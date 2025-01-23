import { TOKENS } from './token.js';
import { MONITOR } from './monitor.js';
import { IMAGE } from './image.js';

export class ADMIN {
    adminStyle = document.getElementById('adminStyle');
    adminPasswordInput = document.getElementById('adminPasswordInput');
    adminButton = document.getElementById('adminButton');

    tokens;
    monitor;
    image;

    login;

    constructor() {
        this.adminPasswordInput.addEventListener('input', () => {
            this.adminPasswordInput.classList.remove('is-invalid');
        });
        this.adminButton.addEventListener('click', () => {
            if (this.login) {
                fetch('/session', {
                    method: 'DELETE'
                }).then(response => response.json()).then(data => {
                    this.setLogin(false);
                });
            }
            else {
                fetch('/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: this.adminPasswordInput.value })
                }).then(response => response.json()).then(data => {
                    if (!data.error) {
                        this.setLogin(true);
                    }
                    else {
                        alert(data.error);
                        this.adminPasswordInput.classList.add('is-invalid');
                        this.setLogin(false);
                    }
                });
            }
        });

        this.setLogin(false);
        fetch('/session').then(response => response.json()).then(data => {
            if (data.valid) {
                this.setLogin(true);
            }
        });
    }

    setLogin(login) {
        if (this.login === login) { return; }
        this.login = login;
        if (this.login) {
            this.adminPasswordInput.value = '';
            this.adminPasswordInput.disabled = true;
            this.adminButton.innerHTML = '登出'; this.adminButton.classList.remove('btn-outline-primary'); this.adminButton.classList.add('btn-outline-warning');
            this.tokens = new TOKENS();
            this.monitor = new MONITOR();
            this.image = new IMAGE();
            this.adminStyle.innerHTML = ``;
        }
        else {
            this.adminPasswordInput.disabled = false;
            this.adminButton.innerHTML = '登录'; this.adminButton.classList.remove('btn-outline-warning'); this.adminButton.classList.add('btn-outline-primary');
            if (this.tokens) { this.tokens.destroy(); delete this.tokens; }
            if (this.monitor) { this.monitor.destroy(); delete this.monitor; }
            if (this.image) { this.image.destroy(); delete this.image; }
            this.adminStyle.innerHTML = `.adminOnly {
    filter: blur(5px);
    pointer-events: none;
    user-select: none;
}`;
        }
    }
}
