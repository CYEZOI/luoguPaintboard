export class MONITOR {
    systemInfo = document.getElementById('systemInfo');

    constructor() {
        this.setupSocket();
    }

    setupSocket() {
        const monitorSocket = new WebSocket('/monitor/ws');
        var lastIn = 0;
        var lastOut = 0;
        monitorSocket.onmessage = async (e) => {
            const data = JSON.parse(e.data);
            var currentIn = data.networkStats[0].rx_bytes;
            var currentOut = data.networkStats[0].tx_bytes;
            this.systemInfo.innerHTML = `OS: ${data.osInfo.platform}   ${data.osInfo.distro} ${data.osInfo.release} ${data.osInfo.arch}   ${data.osInfo.hostname}
CPU: ${data.currentLoad.currentLoad.toFixed(2)}%   ${data.currentLoad.cpus.map((cpu) => cpu.load.toFixed(2))}
Memory: ${(data.mem.used / data.mem.total * 100).toFixed(2)}%   ${(data.mem.used / 1024 / 1024).toFixed(2)}MB / ${(data.mem.total / 1024 / 1024).toFixed(2)}MB
DiskIO: Read ${(data.disksIO.rIO / 1024 / 1024).toFixed(2)}MB/s   Write ${(data.disksIO.wIO / 1024 / 1024).toFixed(2)}MB/s
Network: In ${((currentIn - lastIn) / 1024).toFixed(2)}KB/s   Out ${((currentOut - lastOut) / 1024).toFixed(2)}KB/s`;
            lastIn = currentIn, lastOut = currentOut;
        };
        monitorSocket.addEventListener('close', () => {
            setTimeout(() => { this.setupSocket(); }, 1000);
        });
    }

    registerEvent() { }
};
