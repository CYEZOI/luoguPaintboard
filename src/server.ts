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
import { setIntervalImmediately } from './utils';

const serverLogger = logger.child({ module: 'server' });

export const createServer = () => {
    const app = expressWs(express()).app;
    const port = 3000;

    app.use(express.static('public'));
    app.use(express.json());

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
        const time = new Date(parseInt(req.params['time']!) * 1000);
        const board = await pb.getHistory(time);
        if (board === null) {
            res.json({ error: 'No history found' });
            return;
        }
        const image = sharp(Buffer.from(board), { raw: { width: config.pb.width, height: config.pb.height, channels: 3 } });
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Encoding', 'gzip');
        image.png().pipe(createGzip()).pipe(res);
    });

    app.ws('/monitor/ws', async (ws, _) => {
        setIntervalImmediately(async () => {
            ws.send(JSON.stringify({
                currentLoad: await si.currentLoad(),
                mem: await si.mem(),
                disksIO: await si.disksIO(),
                networkStats: await si.networkStats(),
                osInfo: await si.osInfo(),
            }));
        }, 1000);
    });

    app.listen(port, () => { serverLogger.info(`Server started at http://localhost:${port}`); });
};
