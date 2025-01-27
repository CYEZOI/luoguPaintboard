import process from 'node:process';
import { logger } from './logger';
import { socket } from './socket';
import { prisma } from './db';
import { painter } from './painter';

const waitList: Promise<void>[] = [];
export var closing = false;

export const cleanUp = async () => {
    closing = true;
    for (const promise of waitList) { await promise; }
    await painter.moveAllPaintingToPending();
    await painter.clearPaintQueue();
    socket.close();
    await prisma.$disconnect();
    waitList.length = 0;
    closing = false;
};

const signalHandler = async (signal: NodeJS.Signals) => {
    logger.info(`Received signal: ${signal}, cleaning up...`);
    cleanUp();
    logger.info('Exiting...');
    process.exit(0);
};

export const setupSignalHandler = () => {
    process.on('SIGINT', signalHandler);
    process.on('SIGTERM', signalHandler);
};

export const waitBeforeClose = async (promise: Promise<void>) => { waitList.push(promise); }
