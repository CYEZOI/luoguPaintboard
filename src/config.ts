import { parse } from 'yaml';
import { readFileSync } from 'fs';

export const config = parse(readFileSync('./config.yml', 'utf8'));
