import { POS, RGB } from './utils';
import { config } from './config';
import { socket } from './socket';
import { logger } from './logger';
import { PrismaClient } from '@prisma/client';
import { prisma } from './db';

const pbLogger = logger.child({ module: 'pb' });

export class PB {
    constructor(private readonly prismaPb: PrismaClient['pb']) { }

    private refreshing = false;
    private pendingQueue: [POS, RGB][] = [];
    private readonly boardData: Map<number, RGB> = new Map();

    public getBoardData = (pos: POS): RGB | undefined => { return this.boardData.get(pos.toNumber()); };
    private setBoardData = (pos: POS, color: RGB) => { this.boardData.set(pos.toNumber(), color); };

    update = (pos: POS, color: RGB) => {
        if (this.refreshing) { this.pendingQueue.push([pos, color]); }
        else { this.setBoardData(pos, color); }
    };

    refreshPaintboard = async () => {
        await socket.socketOpen;
        this.refreshing = true;
        try {
            pbLogger.info('Refreshing paintboard...');
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
            await this.prismaPb.create({ data: { boardData: byteArray, }, });
        } catch (err) {
            await this.prismaPb.create({ data: { message: `Refresh paintboard failed: ${err}`, }, });
        }
        while (this.pendingQueue.length > 0) {
            const [pos, color] = this.pendingQueue.shift()!;
            this.setBoardData(pos, color);
        }
        this.refreshing = false;
    };
};

export const pb = new PB(prisma.pb);
