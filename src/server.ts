import express, { Request, Response } from 'express';
import { logger } from './logger';
import { pb } from './pb';
import sharp from 'sharp';
import { config } from './config';
import { createGzip } from 'zlib';
import { prisma } from './db';
import expressWs from 'express-ws';

const serverLogger = logger.child({ module: 'server' });

export const createServer = () => {
    const app = expressWs(express()).app;
    const port = 5000;

    app.use(express.static('public'));
    app.use(express.json());

    app.post('/token', async (req: Request, res: Response) => {
        if (!Array.isArray(req.body) ||
            req.body.some((item: any) => typeof item.uid !== 'number' || typeof item.paste !== 'string' || Object.keys(item).length !== 2)) {
            res.status(400).json({ error: 'Invalid request format' });
            return;
        }
        await prisma.token.createMany({ data: req.body });
        res.send('Token request received');
    });
    app.ws('/token/ws', (ws, _) => {
        setInterval(async () => {
            const tokens = await prisma.token.findMany();
            ws.send(JSON.stringify(tokens));
        }, 1000);
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

    app.listen(port, () => { serverLogger.info(`Server started at http://localhost:${port}`); });
};
