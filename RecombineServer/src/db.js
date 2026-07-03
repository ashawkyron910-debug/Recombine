const MongoClient = require('mongodb').MongoClient;
const uri = process.env.DB_URL;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

let isConnected = false;
/** @type {import('mongodb').Db} */
let db = null;

client.on('serverOpening', () => {
    isConnected = true;
    db = client.db('wynell-website');
    // db.createIndex({ _id: 1 }, { expireAfterSeconds: 24 * 60 * 60 });
});

client.on('serverClosed', () => {
    isConnected = false;
    db = null;
});

function isEmpty(o) {
    if (o === null) return false;
    if (typeof o !== 'object') return !o;
    if (Array.isArray(o)) return o.length === 0;
    return isEmpty(Object.keys(o));
}

function and({ id, ip, fp, tag, user, token, note } = {}, strict = false) {
    const ands = {};
    if (id) ands.id = id;
    if (ip) ands.ip = ip;
    if (fp) ands.fp = fp;
    if (user) ands.user = user;
    if (!strict && tag) ands.tag = tag;
    if (!strict && note) ands.note = note;
    if (!strict && token) ands.token = token;
    if (isEmpty(ands)) return false;
    return ands;
}

function or({ id, ip, fp, tag, user, token, note } = {}, strict = false) {
    const ors = [];
    if (id) ors.push({ id });
    if (ip) ors.push({ ip });
    if (fp) ors.push({ fp });
    if (user) ors.push({ user });
    if (!strict && tag) ors.push({ tag });
    if (!strict && note) ors.push({ note });
    if (!strict && token) ors.push({ token });
    if (isEmpty(ors)) return false;
    return { $or: ors };
}

async function addConnection(info, strict = false) {
    if (!isConnected) return false;
    const data = and(info, strict);
    if (!data) return false;
    return await db.collection('connections').insertOne(data);
}

async function getConnections(info, strict = false) {
    if (!isConnected) return false;
    const data = or(info, strict);
    if (!data) return false;
    return await db.collection('connections').find(data).toArray();
}

async function addBan(info, strict = false) {
    if (!isConnected) return false;
    const connections = await getConnections(info);
    if (!connections || connections.length === 0) return false;
    const data = connections.map((info) => and(info, strict)).filter(Boolean);
    return await db.collection('bans').insertMany(data);
}

async function removeBan(info, strict = false) {
    if (!isConnected) return false;
    const data = or(info, strict);
    if (!data) return false;
    return await db.collection('bans').deleteMany(data);
}

async function getBans(info, strict = true) {
    if (!isConnected) return false;
    const data = or(info, strict);
    if (!data) return false;
    return await db.collection('bans').find(data).toArray();
}

async function isBanned(info, strict = true) {
    if (!isConnected) return false;
    const bans = await getBans(info, strict);
    return bans && bans.length > 0;
}

module.exports = {
    db: client,
    addConnection,
    getConnections,
    addBan,
    removeBan,
    getBans,
    isBanned,
};
