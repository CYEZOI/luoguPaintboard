import pino from 'pino';
import pretty from 'pino-pretty';

export const logger: pino.Logger = pino(pretty({
    colorize: true,
    minimumLevel: 'debug',
}));
