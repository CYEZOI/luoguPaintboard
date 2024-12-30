import WebSocket from 'ws';
import { painter } from './painter.js';
import config from './config.js';
import { paintStatus } from './utils.js';
import { log } from './report.js';

export class SocketManager {
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

        this.paintboardSocket.onmessage = (event) => this.handleMessage(event);

        this.paintboardSocket.onerror = (err) => {
            console.error(`WebSocket 出错：${err.message}。`);
        };
        this.paintboardSocket.onclose = (err) => {
            const reason = err.reason ? err.reason : "Unknown";
            log(`WebSocket 已经关闭 (${err.code}: ${reason})。`);
        };
    }

    async handleMessage(event) {
        const buffer = event.data;
        const dataView = new DataView(buffer);

        let offset = 0;
        while (offset < buffer.byteLength) {
            const type = dataView.getUint8(offset);
            offset += 1;
            switch (type) {
                case 0xfa: {
                    const x = dataView.getUint16(offset, true);
                    const y = dataView.getUint16(offset + 2, true);
                    const colorR = dataView.getUint8(offset + 4);
                    const colorG = dataView.getUint8(offset + 5);
                    const colorB = dataView.getUint8(offset + 6);
                    offset += 7;
                    log(`收到像素点 (${x}, ${y}) 的颜色：rgb(${colorR}, ${colorG}, ${colorB})。`);
                    boardData[x][y] = { r: colorR, g: colorG, b: colorB };
                    break;
                }
                case 0xfc: {
                    this.paintboardSocket.send(new Uint8Array([0xfb]));
                    this.lastHeartbeatTime = new Date();
                    break;
                }
                case 0xff: {
                    const id = dataView.getUint32(offset, true);
                    const code = dataView.getUint8(offset + 4);
                    offset += 5;
                    const paintEvent = this.paintEvents.painting[id];
                    this.paintEvents.painting[id] = undefined;
                    switch (code) {
                        case 0xef: // 成功
                            paintEvent.status = paintStatus.SUCCESS;
                            break;
                        case 0xee: // 正在冷却
                            paintEvent.status = paintStatus.COOLING;
                            this.tokenManager.tokens[paintEvent.uid].lastUsed = new Date(new Date().getTime() - 1000 * (config.cd - config.cdRetry));
                            break;
                        case 0xed: // Token 无效
                            paintEvent.status = paintStatus.TOKEN_INVALID;
                            await this.tokenManager(paintEvent.uid);
                            this.tokenManager.tokens[paintEvent.uid].lastUsed = new Date(new Date().getTime() - 1000 * (config.cd - config.cdRetry));
                            break;
                        case 0xec: // 请求格式错误
                            paintEvent.status = paintStatus.REQUEST_FAILED;
                            break;
                        case 0xeb: // 无权限
                            paintEvent.status = paintStatus.NO_PERMISSION;
                            break;
                        case 0xea: // 服务器错误
                            paintEvent.status = paintStatus.SERVER_ERROR;
                            break;
                        default:
                            paintEvent.status = paintStatus.UNKNOWN_ERROR;
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
