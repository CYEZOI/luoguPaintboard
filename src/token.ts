import { config } from './config';
import { setIntervalImmediately } from './utils';

export class Token {
    lastUsed?: Date;
    token?: string;
    info?: string;
    error?: string;

    constructor(private uid: number, private paste: string) { }

    async fetchToken() {
        this.info = 'Getting token';
        this.error = '';
        if (this.token) {
            this.token = '';
        }
        try {
            const res = await fetch(`${config.socket.http}/api/auth/gettoken`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid: this.uid,
                    paste: this.paste,
                }),
            });
            if (res.status !== 200) { throw 'Request token failed'; }
            const data = await res.json();
            if (data.data.errorType) {
                this.error = `${data.data.errorType} ${data.data.message}`;
            }
            else {
                this.token = data.data.token;
                this.info = `Got token`;
            }
        } catch (err) {
            this.error = `Request token failed: ${err}`;
            setTimeout(() => { this.fetchToken(); }, config.token.retry);
        }
    }
}

export class Tokens {
    private readonly tokens: Map<number, Token> = new Map();

    constructor() {
        for (const [uid, paste] of Object.entries(config.token.pastes)) {
            this.tokens.set(parseInt(uid), new Token(parseInt(uid), paste as string));
        };
    }

    getToken(uid: number) { return this.tokens.get(uid); }
    getTokens() { return this.tokens; }

    isCooledDown(uid: number) {
        const token: Token = this.tokens.get(uid)!;
        if (token.lastUsed == null) {
            return true;
        }
        return new Date().getTime() - token.lastUsed.getTime() > config.token.cd;
    }

    async getAvailableToken() {
        return new Promise<[number, string]>((resolve) => {
            var intervalId: NodeJS.Timeout;
            intervalId = setIntervalImmediately(() => {
                for (const [uid, token] of this.tokens) {
                    if (this.isCooledDown(uid) && token.token) {
                        clearInterval(intervalId);
                        resolve([uid, token.token]);
                        break;
                    }
                }
            }, 100);
        });
    }

    useToken(uid: number) {
        return this.tokens.get(uid)!.lastUsed = new Date();
    }

    updateUseTime(uid: number, time: Date) {
        this.tokens.get(uid)!.lastUsed = time;
    }

    setInfo(uid: number, info: string) {
        this.tokens.get(uid)!.info = info;
    }
}

export const tokens = new Tokens();

for (const [_, token] of tokens.getTokens()) {
    token.fetchToken();
}
