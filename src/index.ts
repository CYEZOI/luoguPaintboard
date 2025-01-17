import { existsSync, mkdirSync } from 'node:fs';
import { images } from './image';
import { logger } from './logger';
import { painter } from './painter';
import { pb } from './pb';
import { createServer } from './server';
import { setupSignalHandler, waitBeforeClose } from './signal';
import { socket } from './socket';
import { tokens } from './token';

logger.info('Starting...');
setupSignalHandler();
if (!existsSync('pb')) { mkdirSync('pb'); }
createServer();
tokens.fetchBlankTokenInterval();
await pb.refreshPaintboard();
waitBeforeClose(socket.startSending());
waitBeforeClose(painter.startPainting());
waitBeforeClose(images.startMonitoring());
