export const fetchConfig = async () => {
    const res = await fetch('/config');
    config = await res.json();
};

export var config = {};
