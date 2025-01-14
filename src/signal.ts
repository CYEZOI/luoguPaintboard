import process from 'node:process';
import { logger } from './logger';
import { painter } from './painter';
import { socket } from './socket';
import { prisma } from './db';

const waitList: Promise<void>[] = [];
export var closing = false;

const signalHandler = async (signal: NodeJS.Signals) => {
    logger.info(`Received signal: ${signal}, cleaning up...`);
    closing = true;
    for (const promise of waitList) { await promise; }
    await painter.clear();
    await socket.close();
    await prisma.$disconnect();
    logger.info('Exiting...');
    process.exit(0);
};

export const setupSignalHandler = () => {
    process.on('SIGINT', signalHandler);
    process.on('SIGTERM', signalHandler);
};

export const waitBeforeClose = async (promise: Promise<void>) => { waitList.push(promise); }
