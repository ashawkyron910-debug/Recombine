const BinaryWriter = require('./BinaryWriter');
const botShop = require('../modules/botShop');

class BotShop {
    constructor(playerTracker) {
        this.playerTracker = playerTracker;
    }
    build() {
        const player = this.playerTracker;
        const writer = new BinaryWriter();
        writer.writeUInt8(54);
        const secondsLeft = player.botLicenseExpiresAt
            ? Math.max(0, Math.floor((player.botLicenseExpiresAt - Date.now()) / 1000))
            : 0;
        writer.writeUInt16(player.botLicenseBots || 0);
        writer.writeUInt32(secondsLeft);
        writer.writeUInt8(player.botLicenseMassBots ? 1 : 0);
        writer.writeUInt8(player.minionPanelEnabled !== false ? 1 : 0);
        const activeCount = botShop.activeMinionCount(player);
        writer.writeUInt8(activeCount > 0 ? 1 : 0);
        writer.writeUInt16(activeCount);
        return writer.toBuffer();
    }
}

module.exports = BotShop;
