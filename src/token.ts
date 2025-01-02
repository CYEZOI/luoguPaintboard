import { config } from './config';

export type Token = {
    lastUsed: Date | null;
    token: string | null;
    info: string;
    error: string;
    paste: string;
}

export class Tokens {
    public readonly tokens: Map<number, Token> = new Map();

    constructor() {
        config.pasteIds.forEach((paste, uid) => {
            this.tokens.set(uid, {
                lastUsed: null,
                token: null,
                info: '',
                error: '',
                paste,
            });
        });
    }

    isCooledDown(uid: number) {
        const token: Token = this.tokens.get(uid)!;
        if (token.lastUsed == null) {
            return true;
        }
        return new Date().getTime() - token.lastUsed.getTime() > 1000 * config.cd;
    }

    async fetchToken(uid: number) {
        const token = this.tokens.get(uid)!;
        token.info = 'Getting token';
        token.error = '';
        this.tokens.set(uid, token);
        if (token.token) {
            token.token = null;
        }
        try {
            const res = await fetch(`${config.httpsUrl}/api/auth/gettoken`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid,
                    paste: token.paste,
                }),
            });
            const data = await res.json();
            if (data.data.errorType) {
                token.error = `${data.data.errorType} ${data.data.message}`;
            }
            else {
                token.token = data.data.token;
                token.info = `Got token`;
            }
        } catch (err) {
            token.error = `Request token failed: ${err}`;
            setTimeout(() => { this.fetchToken(uid); }, 1000 * config.cdRetry);
        }
        this.tokens.set(uid, token);
    }

    async getAvailableToken() {
        return new Promise<[number, string]>((resolve) => {
            var intervalId: NodeJS.Timeout | null = null;
            const check = () => {
                for (const [uid, token] of this.tokens) {
                    if (this.isCooledDown(uid) && token.token) {
                        intervalId && clearInterval(intervalId);
                        resolve([uid, token.token]);
                        break;
                    }
                }
            };
            check();
            intervalId = setInterval(check, 100);
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

for (const [uid, _] of config.pasteIds) {
    tokens.fetchToken(uid);
}
