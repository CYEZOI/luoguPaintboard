import { config } from './config';
import { tokens } from './token';
import { POS, RGB, setIntervalImmediately, tokenToUint8Array, uintToUint8Array } from './utils';
import { socket } from './socket';
import { logger } from './logger';
import { closing } from './signal';

const painterLogger = logger.child({ module: 'painter' });
const ID_MAX = Math.pow(2, 32);

export class Painter {
    constructor() { }
    private paintQueue: { pos: POS, rgb: RGB }[] = [];
    private paintingQueue: Map<number, { uid: number, pos: POS, rgb: RGB }> = new Map();

    paint = async (events: { pos: POS, rgb: RGB }[]): Promise<void> => { this.paintQueue.push(...events); };

    startPainting = async (): Promise<void> => {
        await socket.socketOpen;
        while (!closing) {
            await setIntervalImmediately(async (stop) => {
                if (closing || this.paintQueue.length) { stop(); }
            }, 100);
            if (closing) { break; }
            const tokenList = await setIntervalImmediately(async (stop) => {
                const tokenList = await tokens.getAvailableTokens();
                if (closing || tokenList.length) { stop(tokenList); }
            }, 100);
            if (closing) { break; }
            const usedUid = new Array<number>();
            for (const tokenData of tokenList) {
                const { uid, token } = tokenData;
                usedUid.push(uid);

                if (!this.paintQueue.length) { break; }
                const paintEvent = this.paintQueue.splice(config.painter.random ? Math.floor(Math.random() * this.paintQueue.length) : 0, 1)[0]!;
                painterLogger.debug(`Painting uid: ${uid} (${token}), pos: ${paintEvent.pos.toString()}, rgb: ${paintEvent.rgb.toString()}`);

                const id = Math.floor(Math.random() * ID_MAX);
                this.paintingQueue.set(id, { uid, pos: paintEvent.pos, rgb: paintEvent.rgb });

                const paintData = new Uint8Array([
                    0xfe,
                    ...paintEvent.pos.toUint8Array(),
                    ...paintEvent.rgb.toUint8Array(),
                    ...uintToUint8Array(uid, 3),
                    ...tokenToUint8Array(token),
                    ...uintToUint8Array(id, 4),
                ]);
                socket.send(paintData.buffer);
            }

            await tokens.updateUseTime(usedUid, new Date());
            painterLogger.info(`Painted ${usedUid.length} pixels`);
        }
    };

    donePainting = async (id: number, result: number): Promise<void> => {
        const paintEvent = this.paintingQueue.get(id);
        if (paintEvent) {
            this.paintingQueue.delete(id);
            painterLogger.debug(`Paint done, pos: ${paintEvent.pos.toOutputString()}, rgb: ${paintEvent.rgb.toOutputString()}, result: ${result}`);
        }
    };
    getPaintEvent = async (id: number) => { return this.paintingQueue.get(id); };
    moveAllPaintingToPending = async () => { this.paintQueue.push(...Array.from(this.paintingQueue.values())); this.paintingQueue.clear(); };
    clearPaintQueue = async () => { this.paintQueue = []; };
};

export const painter = new Painter();
