import { config } from './config';
import { tokens } from './token';
import { POS, RGB, setIntervalImmediately, tokenToUint8Array, uintToUint8Array } from './utils';
import { socket } from './socket';

export class PaintEvent {
    uid?: number;
    status?: number;

    constructor(public readonly pos: POS, public readonly color: RGB) { }

    toOutputString = (withUid: boolean = false): string => {
        var message = '';
        if (withUid) {
            message += (this.uid?.toString().padEnd(7) || ' '.repeat(7)) + ' ';
        }
        message += `${this.pos.toOutputString()} -> ${this.color.toOutputString()}`;
        return message;
    }
};

export type PaintEvents = {
    pending: PaintEvent[];
    painting: Map<number, PaintEvent>;
    done: PaintEvent[];
};

export class Painter {
    public readonly paintEvents: PaintEvents = {
        pending: [],
        painting: new Map(),
        done: [],
    }

    paint = (pos: POS, color: RGB): void => {
        this.paintEvents.pending.push(new PaintEvent(pos, color));
    }

    startPainting = async (): Promise<void> => {
        await socket.socketOpen;
        const ID_MAX = Math.pow(2, 32);
        while (true) {
            await new Promise<void>((resolve) => {
                var intervalId: NodeJS.Timeout;
                intervalId = setIntervalImmediately(() => {
                    if (this.paintEvents.pending.length > 0) { clearInterval(intervalId); resolve(); }
                }, 100);
            });
            const { uid, token } = await new Promise<{ uid: number, token: string }>((resolve) => {
                var intervalId: NodeJS.Timeout;
                intervalId = setIntervalImmediately(async () => {
                    const token = await tokens.getAvailableToken();
                    if (token) { clearInterval(intervalId); resolve(token); }
                }, 100);
            });
            const paintEvent: PaintEvent = this.paintEvents.pending.splice(config.painter.random ? Math.floor(Math.random() * this.paintEvents.pending.length) : 0, 1)[0]!;
            const { color, pos } = paintEvent;
            var id = Math.floor(Math.random() * ID_MAX);
            while (this.paintEvents.painting.has(id)) {
                id = Math.floor(Math.random() * ID_MAX);
            }
            paintEvent.uid = uid;
            this.paintEvents.painting.set(id, paintEvent);

            const paintData = new Uint8Array([
                0xfe,
                ...pos.toUint8Array(),
                ...color.toUint8Array(),
                ...uintToUint8Array(uid, 3),
                ...tokenToUint8Array(token),
                ...uintToUint8Array(id, 4),
            ]);
            tokens.updateUseTime(uid, new Date());
            socket.send(paintData.buffer);
        }
    }
}

export const painter = new Painter();
