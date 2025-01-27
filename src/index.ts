import { existsSync, mkdirSync } from 'node:fs';
import { images } from './image';
import { logger } from './logger';
import { painter } from './painter';
import { pb } from './pb';
import { runServer } from './server';
import { cleanUp, setupSignalHandler, waitBeforeClose } from './signal';
import { socket } from './socket';
import { tokens } from './token';
import { config } from './config';

while (true) {
    logger.warn('Starting...');
    setupSignalHandler();
    if (!existsSync('pb')) { mkdirSync('pb'); }
    config.watchFile();
    waitBeforeClose(runServer());
    tokens.fetchBlankTokenInterval();
    await pb.refreshPaintboard();
    logger.warn('Running...');
    waitBeforeClose(socket.startSending());
    waitBeforeClose(painter.startPainting());
    waitBeforeClose(images.startMonitoring());
    await new Promise<void>((resolve) => {
        process.on('uncaughtException', (error) => {
            logger.fatal(`Uncaught exception: ${error}`);
            resolve();
        });
    });
    await cleanUp();
}
