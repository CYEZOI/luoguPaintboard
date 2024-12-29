import config from './config.js';

export const tokenStatus = {
    tokens: new Map(),
    availableCount: 0,
};
config.pasteIds.forEach((pasteId, uid) => {
    tokenStatus.tokens[uid] = {
        lastUsed: new Date(0),
        token: '',
        info: 'Uninitialized',
        error: '',
        paste: pasteId,
    };
});

export const isCooledDown = (uid) => {
    return new Date() - tokenStatus.tokens[uid].lastUsed > 1000 * config.cd;
}

export const fetchToken = async (uid) => {
    if (tokenStatus.tokens[uid].token) {
        tokenStatus.tokens[uid].token = '';
        tokenStatus.availableCount--;
    }
    if (!tokenStatus.tokens[uid].paste) {
        tokenStatus.tokens[uid].error = 'No paste';
        return;
    }
    try {
        const res = await fetch(`${config.httpsUrl}/api/auth/gettoken`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                uid: Number(parseInt(uid)),
                paste: String(tokenStatus.tokens[uid].paste),
            }),
        });
        const data = await res.json();
        if (data.data.errorType) {
            tokenStatus.tokens[uid].error = `${data.data.errorType} ${data.data.message}`;
        }
        else {
            tokenStatus.tokens[uid].token = data.data.token;
            tokenStatus.tokens[uid].info = `Got token`;
            tokenStatus.availableCount++;
        }
    } catch (err) {
        tokenStatus.tokens[uid].error = `Request token failed: ${err}`;
    }
};

for (const uid in tokenStatus.tokens) {
    fetchToken(parseInt(uid));
}

export const getAvailableToken = async () => {
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            for (const uid in tokenStatus.tokens) {
                if (isCooledDown(uid) && tokenStatus.tokens[uid].token) {
                    clearInterval(interval);
                    resolve([parseInt(uid), tokenStatus.tokens[uid].token]);
                    break;
                }
            }
        }, 100);
    });
};

export const useToken = async (uid) => {
    return tokenStatus.tokens[uid].lastUsed = new Date();
};
