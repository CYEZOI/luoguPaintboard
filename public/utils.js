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
}
