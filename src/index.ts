import { images } from './image';
import { painter } from './painter';
import { report } from './report';
import { socket } from './socket';
import { POS } from './utils';

report.startReport();
for (let i = 5; i < 6; i++) {
    for (let j = 0; j < 1; j++) {
        images.addImage('image.jpg', new POS(100 * i, 100 * j));
    }
}
painter.startPainting();
socket.startSending();
