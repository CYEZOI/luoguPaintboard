import { report } from './report';
import { config } from './config';
import { tokens } from './token';
import { createWriteStream } from 'fs';
import { createCanvas } from 'canvas';
import { POS, RGB, tokenToUint8Array, uintToUint8Array } from './utils';
import { socket } from './socket';

export const PaintStatus = {
    PENDING: -1,
    PAINTING: 0,
    SUCCESS: 1,
    ALREADY_PAINTED: 2,
    COOLING: 10,
    TOKEN_INVALID: 11,
    REQUEST_FAILED: 12,
    NO_PERMISSION: 13,
    SERVER_ERROR: 14,
    UNKNOWN_ERROR: 15,
};

export class PaintEvent {
    color: RGB;
    pos: POS;
    uid?: number;
    status: number;

    constructor(color: RGB, pos: POS, status: number) {
        this.color = color;
        this.pos = pos;
        this.status = status;
    }

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

const saveToImage = async () => {
    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');
    for (let x = 0; x < config.width; x++) {
        for (let y = 0; y < config.height; y++) {
            ctx.fillStyle = painter.boardData.get(new POS(x, y).toNumber())!.toOutputString();
            ctx.fillRect(x, y, 1, 1);
        }
    }
    const out = createWriteStream('board.jpeg');
    const stream = canvas.createJPEGStream();
    stream.pipe(out);
    await new Promise((resolve) => {
        out.on('finish', resolve);
    });
}

export class Painter {
    public readonly boardData: Map<number, RGB> = new Map();
    public readonly paintEvents: PaintEvents = {
        pending: [],
        painting: new Map(),
        done: [],
    }

    paint = (color: RGB, pos: POS): void => {
        this.paintEvents.pending.push(new PaintEvent(color, pos, PaintStatus.PENDING));
    }

    startPainting = async (): Promise<void> => {
        await socket.socketOpen;
        await this.refreshPaintboard();
        const ID_MAX = Math.pow(2, 32);
        while (true) {
            await new Promise<void>((resolve) => {
                var intervalId: NodeJS.Timeout | null = null;
                const check = () => {
                    if (this.paintEvents.pending.length > 0) {
                        intervalId && clearInterval(intervalId);
                        resolve();
                        return;
                    }
                };
                check();
                intervalId = setInterval(check, 100);
            });
            const [uid, token] = await tokens.getAvailableToken();
            const paintEvent: PaintEvent = this.paintEvents.pending.shift()!;
            const { color, pos } = paintEvent;
            const currentData = this.boardData.get(pos.toNumber());
            if (currentData && currentData.toOutputString() == color.toOutputString()) {
                paintEvent.status = PaintStatus.ALREADY_PAINTED;
                this.paintEvents.done.push(paintEvent);
                continue;
            }
            const id = Math.floor(Math.random() * ID_MAX);
            paintEvent.uid = uid;
            paintEvent.status = PaintStatus.PAINTING;
            this.paintEvents.painting.set(id, paintEvent);

            tokens.setInfo(uid, paintEvent.toOutputString());

            const paintData = new Uint8Array([
                0xfe,
                ...pos.toUint8Array(),
                ...color.toUint8Array(),
                ...uintToUint8Array(uid, 3),
                ...tokenToUint8Array(token),
                ...uintToUint8Array(id, 4),
            ]);
            tokens.useToken(uid);
            socket.send(paintData);
        }
    }

    refreshPaintboard = async () => {
        try {
            const res = await fetch(`${config.httpsUrl}/api/paintboard/getboard`);
            const byteArray = new Uint8Array(await res.arrayBuffer());
            if (byteArray.length !== config.width * config.height * 3) {
                report.paintboardRefresh('Paintboard data length mismatch.');
            }
            for (let y = 0; y < config.height; y++) {
                for (let x = 0; x < config.width; x++) {
                    this.boardData.set(new POS(x, y).toNumber(), new RGB(
                        byteArray[y * config.width * 3 + x * 3]!,
                        byteArray[y * config.width * 3 + x * 3 + 1]!,
                        byteArray[y * config.width * 3 + x * 3 + 2]!
                    ));
                }
            }
            report.paintboardRefresh();
            await saveToImage();
        } catch (err) {
            report.log((err as Error).message);
        }
    };
}

export const painter = new Painter();
