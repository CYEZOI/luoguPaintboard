import { config } from './config.js';
import { setIntervalImmediately } from './utils.js';

export class PB {
    refreshing = false;
    pendingQueue = [];
    paintboard = document.getElementById('paintboard');

    constructor() {
        paintboard.width = config.pb.width;
        paintboard.height = config.pb.height;

        this.setupSocket();
        setIntervalImmediately(async () => { this.refreshPaintboard(); }, config.pb.refresh);
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
            const ctx = paintboard.getContext('2d');
            const imageData = ctx.getImageData(0, 0, config.pb.width, config.pb.height);
            for (let i = 0; i < byteArray.length / 3; i++) {
                imageData.data[i * 4] = byteArray[i * 3];
                imageData.data[i * 4 + 1] = byteArray[i * 3 + 1];
                imageData.data[i * 4 + 2] = byteArray[i * 3 + 2];
                imageData.data[i * 4 + 3] = 255;
            }
            ctx.putImageData(imageData, 0, 0);
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
        paintboardSocket.addEventListener('close', () => {
            console.error('Paintboard socket closed.');
            setTimeout(() => { this.setupSocket(); }, 1000);
        });
    }

    registerEvent = () => {
        this.paintboard.addEventListener('click', () => { paintboard.requestFullscreen(); });
    }
};
