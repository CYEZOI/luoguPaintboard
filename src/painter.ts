import { config } from './config';
import { tokens } from './token';
import { POS, RGB, setIntervalImmediately, tokenToUint8Array, uintToUint8Array } from './utils';
import { socket } from './socket';
import { prisma } from './db';

export enum PaintEventStatus {
    PENDING,
    PAINTING,
    DONE,
}

export class Painter {
    paint = async (pos: POS, rgb: RGB): Promise<void> => {
        await prisma.paintEvent.create({
            data: {
                pos: pos.toNumber(), rgb: rgb.toNumber(),
                status: PaintEventStatus.PENDING, random: Math.random(),
            },
        });
    }

    startPainting = async (): Promise<void> => {
        await socket.socketOpen;
        while (true) {
            await new Promise<void>((resolve) => {
                var intervalId: NodeJS.Timeout;
                intervalId = setIntervalImmediately(async () => {
                    const paintEvent = await prisma.paintEvent.findFirst({ where: { status: PaintEventStatus.PENDING } });
                    if (paintEvent) { clearInterval(intervalId); resolve(); }
                }, 100);
            });
            const { uid, token } = await new Promise<{ uid: number, token: string }>((resolve) => {
                var intervalId: NodeJS.Timeout;
                intervalId = setIntervalImmediately(async () => {
                    const token = await tokens.getAvailableToken();
                    if (token) { clearInterval(intervalId); resolve(token); }
                }, 100);
            });
            const paintEvent = (
                config.painter.random ?
                    await prisma.paintEvent.findFirst({ where: { status: PaintEventStatus.PENDING }, orderBy: { random: 'asc' } })
                    : await prisma.paintEvent.findFirst({ where: { status: PaintEventStatus.PENDING } })
            )!;
            await prisma.paintEvent.update({
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
            tokens.updateUseTime(uid, new Date());
            socket.send(paintData.buffer);
        }
    }
}

export const painter = new Painter();
