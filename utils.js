export const paintStatus = {
    PENDING: -1,
    PAINTING: 0,
    SUCCESS: 1,
    ALREADY_PAINTED: 2,
    COOLING: 10,
    TOKEN_INVALID: 11,
    REQUEST_FAILED: 12,
    NO_PERMISSION: 13,
    SERVER_ERROR: 14,
    UNKNOWN_ERROR: 15,
}

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
