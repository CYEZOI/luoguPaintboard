import WebSocket from 'ws';
import { boardData, PaintEvents, PaintStatus, refreshBoard } from './painter';
import config from './config';
import { log } from './report';
import { tokenManager } from './token';

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

export class SocketManager {
    lastHeartbeatTime: Date | null;
    paintboardSocket: WebSocket;
    paintEvents: PaintEvents;

    constructor() {
        this.lastHeartbeatTime = null;
        this.paintboardSocket = new WebSocket(config.wsUrl);
        this.setupSocket();
    }

    setupSocket() {
        this.paintboardSocket.binaryType = "arraybuffer";
        this.paintboardSocket.onopen = () => {
            refreshBoard();
        };

        this.paintboardSocket.onmessage = (event: MessageEvent) => this.handleMessage(event);

        this.paintboardSocket.onerror = (err: Error) => {
            console.error(`WebSocket 出错：${err.message}。`);
        };
        this.paintboardSocket.onclose = (reason: CloseEvent) => {
            console.error(`WebSocket 关闭：${reason.code} ${reason.reason}。`);
        };
    }

    async handleMessage(event: MessageEvent<ArrayBuffer>) {
        const buffer = event.data;
        const dataView = new DataView(buffer);

        let offset = 0;
        while (offset < buffer.byteLength) {
            const type = dataView.getUint8(offset);
            offset += 1;
            switch (type) {
                case WebSocketMessageTypes.PIXEL: {
                    const x = dataView.getUint16(offset, true);
                    const y = dataView.getUint16(offset + 2, true);
                    const colorR = dataView.getUint8(offset + 4);
                    const colorG = dataView.getUint8(offset + 5);
                    const colorB = dataView.getUint8(offset + 6);
                    offset += 7;
                    log(`收到像素点 (${x}, ${y}) 的颜色：rgb(${colorR}, ${colorG}, ${colorB})。`);
                    boardData[x * config.width + y] = { r: colorR, g: colorG, b: colorB };
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
                    const paintEvent = this.paintEvents.painting[id];
                    this.paintEvents.painting[id] = undefined;
                    switch (code) {
                        case WebSocketMessageCodes.SUCCESS:
                            paintEvent.status = PaintStatus.SUCCESS;
                            break;
                        case WebSocketMessageCodes.COOLING:
                            paintEvent.status = PaintStatus.COOLING;
                            tokenManager.updateUseTime(paintEvent.uid, new Date(new Date().getTime() - 1000 * (config.cd - config.cdRetry)));
                            break;
                        case WebSocketMessageCodes.TOKEN_INVALID:
                            paintEvent.status = PaintStatus.TOKEN_INVALID;
                            await tokenManager.fetchToken(paintEvent.uid);
                            tokenManager.updateUseTime(paintEvent.uid, new Date(new Date().getTime() - 1000 * (config.cd - config.cdRetry)));
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
                            log(`未知的返回码：${code}`);
                    }
                    this.paintEvents.done.push(paintEvent);
                    break;
                }
                default:
                    log(`未知的消息类型：${type}`);
            }
        }
    }
}

export const socketManager = new SocketManager();
