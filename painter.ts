import { log } from './report.js';
import config from './config.js';
import { tokenManager } from './token.js';
// import { createWriteStream } from 'fs';
// import { createCanvas } from 'canvas';
import { tokenToUint8Array, uintToUint8Array } from './utils.js';
import { socketManager } from './socket.js';
import { WebSocket } from 'ws';

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
    r: number;
    g: number;
    b: number;
    x: number;
    y: number;
    uid?: number;
    status: number;
}

export class PaintEvents {
    pending: PaintEvent[];
    painting: Map<number, PaintEvent>;
    done: PaintEvent[];
}

const saveToImage = async () => {
    // const canvas = createCanvas(config.width, config.height);
    // const ctx = canvas.getContext('2d');
    // for (let x = 0; x < config.width; x++) {
    //     for (let y = 0; y < config.height; y++) {
    //         const { r, g, b } = boardData[x * config.width + y];
    //         ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    //         ctx.fillRect(x, y, 1, 1);
    //     }
    // }
    // const out = createWriteStream('board.jpeg');
    // const stream = canvas.createJPEGStream();
    // stream.pipe(out);
    // await new Promise((resolve) => {
    //     out.on('finish', resolve);
    // });
}

export class Painter {
    boardData: { r: number, g: number, b: number }[];
    paintEvents: PaintEvents;

    paint(r: number, g: number, b: number, x: number, y: number) {
        this.paintEvents.pending.push({ r, g, b, x, y, status: PaintStatus.PENDING });
    }

    async startPainting() {
        const ID_MAX = Math.pow(2, 32);
        while (true) {
            await new Promise<void>((resolve) => {
                var intervalId: number | null = null;
                const check = () => {
                    if (socketManager.paintboardSocket.readyState === WebSocket.OPEN && this.paintEvents.pending.length > 0) {
                        intervalId && clearInterval(intervalId);
                        resolve();
                        return;
                    }
                };
                check();
                intervalId = setInterval(check, 100);
            });
            const [uid, token] = await tokenManager.getAvailableToken();
            const paintEvent: PaintEvent = this.paintEvents.pending.shift()!;
            const { r, g, b, x, y } = paintEvent;
            const currentData = this.boardData[x * config.width + y];
            if (currentData.r === r && currentData.g === g && currentData.b === b) {
                paintEvent.status = PaintStatus.ALREADY_PAINTED;
                this.paintEvents.done.push(paintEvent);
                continue;
            }
            const id = Math.floor(Math.random() * ID_MAX);
            paintEvent.uid = uid;
            paintEvent.status = PaintStatus.PAINTING;
            this.paintEvents.painting[id] = paintEvent;

            tokenManager.setInfo(uid, `(${x}, ${y}) => (${r}, ${g}, ${b})`);

            const paintData = new Uint8Array([
                0xfe,
                ...uintToUint8Array(x, 2),
                ...uintToUint8Array(y, 2),
                r, g, b,
                ...uintToUint8Array(uid, 3),
                ...tokenToUint8Array(token),
                ...uintToUint8Array(id, 4),
            ]);
            tokenManager.useToken(uid);
            socketManager.paintboardSocket.send(paintData);
        }
    }

    refreshBoard = async () => {
        try {
            const res = await fetch(`${config.httpsUrl}/api/paintboard/getboard`);
            const byteArray = new Uint8Array(await res.arrayBuffer());
            for (let y = 0; y < config.height; y++) {
                for (let x = 0; x < config.width; x++) {
                    this.boardData[x * config.width + y] = {
                        r: byteArray[y * config.width * 3 + x * 3],
                        g: byteArray[y * config.width * 3 + x * 3 + 1],
                        b: byteArray[y * config.width * 3 + x * 3 + 2],
                    };
                }
            }
            log("画板已刷新。");
            await saveToImage();
        } catch (err) {
            log(`刷新画板失败：${err.message}。`);
        }
    };
}

export const painter = new Painter();
painter.startPainting();
