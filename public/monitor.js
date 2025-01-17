export class MONITOR {
    systemInfo = document.getElementById('systemInfo');

    constructor() {
        this.setupSocket();
    }

    setupSocket() {
        const monitorSocket = new WebSocket('/monitor/ws');
        monitorSocket.addEventListener('message', (e) => {
            this.systemInfo.innerHTML = e.data;
        });
        monitorSocket.addEventListener('close', () => {
            setTimeout(() => { this.setupSocket(); }, 1000);
        });
    }

    registerEvent() { }
};
