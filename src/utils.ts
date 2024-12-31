import { config } from './config';

export const uintToUint8Array = (uint: number, bytes: number) => {
    const array = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i++) {
        array[i] = uint & 0xff;
        uint = uint >> 8;
    }
    return array;
};

export const tokenToUint8Array = (token: string) => {
    const tokenBytes = new Uint8Array(16);
    token.replace(/-/g, '').match(/.{2}/g)?.map((byte, i) => tokenBytes[i] = parseInt(byte, 16));
    return tokenBytes;
};

export class RGB {
    r: number;
    g: number;
    b: number;

    constructor(r: number, g: number, b: number) {
        this.r = r;
        this.g = g;
        this.b = b;
    }

    toOutputString = (): string => {
        return `#${(this.r << 16 | this.g << 8 | this.b).toString(16).toUpperCase().padStart(6, '0')}`;
    }

    toUint8Array = (): Uint8Array => {
        return new Uint8Array([this.r, this.g, this.b]);
    }
}

export class POS {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    toOutputString = (): string => {
        return `(${this.x.toString().padEnd(3)}, ${this.y.toString().padEnd(3)})`;
    }

    toUint8Array = (): Uint8Array => {
        return new Uint8Array([
            ...uintToUint8Array(this.x, 2),
            ...uintToUint8Array(this.y, 2),
        ]);
    }

    toNumber = (): number => {
        return this.x * config.width + this.y;
    }
}
