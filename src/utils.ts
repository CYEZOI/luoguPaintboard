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

export const setIntervalImmediately = (callback: () => void, interval: number) => {
    callback();
    return setInterval(callback, interval);
}

export class RGB {
    constructor(public readonly r: number, public readonly g: number, public readonly b: number) { }
    toOutputString = (): string => { return `#${(this.r << 16 | this.g << 8 | this.b).toString(16).toUpperCase().padStart(6, '0')}`; }
    toUint8Array = (): Uint8Array => { return new Uint8Array([this.r, this.g, this.b]); }
}

export class POS {
    constructor(public readonly x: number, public readonly y: number) { }
    toOutputString = (): string => { return `(${this.x.toString().padEnd(3)}, ${this.y.toString().padEnd(3)})`; }
    toUint8Array = (): Uint8Array => { return new Uint8Array([...uintToUint8Array(this.x, 2), ...uintToUint8Array(this.y, 2),]); }
    toNumber = (): number => { return this.x * config.pb.width + this.y; }
}
