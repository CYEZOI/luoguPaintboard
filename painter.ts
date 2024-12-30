import { log } from './report.js';
import config from './config.js';
import { getAvailableToken, tokenStatus, useToken } from './token.js';
import { createWriteStream } from 'fs';
import { createCanvas } from 'canvas';
import { paintStatus, tokenToUint8Array, uintToUint8Array } from './utils.js';
import { paintboardSocket } from './socket.js';
import { WebSocket } from 'ws';

export const boardData = new Array(config.width * config.height).fill({ r: 0, g: 0, b: 0 });

const saveToImage = async () => {
    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');
    for (let x = 0; x < config.width; x++) {
        for (let y = 0; y < config.height; y++) {
            const { r, g, b } = boardData[x * config.width + y];
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
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

export const refreshBoard = async () => {
    try {
        const res = await fetch(`${config.httpsUrl}/api/paintboard/getboard`);
        const byteArray = new Uint8Array(await res.arrayBuffer());
        for (let y = 0; y < config.height; y++) {
            for (let x = 0; x < config.width; x++) {
                boardData[x * config.width + y] = {
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

export class Painter {
    constructor(boardData, config, tokenManager, paintboardSocket) {
        this.boardData = boardData;
        this.config = config;
        this.tokenManager = tokenManager;
        this.paintboardSocket = paintboardSocket;
        this.paintEvents = {
            pending: [],
            painting: new Map(),
            done: [],
        };
    }

    paint(r, g, b, x, y) {
        this.paintEvents.pending.push({ r, g, b, x, y, status: paintStatus.PENDING });
    }

    async startPainting() {
        const ID_MAX = Math.pow(2, 32);
        while (true) {
            if (this.paintboardSocket.readyState !== WebSocket.OPEN || this.paintEvents.pending.length <= 0) {
                await new Promise((resolve) => {
                    const painterInterval = setInterval(() => {
                        if (this.paintboardSocket.readyState === WebSocket.OPEN && this.paintEvents.pending.length > 0) {
                            clearInterval(painterInterval);
                            resolve();
                        }
                    }, 100);
                });
            }
            const [uid, token] = await getAvailableToken();
            const paintEvent = this.paintEvents.pending.shift();
            const { r, g, b, x, y } = paintEvent;
            const currentData = this.boardData[x * this.config.width + y];
            if (currentData.r === r && currentData.g === g && currentData.b === b) {
                paintEvent.status = paintStatus.ALREADY_PAINTED;
                this.paintEvents.done.push(paintEvent);
                continue;
            }
            const id = Math.floor(Math.random() * ID_MAX);
            paintEvent.uid = uid;
            paintEvent.status = paintStatus.PAINTING;
            this.paintEvents.painting[id] = paintEvent;

            tokenStatus.tokens[uid].info = `(${x}, ${y}) => (${r}, ${g}, ${b})`;

            const paintData = new Uint8Array([
                0xfe,
                ...uintToUint8Array(x, 2),
                ...uintToUint8Array(y, 2),
                r, g, b,
                ...uintToUint8Array(uid, 3),
                ...tokenToUint8Array(token),
                ...uintToUint8Array(id, 4),
            ]);
            useToken(uid);
            this.paintboardSocket.send(paintData);
        }
    }
}

export const painter = new Painter(boardData, config, tokenStatus, paintboardSocket);

setTimeout(async () => {
    await painter.startPainting();
}, 0);
