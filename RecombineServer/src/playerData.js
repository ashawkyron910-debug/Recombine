const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'playerData.json');
let cache = {};
let dirty = false;
let saveTimer = null;

function defaultData() {
    return {
        coins: 0,
        totalCoinsEarned: 0,
        bestScore: 0,
        lastNick: '',
        lastSkin: '',
        totalFeeds: 0,
        goldCoinsCollected: 0,
        gamesPlayed: 0,
        updatedAt: Date.now()
    };
}

function load() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (err) {
        cache = {};
    }
}

function scheduleSave() {
    dirty = true;
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        if (!dirty) return;
        dirty = false;
        fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2));
    }, 300);
}

function flush() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    if (!dirty && Object.keys(cache).length) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2));
        return;
    }
    dirty = false;
    fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2));
}

function getPlayerKey(socket) {
    if (!socket || !socket.info) return null;
    if (socket.info.user) return 'discord:' + socket.info.user;
    if (socket.info.fp) return 'fp:' + socket.info.fp;
    if (socket.info.id) return 'id:' + socket.info.id;
    return null;
}

function get(key) {
    if (!key) return defaultData();
    if (!cache[key]) cache[key] = defaultData();
    return cache[key];
}

function save(key, data) {
    if (!key) return;
    cache[key] = Object.assign(defaultData(), data, { updatedAt: Date.now() });
    scheduleSave();
}

function loadInto(player) {
    const key = getPlayerKey(player.socket);
    player.dataKey = key;
    const data = get(key);
    player.coins = data.coins || 0;
    player.totalCoinsEarned = data.totalCoinsEarned || 0;
    player.bestScore = data.bestScore || 0;
    player.totalFeeds = data.totalFeeds || 0;
    player.goldCoinsCollected = data.goldCoinsCollected || 0;
    player.gamesPlayed = data.gamesPlayed || 0;
    player.savedData = data;
}

function syncFromPlayer(player) {
    const key = player.dataKey || getPlayerKey(player.socket);
    if (!key) return;
    const data = get(key);
    data.coins = player.coins || 0;
    data.totalCoinsEarned = Math.max(data.totalCoinsEarned || 0, player.totalCoinsEarned || 0);
    data.bestScore = Math.max(data.bestScore || 0, Math.floor(player._score || 0), Math.floor(player.bestScore || 0));
    data.lastNick = player._name || data.lastNick;
    data.lastSkin = player._skin || data.lastSkin;
    data.totalFeeds = player.totalFeeds || 0;
    data.goldCoinsCollected = player.goldCoinsCollected || 0;
    data.gamesPlayed = player.gamesPlayed || 0;
    save(key, data);
}

load();

process.on('exit', flush);

module.exports = {
    loadInto,
    syncFromPlayer,
    flush,
    getPlayerKey
};
