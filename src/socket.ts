import WebSocket, { CloseEvent, ErrorEvent, MessageEvent } from 'ws';
import config from './config';
import { tokens } from './token';
import { painter, PaintStatus } from './painter';
import { report } from './report';
import { POS, RGB } from './utils';

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
    lastHeartbeatTime: Date | null;
    paintboardSocket: WebSocket;
    socketOpen: Promise<void>;

    constructor() {
        this.lastHeartbeatTime = null;
        this.paintboardSocket = new WebSocket(config.wsUrl);
        this.setupSocket();
        this.socketOpen = new Promise((resolve) => {
            this.paintboardSocket.onopen = () => {
                resolve();
            };
        });
    }

    setupSocket() {
        this.paintboardSocket.binaryType = 'arraybuffer';

        this.paintboardSocket.addEventListener('message', (event: MessageEvent) => this.handleMessage(event));
        this.paintboardSocket.addEventListener('error', (err: ErrorEvent) => { console.error(`WebSocket 出错：${err.message}。`); });
        this.paintboardSocket.addEventListener('close', (reason: CloseEvent) => { console.error(`WebSocket 关闭：${reason.code} ${reason.reason}。`); });
    }

    async handleMessage(event: MessageEvent) {
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
                    report.log(`收到像素点 ${pos.toOutputString()} 的颜色： ${color.toOutputString()}。`);
                    painter.boardData.set(pos, color);
                    break;
                }
                case WebSocketMessageTypes.HEARTBEAT: {
                    this.paintboardSocket.send(new Uint8Array([0xfb]));
                    this.lastHeartbeatTime = new Date();
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
                            tokens.updateUseTime(paintEvent.uid!, new Date(new Date().getTime() - 1000 * (config.cd - config.cdRetry)));
                            break;
                        case WebSocketMessageCodes.TOKEN_INVALID:
                            paintEvent.status = PaintStatus.TOKEN_INVALID;
                            await tokens.fetchToken(paintEvent.uid!);
                            tokens.updateUseTime(paintEvent.uid!, new Date(new Date().getTime() - 1000 * (config.cd - config.cdRetry)));
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
                            report.log(`未知的返回码：${code}`);
                    }
                    painter.paintEvents.done.push(paintEvent);
                    break;
                }
                default:
                    report.log(`未知的消息类型：${type}`);
            }
        }
    }
}

export const socket = new Socket();
