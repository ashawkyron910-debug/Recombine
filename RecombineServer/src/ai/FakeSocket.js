class FakeSocket {
    constructor(server) {
        this.server = server;
        this.isCloseRequest = false;
        this.isConnected = true;
        this.isFake = true;
        this.info = {};
    }
    sendPacket(packet) {
        return;
    }
    close() {
        this.isCloseRequest = true;
        this.isConnected = false;
    }
}

module.exports = FakeSocket;
