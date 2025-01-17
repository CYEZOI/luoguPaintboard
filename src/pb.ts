import { POS, RGB } from './utils';
import { config } from './config';
import { socket } from './socket';
import { logger } from './logger';
import { appendFile, readdir, readFile, writeFile } from 'fs/promises';
import gzip from 'node-gzip';
import { images } from './image';
import { painter } from './painter';

const pbLogger = logger.child({ module: 'pb' });

export class PB {
    private refreshing = false;
    private pendingQueue: [POS, RGB][] = [];
    private readonly boardData: Map<number, RGB> = new Map();

    public getBoardData = (pos: POS): RGB | undefined => { return this.boardData.get(pos.toNumber()); };
    private setBoardData = (pos: POS, color: RGB) => { this.boardData.set(pos.toNumber(), color); };

    constructor() {
        setInterval(async () => {
            await this.refreshPaintboard();
        }, config.pb.refresh);
    }

    update = async (pos: POS, color: RGB) => {
        const now = Date.now();
        const id = Math.floor(now / 1000 / 60);
        const delta = now - id * 1000 * 60;
        const posNumber = pos.toNumber();
        await appendFile(`pb/${id}.pe`, Buffer.from([
            delta >> 8, delta,
            posNumber >> 16, posNumber >> 8, posNumber,
            color.r, color.g, color.b]));
        if (this.refreshing) { this.pendingQueue.push([pos, color]); }
        else { this.setBoardData(pos, color); }
    };

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
            gzip.gzip(byteArray).then((compressed) => { writeFile(`pb/${Date.now()}.pb`, compressed); });
            await painter.clearPaintQueue();
            await images.repaint();
            pbLogger.info('Paintboard refreshed.');
        } catch (err) {
            pbLogger.error(`Failed to refresh paintboard: ${err}`);
        }
        while (this.pendingQueue.length > 0) {
            const [pos, color] = this.pendingQueue.shift()!;
            this.setBoardData(pos, color);
        }
        this.refreshing = false;
    };

    getOldestHistory = async () => {
        var size = 0;
        for (const file of await readdir('pb')) {
            if (file.endsWith('.pb')) {
                const time = parseInt(file.slice(0, -3));
                if (time < size || size === 0) { size = time; }
            }
        }
        return size;
    }

    getHistory = async (time: Date) => {
        const files = { pb: new Array<number>(), pe: new Array<number>() };
        for (const file of await readdir('pb')) {
            (file.endsWith('.pb') ? files.pb : files.pe).push(parseInt(file.slice(0, -3)));
        }
        let latest = 0;
        for (const file of files.pb) {
            if (file > time.getTime()) { break; }
            if (file > latest) { latest = file; }
        }
        if (latest) {
            const compressed = await readFile(`pb/${latest}.pb`);
            var byteArray = new Uint8Array(await gzip.ungzip(compressed));
            if (byteArray.length !== config.pb.width * config.pb.height * 3) {
                pbLogger.error(`Paintboard data length mismatch: pb/${latest}.pb`);
                return null;
            }
            const historyId = Math.floor(latest / 1000 / 60);
            const currentId = Math.floor(time.getTime() / 1000 / 60);
            for (var id = historyId; id <= currentId; id++) {
                if (!files.pe.includes(id)) { continue; }
                const file = await readFile(`pb/${id}.pe`);
                if (file.length % 8 !== 0) {
                    pbLogger.error(`Paint event data length is not a multiple of 8: pb/${id}.pe`);
                    return null;
                }
                for (let j = 0; j < file.length; j += 8) {
                    const base = id * 1000 * 60;
                    const delta = file[j]! << 8 | file[j + 1]!;
                    const currentTime = new Date(base + delta);
                    if (currentTime.getTime() > time.getTime()) { break; }
                    const pos = POS.fromNumber(file[j + 2]! << 16 | file[j + 3]! << 8 | file[j + 4]!);
                    byteArray.set([...file.subarray(j + 5, j + 8)], (pos.y * config.pb.width + pos.x) * 3);
                }
            }
            return byteArray;
        }
        return null;
    };
};

export const pb = new PB();
