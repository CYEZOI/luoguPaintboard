import { PB } from './pb.js';
import { PBHistory } from './pbHistory.js';
import { TOKENS } from './token.js';
import { MONITOR } from './monitor.js';
import { fetchConfig } from './config.js';

fetchConfig().then(() => {
    const pb = new PB(); pb.registerEvent();
    const pbHistory = new PBHistory(); pbHistory.registerEvent();
    const tokens = new TOKENS(); tokens.registerEvent();
    const monitor = new MONITOR(); monitor.registerEvent();
});
