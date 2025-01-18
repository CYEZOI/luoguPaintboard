import { config } from './config.js';
import { setIntervalImmediately } from './utils.js';

export class TOKENS {
    tokenUidInput = document.getElementById('tokenUidInput');
    tokenPasteIdInput = document.getElementById('tokenPasteIdInput');
    tokenButton = document.getElementById('tokenButton');

    tokenBulkInput = document.getElementById('tokenBulkInput');
    tokenBulkInfo = document.getElementById('tokenBulkInfo');
    tokenBulkButton = document.getElementById('tokenBulkButton');

    tokenList = document.getElementById('tokenList');

    constructor() {
        this.setupSocket();
    }

    createTokenElement = (token) => {
        const tokenElement = document.createElement('div');
        tokenElement.dataset.uid = token.uid;
        tokenElement.classList.add('list-group-item');
        if (token.token) { tokenElement.classList.remove('list-group-item-danger'); }
        else { tokenElement.classList.add('list-group-item-danger'); }

        const firstLine = document.createElement('div'); tokenElement.appendChild(firstLine);
        firstLine.classList.add('d-flex', 'w-100', 'justify-content-between');

        const left = document.createElement('div'); firstLine.appendChild(left);
        left.classList.add('form-check', 'form-switch');
        const leftSwitch = document.createElement('input'); left.appendChild(leftSwitch);
        leftSwitch.classList.add('form-check-input');
        leftSwitch.type = 'checkbox';
        leftSwitch.role = 'switch';
        leftSwitch.checked = token.enabled;
        leftSwitch.addEventListener('change', async () => {
            const res = await fetch(`/token/${token.uid}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify({ enabled: leftSwitch.checked }),
            });
            if (!res.ok) { leftSwitch.checked = !leftSwitch.checked; }
        });
        const leftText = document.createElement('div'); left.appendChild(leftText);
        leftText.classList.add('form-check-label');
        const link = document.createElement('a'); leftText.appendChild(link);
        link.href = `https://www.luogu.com/user/${token.uid}`;
        link.target = '_blank';
        link.innerText = token.uid;
        const small = document.createElement('small'); leftText.appendChild(small);
        small.classList.add('ms-2');

        const right = document.createElement('div'); firstLine.appendChild(right);
        right.classList.add('btn-group');
        const viewButton = document.createElement('button'); right.appendChild(viewButton);
        viewButton.classList.add('btn', 'btn-sm', 'btn-outline-primary');
        viewButton.innerText = '查看';
        viewButton.onclick = () => { window.open(`https://www.luogu.com/paste/${token.paste}`, '_blank'); };
        const deleteButton = document.createElement('button'); right.appendChild(deleteButton);
        deleteButton.classList.add('btn', 'btn-sm', 'btn-outline-danger');
        deleteButton.innerText = '删除';
        deleteButton.onclick = async () => {
            const res = await fetch(`/token/${token.uid}`, { method: 'DELETE', });
            if (res.ok) { tokenElement.remove(); }
        };

        const secondLine = document.createElement('div'); tokenElement.appendChild(secondLine);
        secondLine.classList.add('d-flex', 'w-100', 'justify-content-between');
        const message = document.createElement('div'); secondLine.appendChild(message);
        message.classList.add('text-muted');
        message.innerText = token.message;

        tokenElement.setAttribute('lastUsed', token.lastUsed);
        setIntervalImmediately(() => {
            tokenElement.classList.remove('list-group-item-warning');
            tokenElement.classList.remove('list-group-item-success');
            if (tokenElement.classList.contains('list-group-item-danger')) { return; }
            const wait = new Date(tokenElement.getAttribute('lastUsed')).getTime() + config.token.cd - Date.now();
            if (wait < 0) {
                tokenElement.classList.add('list-group-item-success');
            }
            else {
                tokenElement.classList.add('list-group-item-warning');
            }
            small.innerText = `等待 ${Math.floor(wait / 1000)} 秒`;
            if (wait < 0) { small.setAttribute('hidden', ''); }
            else { small.removeAttribute('hidden'); }
        }, 100);

        return tokenElement;
    };

    registerEvent = () => {
        this.tokenButton.onclick = () => {
            const uid = parseInt(this.tokenUidInput.value);
            const paste = this.tokenPasteIdInput.value;
            fetch('/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify([{ uid, paste, }]),
            })
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        alert(data.error);
                        return;
                    }
                    this.tokenUidInput.value = this.tokenPasteIdInput.value = '';
                    this.tokenList.appendChild(this.createTokenElement({
                        uid,
                        paste,
                        enabled: true,
                        token: null,
                        lastUsed: new Date(),
                        message: null,
                    }));
                });
        };

        this.tokenBulkButton.onclick = () => {
            const tokens = this.tokenBulkInput.value.split('\n').map(line => {
                const matched = line.match(/(\d+)[^\da-zA-Z]*(\w{8})/);
                if (matched) {
                    return {
                        uid: parseInt(matched[1]),
                        paste: matched[2],
                    };
                }
                return null;
            }).filter(token => token !== null);
            tokenBulkInfo.innerText = `导入 ${tokens.length} 条数据`;
            fetch('/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(tokens),
            })
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        alert(data.error);
                        return;
                    }
                    tokens.forEach(token => {
                        this.tokenList.appendChild(this.createTokenElement({
                            uid: token.uid,
                            paste: token.paste,
                            enabled: true,
                            token: null,
                            lastUsed: new Date(),
                            message: '',
                        }));
                    });
                });
        };
    }

    setupSocket = () => {
        fetch('/token')
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                    return;
                }
                this.tokenList.innerHTML = '';
                data.forEach(token => {
                    this.tokenList.appendChild(this.createTokenElement(token));
                });

                const tokenSocket = new WebSocket('/token/ws');
                tokenSocket.addEventListener('message', event => {
                    const data = JSON.parse(event.data);
                    const uid = data.uid;
                    const tokenElement = this.tokenList.querySelector(`[data-uid="${uid}"]`);
                    if (!tokenElement) { return; }
                    if (data.enabled !== undefined) { tokenElement.querySelector('input').checked = data.enabled; }
                    if (data.message !== undefined) { tokenElement.querySelector('div.text-muted').innerText = data.message; }
                    if (data.token !== undefined) {
                        if (data.token) { tokenElement.classList.remove('list-group-item-danger'); }
                        else { tokenElement.classList.add('list-group-item-danger'); }
                    }
                    if (data.lastUsed !== undefined) {
                        tokenElement.setAttribute('lastUsed', data.lastUsed);
                    }
                });

                tokenSocket.addEventListener('close', () => {
                    setTimeout(() => { this.setupSocket(); }, 1000);
                });
            });
    }
}
