import WebSocket from 'ws';
import { config } from './config';
import { tokens } from './token';
import { painter } from './painter';
import { POS, RGB, setIntervalImmediately } from './utils';
import { images } from './image';
import { pb } from './pb';
import { logger } from './logger';
import { closing } from './signal';

const socketLogger = logger.child({ module: 'socket' });

const WebSocketMessageTypes = {
    PIXEL: 0xfa,
    HEARTBEAT: 0xfc,
    PAINT_RESULT: 0xff,
};

const WebSocketMessageCodes = {
    SUCCESS: 0xef,
    COOLING: 0xee,
    TOKEN_INVALID: 0xed,
    REQUEST_FAILED: 0xec,
    NO_PERMISSION: 0xeb,
    SERVER_ERROR: 0xea,
};

export class Socket {
    public paintboardSocket!: WebSocket;
    public readonly socketOpen: Promise<void>;
    private readonly sendQueue: ArrayBuffer[] = [];

    constructor() {
        this.setupSocket();
        this.socketOpen = new Promise((resolve) => {
            this.paintboardSocket.addEventListener('open', async () => {
                socketLogger.info('WebSocket opened');
                resolve();
            });
        });
    }

    setupSocket = () => {
        this.paintboardSocket = new WebSocket(config.config.socket.ws);
        this.paintboardSocket.binaryType = 'arraybuffer';

        this.paintboardSocket.addEventListener('message', async (event: WebSocket.MessageEvent) => {
            await this.handleMessage(event);
        });
        this.paintboardSocket.addEventListener('error', async (err: WebSocket.ErrorEvent) => {
            socketLogger.error(`WebSocket error: ${err.message}`);
        });
        this.paintboardSocket.addEventListener('close', async (reason: WebSocket.CloseEvent) => {
            socketLogger.error(`WebSocket closed: ${reason.code} ${reason.reason}`);
            await painter.moveAllPaintingToPending();
            setTimeout(() => { this.setupSocket(); }, config.config.socket.retry);
        });
    };

    handleMessage = async (event: WebSocket.MessageEvent) => {
        const buffer = event.data as ArrayBuffer;
        const dataView = new DataView(buffer);

        let offset = 0;
        while (offset < buffer.byteLength) {
            const type = dataView.getUint8(offset);
            offset += 1;
            switch (type) {
                case WebSocketMessageTypes.PIXEL: {
                    const x = dataView.getUint16(offset, true);
                    const y = dataView.getUint16(offset + 2, true);
                    const pos = new POS(x, y);
                    const colorR = dataView.getUint8(offset + 4);
                    const colorG = dataView.getUint8(offset + 5);
                    const colorB = dataView.getUint8(offset + 6);
                    const color = new RGB(colorR, colorG, colorB);
                    offset += 7;
                    await pb.update(pos, color);
                    images.checkColor(pos, color);
                    break;
                }
                case WebSocketMessageTypes.HEARTBEAT: {
                    this.paintboardSocket.send(new Uint8Array([0xfb]));
                    socketLogger.debug('Heartbeat');
                    break;
                }
                case WebSocketMessageTypes.PAINT_RESULT: {
                    const id = dataView.getUint32(offset, true);
                    const result = dataView.getUint8(offset + 4);
                    offset += 5;
                    const paintEvent = await painter.getPaintEvent(id);
                    if (!paintEvent) {
                        socketLogger.warn(`Unknown paint event: ${id}`);
                        break;
                    }
                    switch (result) {
                        // @ts-expect-error
                        case WebSocketMessageCodes.TOKEN_INVALID:
                            await tokens.fetchToken([paintEvent.uid!]);
                        case WebSocketMessageCodes.COOLING:
                            await tokens.updateUseTime([paintEvent.uid!], new Date(new Date().getTime() - (config.config.token.cd - config.config.painter.retry)));
                            break;
                    }
                    await painter.donePainting(id, result);
                    if (result !== WebSocketMessageCodes.SUCCESS) {
                        socketLogger.info(`Paint event ${id} failed with result ${result}`);
                        await painter.paint([{ pos: paintEvent.pos, rgb: paintEvent.rgb }]);
                    }
                    break;
                }
                default:
                    socketLogger.warn(`Unknown message type: ${type}`);
            }
        }
    };

    send = (buffer: ArrayBuffer) => {
        this.sendQueue.push(buffer);
    };

    startSending = async () => {
        return await setIntervalImmediately(async (stop) => {
            if (closing) { stop(); return; }
            if (this.paintboardSocket.readyState === WebSocket.OPEN) {
                const tempQueue = this.sendQueue.splice(0, this.sendQueue.length);
                if (tempQueue.length === 0) {
                    return;
                }
                if (config.config.socket.batch) {
                    const buffer = new Uint8Array(tempQueue.reduce((acc, cur) => acc + cur.byteLength, 0));
                    let offset = 0;
                    for (const item of tempQueue) {
                        buffer.set(new Uint8Array(item), offset);
                        offset += item.byteLength;
                    }
                    this.paintboardSocket.send(buffer);
                }
                else {
                    for (const item of tempQueue) {
                        this.paintboardSocket.send(item);
                    }
                }
            }
        }, 5);
    };

    close = () => { this.paintboardSocket.close(); };
};

export const socket = new Socket();
