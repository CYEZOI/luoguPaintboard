import sharp from 'sharp';
import { paint, paintEvents } from './painter.js';

export const imageData = {
    width: 0,
    height: 0,
    pixelData: [],
};

const image = sharp('image.jpg');

const metadata = await image.metadata();
imageData.width = metadata.width;
imageData.height = metadata.height;
const channels = metadata.channels;

const pixels = await image.raw().toBuffer();
for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    imageData.pixelData.push({ r, g, b });
}

export const maintain = (initX, initY) => {
    setInterval(async () => {
        await new Promise((resolve) => {
            const paintInterval = setInterval(() => {
                if (paintEvents.pending.length === 0) {
                    clearInterval(paintInterval);
                    resolve();
                }
            }, 1000);
        });
        imageData.pixelData.forEach((pixel, index) => {
            const x = initX + index % imageData.width;
            const y = initY + Math.floor(index / imageData.width);
            paint(pixel.r, pixel.g, pixel.b, x, y);
        });
    }, 1000);
};
