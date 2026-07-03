var Cell = require('./Cell');

class PushPellet extends Cell {
    constructor(server, owner, position, direction) {
        super(server, owner, position, 1);
        this.color = {
            r: 0xdd,
            g: 0xdd,
            b: 0x33,
        };
        this.direction = direction;
        this.type = 4;
        this.speed = 36;
    }
    canEat() {
        return false;
    }
    angleAbs(angle) {
        return angle >= 0 ? angle : angle + Math.PI * 2;
    }
    angleMin(angle) {
        return Math.min(angle, Math.PI * 2 - angle);
    }
    angleMax(angle) {
        return Math.max(angle, Math.PI * 2 - angle);
    }
    getSpeed() {
        return this.speed;
    }
    // Reflect push pellet from the border OwO
    checkBorder(b) {
        const r = this._size / 2;
        if (this.position.x < b.minx + r || this.position.x > b.maxx - r) {
            this.direction = this.angleAbs(Math.PI - this.direction); // Reflect left-right
            this.position.x = Math.max(this.position.x, b.minx + r);
            this.position.x = Math.min(this.position.x, b.maxx - r);
        }
        if (this.position.y < b.miny + r || this.position.y > b.maxy - r) {
            this.direction = this.angleAbs(2 * Math.PI - this.direction); // Reflect off of top and bottom, borders
            this.position.y = Math.max(this.position.y, b.miny + r);
            this.position.y = Math.min(this.position.y, b.maxy - r);
        }
    }

    onEaten(cell) {
        const bigDiff = this.angleAbs(cell.boostDirection.angle() - this.direction);
        if (!cell.boostPush && cell.boostDistance > 10 && this.angleMin(bigDiff) < Math.PI / 3) return;
        cell.setBoost(1024, this.direction, true);
    }
    onAdd(server) {
        server.nodesPush.push(this);
    }
    onRemove(server) {
        var index = server.nodesPush.indexOf(this);
        if (index != -1) server.nodesPush.splice(index, 1);
    }
}

module.exports = PushPellet;