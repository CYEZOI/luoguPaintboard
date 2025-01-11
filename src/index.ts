import { images } from './image';
import { painter } from './painter';
import { pb } from './pb';
import { report } from './report';
import { socket } from './socket';
import { POS } from './utils';

report.startReport();
await pb.refreshPaintboard();
images.addImage('image.jpg', new POS(0, 0));
socket.startSending();
painter.startPainting();
