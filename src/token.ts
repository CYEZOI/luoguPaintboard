import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { prisma } from './db';
import { setIntervalImmediately } from './utils';

export class Tokens {
    constructor(private readonly prismaToken: PrismaClient['token']) { }

    async fetchBlankTokenInterval() {
        setIntervalImmediately(async () => {
            const tokens = await this.prismaToken.findMany({ where: { token: null }, });
            if (tokens.length > 0) { this.fetchToken(tokens.map(token => token.uid)); }
        }, config.token.interval);
    }

    async fetchToken(uidList: number[]) {
        for (const uid of uidList) {
            const token = await this.prismaToken.findUnique({ where: { uid, }, });
            if (!token) { continue; }
            await this.prismaToken.update({ where: { uid, }, data: { token: null, message: 'Getting token', }, });
            try {
                const res = await fetch(`${config.socket.http}/api/auth/gettoken`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify({ uid, paste: token.paste, }),
                });
                if (res.status !== 200) { throw 'Request token failed'; }
                const data = await res.json();
                if (data.data.errorType) { await this.prismaToken.update({ where: { uid, }, data: { message: `${data.data.errorType} ${data.data.message}`, }, }); }
                else { await this.prismaToken.update({ where: { uid, }, data: { token: data.data.token, message: null, }, }); }
            } catch (err) {
                await this.prismaToken.update({ where: { uid, }, data: { message: `Request token failed: ${err}`, }, });
            }
        }
    }

    async getToken(uid: number) { return await this.prismaToken.findUnique({ where: { uid, }, }); }
    async getTokens() { return await this.prismaToken.findMany(); }

    async isCooledDown(uid: number) {
        const token = await this.getToken(uid);
        if (!token) { return false; }
        if (token.lastUsed == null) { return true; }
        return new Date().getTime() - token.lastUsed.getTime() > config.token.cd;
    }

    async getAvailableToken() {
        const token = await this.prismaToken.findFirst({ where: { token: { not: null }, lastUsed: { lt: new Date(new Date().getTime() - config.token.cd) }, }, });
        if (!token) { return null; }
        return { uid: token.uid, token: token.token! };
    }

    async updateUseTime(uid: number, lastUsed: Date) { await this.prismaToken.update({ where: { uid, }, data: { lastUsed, }, }); }
}

export const tokens = new Tokens(prisma.token);
tokens.fetchBlankTokenInterval();
