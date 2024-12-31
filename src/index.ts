import { Image } from './image';
import { painter } from './painter';
import { report } from './report';
import { socket } from './socket';
report.startReport();

const image = new Image('image.jpg');
image.loadImage().then(() => {
    image.maintain(0, 0);
});

painter.startPainting();
socket.startSending();
