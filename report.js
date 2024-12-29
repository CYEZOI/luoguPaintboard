import { WebSocket } from 'ws';
import config from './config.js';
import { paintEvents } from './painter.js';
import { lastHeartbeatTime, paintboardSocket } from './socket.js';
import { isCooledDown, tokenStatus } from './token.js';
import { paintStatus } from './utils.js';

const logs = [];

export const log = (msg) => {
    logs.push(msg);
};

const colors = {
    Reset: '\x1b[0m',
    Bright: '\x1b[1m',
    Dim: '\x1b[2m',
    Underscore: '\x1b[4m',
    Blink: '\x1b[5m',
    Reverse: '\x1b[7m',
    Hidden: '\x1b[8m',

    FgBlack: '\x1b[30m',
    FgRed: '\x1b[31m',
    FgGreen: '\x1b[32m',
    FgYellow: '\x1b[33m',
    FgBlue: '\x1b[34m',
    FgMagenta: '\x1b[35m',
    FgCyan: '\x1b[36m',
    FgWhite: '\x1b[37m',
    FgGray: '\x1b[90m',

    BgBlack: '\x1b[40m',
    BgRed: '\x1b[41m',
    BgGreen: '\x1b[42m',
    BgYellow: '\x1b[43m',
    BgBlue: '\x1b[44m',
    BgMagenta: '\x1b[45m',
    BgCyan: '\x1b[46m',
    BgWhite: '\x1b[47m',
    BgGray: '\x1b[100m',
};

export const outputPaintEvent = (eventData) => {
    var message = '';
    message += (eventData.uid ? eventData.uid.toString() : "").padEnd(7) + ` (${eventData.x}, ${eventData.y}) -> rgb(${eventData.r}, ${eventData.g}, ${eventData.b}) `;
    switch (eventData.status) {
        case paintStatus.PENDING: message += colors.FgCyan + "Pending"; break;
        case paintStatus.PAINTING: message += colors.FgBlue + "Painting"; break;
        case paintStatus.SUCCESS: message += colors.FgGreen + "Success"; break;
        case paintStatus.ALREADY_PAINTED: message += colors.FgGray + "Already painted"; break;
        case paintStatus.COOLING: message += colors.FgYellow + "Cooling"; break;
        case paintStatus.TOKEN_INVALID: message += colors.FgRed + "Token invalid"; break;
        case paintStatus.REQUEST_FAILED: message += colors.FgRed + "Request failed"; break;
        case paintStatus.NO_PERMISSION: message += colors.FgRed + "No permission"; break;
        case paintStatus.SERVER_ERROR: message += colors.FgMagenta + "Server error"; break;
        case paintStatus.UNKNOWN_ERROR: message += colors.FgMagenta + "Unknown error"; break;
    }
    message += colors.Reset + '\n';
    return message;
};

export const startReport = () => {
    setInterval(() => {
        var message = '';
        for (const uid in tokenStatus.tokens) {
            const { token, info, error, lastUsed } = tokenStatus.tokens[uid];
            message += uid.padEnd(7) + ' ' + colors.Underscore;
            if (token) { message += colors.FgGreen + token; }
            else { message += colors.FgRed + 'No token'.padEnd(36); }
            message += colors.Reset + ' ';
            if (isCooledDown(uid)) { message += colors.FgGreen + 'COOLED'; }
            else { message += colors.FgRed + ((config.cd * 1000 - (new Date() - lastUsed)) / 1000).toFixed(1).padStart(5) + "s"; }
            message += colors.Reset + ' ';
            if (error) { message += colors.BgRed + error + colors.Reset + ' '; }
            if (info) { message += info + ' '; }
            message += `\n`;
        }
        message += `\n`;

        message += `WebSocket: `;
        switch (paintboardSocket.readyState) {
            case WebSocket.CONNECTING:
                message += colors.FgYellow + 'CONNECTING';
                break;
            case WebSocket.OPEN:
                message += colors.FgGreen + 'OPEN';
                break;
            case WebSocket.CLOSING:
                message += colors.FgYellow + 'CLOSING';
                break;
            case WebSocket.CLOSED:
                message += colors.FgRed + 'CLOSED';
        }
        message += colors.Reset + '\n';
        message += `Last heartbeat time: ${lastHeartbeatTime}\n`;
        message += `Painted: ${paintEvents.done.length}  Painting: ${paintEvents.painting.size}  Pending: ${paintEvents.pending.length}\n\n`;

        for (let i = 0; i < Math.min(config.paintOldLogSize, paintEvents.done.length); i++) { message += outputPaintEvent(paintEvents.done[paintEvents.done.length - 1 - i]); }
        for (const paintEvent of paintEvents.painting.values()) { message += outputPaintEvent(paintEvent); }
        for (let i = 0; i < Math.min(config.paintLogSize, paintEvents.pending.length); i++) { message += outputPaintEvent(paintEvents.pending[i]); }
        message += `\n`;

        for (let i = 0; i < Math.min(config.logSize, logs.length); i++) {
            message += logs[logs.length - 1 - i] + '\n';
        }

        console.clear();
        console.log(message);
    }, 100);
};
