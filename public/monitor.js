export class MONITOR {
    systemInfo = document.getElementById('systemInfo');
    monitorSocket;

    constructor() {
        this.setupSocket();
    }

    destroy = () => {
        this.monitorSocket.close(1000);
        this.systemInfo.innerHTML = '';
    };

    setupSocket = () => {
        this.monitorSocket = new WebSocket('/monitor');
        this.monitorSocket.addEventListener('message', (e) => {
            this.systemInfo.innerHTML = e.data;
        });
        this.monitorSocket.addEventListener('close', (e) => {
            if (e.code === 1000) { return; }
            setTimeout(() => { this.setupSocket(); }, 1000);
        });
    };
};
