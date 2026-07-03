// Import
var BinaryWriter = require("./BinaryWriter");

class PlayerStats {
    constructor(playerTracker) {
        this.playerTracker = playerTracker;
    }
    build() {
        const writer = new BinaryWriter();
        writer.writeUInt8(51);
        var flags = 0;
        flags |= this.playerTracker.frozen;
        writer.writeUInt8(flags);
        writer.writeUInt32(this.playerTracker.coins >>> 0);
        writer.writeUInt32(this.playerTracker.totalCoinsEarned >>> 0);
        writer.writeUInt32(this.playerTracker.bestScore >>> 0);
        writer.writeUInt16(this.playerTracker.totalFeeds >>> 0);
        writer.writeUInt16(this.playerTracker.goldCoinsCollected >>> 0);
        return writer.toBuffer();
    }
}
module.exports = PlayerStats;