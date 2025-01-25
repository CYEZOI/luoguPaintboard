import { parse } from 'yaml';
import { readFileSync, watch } from 'fs';
import { logger } from './logger';

const configLogger = logger.child({ module: 'config' });

export interface CONFIG_DATA {
    token: {
        cd: number;
        interval: number;
    };
    pb: {
        width: number;
        height: number;
        refresh: number;
    };
    painter: {
        random: boolean;
        retry: number;
    };
    socket: {
        http: string;
        ws: string;
        batch: boolean;
        retry: number;
    };
    server: {
        port: number;
        bodyLimit: number;
        password: string;
        session: number;
    };
};

export class CONFIG {
    private _config: CONFIG_DATA;

    constructor() {
        this._config = parse(readFileSync('./config.yml', 'utf8')) as CONFIG_DATA;
    }

    get config(): CONFIG_DATA {
        return this._config;
    }

    watchFile = () => {
        watch('./config.yml', (event, _) => {
            configLogger.info(`Config file event: ${event}`);
            if (event === 'change') {
                configLogger.warn('Config file changed, reloading');
                try {
                    this._config = parse(readFileSync('./config.yml', 'utf8')) as CONFIG_DATA;
                } catch (error) {
                    configLogger.error(`Failed to reload config file: ${error}`);
                }
            }
        });
    };
}

export const config = new CONFIG();
