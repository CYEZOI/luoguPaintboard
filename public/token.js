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

    registerEvent = () => {
        this.tokenButton.onclick = () => {
            fetch('/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify([{
                    uid: parseInt(this.tokenUidInput.value),
                    paste: this.tokenPasteIdInput.value,
                }]),
            })
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        alert(data.error);
                        return;
                    }
                    this.tokenUidInput.value = this.tokenPasteIdInput.value = '';
                });
        };

        this.tokenBulkButton.onclick = () => {
            const tokens = this.tokenBulkInput.value.split('\n').map(line => {
                const matched = line.match(/(\d+)[^\da-zA-Z]*(\w{6})/);
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
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(tokens),
            })
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        alert(data.error);
                        return;
                    }
                });
        };
    }

    setupSocket = () => {
        const tokenSocket = new WebSocket('/token');
        tokenSocket.onmessage = async (e) => {
            const data = await e.data.json();
            if (data.error) {
                alert(data.error);
                return;
            }
            this.tokenList.innerHTML = '';
            data.forEach(token => {
                const tokenElement = document.createElement('div');
                tokenElement.innerText = `${token.uid} ${token.paste}`;
                this.tokenList.appendChild(tokenElement);
            });
        };
    }
}

export const tokens = new TOKENS();
