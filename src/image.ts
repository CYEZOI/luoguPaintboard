import sharp from 'sharp';
import { POS, RGB } from './utils';
import { painter } from './painter';
import { pb } from './pb';
import { logger } from './logger';

const imageLogger = logger.child({ module: 'image' });

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
            const paintEvents = [];
            for (let i = 0; i < pixels.length; i += channels) {
                const pos = new POS(i / channels % this.width, Math.floor(i / channels / this.width))
                const rgb = new RGB(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
                this.pixelData.set(pos.toNumber(), rgb);
                if (pb.getBoardData(this.toBoardPos(pos))?.toOutputString() !== rgb.toOutputString()) {
                    paintEvents.push({ pos: this.toBoardPos(pos), rgb });
                }
            }
            if (paintEvents.length > 0) { await painter.paint(paintEvents); }
        })();
    }

    toBoardPos = (pos: POS) => { return new POS(this.init.x + pos.x, this.init.y + pos.y); };
    fromBoardPos = (pos: POS) => { return new POS(pos.x - this.init.x, pos.y - this.init.y); };
};

export class Images {
    private readonly images: Image[] = [];

    addImage = (imagePath: string, init: POS) => {
        imageLogger.info(`Adding image ${imagePath} at ${init.toOutputString()}`);
        this.images.push(new Image(imagePath, init));
    };

    checkColor = async (pos: POS, color: RGB) => {
        for (const image of this.images) {
            await image.load;
            const imagePos = image.fromBoardPos(pos);
            if (imagePos.x >= 0 && imagePos.x < image.width && imagePos.y >= 0 && imagePos.y < image.height) {
                const rgb = image.pixelData!.get(imagePos.toNumber())!;
                if (rgb.toOutputString() !== color.toOutputString()) {
                    await painter.paint([{ pos, rgb }]);
                }
            }
        }
    };
};

export const images = new Images();
