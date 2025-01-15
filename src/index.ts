import { existsSync, mkdirSync } from 'node:fs';
import { images } from './image';
import { logger } from './logger';
import { painter } from './painter';
import { pb } from './pb';
import { createServer } from './server';
import { setupSignalHandler, waitBeforeClose } from './signal';
import { socket } from './socket';
import { tokens } from './token';
import { POS } from './utils';

logger.info('Starting...');
setupSignalHandler();
if (!existsSync('pb')) { mkdirSync('pb'); }
createServer();
tokens.fetchBlankTokenInterval();
await pb.refreshPaintboard();
for (let i = 0; i < 1; i++) {
    for (let j = 0; j < 1; j++) {
        images.addImage('image.jpg', new POS(200 * i, 200 * j));
    }
}
waitBeforeClose(socket.startSending());
waitBeforeClose(painter.startPainting());
