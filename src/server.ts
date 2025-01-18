import express, { Request, Response } from 'express';
import { logger } from './logger';
import { pb } from './pb';
import sharp from 'sharp';
import { config } from './config';
import { createGzip } from 'zlib';
import { prisma } from './db';
import expressWs from 'express-ws';
import { tokens } from './token';
import si from 'systeminformation';
import { POS, setIntervalImmediately } from './utils';

const serverLogger = logger.child({ module: 'server' });

export const createServer = () => {
    const app = expressWs(express()).app;

    app.use(express.static('public'));
    app.use(express.json({ limit: `${config.server.bodyLimit}mb` }));

    app.get('/config', async (_: Request, res: Response) => {
        res.json(config);
    });

    app.get('/token', async (_: Request, res: Response) => {
        res.json(await prisma.token.findMany());
    });
    app.post('/token', async (req: Request, res: Response) => {
        if (!Array.isArray(req.body) ||
            req.body.some((item: any) => typeof item.uid !== 'number' || typeof item.paste !== 'string' || Object.keys(item).length !== 2)) {
            res.status(400).json({ error: 'Invalid request format' });
            return;
        }
        await prisma.token.createMany({ data: req.body });
        res.json({});
    });
    app.patch('/token/:uid', async (req: Request, res: Response) => {
        (req.body.enabled ? tokens.enableToken : tokens.disableToken)(parseInt(req.params['uid']!));
        res.send('Token updated');
    });
    app.delete('/token/:uid', async (req: Request, res: Response) => {
        await prisma.token.deleteMany({ where: { uid: parseInt(req.params['uid']!) } });
        res.send('Token deleted');
    });
    app.ws('/token/ws', async (ws, _) => {
        const listener = (data: any) => ws.send(JSON.stringify(data));
        tokens.on(listener);
        ws.on('close', () => tokens.off(listener));
    });

    app.get('/history', async (_: Request, res: Response) => {
        res.json({ oldest: await pb.getOldestHistory() });
    });
    app.get('/history/:time', async (req: Request, res: Response) => {
        const timeString = req.params['time'];
        if (typeof timeString !== 'string' || !/^\d+$/.test(timeString)) {
            res.status(400).json({ error: 'Invalid time' });
            return;
        }
        const time = new Date(parseInt(timeString) * 1000);
        const board = await pb.getHistory(time);
        if (board === null) {
            res.status(404).json({ error: 'History not found' });
            return;
        }
        const image = sharp(Buffer.from(board), { raw: { width: config.pb.width, height: config.pb.height, channels: 3 } });
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Encoding', 'gzip');
        image.png().pipe(createGzip()).pipe(res);
    });

    app.ws('/monitor/ws', async (ws, _) => {
        var unload = false;
        var lastIn = 0;
        var lastOut = 0;
        setIntervalImmediately(async (stop) => {
            if (unload) { stop(); }
            const currentLoad = await si.currentLoad();
            const mem = await si.mem();
            const disksIO = await si.disksIO();
            const networkStats = await si.networkStats();
            const osInfo = await si.osInfo();
            var message = `OS: ${osInfo.platform}   ${osInfo.distro} ${osInfo.release} ${osInfo.arch}   ${osInfo.hostname}\n`;
            message += `CPU: ${currentLoad.currentLoad.toFixed(2)}%   ${currentLoad.cpus.map((cpu: any) => cpu.load.toFixed(2))}\n`;
            message += `Memory: ${(mem.used / mem.total * 100).toFixed(2)}%   ${(mem.used / 1024 / 1024).toFixed(2)}MB / ${(mem.total / 1024 / 1024).toFixed(2)}MB\n`;
            if (disksIO) {
                message += `DiskIO: Read ${(disksIO.rIO / 1024 / 1024).toFixed(2)}MB/s   Write ${(disksIO.wIO / 1024 / 1024).toFixed(2)}MB/s\n`;
            }
            if (networkStats.length > 0) {
                const currentIn = networkStats[0]!.rx_bytes;
                const currentOut = networkStats[0]!.tx_bytes;
                if (lastIn !== 0 && lastOut !== 0) {
                    message += `Network: In ${((currentIn - lastIn) / 1024).toFixed(2)}KB/s   Out ${((currentOut - lastOut) / 1024).toFixed(2)}KB/s\n`;
                }
                lastIn = currentIn, lastOut = currentOut;
            }
            ws.send(message);
        }, 1000);
        ws.addEventListener('close', () => { unload = true; });
    });

    app.get('/image', async (_: Request, res: Response) => {
        res.json((await prisma.image.findMany({ omit: { image: true } })).map((image) => ({
            ...image,
            init: POS.fromNumber(image.init),
        })));
    });
    app.get('/image/:id', async (req: Request, res: Response) => {
        const idString = req.params['id'];
        if (typeof idString !== 'string' || !/^\d+$/.test(idString)) {
            res.status(400).json({ error: 'Invalid id' });
            return;
        }
        const id = parseInt(idString);
        const image = await prisma.image.findUnique({ where: { id } });
        if (!image) {
            res.status(404).json({ error: 'Image not found' });
            return;
        }
        res.write(image.image);
        res.end();
    });
    app.post('/image', async (req: Request, res: Response) => {
        if (typeof req.body.name !== 'string' ||
            typeof req.body.image !== 'string' ||
            typeof req.body.scale !== 'number' ||
            typeof req.body.initX !== 'number' ||
            typeof req.body.initY !== 'number') {
            res.status(400).json({ error: 'Invalid request format' });
            return;
        }
        await prisma.image.create({
            data: {
                name: req.body.name,
                image: Buffer.from(req.body.image.replace(/^data:image\/\w+;base64,/, ''), 'base64'),
                scale: req.body.scale,
                init: new POS(req.body.initX, req.body.initY).toNumber(),
            },
        });
        res.json({});
    });
    app.delete('/image/:id', async (req: Request, res: Response) => {
        const idString = req.params['id'];
        if (typeof idString !== 'string' || !/^\d+$/.test(idString)) {
            res.status(400).json({ error: 'Invalid id' });
            return;
        }
        const id = parseInt(idString);
        await prisma.image.deleteMany({ where: { id } });
        res.json({});
    });

    app.listen(config.server.port, () => {
        serverLogger.warn(`Server started at port ${config.server.port}`);
    });
};
