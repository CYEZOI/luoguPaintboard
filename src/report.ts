import config from './config';
import { painter, PaintEvent, PaintStatus } from './painter';
import { socket } from './socket';
import { tokens } from './token';

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

export class Report {
    private logs: string[] = [];

    log(msg: string): void {
        this.logs.push(msg);
    }

    private outputPaintEvent(eventData: PaintEvent): string {
        var message = '';
        message += eventData.toOutputString(true) + ' ';
        switch (eventData.status) {
            case PaintStatus.PENDING: message += colors.FgCyan + 'Pending'; break;
            case PaintStatus.PAINTING: message += colors.FgBlue + 'Painting'; break;
            case PaintStatus.SUCCESS: message += colors.FgGreen + 'Success'; break;
            case PaintStatus.ALREADY_PAINTED: message += colors.FgGray + 'Already painted'; break;
            case PaintStatus.COOLING: message += colors.FgYellow + 'Cooling'; break;
            case PaintStatus.TOKEN_INVALID: message += colors.FgRed + 'Token invalid'; break;
            case PaintStatus.REQUEST_FAILED: message += colors.FgRed + 'Request failed'; break;
            case PaintStatus.NO_PERMISSION: message += colors.FgRed + 'No permission'; break;
            case PaintStatus.SERVER_ERROR: message += colors.FgMagenta + 'Server error'; break;
            case PaintStatus.UNKNOWN_ERROR: message += colors.FgMagenta + 'Unknown error'; break;
        }
        message += colors.Reset + '\n';
        return message;
    }

    startReport() {
        setInterval(() => {
            var message = '';
            for (const [uid, { token, info, error, lastUsed }] of tokens.tokens) {
                message += uid.toString().padEnd(7) + ' ' + colors.Underscore;
                if (token) { message += colors.FgGreen + token; }
                else { message += colors.FgRed + 'No token'.padEnd(36); }
                message += colors.Reset + ' ';
                if (tokens.isCooledDown(uid)) { message += colors.FgGreen + 'COOLED'; }
                else { message += colors.FgRed + ((config.cd * 1000 - (new Date().getTime() - lastUsed!.getTime())) / 1000).toFixed(1).padStart(5) + 's'; }
                message += colors.Reset + ' ';
                if (error) { message += colors.BgRed + error + colors.Reset + ' '; }
                if (info) { message += info + ' '; }
                message += `\n`;
            }
            message += `\n`;

            message += `WebSocket: `;
            switch (socket.paintboardSocket.readyState) {
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
            message += `Last heartbeat time: ${socket.lastHeartbeatTime}\n`;
            message += `Painted: ${painter.paintEvents.done.length}  Painting: ${painter.paintEvents.painting.size}  Pending: ${painter.paintEvents.pending.length}\n\n`;

            for (let i = Math.min(config.paintOldLogSize, painter.paintEvents.done.length) - 1; i >= 0; i--) { message += this.outputPaintEvent(painter.paintEvents.done[painter.paintEvents.done.length - 1 - i]!); }
            for (const paintEvent of painter.paintEvents.painting.values()) { message += this.outputPaintEvent(paintEvent); }
            for (let i = 0; i < Math.min(config.paintLogSize, painter.paintEvents.pending.length); i++) { message += this.outputPaintEvent(painter.paintEvents.pending[i]!); }
            message += `\n`;

            for (let i = 0; i < Math.min(config.logSize, this.logs.length); i++) {
                message += this.logs[this.logs.length - 1 - i] + '\n';
            }

            console.clear();
            console.log(message);
        }, 100);
    }
}

export const report = new Report();
