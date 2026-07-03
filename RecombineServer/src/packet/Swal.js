// Import
var BinaryWriter = require('./BinaryWriter');

class Swal {
    constructor(message) {
        this.message = message;
    }
    build() {
        const writer = new BinaryWriter();
        writer.writeUInt8(52);
        writer.writeStringZeroUnicode(this.message);
        return writer.toBuffer();
    }
}
module.exports = Swal;
