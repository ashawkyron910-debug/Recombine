const Packet = require('../packet');
const playerData = require('../playerData');

const PACKS = [
    { id: 1, bots: 10, hours: 1, price: 70000, massBots: false },
    { id: 2, bots: 40, hours: 2, price: 125000, massBots: false },
    { id: 3, bots: 50, hours: 2, price: 149000, massBots: false },
    { id: 4, bots: 100, hours: 4, price: 480000, massBots: false },
    { id: 5, bots: 125, hours: 8, price: 600000, massBots: false },
    { id: 6, bots: 300, hours: 24, price: 900000, massBots: false },
    { id: 7, bots: 100, hours: 1, price: 800000, massBots: true, label: 'MASS' },
];

function getPack(id) {
    return PACKS.find((pack) => pack.id === id);
}

function sendState(player) {
    if (!player.socket || !player.socket.packetHandler) return;
    player.socket.packetHandler.sendPacket(new Packet.BotShop(player));
}

function removeMinions(player) {
    for (const client of player.server.clients) {
        const tracker = client.playerTracker;
        if (tracker && tracker.isMi && tracker.owner === player) {
            tracker.remove();
        }
    }
    player.hasMinions = false;
}

function activeMinionCount(player) {
    let count = 0;
    for (const client of player.server.clients) {
        const tracker = client.playerTracker;
        if (tracker && tracker.isMi && tracker.owner === player) count++;
    }
    return count;
}

function hasValidLicense(player) {
    return !!(player.botLicenseExpiresAt && Date.now() < player.botLicenseExpiresAt && player.botLicenseBots > 0);
}

function expireLicense(player) {
    removeMinions(player);
    player.botLicenseBots = 0;
    player.botLicenseExpiresAt = 0;
    player.botLicenseMassBots = false;
    playerData.syncFromPlayer(player);
    sendState(player);
}

function checkLicense(player) {
    if (player.botLicenseExpiresAt && Date.now() >= player.botLicenseExpiresAt) {
        expireLicense(player);
        return false;
    }
    return hasValidLicense(player);
}

function purchase(player, packId) {
    const pack = getPack(packId);
    if (!pack) {
        player.socket.packetHandler.sendPacket(new Packet.Swal('Invalid bot pack.'));
        return false;
    }
    if ((player.coins || 0) < pack.price) {
        player.socket.packetHandler.sendPacket(new Packet.Swal('Not enough coins!'));
        return false;
    }
    player.coins -= pack.price;
    const now = Date.now();
    const base = Math.max(now, player.botLicenseExpiresAt || 0);
    player.botLicenseExpiresAt = base + pack.hours * 3600000;
    player.botLicenseBots = pack.bots;
    player.botLicenseMassBots = !!pack.massBots;
    playerData.syncFromPlayer(player);
    player.socket.packetHandler.sendPacket(new Packet.PlayerStats(player));
    sendState(player);
    const label = pack.label ? `${pack.bots} ${pack.label} Bots` : `${pack.bots} Bots`;
    player.socket.packetHandler.sendPacket(new Packet.Swal(`Purchased ${label} for ${pack.hours}h!`));
    return true;
}

function startBots(player) {
    checkLicense(player);
    if (!hasValidLicense(player)) {
        player.socket.packetHandler.sendPacket(new Packet.Swal('No active bot license.'));
        return false;
    }
    if (!player.cells.length) {
        player.socket.packetHandler.sendPacket(new Packet.Swal('Spawn in first, then start bots.'));
        return false;
    }
    removeMinions(player);
    const count = player.botLicenseBots;
    const mass = player.botLicenseMassBots
        ? player.server.config.minionMaxStartSize * 1.5
        : undefined;
    for (let i = 0; i < count; i++) {
        player.server.bots.addMinion(player, '', mass);
    }
    player.hasMinions = true;
    sendState(player);
    player.socket.packetHandler.sendPacket(new Packet.Swal(`Started ${count} bots!`));
    return true;
}

module.exports = {
    PACKS,
    getPack,
    sendState,
    purchase,
    startBots,
    checkLicense,
    expireLicense,
    removeMinions,
    activeMinionCount,
    hasValidLicense,
};
