import sharp from 'sharp';
import { POS, RGB } from './utils';
import { painter } from './painter';

type ImageData = {
    width: number;
    height: number;
    pixelData: RGB[];
}

export class Image {
    private image: sharp.Sharp;
    private imageData: ImageData | null = null;

    constructor(imagePath: string) {
        this.image = sharp(imagePath);
    }

    async loadImage() {
        const metadata = await this.image.metadata();
        this.imageData = {
            width: metadata.width!,
            height: metadata.height!,
            pixelData: []
        };
        const channels = metadata.channels!;

        const pixels = await this.image.raw().toBuffer();
        for (let i = 0; i < pixels.length; i += channels) {
            const r = pixels[i] as number;
            const g = pixels[i + 1] as number;
            const b = pixels[i + 2] as number;
            this.imageData.pixelData.push(new RGB(r, g, b));
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
            this.imageData!.pixelData.forEach((pixel, index) => {
                const x = initX + index % this.imageData!.width;
                const y = initY + Math.floor(index / this.imageData!.width);
                painter.paint(pixel, new POS(x, y));
            });
        }, 1000);
    }
}
