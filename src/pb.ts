import { POS, RGB } from './utils';
import { config } from './config';
import { socket } from './socket';
import { logger } from './logger';
import { appendFile, readdir, readFile, writeFile } from 'fs/promises';
import gzip from 'node-gzip';

const pbLogger = logger.child({ module: 'pb' });

export class PB {
    private refreshing = false;
    private pendingQueue: [POS, RGB][] = [];
    private readonly boardData: Map<number, RGB> = new Map();

    public getBoardData = (pos: POS): RGB | undefined => { return this.boardData.get(pos.toNumber()); };
    private setBoardData = (pos: POS, color: RGB) => { this.boardData.set(pos.toNumber(), color); };

    update = async (pos: POS, color: RGB) => {
        const now = Date.now();
        await appendFile(`pb/${Math.floor(now / 1000 / 60)}.pe`, Buffer.from([
            now >> 24, now >> 16, now >> 8, now,
            pos.x, pos.y,
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
        return size / 1000;
    }

    getHistory = async (time: Date) => {
        const files = { pb: new Array<number>(), pe: new Array<number>() };
        for (const file of await readdir('pb')) {
            (file.endsWith('.pb') ? files.pb : files.pe).push(parseInt(file.slice(0, -3)));
        }
        let latest = 0;
        for (const file of files.pb) {
            if (file < time.getTime() && file > latest) { latest = file; }
        }
        if (latest) {
            const compressed = await readFile(`pb/${latest}.pb`);
            var byteArray = new Uint8Array(await gzip.ungzip(compressed));
            if (byteArray.length !== config.pb.width * config.pb.height * 3) { throw 'Paintboard data length mismatch.'; }
            const boardData: Array<number> = new Array(config.pb.width * config.pb.height);
            for (let y = 0; y < config.pb.height; y++) {
                for (let x = 0; x < config.pb.width; x++) {
                    boardData[new POS(x, y).toNumber()] = new RGB(
                        byteArray[y * config.pb.width * 3 + x * 3]!,
                        byteArray[y * config.pb.width * 3 + x * 3 + 1]!,
                        byteArray[y * config.pb.width * 3 + x * 3 + 2]!
                    ).toNumber();
                }
            }
            const historyId = Math.floor(latest / 1000 / 60);
            const currentId = Math.floor(time.getTime() / 1000 / 60);
            for (var i = historyId; i <= currentId; i++) {
                if (!files.pe.includes(i)) { continue; }
                const file = await readFile(`pb/${i}.pe`);
                if (file.length % 9 !== 0) { throw 'Paint event data length is not a multiple of 9.'; }
                for (let j = 0; j < file.length; j += 9) {
                    const currentTime = new Date(file[j]! << 24 | file[j + 1]! << 16 | file[j + 2]! << 8 | file[j + 3]!);
                    if (currentTime.getTime() >= time.getTime()) { break; }
                    const pos = new POS(file[j]!, file[j + 1]!);
                    const color = new RGB(file[j + 2]!, file[j + 3]!, file[j + 4]!);
                    boardData[pos.toNumber()] = color.toNumber();
                }
            }
            return boardData;
        }
        return null;
    };
};

export const pb = new PB();
