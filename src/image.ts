import sharp from 'sharp';
import { POS, RGB } from './utils';
import { painter } from './painter';

export class Image {
    private image!: sharp.Sharp;
    public width!: number;
    public height!: number;
    public readonly pixelData: Map<number, RGB> = new Map();
    private readonly init: POS;
    public load: Promise<void>;

    constructor(imagePath: string, init: POS) {
        this.image = sharp(imagePath);
        this.init = init;
        this.load = (async () => {
            const metadata = await this.image.metadata();
            this.width = metadata.width!;
            this.height = metadata.height!;
            const channels = metadata.channels!;

            const pixels = await this.image.raw().toBuffer();
            for (let i = 0; i < pixels.length; i += channels) {
                const pos = new POS(i / channels % this.width, Math.floor(i / channels / this.width))
                const color = new RGB(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
                this.pixelData.set(pos.toNumber(), color);
                painter.paint(this.toBoardPos(pos), color);
            }
        })();
    }

    public toBoardPos(pos: POS): POS {
        return new POS(this.init.x + pos.x, this.init.y + pos.y);
    }

    public fromBoardPos(pos: POS): POS {
        return new POS(pos.x - this.init.x, pos.y - this.init.y);
    }
}

export class Images {
    private readonly images: Image[] = [];

    addImage(imagePath: string, init: POS) {
        this.images.push(new Image(imagePath, init));
    }

    async checkColor(pos: POS, color: RGB) {
        for (const image of this.images) {
            await image.load;
            const imagePos = image.fromBoardPos(pos);
            if (imagePos.x >= 0 && imagePos.x < image.width && imagePos.y >= 0 && imagePos.y < image.height) {
                const imageColor = image.pixelData!.get(imagePos.toNumber())!;
                if (imageColor.toOutputString() !== color.toOutputString()) {
                    painter.paint(pos, imageColor);
                }
            }
        }
    }
}

export const images = new Images();
