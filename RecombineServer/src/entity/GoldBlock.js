const Cell = require('./Cell');
const GoldCoin = require('./GoldCoin');
const Vec2 = require('../modules/Vec2');

const GOLD_COLOR = { r: 255, g: 180, b: 0 };

class GoldBlock extends Cell {
    constructor(server, owner, position, size) {
        super(server, owner, position, size);
        this.type = 6;
        this.color = GOLD_COLOR;
        this.isAgitated = true;
    }

    canEat(cell) {
        return cell.type === 3;
    }

    onEat(prey) {
        if (prey.type === 3 && prey.owner) {
            prey.owner.addCoins(this.server.config.goldCoinReward);
        }
    }

    onAdd(server) {
        server.nodesGoldBlock.push(this);
    }

    onRemove(server) {
        const index = server.nodesGoldBlock.indexOf(this);
        if (index !== -1) {
            server.nodesGoldBlock.splice(index, 1);
        }
    }

    trySpawnCoin() {
        const interval = this.server.config.goldBlockSpawnInterval;
        if (!interval || this.server.ticks % interval !== 0) {
            return;
        }
        const angle = Math.random() * 2 * Math.PI;
        const dist = this._size + this.server.config.goldCoinSize;
        const pos = this.position.sum(Vec2.fromAngle(angle).product(dist));
        if (!this.server.onField(pos)) {
            return;
        }
        const coin = new GoldCoin(this.server, null, pos, this.server.config.goldCoinSize);
        this.server.addNode(coin);
    }
}

module.exports = GoldBlock;
