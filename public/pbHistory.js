import { config } from './config.js';

export class PBHistory {
    historyPaintboard = document.getElementById('historyPaintboard');
    historyRange = document.getElementById('historyRange');

    constructor() {
        historyPaintboard.width = config.pb.width;
        historyPaintboard.height = config.pb.height;
        fetch('/history')
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                    return;
                }
                this.historyRange.min = data.oldest;
                this.historyRange.max = Math.floor(Date.now() / 1000);
                this.historyRange.value = this.historyRange.max;
                this.historyRange.removeAttribute('disabled');
                this.historyRange.onchange();
                setInterval(() => { this.historyRange.max = Math.floor(Date.now() / 1000); }, 1000);
            });
    }

    registerEvent = () => {
        this.historyRange.onchange = () => {
            const time = this.historyRange.value;
            fetch(`/history?time=${time}`)
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        alert(data.error);
                        return;
                    }
                    if (data.length !== config.pb.width * config.pb.height) {
                        alert('数据长度错误');
                        return;
                    }
                    const ctx = historyPaintboard.getContext('2d');
                    for (let i = 0; i < data.length; i++) {
                        const color = data[i];
                        const x = i % config.pb.width;
                        const y = Math.floor(i / config.pb.width);
                        ctx.fillStyle = `rgb(${color >> 16}, ${color >> 8 & 0xff}, ${color & 0xff})`;
                        ctx.fillRect(x, y, 1, 1);
                    }
                });
        };
    };
};

export const pbHistory = new PBHistory();
