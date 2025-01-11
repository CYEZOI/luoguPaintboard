import WebSocket from 'ws';
import { config } from './config';
import { tokens } from './token';
import { painter, PaintEvent, PaintStatus } from './painter';
import { report } from './report';
import { POS, RGB, setIntervalImmediately } from './utils';
import { images } from './image';

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
    public paintboardSocket: WebSocket;
    public readonly socketOpen: Promise<void>;
    private readonly sendQueue: ArrayBuffer[] = [];

    constructor() {
        this.paintboardSocket = new WebSocket(config.socket.ws);
        this.setupSocket();
        this.socketOpen = new Promise((resolve) => {
            this.paintboardSocket.onopen = () => {
                resolve();
            };
        });
    }

    setupSocket() {
        this.paintboardSocket.binaryType = 'arraybuffer';

        this.paintboardSocket.addEventListener('message', (event: WebSocket.MessageEvent) => (async () => {
            await this.handleMessage(event);
        })());
        this.paintboardSocket.addEventListener('error', (err: WebSocket.ErrorEvent) => { report.log(`WebSocket 出错：${err.message}。`); });
        this.paintboardSocket.addEventListener('close', (reason: WebSocket.CloseEvent) => {
            report.log(`WebSocket closed: ${reason.code} ${reason.reason}。`);
            setTimeout(() => {
                report.log('Reconnecting...');
                this.paintboardSocket = new WebSocket(config.socket.ws);
                this.setupSocket();
            });
        });
    }

    async handleMessage(event: WebSocket.MessageEvent) {
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
                    painter.boardData.set(pos.toNumber(), color);
                    images.checkColor(pos, color);
                    break;
                }
                case WebSocketMessageTypes.HEARTBEAT: {
                    this.paintboardSocket.send(new Uint8Array([0xfb]));
                    report.heatBeat();
                    break;
                }
                case WebSocketMessageTypes.PAINT_RESULT: {
                    const id = dataView.getUint32(offset, true);
                    const code = dataView.getUint8(offset + 4);
                    offset += 5;
                    const paintEvent = painter.paintEvents.painting.get(id)!;
                    painter.paintEvents.painting.delete(id);
                    switch (code) {
                        case WebSocketMessageCodes.SUCCESS:
                            paintEvent.status = PaintStatus.SUCCESS;
                            break;
                        case WebSocketMessageCodes.COOLING:
                            paintEvent.status = PaintStatus.COOLING;
                            tokens.updateUseTime(paintEvent.uid!, new Date(new Date().getTime() - (config.pb.cd - config.pb.retryCd)));
                            break;
                        case WebSocketMessageCodes.TOKEN_INVALID:
                            paintEvent.status = PaintStatus.TOKEN_INVALID;
                            await tokens.getToken(paintEvent.uid!)!.fetchToken();
                            tokens.updateUseTime(paintEvent.uid!, new Date(new Date().getTime() - (config.pb.cd - config.pb.retryCd)));
                            break;
                        case WebSocketMessageCodes.REQUEST_FAILED:
                            paintEvent.status = PaintStatus.REQUEST_FAILED;
                            break;
                        case WebSocketMessageCodes.NO_PERMISSION:
                            paintEvent.status = PaintStatus.NO_PERMISSION;
                            break;
                        case WebSocketMessageCodes.SERVER_ERROR:
                            paintEvent.status = PaintStatus.SERVER_ERROR;
                            break;
                        default:
                            paintEvent.status = PaintStatus.UNKNOWN_ERROR;
                            report.log(`Unknown paint status: ${code}`);
                    }
                    painter.paintEvents.done.push(paintEvent);
                    if (paintEvent.status !== PaintStatus.SUCCESS) {
                        painter.paintEvents.pending.push(new PaintEvent(paintEvent.pos, paintEvent.color, PaintStatus.PENDING));
                    }
                    break;
                }
                default:
                    report.log(`Unknown message type: ${type}`);
            }
        }
    }

    send(buffer: ArrayBuffer) {
        this.sendQueue.push(buffer);
    }

    startSending() {
        setIntervalImmediately(() => {
            if (this.paintboardSocket.readyState === WebSocket.OPEN) {
                const tempQueue = this.sendQueue.splice(0, this.sendQueue.length);
                if (tempQueue.length === 0) {
                    return;
                }
                if (config.socket.batch) {
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
        }, 100);
    }
}

export const socket = new Socket();
