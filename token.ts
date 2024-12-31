import config from './config';

export class Token {
    lastUsed: Date | null;
    token: string | null;
    info: string = 'Uninitialized';
    error: string = '';
    paste: string;
}

export class TokenManager {
    public readonly tokens: Map<number, Token>;
    private availableCount: number;

    constructor() {
        config.pasteIds.forEach((paste, uid) => {
            this.tokens[uid] = { paste, };
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
        if (token.token) {
            token.token = null;
            this.availableCount--;
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
                this.availableCount++;
            }
        } catch (err) {
            token.error = `Request token failed: ${err}`;
        }
        this.tokens.set(uid, token);
    }

    async getAvailableToken() {
        return new Promise<[number, string]>((resolve) => {
            var intervalId: number | null = null;
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

export const tokenManager = new TokenManager();

for (const [uid, _] of config.pasteIds) {
    tokenManager.fetchToken(uid);
}
