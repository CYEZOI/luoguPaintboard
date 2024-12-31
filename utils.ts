export const uintToUint8Array = (uint, bytes) => {
    const array = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i++) {
        array[i] = uint & 0xff;
        uint = uint >> 8;
    }
    return array;
};

export const tokenToUint8Array = (token) => {
    const tokenBytes = new Uint8Array(16);
    token.replace(/-/g, '').match(/.{2}/g).map((byte, i) =>
        tokenBytes[i] = parseInt(byte, 16));
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
}
