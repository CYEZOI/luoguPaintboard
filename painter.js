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

export const paintEvents = {
    pending: [],
    painting: new Map(),
    done: [],
};

const ID_MAX = Math.pow(2, 32);
export const paint = (r, g, b, x, y) => {
    paintEvents.pending.push({ r, g, b, x, y, status: paintStatus.PENDING });
}

setTimeout(async () => {
    while (true) {
        await new Promise((resolve) => {
            const painterInterval = setInterval(() => {
                if (paintboardSocket.readyState === WebSocket.OPEN && paintEvents.pending.length > 0) {
                    clearInterval(painterInterval);
                    resolve();
                }
            }, config.cd / tokenStatus.availableCount);
        });
        const [uid, token] = await getAvailableToken();
        const paintEvent = paintEvents.pending.shift();
        const { r, g, b, x, y } = paintEvent;
        const currentData = boardData[x * config.width + y];
        if (currentData.r === r && currentData.g === g && currentData.b === b) {
            paintEvents.status = paintStatus.ALREADY_PAINTED;
            paintEvents.done.push(paintEvent);
            continue;
        }
        const id = Math.floor(Math.random() * ID_MAX);
        paintEvent.uid = uid;
        paintEvent.status = paintStatus.PAINTING;
        paintEvents.painting[id] = paintEvent;

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
        paintboardSocket.send(paintData);
    }
}, 0);
