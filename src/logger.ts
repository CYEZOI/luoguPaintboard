import pino from 'pino';
import pretty from 'pino-pretty';
import { createStream } from 'rotating-file-stream';

export const logger: pino.Logger = pino({
    level: 'trace',
    base: null,
    redact: ['e.image'],
}, pino.multistream([
    {
        level: 'trace',
        stream: createStream((time, index) => {
            const pad = (num: number) => (num > 9 ? '' : '0') + num;

            if (!time) return 'trace.log';
            if (!(time instanceof Date))
                time = new Date(time);

            return `${time.getFullYear()}${pad(time.getMonth() + 1)}${pad(time.getDate())}${pad(time.getHours())}${pad(time.getMinutes())}${pad(time.getSeconds())}-${index}.log.gz`;
        }, {
            size: '10M',
            compress: 'gzip',
            path: 'logs',
        })
    },
    {
        level: 'info',
        stream: pretty({
            colorize: true,
        })
    },
]));
