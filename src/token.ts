import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { prisma } from './db';
import { setIntervalImmediately } from './utils';
import { logger } from './logger';
import { closing } from './signal';

const tokenLogger = logger.child({ module: 'token' });

export class Tokens {
    constructor(private readonly prismaToken: PrismaClient['token']) { }
    private listeners: ((data: any) => void)[] = [];

    on = (listener: (data: any) => void) => { this.listeners.push(listener); };
    off = (listener: (data: any) => void) => { this.listeners = this.listeners.filter(l => l !== listener); };
    private trigger = (data: any) => { this.listeners.forEach(listener => listener(data)); };

    enableToken = async (uid: number) => {
        await this.prismaToken.update({ where: { uid, }, data: { enabled: true, }, });
        this.trigger({ uid, enabled: true, });
    }
    disableToken = async (uid: number) => {
        await this.prismaToken.update({ where: { uid, }, data: { enabled: false, }, });
        this.trigger({ uid, enabled: false, });
    }

    fetchBlankTokenInterval = async () => {
        return await setIntervalImmediately(async (stop) => {
            if (closing) { stop(); return; }
            const tokens = await this.prismaToken.findMany({ where: { token: null, enabled: true, }, });
            if (tokens.length > 0) {
                await this.fetchToken(tokens.map(token => token.uid));
            }
        }, config.token.interval);
    };

    fetchToken = async (uidList: number[]) => {
        for (const uid of uidList) {
            tokenLogger.info(`Fetching token for uid: ${uid}`);
            const token = await this.prismaToken.findUnique({ where: { uid, }, });
            if (!token) { continue; }
            await this.prismaToken.update({ where: { uid, }, data: { token: null, message: 'Getting token', }, });
            this.trigger({ uid, token: null, message: 'Getting token', });
            try {
                const res = await fetch(`${config.socket.http}/api/auth/gettoken`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify({ uid, paste: token.paste, }),
                });
                if (res.status !== 200) { throw `Status code: ${res.status}`; }
                const data = await res.json();
                if (data.data.errorType) {
                    await this.prismaToken.update({ where: { uid, }, data: { message: `${data.data.errorType} ${data.data.message}`, }, });
                    this.trigger({ uid, message: `${data.data.errorType} ${data.data.message}`, });
                }
                else {
                    await this.prismaToken.update({ where: { uid, }, data: { token: data.data.token, message: null, }, });
                    this.trigger({ uid, token: data.data.token, message: null, });
                }
            } catch (err) {
                await this.prismaToken.update({ where: { uid, }, data: { message: `Request token failed: ${err}`, }, });
                this.trigger({ uid, message: `Request token failed: ${err}`, });
                tokenLogger.error(`Fetch token failed: ${err}`);
            }
        }
    };

    getToken = async (uid: number) => { return await this.prismaToken.findUnique({ where: { uid, }, }); };
    getTokens = async () => { return await this.prismaToken.findMany(); };

    isCooledDown = async (uid: number) => {
        const token = await this.getToken(uid);
        if (!token) { return false; }
        if (token.lastUsed == null) { return true; }
        return new Date().getTime() - token.lastUsed.getTime() > config.token.cd;
    };

    getAvailableTokens = async () => {
        return await this.prismaToken.findMany({
            where: {
                token: { not: null },
                enabled: true,
                lastUsed: { lt: new Date(new Date().getTime() - config.token.cd) },
            },
            orderBy: { lastUsed: 'asc', }
        });
    };

    updateUseTime = async (uidList: number[], lastUsed: Date) => {
        for (const uid of uidList) { this.trigger({ uid, lastUsed, }); }
        await this.prismaToken.updateMany({
            where: { uid: { in: uidList }, },
            data: { lastUsed, },
        });
    };
};

export const tokens = new Tokens(prisma.token);
