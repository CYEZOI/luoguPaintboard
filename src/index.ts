import { images } from './image';
import { painter } from './painter';
import { report } from './report';
import { socket } from './socket';
import { POS } from './utils';

report.startReport();
images.addImage('image.jpg', new POS(0, 0));
painter.startPainting();
socket.startSending();
