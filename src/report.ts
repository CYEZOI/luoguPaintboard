import { WebSocket } from 'ws';
import { config } from './config';
import { painter } from './painter';
import { socket } from './socket';
import { tokens } from './token';
import { setIntervalImmediately } from './utils';

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

const color = (color: string, message?: string): string => {
    return color + message + colors.Reset;
};

export class Report {
    private readonly logs: string[] = [];
    private lastHeartbeat: Date | null = null;
    private lastPaintboardRefresh: Date | null = null;
    private lastPaintboardRefreshMessage: string = '';

    log(msg: string): void {
        this.logs.push(msg);
    }

    startReport() {
        setIntervalImmediately(() => {
            var message = '';
            for (const [uid, { token, info, error, lastUsed }] of tokens.getTokens()) {
                message += uid.toString().padEnd(7) + ' ';
                if (!token) { message += color(colors.FgRed, 'ERR '); }
                else if (tokens.isCooledDown(uid)) { message += color(colors.FgGreen, 'COOL'); }
                else { message += color(colors.FgRed, ((config.pb.cd - (new Date().getTime() - lastUsed!.getTime())) / 1000).toFixed(1).padStart(4)); }
                message += ' ';
                if (error) { message += color(colors.BgRed, error) + ' '; }
                if (info) { message += color(colors.FgCyan, info) + ' '; }
                message += `\n`;
            }
            message += `\n`;

            message += `WebSocket: `;
            switch (socket.paintboardSocket.readyState) {
                case WebSocket.CONNECTING:
                    message += color(colors.FgYellow, 'CONNECTING');
                    break;
                case WebSocket.OPEN:
                    message += color(colors.FgGreen, 'OPEN');
                    break;
                case WebSocket.CLOSING:
                    message += color(colors.FgYellow, 'CLOSING');
                    break;
                case WebSocket.CLOSED:
                    message += color(colors.FgRed, 'CLOSED');
            }
            message += colors.Reset + '\n';
            message += `Last heartbeat time: ` + color(colors.FgBlue, this.lastHeartbeat?.toLocaleString()) + `\n`;
            message += `Last paintboard refresh: ` + color(colors.FgBlue, this.lastPaintboardRefresh?.toLocaleString()) + ` ` + color(colors.FgRed, this.lastPaintboardRefreshMessage) + `\n`;
            message += `Painted: ${painter.paintEvents.done.length}  Painting: ${painter.paintEvents.painting.size}  Pending: ${painter.paintEvents.pending.length}\n`;

            message += `\n`;
            for (let i = 0; i < Math.min(config.log.size, this.logs.length); i++) {
                message += this.logs[this.logs.length - 1 - i] + '\n';
            }

            console.clear();
            console.log(message);
        }, 100);
    }

    heatBeat() { this.lastHeartbeat = new Date(); }
    paintboardRefresh(message?: string) {
        this.lastPaintboardRefresh = new Date();
        this.lastPaintboardRefreshMessage = message ?? '';
    }
}

export const report = new Report();
