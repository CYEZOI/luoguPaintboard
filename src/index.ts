import { images } from './image';
import { painter } from './painter';
import { pb } from './pb';
import { socket } from './socket';
import { POS } from './utils';

await pb.refreshPaintboard();
images.addImage('image.jpg', new POS(100, 0));
socket.startSending();
painter.startPainting();
