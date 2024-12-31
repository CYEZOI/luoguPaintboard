import sharp from 'sharp';
import { RGB } from './utils.js';
import { painter } from './painter.js';

class ImageData {
    width: number;
    height: number;
    pixelData: RGB[];
}

export class ImageManager {
    private image: sharp.Sharp;
    private imageData: ImageData;

    async loadImage() {
        this.image = sharp('image.jpg');

        const metadata = await this.image.metadata();
        this.imageData.width = metadata.width!;
        this.imageData.height = metadata.height!;
        const channels = metadata.channels!;

        const pixels = await this.image.raw().toBuffer();
        for (let i = 0; i < pixels.length; i += channels) {
            const r = pixels[i] as number;
            const g = pixels[i + 1] as number;
            const b = pixels[i + 2] as number;
            this.imageData.pixelData.push({ r, g, b });
        }
    }

    maintain(initX: number, initY: number) {
        setInterval(async () => {
            await new Promise<void>((resolve) => {
                const paintInterval = setInterval(() => {
                    if (painter.paintEvents.pending.length === 0) {
                        clearInterval(paintInterval);
                        resolve();
                    }
                }, 1000);
            });
            this.imageData.pixelData.forEach((pixel, index) => {
                const x = initX + index % this.imageData.width;
                const y = initY + Math.floor(index / this.imageData.width);
                painter.paint(pixel.r, pixel.g, pixel.b, x, y);
            });
        }, 1000);
    }
}
