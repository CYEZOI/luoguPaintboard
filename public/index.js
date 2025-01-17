import { PB } from './pb.js';
import { PBHistory } from './pbHistory.js';
import { TOKENS } from './token.js';
import { MONITOR } from './monitor.js';
import { IMAGE } from './image.js';
import { fetchConfig } from './config.js';

const bodyLoading = document.getElementById('bodyLoading');

fetchConfig().then(() => {
    bodyLoading.hidden = true;
    const pb = new PB(); pb.registerEvent();
    const pbHistory = new PBHistory(); pbHistory.registerEvent();
    const tokens = new TOKENS(); tokens.registerEvent();
    const monitor = new MONITOR(); monitor.registerEvent();
    const image = new IMAGE(); image.registerEvent();
});
