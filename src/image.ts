import sharp from 'sharp';
import { POS, RGB, setIntervalImmediately } from './utils';
import { painter } from './painter';
import { pb } from './pb';
import { logger } from './logger';
import { closing } from './signal';
import { prisma } from './db';

const imageLogger = logger.child({ module: 'image' });

export class Image {
    private image!: sharp.Sharp;
    public width!: number;
    public height!: number;
    private init!: POS;
    public readonly pixelData: Map<number, RGB> = new Map();
    public loaded!: Promise<void>;

    constructor(private readonly id: number) { };

    load = async () => {
        const imageData = await prisma.image.findUnique({ where: { id: this.id, }, });
        if (!imageData) { throw 'Image not found.'; }

        this.image = sharp(imageData.image);
        this.init = POS.fromNumber(imageData.init);

        this.loaded = (async () => {
            const scale = imageData.scale;
            const metadata = await this.image.metadata();
            this.width = Math.round(metadata.width! * scale);
            this.height = Math.round(metadata.height! * scale);
            this.image = this.image.resize(this.width, this.height, { fit: 'cover' });
            const channels = metadata.channels!;

            const pixels = await this.image.raw().toBuffer();
            if (pixels.length !== this.width * this.height * channels) { throw 'Invalid image data.'; }
            for (let i = 0; i < pixels.length; i += channels) {
                const pos = new POS(i / channels % this.width, Math.floor(i / channels / this.width))
                const rgb = new RGB(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
                this.pixelData.set(pos.toNumber(), rgb);
            }
            this.repaint();
        })();
    }

    repaint = async () => {
        await this.loaded;
        const paintEvents = [];
        for (const [pos, rgb] of this.pixelData) {
            if (pb.getBoardData(this.toBoardPos(POS.fromNumber(pos)))?.toOutputString() !== rgb.toOutputString()) {
                paintEvents.push({ pos: this.toBoardPos(POS.fromNumber(pos)), rgb });
            }
        }
        if (paintEvents.length > 0) { await painter.paint(paintEvents); }
    }

    toBoardPos = (pos: POS) => { return new POS(this.init.x + pos.x, this.init.y + pos.y); };
    fromBoardPos = (pos: POS) => { return new POS(pos.x - this.init.x, pos.y - this.init.y); };
};

export class Images {
    private readonly images: Map<number, Image> = new Map();

    startMonitoring = async () => {
        return await setIntervalImmediately(async (stop) => {
            if (closing) { stop(); }
            const images = await prisma.image.findMany();
            for (const image of images) {
                if (!this.images.has(image.id)) {
                    const imageObj = new Image(image.id);
                    imageObj.load().then(() => {
                        imageLogger.info(`Image ${image.id} loaded.`);
                        this.images.set(image.id, imageObj);
                    });
                }
            }
        }, 100);
    };

    checkColor = async (pos: POS, color: RGB) => {
        for (const [_, image] of this.images) {
            await image.loaded;
            const imagePos = image.fromBoardPos(pos);
            if (imagePos.x >= 0 && imagePos.x < image.width && imagePos.y >= 0 && imagePos.y < image.height) {
                const rgb = image.pixelData!.get(imagePos.toNumber())!;
                if (rgb.toOutputString() !== color.toOutputString()) {
                    await painter.paint([{ pos, rgb }]);
                }
            }
        }
    };

    repaint = async () => {
        for (const [_, image] of this.images) { await image.repaint(); }
    }
};

export const images = new Images();
