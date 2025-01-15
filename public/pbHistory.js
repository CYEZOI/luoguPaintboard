import { config } from './config.js';

export class PBHistory {
    historyContainer = document.getElementById('historyContainer');
    historyPaintboard = this.historyContainer.querySelector('img');
    historyRange = document.getElementById('historyRange');
    oldestLabel = document.getElementById('oldestLabel');
    currentLabel = document.getElementById('currentLabel');
    newestLabel = document.getElementById('newestLabel');

    constructor() {
        this.historyPaintboard.width = config.pb.width;
        this.historyPaintboard.height = config.pb.height;
        fetch('/history')
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                    return;
                }
                if (data.oldest === 0) {
                    alert('No history data available');
                    return;
                }
                this.historyRange.min = Math.ceil(data.oldest / 1000);
                this.historyRange.max = Math.floor(Date.now() / 1000);
                this.historyRange.value = this.historyRange.max;
                this.historyRange.removeAttribute('disabled');
                this.historyRange.oninput();
                this.historyRange.onchange();
                setInterval(() => {
                    this.historyRange.max = Math.floor(Date.now() / 1000);
                    this.historyRange.oninput();
                }, 1000);
            });
    }

    registerEvent = () => {
        this.historyRange.oninput = () => {
            const time = this.historyRange.value;
            this.oldestLabel.innerText = new Date(this.historyRange.min * 1000).toLocaleString();
            this.currentLabel.innerText = new Date(time * 1000).toLocaleString();
            this.newestLabel.innerText = new Date(this.historyRange.max * 1000).toLocaleString();
        };
        this.historyRange.onchange = () => {
            this.historyRange.disabled = true;
            historyContainer.classList.add('loading');
            const time = this.historyRange.value;
            this.historyPaintboard.setAttribute('src', `/history/${time}`);
        };

        this.oldestLabel.addEventListener('click', () => {
            this.historyRange.value = this.historyRange.min;
            this.historyRange.onchange();
        });
        this.newestLabel.addEventListener('click', () => {
            this.historyRange.value = this.historyRange.max;
            this.historyRange.onchange();
        });

        this.historyPaintboard.addEventListener('load', () => {
            this.historyRange.disabled = false;
            historyContainer.classList.remove('loading');
        });
        this.historyPaintboard.addEventListener('error', () => {
            this.historyRange.disabled = false;
            historyContainer.classList.remove('loading');
            alert('Failed to load history image');
        });
        this.historyPaintboard.addEventListener('click', () => { open(this.historyPaintboard.src); });
    };
};
