const Cell = require('./Cell');

const GOLD_COLOR = { r: 255, g: 215, b: 0 };

class GoldCoin extends Cell {
    constructor(server, owner, position, size) {
        super(server, owner, position, size);
        this.type = 5;
        this.color = GOLD_COLOR;
        this.overrideReuse = true;
    }

    canEat() {
        return false;
    }

    onAdd(server) {
        server.nodesGoldCoin.push(this);
    }

    onRemove(server) {
        const index = server.nodesGoldCoin.indexOf(this);
        if (index !== -1) {
            server.nodesGoldCoin.splice(index, 1);
        }
    }

    onEaten(hunter) {
        if (hunter.owner) {
            hunter.owner.addCoins(this.server.config.goldCoinReward);
        }
    }
}

module.exports = GoldCoin;
