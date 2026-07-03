// Import
var BinaryWriter = require('./BinaryWriter');

class Quest {
    constructor(params) {
        this.params = params;
    }
    build() {
        const writer = new BinaryWriter();
        writer.writeUInt8(100);
        writer.writeUInt8(this.params.length);
        for (let i = 0; i < this.params.length; i++) {
            writer.writeUInt32(this.params[i]);
        }
        return writer.toBuffer();
    }
}
module.exports = Quest;
