import { config } from './config';
import { prisma } from './db';
import { setIntervalImmediately } from './utils';

export class Tokens {
    async fetchBlankTokenInterval() {
        setIntervalImmediately(async () => {
            const tokens = await prisma.token.findMany({ where: { value: null }, });
            if (tokens.length > 0) { this.fetchToken(tokens.map(token => token.uid)); }
        }, config.token.interval);
    }

    async fetchToken(uidList?: number[]) {
        for (const uid of uidList || (await prisma.token.findMany()).map(token => token.uid)) {
            const token = await prisma.token.findUnique({ where: { uid, }, });
            if (!token) { continue; }
            await prisma.token.update({ where: { uid, }, data: { value: null, info: 'Getting token', error: null, }, });
            try {
                const res = await fetch(`${config.socket.http}/api/auth/gettoken`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify({ uid, paste: token.paste, }),
                });
                if (res.status !== 200) { throw 'Request token failed'; }
                const data = await res.json();
                if (data.data.errorType) { await prisma.token.update({ where: { uid, }, data: { error: `${data.data.errorType} ${data.data.message}`, }, }); }
                else { await prisma.token.update({ where: { uid, }, data: { value: data.data.token, info: null, }, }); }
            } catch (err) {
                await prisma.token.update({ where: { uid, }, data: { error: `Request token failed: ${err}`, }, });
            }
        }
    }

    async getToken(uid: number) { return await prisma.token.findUnique({ where: { uid, }, }); }
    async getTokens() { return await prisma.token.findMany(); }

    async isCooledDown(uid: number) {
        const token = await this.getToken(uid);
        if (!token) { return false; }
        if (token.lastUsed == null) { return true; }
        return new Date().getTime() - token.lastUsed.getTime() > config.token.cd;
    }

    async getAvailableToken() {
        const token = await prisma.token.findFirst({ where: { value: { not: null }, lastUsed: { lt: new Date(new Date().getTime() - config.token.cd) }, }, });
        if (!token) { return null; }
        return { uid: token.uid, token: token.value! };
    }

    async updateUseTime(uid: number, lastUsed: Date) { await prisma.token.update({ where: { uid, }, data: { lastUsed, }, }); }
    async setInfo(uid: number, info: string) { await prisma.token.update({ where: { uid, }, data: { info, }, }); }
}

export const tokens = new Tokens();
tokens.fetchBlankTokenInterval();
