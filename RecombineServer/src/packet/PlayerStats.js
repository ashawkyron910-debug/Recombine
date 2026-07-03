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
        return writer.toBuffer();
    }
}
module.exports = PlayerStats;