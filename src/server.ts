import express, { NextFunction, Request, Response } from 'express';
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
import { SESSION } from './session';
import cookieParser from 'cookie-parser';
import { ValidationError, Validator } from 'express-json-validator-middleware';

const serverLogger = logger.child({ module: 'server' });
const { validate } = new Validator({ allErrors: true });

class SessionError extends Error {
    override name = 'SessionError';
}

export const createServer = () => {
    const app = expressWs(express()).app;

    app.use(express.static('public'));
    app.use(express.json({ limit: `${config.server.bodyLimit}mb` }));
    app.use(cookieParser());

    app.get('/config', async (_: Request, res: Response) => {
        res.json(config);
    });

    app.get('/session', async (req: Request, res: Response) => {
        res.json({ valid: await SESSION.verifySession(req.cookies['session']) });
    });
    // @ts-ignore
    app.post('/session', validate({
        body: {
            type: 'object',
            properties: {
                password: { type: 'string' },
            },
            required: ['password'],
            additionalProperties: false,
        }
    }), async (req: Request, res: Response) => {
        if (req.body.password !== config.server.password) {
            res.json({ error: 'Password incorrect' });
            return;
        }
        res.cookie('session', await SESSION.createSession(), { httpOnly: true });
        res.json({});
    });
    app.delete('/session', async (req: Request, res: Response) => {
        await SESSION.deleteSession(req.cookies['session']);
        res.json({});
    });

    app.get('/token', async (req: Request, res: Response, next: NextFunction) => {
        if (!await SESSION.verifySession(req.cookies['session'])) { next(new SessionError()); return; }
        res.json(await prisma.token.findMany());
    });
    // @ts-ignore
    app.post('/token', validate({
        body: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    uid: { type: 'number' },
                    token: { type: 'string' },
                    enabled: { type: 'boolean' },
                },
                required: ['uid', 'token', 'enabled'],
                additionalProperties: false,
            },

        }
    }), async (req: Request, res: Response, next: NextFunction) => {
        if (!await SESSION.verifySession(req.cookies['session'])) { next(new SessionError()); return; }
        await prisma.token.createMany({ data: req.body });
        res.json({});
    });
    // @ts-ignore
    app.patch('/token/:uid', validate({
        body: {
            type: 'object',
            properties: {
                enabled: { type: 'boolean' },
            },
            required: ['enabled'],
            additionalProperties: false,
        }
    }), async (req: Request, res: Response, next: NextFunction) => {
        if (!await SESSION.verifySession(req.cookies['session'])) { next(new SessionError()); return; }
        (req.body.enabled ? tokens.enableToken : tokens.disableToken)(parseInt(req.params['uid']!));
        res.json({});
    });
    app.delete('/token/:uid', async (req: Request, res: Response, next: NextFunction) => {
        if (!await SESSION.verifySession(req.cookies['session'])) { next(new SessionError()); return; }
        await prisma.token.deleteMany({ where: { uid: parseInt(req.params['uid']!) } });
        res.json({});
    });
    app.ws('/token/ws', async (ws, req: Request, next: NextFunction) => {
        if (!await SESSION.verifySession(req.cookies['session'])) { next(new SessionError()); return; }
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
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Encoding', 'gzip');
        sharp(Buffer.from(board), {
            raw: {
                width: config.pb.width,
                height: config.pb.height,
                channels: 3
            }
        }).jpeg({
            quality: 100,
            progressive: true,
        }).pipe(createGzip()).pipe(res);
    });

    app.ws('/monitor/ws', async (ws, req: Request, next: NextFunction) => {
        if (!await SESSION.verifySession(req.cookies['session'])) { next(new SessionError()); return; }
        var unload = false;
        var lastIn = 0;
        var lastOut = 0;
        setIntervalImmediately(async (stop) => {
            if (unload) { stop(); }
            const data = await si.get({
                currentLoad: 'currentLoad,cpus',
                mem: 'used,total',
                disksIO: 'rIO,wIO',
                networkStats: 'rx_bytes,tx_bytes',
                osInfo: 'platform,distro,release,arch,hostname',
            });
            var message = `${new Date().toLocaleString()}\n`;
            message += `OS: ${data.osInfo.platform}   ${data.osInfo.distro} ${data.osInfo.release} ${data.osInfo.arch}   ${data.osInfo.hostname}\n`;
            message += `CPU: ${data.currentLoad.currentLoad.toFixed(2)}%   ${data.currentLoad.cpus.map((cpu: any) => cpu.load.toFixed(2))}\n`;
            message += `Memory: ${(data.mem.used / data.mem.total * 100).toFixed(2)}%   ${(data.mem.used / 1024 / 1024).toFixed(2)}MB / ${(data.mem.total / 1024 / 1024).toFixed(2)}MB\n`;
            if (data.disksIO) {
                message += `DiskIO: Read ${(data.disksIO.rIO / 1024 / 1024).toFixed(2)}MB/s   Write ${(data.disksIO.wIO / 1024 / 1024).toFixed(2)}MB/s\n`;
            }
            if (data.networkStats.length > 0) {
                const currentIn = data.networkStats[0]!.rx_bytes;
                const currentOut = data.networkStats[0]!.tx_bytes;
                if (lastIn !== 0 && lastOut !== 0) {
                    message += `Network: In ${((currentIn - lastIn) / 1024).toFixed(2)}KB/s   Out ${((currentOut - lastOut) / 1024).toFixed(2)}KB/s\n`;
                }
                lastIn = currentIn, lastOut = currentOut;
            }
            ws.send(message);
        }, 1000);
        ws.addEventListener('close', () => { unload = true; });
    });

    app.get('/image', async (req: Request, res: Response, next: NextFunction) => {
        if (!await SESSION.verifySession(req.cookies['session'])) { next(new SessionError()); return; }
        res.json((await prisma.image.findMany({ omit: { image: true } })).map((image) => ({
            ...image,
            init: POS.fromNumber(image.init),
        })));
    });
    app.get('/image/:id', async (req: Request, res: Response, next: NextFunction) => {
        if (!await SESSION.verifySession(req.cookies['session'])) { next(new SessionError()); return; }
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
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Encoding', 'gzip');
        sharp(image.image).jpeg({
            quality: 100,
            progressive: true,
        }).pipe(createGzip()).pipe(res);
    });
    // @ts-ignore
    app.post('/image', validate({
        body: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                image: { type: 'string' },
                scale: { type: 'number' },
                initX: { type: 'number' },
                initY: { type: 'number' },
            },
            required: ['name', 'image', 'scale', 'initX', 'initY'],
            additionalProperties: false,
        }
    }), async (req: Request, res: Response, next: NextFunction) => {
        if (!await SESSION.verifySession(req.cookies['session'])) { next(new SessionError()); return; }
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
    app.delete('/image/:id', async (req: Request, res: Response, next: NextFunction) => {
        if (!await SESSION.verifySession(req.cookies['session'])) { next(new SessionError()); return; }
        const idString = req.params['id'];
        if (typeof idString !== 'string' || !/^\d+$/.test(idString)) {
            res.status(400).json({ error: 'Invalid id' });
            return;
        }
        const id = parseInt(idString);
        await prisma.image.deleteMany({ where: { id } });
        res.json({});
    });

    app.use((err: any, _: Request, res: Response, next: NextFunction) => {
        if (err instanceof SessionError) {
            res.status(401).json({ error: 'Unauthorized' });
        }
        else if (err instanceof ValidationError) {
            res.status(400).json({ error: 'Invalid request format', details: err.validationErrors });
        } else {
            next(err);
        }
    });

    app.listen(config.server.port, () => {
        serverLogger.warn(`Server started at port ${config.server.port}`);
    });
};
