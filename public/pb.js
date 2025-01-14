import { config } from './config.js';

export class PB {
    refreshing = false;
    pendingQueue = [];
    paintboard = document.getElementById('paintboard');

    constructor() {
        paintboard.width = config.pb.width;
        paintboard.height = config.pb.height;
    }

    setBoardData = (pos, color) => {
        const ctx = paintboard.getContext('2d');
        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.fillRect(pos.x, pos.y, 1, 1);
    }

    update = (pos, color) => {
        if (this.refreshing) { this.pendingQueue.push([pos, color]); }
        else { this.setBoardData(pos, color); }
    }

    refreshPaintboard = async () => {
        this.refreshing = true;
        try {
            const res = await fetch(`${config.socket.http}/api/paintboard/getboard`);
            if (res.status !== 200) { throw 'Paintboard data fetch failed.'; }
            const byteArray = new Uint8Array(await res.arrayBuffer());
            if (byteArray.length !== config.pb.width * config.pb.height * 3) { throw 'Paintboard data length mismatch.'; }
            for (let y = 0; y < config.pb.height; y++) {
                for (let x = 0; x < config.pb.width; x++) {
                    this.setBoardData({ x, y }, {
                        r: byteArray[y * config.pb.width * 3 + x * 3],
                        g: byteArray[y * config.pb.width * 3 + x * 3 + 1],
                        b: byteArray[y * config.pb.width * 3 + x * 3 + 2]
                    });
                }
            }
        }
        catch (err) {
            console.error(`Failed to refresh paintboard: ${err}`);
        }
        while (this.pendingQueue.length > 0) {
            const [pos, color] = this.pendingQueue.shift();
            this.setBoardData(pos, color);
        }
        this.refreshing = false;
    }

    setupSocket = () => {
        const paintboardSocket = new WebSocket(config.socket.ws);
        paintboardSocket.onmessage = async (e) => {
            /*    handleMessage = async (event: WebSocket.MessageEvent) => {
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
                            await tokens.updateUseTime([paintEvent.uid!], new Date(new Date().getTime() - (config.token.cd - config.painter.retry)));
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
    };*/
            const dataview = new DataView(await e.data.arrayBuffer());
            let offset = 0;
            while (offset < dataview.byteLength) {
                const type = dataview.getUint8(offset);
                offset += 1;
                switch (type) {
                    case 0xfa: {
                        const x = dataview.getUint16(offset, true);
                        const y = dataview.getUint16(offset + 2, true);
                        const pos = { x, y };
                        const color = {
                            r: dataview.getUint8(offset + 4),
                            g: dataview.getUint8(offset + 5),
                            b: dataview.getUint8(offset + 6)
                        };
                        offset += 7;
                        this.update(pos, color);
                        break;
                    }
                    case 0xfc: {
                        paintboardSocket.send(new Uint8Array([0xfb]));
                        break;
                    }
                    default: {
                        console.error(`Unknown message type: ${type}`);
                    }
                }
            }
        };
        paintboardSocket.onclose = () => {
            console.error('Paintboard socket closed.');
            setTimeout(() => { this.setupSocket(); }, 1000);
        };
    }
};

export const pb = new PB();
