import { images } from './image';
import { logger } from './logger';
import { painter } from './painter';
import { pb } from './pb';
import { setupSignalHandler, waitBeforeClose } from './signal';
import { socket } from './socket';
import { tokens } from './token';
import { POS } from './utils';

logger.info('Starting...');
tokens.fetchBlankTokenInterval();
setupSignalHandler();
await pb.refreshPaintboard();
for (let i = 0; i < 1; i++) {
    for (let j = 5; j < 6; j++) {
        images.addImage('image.jpg', new POS(100 * i, 100 * j));
    }
}
waitBeforeClose(socket.startSending());
waitBeforeClose(painter.startPainting());
