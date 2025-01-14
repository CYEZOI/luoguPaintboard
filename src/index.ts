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
createServer();
tokens.fetchBlankTokenInterval();
await pb.refreshPaintboard();
for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 1; j++) {
        images.addImage('image.jpg', new POS(100 * i, 100 * j));
    }
}
waitBeforeClose(socket.startSending());
waitBeforeClose(painter.startPainting());
