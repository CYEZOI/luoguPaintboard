export class MONITOR {
    systemRestartButton = document.getElementById('systemRestartButton');
    systemInfo = document.getElementById('systemInfo');
    monitorSocket;

    constructor() {
        this.setupSocket();
        this.systemRestartButton.addEventListener('click', this.handleSystemRestartButtonClick);
    }

    destroy = () => {
        this.monitorSocket.close(1000);
        this.systemInfo.innerHTML = '';
        this.systemRestartButton.removeEventListener('click', this.handleSystemRestartButtonClick);
    };

    handleSystemRestartButtonClick = async () => {
        const res = await fetch('/monitor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ action: 'restart' }),
        });
    };

    setupSocket = () => {
        this.monitorSocket = new WebSocket('/monitor/ws');
        this.monitorSocket.addEventListener('message', (e) => {
            this.systemInfo.innerHTML = e.data;
        });
        this.monitorSocket.addEventListener('close', (e) => {
            if (e.code === 1000) { return; }
            setTimeout(() => { this.setupSocket(); }, 1000);
        });
    };
};
