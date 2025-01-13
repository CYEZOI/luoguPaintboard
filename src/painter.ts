import { config } from './config';
import { tokens } from './token';
import { POS, RGB, setIntervalImmediately, tokenToUint8Array, uintToUint8Array } from './utils';
import { socket } from './socket';
import { prisma } from './db';
import { logger } from './logger';
import { PrismaClient } from '@prisma/client';
import { closing } from './signal';

const painterLogger = logger.child({ module: 'painter' });

export enum PaintEventStatus {
    PENDING,
    PAINTING,
    DONE,
};

export class Painter {
    constructor(private readonly prismaPainter: PrismaClient['paintEvent']) { }

    paint = async (events: { pos: POS, rgb: RGB }[]): Promise<void> => {
        await this.prismaPainter.createMany({
            data: events.map(event => ({
                pos: event.pos.toNumber(), rgb: event.rgb.toNumber(),
                status: PaintEventStatus.PENDING, random: Math.random(),
            })),
        });
    };

    startPainting = async (): Promise<void> => {
        await socket.socketOpen;
        while (!closing) {
            await setIntervalImmediately(async (stop) => {
                const paintEvent = await this.prismaPainter.findFirst({ where: { status: PaintEventStatus.PENDING } });
                if (paintEvent) { stop(); }
            }, 100);
            const tokenList = await setIntervalImmediately(async (stop) => {
                const tokenList = await tokens.getAvailableTokens();
                if (tokenList.length) { stop(tokenList); }
            }, 100);
            const paintEvents = (
                config.painter.random ?
                    await this.prismaPainter.findMany({ where: { status: PaintEventStatus.PENDING }, orderBy: { random: 'asc' }, take: tokenList.length }) :
                    await this.prismaPainter.findMany({ where: { status: PaintEventStatus.PENDING }, take: tokenList.length })
            )!;
            const usedUid = new Array<number>();
            for (const paintEvent of paintEvents) {
                const { uid, token } = tokenList.shift()!;
                usedUid.push(uid);
                painterLogger.debug(`Painting ${paintEvent.id}, uid: ${uid} (${token}), pos: ${paintEvent.pos.toString()}, rgb: ${paintEvent.rgb.toString()}`);

                await this.prismaPainter.update({
                    where: { id: paintEvent.id },
                    data: { status: PaintEventStatus.PAINTING, uid },
                });

                const paintData = new Uint8Array([
                    0xfe,
                    ...POS.fromNumber(paintEvent.pos).toUint8Array(),
                    ...RGB.fromNumber(paintEvent.rgb).toUint8Array(),
                    ...uintToUint8Array(uid, 3),
                    ...tokenToUint8Array(token),
                    ...uintToUint8Array(paintEvent.id, 4),
                ]);
                socket.send(paintData.buffer);
            }
            await tokens.updateUseTime(usedUid, new Date());
            painterLogger.info(`Painted ${paintEvents.length} pixels`);
        }
    };

    donePainting = async (id: number, result: number): Promise<void> => {
        await this.prismaPainter.update({
            where: { id },
            data: { status: PaintEventStatus.DONE, result }
        });
    };
    getPaintEvent = async (id: number) => { return await this.prismaPainter.findUnique({ where: { id } }); };
    clear = async () => { await this.prismaPainter.deleteMany(); };
    moveAllPaintingToPending = async () => {
        await this.prismaPainter.updateMany({
            where: { status: PaintEventStatus.PAINTING },
            data: { status: PaintEventStatus.PENDING }
        });
    };
};

export const painter = new Painter(prisma.paintEvent);
