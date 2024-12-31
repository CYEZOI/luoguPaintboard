import { Image } from './image';
import { painter } from './painter';
import { report } from './report';
report.startReport();

const image = new Image('image.jpg');
image.loadImage().then(() => {
    image.maintain(0, 0);
});

painter.startPainting();
