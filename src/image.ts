import sharp from 'sharp';
import { POS, RGB } from './utils';
import { painter } from './painter';

type ImageData = {
    width: number;
    height: number;
    pixelData: Map<POS, RGB>;
}

export class Image {
    private readonly image: sharp.Sharp;
    private imageData: ImageData | null = null;

    constructor(imagePath: string) {
        this.image = sharp(imagePath);
    }

    async loadImage() {
        const metadata = await this.image.metadata();
        this.imageData = {
            width: metadata.width!,
            height: metadata.height!,
            pixelData: new Map(),
        };
        const channels = metadata.channels!;

        const pixels = await this.image.raw().toBuffer();
        for (let i = 0; i < pixels.length; i += channels) {
            const r = pixels[i] as number;
            const g = pixels[i + 1] as number;
            const b = pixels[i + 2] as number;
            this.imageData.pixelData.set(new POS(i / channels % metadata.width!, Math.floor(i / channels / metadata.width!)), new RGB(r, g, b));
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
            const pixels = Array.from(this.imageData!.pixelData);
            for (let i = pixels.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const temp = pixels[i]!;
                pixels[i] = pixels[j]!;
                pixels[j] = temp;
            }
            for (const [pos, pixel] of pixels) {
                const x = initX + pos.x;
                const y = initY + pos.y;
                painter.paint(pixel, new POS(x, y));
            }
            // for (const [pos, pixel] of this.imageData!.pixelData) {
            //     const x = initX + pos.x;
            //     const y = initY + pos.y;
            //     painter.paint(pixel, new POS(x, y));
            // }
        }, 1000);
    }

    getPaintRate() {
        var painted = 0;
        for (const [pos, pixel] of this.imageData!.pixelData) {
            if (painter.boardData.get(pos.toNumber())?.toOutputString() === pixel.toOutputString()) {
                painted++;
            }
        }
        return painted / this.imageData!.pixelData.size;
    }
}

export class Images {
    private readonly images: Image[] = [];

    addImage(imagePath: string, init: POS) {
        const image = new Image(imagePath);
        image.loadImage().then(() => {
            image.maintain(init.x, init.y);
        });
        this.images.push(image);
    }

    getPaintRate() {
        return this.images.reduce((acc, image) => acc + image.getPaintRate(), 0) / this.images.length;
    }
}

export const images = new Images();
