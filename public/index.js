import { PB } from './pb.js';
import { PBHistory } from './pbHistory.js';
import { ADMIN } from './admin.js';
import { fetchConfig } from './config.js';

const bodyLoading = document.getElementById('bodyLoading');

fetchConfig().then(() => {
    bodyLoading.hidden = true;
    const pb = new PB();
    const pbHistory = new PBHistory();
    const admin = new ADMIN();
});
