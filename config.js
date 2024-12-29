export default {
    pasteIds: new Map([
        [1392381, "cteoolcs"],
        [246316, "xteor6v6"],
        [280823, "1ze6326t"],
        [286448, "dipgjcvv"],
        [286471, "7b5tzo8w"],
        [450211, "jansj9zt"],
        [564728, "3r21cpoj"],
        [638491, "mrosnexg"],
        [646208, "d6ggyum6"],
        [705374, "5gw9l8hj"],
        [722264, "myeohyma"],
        [785784, "wvv5abqo"],
        [917745, "be89cjsa"],
    ]),
    cd: 30, // 每个点绘图的冷却时间
    cdRetry: 1, // 如果已经到时间但是服务器返回正在冷却，那么再等待多久
    paintOldLogSize: 15,
    paintLogSize: 5, // 显示的绘图日志数量
    logSize: 5, // 显示的日志数量
    width: 1000, // 画板宽度
    height: 600, // 画板高度
    refreshInterval: 60, // 画板整体刷新间隔
    httpsUrl: "https://api.paintboard.ayakacraft.com:32767",
    wsUrl: "wss://api.paintboard.ayakacraft.com:32767/api/paintboard/ws",
};
