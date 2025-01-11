import { report } from './report';
import { config } from './config';
import { tokens } from './token';
import { createWriteStream } from 'fs';
import { createCanvas } from 'canvas';
import { POS, RGB, setIntervalImmediately, tokenToUint8Array, uintToUint8Array } from './utils';
import { socket } from './socket';

export enum PaintStatus {
    PENDING,
    PAINTING,
    SUCCESS,
    ALREADY_PAINTED,
    COOLING,
    TOKEN_INVALID,
    REQUEST_FAILED,
    NO_PERMISSION,
    SERVER_ERROR,
    UNKNOWN_ERROR,
};

export class PaintEvent {
    uid?: number;

    constructor(public readonly pos: POS, public readonly color: RGB, public status: number) { }

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
    const canvas = createCanvas(config.pb.width, config.pb.height);
    const ctx = canvas.getContext('2d');
    for (let x = 0; x < config.pb.width; x++) {
        for (let y = 0; y < config.pb.height; y++) {
            ctx.fillStyle = painter.boardData.get(new POS(x, y).toNumber())!.toOutputString();
            ctx.fillRect(x, y, 1, 1);
        }
    }
    const out = createWriteStream('board.jpg');
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

    paint = (pos: POS, color: RGB): void => {
        this.paintEvents.pending.push(new PaintEvent(pos, color, PaintStatus.PENDING));
    }

    startPainting = async (): Promise<void> => {
        await socket.socketOpen;
        setIntervalImmediately(this.refreshPaintboard, config.pb.refresh);
        const ID_MAX = Math.pow(2, 32);
        while (true) {
            await new Promise<void>((resolve) => {
                var intervalId: NodeJS.Timeout;
                intervalId = setIntervalImmediately(() => {
                    if (this.paintEvents.pending.length > 0) {
                        clearInterval(intervalId);
                        resolve();
                        return;
                    }
                }, 100);
            });
            const [uid, token] = await tokens.getAvailableToken();
            const paintEvent: PaintEvent = this.paintEvents.pending.splice(config.pb.random ? Math.floor(Math.random() * this.paintEvents.pending.length) : 0, 1)[0]!;
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
            const res = await fetch(`${config.socket.http}/api/pb/getboard`);
            const byteArray = new Uint8Array(await res.arrayBuffer());
            if (byteArray.length !== config.pb.width * config.pb.height * 3) {
                report.paintboardRefresh('Paintboard data length mismatch.');
            }
            for (let y = 0; y < config.pb.height; y++) {
                for (let x = 0; x < config.pb.width; x++) {
                    this.boardData.set(new POS(x, y).toNumber(), new RGB(
                        byteArray[y * config.pb.width * 3 + x * 3]!,
                        byteArray[y * config.pb.width * 3 + x * 3 + 1]!,
                        byteArray[y * config.pb.width * 3 + x * 3 + 2]!
                    ));
                }
            }
            report.paintboardRefresh();
            await saveToImage();
        } catch (err) {
            report.paintboardRefresh(err as string);
        }
    };
}

export const painter = new Painter();
