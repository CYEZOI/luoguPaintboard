import express from 'express';
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
import { JSONSchema7, validate } from 'json-schema';
import { closing } from './signal';
import { Socket } from 'net';

const serverLogger = logger.child({ module: 'server' });

const JSONSchemas: { [key: string]: JSONSchema7 } = {
    'POST session': {
        type: 'object',
        properties: {
            password: { type: 'string' },
        },
        required: ['password'],
        additionalProperties: false,
    },
    'POST token': {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                uid: { type: 'number' },
                paste: { type: 'string' },
            },
            required: ['uid', 'paste'],
            additionalProperties: false,
        },
    },
    'PATCH token': {
        type: 'object',
        properties: {
            enabled: { type: 'boolean' },
        },
        required: ['enabled'],
        additionalProperties: false,
    },
    'POST image': {
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
    },
    'POST monitor': {
        type: 'object',
        properties: {
            action: { type: 'string' },
        },
        required: ['action'],
        additionalProperties: false,
    },
};

const app = expressWs(express()).app;

app.use(cookieParser());

app.use((req, res, next) => {
    serverLogger.debug({ req }, `${req.ips.join('-')} ${req.method} ${req.path} ${req.cookies['session']}`);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
    next();
});

app.use(express.static('public'));

app.use((req, res, next: express.NextFunction) => {
    // Check for referer
    if (!req.path.endsWith('/ws/.websocket') &&
        !config.config.server.referer.includes(req.headers.referer?.split('/')[2] ?? '')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    // Check for content type
    if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE') {
        if (!req.headers['content-type']?.includes('application/json')) {
            res.status(415).json({ error: 'Unsupported Media Type' });
            return;
        }
    }
    // Check for content length
    if (req.headers['content-length'] && parseInt(req.headers['content-length']!) > config.config.server.bodyLimit * 1024 * 1024) {
        res.status(413).json({ error: 'Payload Too Large' });
        return;
    }
    // Check for admin pages
    const adminPages = ['/token', '/image', '/monitor'];
    if (adminPages.includes(req.path) && !req.cookies['session']) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    next();
});

app.use(express.json());

app.use((req, res, next) => {
    // Validate JSON schema
    const schema = JSONSchemas[`${req.method} ${req.path.split('/')[1]}`];
    if (schema) {
        const result = validate(req.body, schema);
        if (!result.valid) {
            res.status(400).json({ error: 'Invalid request format: ' + result.errors.map(error => error.message).join(', ') });
            return;
        }
    }
    next();
});


app.get('/config', async (_req, res) => {
    res.json(config.config);
});

app.get('/session', async (req, res) => {
    res.json({ valid: await SESSION.verifySession(req.cookies['session']) });
});
app.post('/session', async (req, res) => {
    if (req.body.password !== config.config.server.password) {
        res.status(401).json({ error: 'Password incorrect' });
        return;
    }
    res.cookie('session', await SESSION.createSession(), { httpOnly: true });
    res.json({});
});
app.delete('/session', async (req, res) => {
    await SESSION.deleteSession(req.cookies['session']);
    res.json({});
});

app.get('/token', async (_req, res) => {
    res.json(await prisma.token.findMany());
});
app.post('/token', async (req, res) => {
    await prisma.token.createMany({ data: req.body });
    res.json({});
});
app.patch('/token/:uid', async (req, res) => {
    (req.body.enabled ? tokens.enableToken : tokens.disableToken)(parseInt(req.params['uid']!));
    res.json({});
});
app.delete('/token/:uid', async (req, res) => {
    await prisma.token.deleteMany({ where: { uid: parseInt(req.params['uid']!) } });
    res.json({});
});
app.ws('/token/ws', async (ws, _req) => {
    const listener = (data: any) => ws.send(JSON.stringify(data));
    tokens.on(listener);
    ws.on('close', () => tokens.off(listener));
});

app.get('/history', async (_req, res) => {
    res.json({ oldest: await pb.getOldestHistory() });
});
app.get('/history/:time', async (req, res) => {
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
            width: config.config.pb.width,
            height: config.config.pb.height,
            channels: 3
        }
    }).jpeg({
        quality: 100,
        progressive: true,
    }).pipe(createGzip()).pipe(res);
});

app.ws('/monitor/ws', async (ws, _req) => {
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
app.post('/monitor', async (req, res) => {
    if (req.body.action === 'restart') {
        res.json({});
        throw new Error('Restart');
    }
    res.status(400).json({ error: 'Invalid action' });
});

app.get('/image', async (_req, res) => {
    res.json((await prisma.image.findMany({ omit: { image: true } })).map((image) => ({
        ...image,
        init: POS.fromNumber(image.init),
    })));
});
app.get('/image/:id', async (req, res) => {
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
app.post('/image', async (req, res) => {
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
app.delete('/image/:id', async (req, res) => {
    const idString = req.params['id'];
    if (typeof idString !== 'string' || !/^\d+$/.test(idString)) {
        res.status(400).json({ error: 'Invalid id' });
        return;
    }
    const id = parseInt(idString);
    await prisma.image.deleteMany({ where: { id } });
    res.json({});
});

export const runServer = async () => {
    const server = app.listen(config.config.server.port, () => {
        serverLogger.warn(`Server started at port ${config.config.server.port}`);
    });

    const connections: Socket[] = [];
    server.on('connection', (socket) => {
        serverLogger.debug(`New connection from ${socket.remoteAddress}`);
        connections.push(socket);
        socket.on('close', () => {
            serverLogger.debug(`Connection from ${socket.remoteAddress} closed`);
            connections.splice(connections.indexOf(socket), 1);
        });
    });

    await setIntervalImmediately(async (stop) => {
        if (closing) { stop(); }
    }, 100);

    for (const connection of connections) { connection.end(); }
    server.close();
};
