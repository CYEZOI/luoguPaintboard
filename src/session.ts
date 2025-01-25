import { config } from './config';
import { prisma } from './db';

export class SESSION {
    static async createSession() {
        const id = Math.random().toString(36).substring(2);
        await prisma.session.create({ data: { id, }, });
        return id;
    }
    static async verifySession(id: string | undefined) {
        if (!id) return false;
        const session = await prisma.session.findUnique({ where: { id }, });
        if (!session) return false;
        if (Date.now() - session.created.getTime() > config.config.server.session) {
            await prisma.session.delete({ where: { id }, });
            return false;
        }
        return true;
    }
    static async deleteSession(id: string) {
        await prisma.session.delete({ where: { id }, });
    }
};
