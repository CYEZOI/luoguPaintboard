import { config } from './config.js';
import { toLocaleISOString } from './utils.js';

export class PBHistory {
    historySpinner = document.getElementById('historySpinner');
    historyPaintboard = document.getElementById('historyPaintboard');
    historyRange = document.getElementById('historyRange');
    oldestLabel = document.getElementById('oldestLabel');
    currentLabel = document.getElementById('currentLabel');
    newestLabel = document.getElementById('newestLabel');
    currentLabelEditor = document.getElementById('currentLabelEditor');
    historyJumpButtons = document.getElementsByClassName('historyJumpButtons');

    enableChange = (enable) => {
        this.historySpinner.hidden = enable;
        this.historyRange.disabled = !enable;
        this.currentLabelEditor.disabled = !enable;
        for (let button of this.historyJumpButtons) {
            button.disabled = !enable;
        }
    };

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
                this.historyRange.removeAttribute('disabled');
                this.historyRange.oninput();
                this.changeHistoryRangeValue(this.historyRange.max);
                setInterval(() => {
                    this.historyRange.max = Math.floor(Date.now() / 1000);
                    this.historyRange.oninput();
                }, 1000);
            });

        this.historyRange.oninput = () => {
            const time = this.historyRange.value;
            this.oldestLabel.innerText = new Date(this.historyRange.min * 1000).toLocaleString();
            this.currentLabel.innerText = new Date(time * 1000).toLocaleString();
            this.newestLabel.innerText = new Date(this.historyRange.max * 1000).toLocaleString();
            this.currentLabelEditor.min = toLocaleISOString(new Date(this.historyRange.min * 1000));
            this.currentLabelEditor.max = toLocaleISOString(new Date(this.historyRange.max * 1000));
        };
        this.historyRange.onchange = () => {
            this.enableChange(false);
            const time = this.historyRange.value;
            this.historyPaintboard.setAttribute('src', '');
            this.historyPaintboard.setAttribute('src', `/history/${time}`);
        };

        this.oldestLabel.addEventListener('click', () => {
            this.changeHistoryRangeValue(this.historyRange.min);
        });
        this.newestLabel.addEventListener('click', () => {
            this.changeHistoryRangeValue(this.historyRange.max);
        });
        this.currentLabel.addEventListener('click', () => {
            this.currentLabel.hidden = true;
            this.currentLabelEditor.hidden = false;
            this.currentLabelEditor.focus();
            this.currentLabelEditor.value = toLocaleISOString(new Date(this.historyRange.value * 1000));
        });
        this.currentLabelEditor.addEventListener('blur', () => {
            this.currentLabelEditor.hidden = true;
            this.currentLabel.hidden = false;
            this.changeHistoryRangeValue(Math.floor(Date.parse(this.currentLabelEditor.value) / 1000));
        });

        for (let button of this.historyJumpButtons) {
            button.addEventListener('click', () => {
                const delta = parseInt(button.dataset.delta);
                var time = parseInt(this.historyRange.value) + delta;
                time = Math.max(this.historyRange.min, time);
                time = Math.min(this.historyRange.max, time);
                this.changeHistoryRangeValue(time);
            });
        }

        this.historyPaintboard.addEventListener('load', () => {
            this.enableChange(true);
        });
        this.historyPaintboard.addEventListener('error', (e) => {
            this.enableChange(true);
            alert('Failed to load history image: ' + e.target.src);
        });
        this.historyPaintboard.addEventListener('click', () => { open(this.historyPaintboard.src); });
    }

    changeHistoryRangeValue = (time) => {
        this.historyRange.value = time;
        this.historyRange.onchange();
    };
};
