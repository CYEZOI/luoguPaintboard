import express, { Request, Response } from 'express';
import { logger } from './logger';
import { pb } from './pb';

const serverLogger = logger.child({ module: 'server' });

export const createServer = () => {
    const app = express();
    const port = 5000;

    app.use(express.static('public'));
    app.get('/history', async (req: Request, res: Response) => {
        if (req.query['time'] === undefined) {
            res.json({ oldest: await pb.getOldestHistory() });
            return;
        }
        const time = new Date(parseInt(req.query['time'] as string) * 1000);
        const board = await pb.getHistory(time);
        if (board === null) {
            res.json({ error: 'No history found' });
            return;
        }
        res.json(board);
    });
    app.listen(port, () => { serverLogger.info(`Server started at http://localhost:${port}`); });
};
