import { createWriteStream } from 'fs';
import { createCanvas } from 'canvas';
import { POS, RGB } from './utils';
import { config } from './config';
import { report } from './report';
import { socket } from './socket';

export class PB {
    private refreshing = false;
    private pendingQueue: [POS, RGB][] = [];
    private readonly boardData: Map<number, RGB> = new Map();

    public getBoardData = (pos: POS): RGB | undefined => { return this.boardData.get(pos.toNumber()); }
    private setBoardData = (pos: POS, color: RGB) => { this.boardData.set(pos.toNumber(), color); }

    update = (pos: POS, color: RGB) => {
        if (this.refreshing) { this.pendingQueue.push([pos, color]); }
        else { this.setBoardData(pos, color); }
    }

    saveToImage = async () => {
        const canvas = createCanvas(config.pb.width, config.pb.height);
        const ctx = canvas.getContext('2d');
        for (let x = 0; x < config.pb.width; x++) {
            for (let y = 0; y < config.pb.height; y++) {
                ctx.fillStyle = this.getBoardData(new POS(x, y))!.toOutputString();
                ctx.fillRect(x, y, 1, 1);
            }
        }
        const out = createWriteStream('board.jpg');
        const stream = canvas.createJPEGStream();
        stream.pipe(out);
        await new Promise((resolve) => {
            out.on('finish', resolve);
        });
    }

    refreshPaintboard = async () => {
        await socket.socketOpen;
        this.refreshing = true;
        try {
            const res = await fetch(`${config.socket.http}/api/paintboard/getboard`);
            if (res.status !== 200) { throw 'Paintboard data fetch failed.'; }
            const byteArray = new Uint8Array(await res.arrayBuffer());
            if (byteArray.length !== config.pb.width * config.pb.height * 3) { throw 'Paintboard data length mismatch.'; }
            for (let y = 0; y < config.pb.height; y++) {
                for (let x = 0; x < config.pb.width; x++) {
                    this.setBoardData(new POS(x, y), new RGB(
                        byteArray[y * config.pb.width * 3 + x * 3]!,
                        byteArray[y * config.pb.width * 3 + x * 3 + 1]!,
                        byteArray[y * config.pb.width * 3 + x * 3 + 2]!
                    ));
                }
            }
            report.paintboardRefresh();
            await this.saveToImage();
        } catch (err) { report.paintboardRefresh(err as string); }
        while (this.pendingQueue.length > 0) {
            const [pos, color] = this.pendingQueue.shift()!;
            this.setBoardData(pos, color);
        }
        this.refreshing = false;
    };
};

export const pb = new PB();
