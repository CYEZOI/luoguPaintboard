import { PrismaClient } from '@prisma/client'
import { logger } from './logger';

const dbLogger = logger.child({ module: 'db' });

export const prisma = new PrismaClient({
    log: [
        { emit: 'event', level: 'query', },
        { emit: 'event', level: 'info', },
        { emit: 'event', level: 'warn', },
        { emit: 'event', level: 'error', },
    ],
});

prisma.$on('query', (e) => { dbLogger.trace({ e }, `Query: ${e.duration}ms ${e.query}`); });
prisma.$on('info', (e) => { dbLogger.info({ e }, e.message); });
prisma.$on('warn', (e) => { dbLogger.warn({ e }, e.message); });
prisma.$on('error', (e) => { dbLogger.error({ e }, e.message); });
