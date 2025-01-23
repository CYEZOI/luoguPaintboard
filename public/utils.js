const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const setIntervalImmediately = async (callback, interval) => {
    while (true) {
        var stop = false;
        var stopData;
        await callback((result) => {
            stop = true, stopData = result;
        });
        if (stop) { return stopData; }
        await delay(interval);
    }
};

export const toLocaleISOString = (date) => {
    return date.getFullYear() + '-' +
        ('0' + (date.getMonth() + 1)).slice(-2) + '-' +
        ('0' + date.getDate()).slice(-2) + 'T' +
        ('0' + date.getHours()).slice(-2) + ':' +
        ('0' + date.getMinutes()).slice(-2) + ':' +
        ('0' + date.getSeconds()).slice(-2);
};
