// Library imports
var http = require('http');
var https = require('https');
var fs = require("fs");
var cookie = require('cookie');
var jwt = require('jsonwebtoken');
var axios = require('axios').default;

// Project imports
var Entity = require('./entity');
var Vec2 = require('./modules/Vec2');
var Logger = require('./modules/Logger');
var Colors = require('./modules/Colors');
var {QuadNode, Quad} = require('./modules/QuadNode.js');
const { addBan, removeBan, isBanned, addConnection } = require('./db');

// Server implementation
class Server {
    constructor() {
        // Location of source files - For renaming or moving source files!
        this.srcFiles = "../src";

        // Startup
        this.run = true;
        this.version = '1.6.2';
        this.httpServer = null;
        this.lastNodeId = 1;
        this.lastPlayerId = 1;
        this.clients = [];
        this.socketCount = 0;
        this.largestClient = null; // Required for spectators
        this.nodes = []; // Total nodes
        this.nodesVirus = []; // Virus nodes
        this.nodesPush = []; // Push pellets
        this.nodesFood = []; // Food nodes
        this.nodesEjected = []; // Ejected nodes
        this.nodesPlayer = []; // Player nodes
        this.movingNodes = []; // For move engine
        this.leaderboard = []; // For leaderboard
        this.leaderboardType = -1; // No type
        var BotLoader = require('./ai/BotLoader');
        this.bots = new BotLoader(this);

        // Main loop tick
        this.startTime = Date.now();
        this.stepDateTime = 0;
        this.timeStamp = 0;
        this.updateTime = 0;
        this.updateTimeAvg = 0;
        this.timerLoopBind = null;
        this.mainLoopBind = null;
        this.ticks = 0;
        this.disableSpawn = false;

        // Config
        this.config = require("./config.js");
        this.minionTest = [];
        this.badWords = [];
        this.loadFiles();

        // Set border, quad-tree
        this.setBorder(this.config.borderWidth, this.config.borderHeight);
        this.quadTree = new QuadNode(this.border);
    }
    start() {
        this.timerLoopBind = this.timerLoop.bind(this);
        this.mainLoopBind = this.mainLoop.bind(this);
        // Set up gamemode(s)
        var Gamemode = require('./gamemodes');
        this.mode = Gamemode.get(this.config.serverGamemode);
        this.mode.onServerInit(this);
        // Client Binding
        var bind = this.config.clientBind + "";
        this.clientBind = bind.split(' - ');
        // Start the server
        this.httpServer = process.env.USE_HTTPS ? https.createServer({
			key: fs.readFileSync(process.env.KEY_LOCATION),
			cert: fs.readFileSync(process.env.CERT_LOCATION)
		}) : http.createServer();
        var wsOptions = {
            server: this.httpServer,
            perMessageDeflate: false,
            maxPayload: 4096
        };
        Logger.info("WebSocket: " + this.config.serverWsModule);
        this.WebSocket = require(this.config.serverWsModule);
        this.wsServer = new this.WebSocket.Server(wsOptions);
        this.wsServer.on('error', this.onServerSocketError.bind(this));
        this.wsServer.on('connection', this.onClientSocketOpen.bind(this));
        this.httpServer.listen(this.config.serverPort, this.config.serverBind, this.onHttpServerOpen.bind(this));
        // Start stats port (if needed)
        if (this.config.serverStatsPort > 0) {
            this.startStatsServer(this.config.serverStatsPort);
        }
    }
    onHttpServerOpen() {
        // Start Main Loop
        setTimeout(this.timerLoopBind, 1);
        // Done
        Logger.info("Game server started, on port " + this.config.serverPort);
        Logger.info("Current game mode is " + this.mode.name);
        // Player bots (Experimental)
        if (this.config.serverBots) {
            for (var i = 0; i < this.config.serverBots; i++)
                this.bots.addBot();
            Logger.info("Added " + this.config.serverBots + " player bots");
        }
        this.spawnCells(this.config.virusAmount, this.config.foodAmount);
    }
    addNode(node) {
        // Add to quad-tree & node list
        var x = node.position.x;
        var y = node.position.y;
        var s = node._size;
        node.quadItem = {
            cell: node,
            bound: new Quad(x - s, y - s, x + s, y + s)
        };
        this.quadTree.insert(node.quadItem);
        this.nodes.push(node);
        // Special on-add actions
        node.onAdd(this);
    }
    onServerSocketError(error) {
        Logger.error("WebSocket: " + error.code + " - " + error.message);
        switch (error.code) {
            case "EADDRINUSE":
                Logger.error("Server could not bind to port " + this.config.serverPort + "!");
                Logger.error("Please close out of Skype or change 'serverPort' in the config to a different number.");
                break;
            case "EACCES":
                Logger.error("Please make sure you are running RecombineServer with root privileges.");
                break;
        }
        process.exit(1); // Exits the program
    }
    tokenUserCount(token) {
        let count = 0;
        for (let i = 0, len = this.clients.length; i < len; i++) {
            if (this.clients[i].userToken === token) {
                count++;
            }
        }
        return count;
    }
    async processConnection(ws, req) {
        req = req || ws.upgradeReq;
        const url = req.url ? req.url.slice(1) : '';
        const params = url ? new URLSearchParams(url) : { get() { return '' } };
        ws.info = {
            id: params.get("id") || '',
            ip: req.headers['x-forwarded-for'] || ws._socket.remoteAddress,
            fp: params.get("fp") || '',
            note: params.get("note") || '',
            token: params.get("token") || '',
        };

        const userId = await Discord.getUserId(ws.info.token);
        ws.info.user = userId;
        const discord = await Discord.getUser(userId);
        if (discord) {
            const { user, nick, roles } = discord;
            let color = '#FFFFFF';
            if (roles) {
                for (const role of roles) {
                    color = Discord.colors[role] ?? color;
                }
            }
            
            ws.playerTracker.discordNick = ws.info.nick = nick ?? user.username;
            ws.playerTracker.nameColor = ws.info.color = Colors.hexToRgb(color);
            ws.playerTracker.discordTag = ws.info.tag = `${user.username}#${user.discriminator}`;
        }
        var logip = ws._socket.remoteAddress + ":" + ws._socket.remotePort;
        ws.on('error', function (err) {
            Logger.writeError("[" + logip + "] " + err.stack);
        });
        if (this.config.serverMaxConnections && this.socketCount >= this.config.serverMaxConnections) {
            ws.close(1000, "No slots");
            return;
        }
        if (typeof ws.info.id !== "string" || !ws.info.id.match(/^[A-Za-z0-9]{50}$/)) {
            ws.close(1000, "Banned");
            return;
        }
        if (typeof ws.info.fp !== "string" || !ws.info.fp.match(/^[a-f0-9]{32}$/)) {
            ws.close(1000, "Banned");
            return;
        }
        if (false && await isBanned(ws.info)) {
            ws.close(1000, "Banned");
            return;
        }
        await addConnection(ws.info);
    }
    onClientSocketOpen(ws, req) {
        var ready = false;
        var queue = [];
        this.processConnection(ws, req).then(() => {
            let m;
            while (m = queue.shift()) {
                ws.packetHandler.handleMessage(m);
            }
            ready = true;
        });

        if (this.config.serverIpLimit) {
            var ipConnections = 0;
            for (var i = 0; i < this.clients.length; i++) {
                var socket = this.clients[i];
                if (!socket.isConnected || socket.remoteAddress != ws._socket.remoteAddress)
                    continue;
                ipConnections++;
            }
            if (ipConnections >= this.config.serverIpLimit) {
                ws.close(1000, "IP limit reached");
                return;
            }
        }
        if (this.config.clientBind.length && req.headers.origin.indexOf(this.clientBind) < 0) {
            ws.close(1000, "Client not allowed");
            return;
        }
        ws.isConnected = true;
        ws.remoteAddress = ws._socket.remoteAddress;
        ws.remotePort = ws._socket.remotePort;
        ws.lastAliveTime = Date.now();
        Logger.write("CONNECTED " + ws.remoteAddress + ":" + ws.remotePort + ", origin: \"" + req.headers.origin + "\"");
        var PlayerTracker = require('./PlayerTracker');
        ws.playerTracker = new PlayerTracker(this, ws);
        var PacketHandler = require('./PacketHandler');
        ws.packetHandler = new PacketHandler(this, ws);
        var PlayerCommand = require('./modules/PlayerCommand');
        ws.playerCommand = new PlayerCommand(this, ws.playerTracker);
    
        var self = this;
        ws.on('message', function (message) {
            if (self.config.serverWsModule === "uws")
                // uws gives ArrayBuffer - convert it to Buffer
                message = parseInt(process.version[1]) < 6 ? Buffer.from(message) : Buffer.from(message);
            if (!message.length)
                return;
            if (message.length > 256) {
                ws.close(1009, "Spam");
                return;
            }

            if (!ready) return void queue.push(message);
            ws.packetHandler.handleMessage(message);
        });
        ws.on('error', function (error) {
            ws.packetHandler.sendPacket = function (data) { };
        });
        ws.on('close', function (reason) {
            if (ws._socket && ws._socket.destroy != null && typeof ws._socket.destroy == 'function') {
                ws._socket.destroy();
            }
            self.socketCount--;
            ws.isConnected = false;
            ws.packetHandler.sendPacket = function (data) { };
            ws.closeReason = {
                reason: ws._closeCode,
                message: ws._closeMessage
            };
            ws.closeTime = Date.now();
            Logger.write("DISCONNECTED " + ws.remoteAddress + ":" + ws.remotePort + ", code: " + ws._closeCode +
                ", reason: \"" + ws._closeMessage + "\", name: \"" + ws.playerTracker._name + "\"");
        });
        this.socketCount++;
        this.clients.push(ws);
        // Check for external minions
        this.checkMinion(ws, req);
    }
    checkMinion(ws, req) {
        // Check headers (maybe have a config for this?)
        if (!req.headers['user-agent'] || !req.headers['cache-control'] ||
            req.headers['user-agent'].length < 50) {
            ws.playerTracker.isMinion = true;
        }
        // External minion detection
        if (this.config.serverMinionThreshold) {
            if ((ws.lastAliveTime - this.startTime) / 1000 >= this.config.serverMinionIgnoreTime) {
                if (this.minionTest.length >= this.config.serverMinionThreshold) {
                    ws.playerTracker.isMinion = true;
                    for (var i = 0; i < this.minionTest.length; i++) {
                        var playerTracker = this.minionTest[i];
                        if (!playerTracker.socket.isConnected)
                            continue;
                        playerTracker.isMinion = true;
                    }
                    if (this.minionTest.length)
                        this.minionTest.splice(0, 1);
                }
                this.minionTest.push(ws.playerTracker);
            }
        }
        // Add server minions if needed
        if (this.config.serverMinions && !ws.playerTracker.isMinion) {
            for (var i = 0; i < this.config.serverMinions; i++) {
                this.bots.addMinion(ws.playerTracker);
            }
        }
    }
    setBorder(width, height) {
        var hw = width / 2;
        var hh = height / 2;
        this.border = new Quad(-hw, -hh, hw, hh);
        this.border.width = width;
        this.border.height = height;
    }
    getRandomColor() {
        // get random
        var colorRGB = [0xFF, 0x07, (Math.random() * 256) >> 0];
        colorRGB.sort(function () {
            return 0.5 - Math.random();
        });
        // return random
        return {
            r: colorRGB[0],
            g: colorRGB[1],
            b: colorRGB[2]
        };
    }
    removeNode(node) {
        // Remove from quad-tree
        node.isRemoved = true;
        this.quadTree.remove(node.quadItem);
        node.quadItem = null;
        // Remove from node lists
        var i = this.nodes.indexOf(node);
        if (i > -1)
            this.nodes.splice(i, 1);
        i = this.movingNodes.indexOf(node);
        if (i > -1)
            this.movingNodes.splice(i, 1);
        // Special on-remove actions
        node.onRemove(this);
    }
    updateClients() {
        // check dead clients
        var len = this.clients.length;
        for (var i = 0; i < len;) {
            if (!this.clients[i]) {
                i++;
                continue;
            }
            this.clients[i].playerTracker.checkConnection();
            if (this.clients[i].playerTracker.isRemoved || this.clients[i].isCloseRequest)
                // remove dead client
                this.clients.splice(i, 1);
            else
                i++;
        }
        // update
        for (var i = 0; i < len; i++) {
            if (!this.clients[i])
                continue;
            this.clients[i].playerTracker.updateTick();
        }
        for (var i = 0; i < len; i++) {
            if (!this.clients[i])
                continue;
            this.clients[i].playerTracker.sendUpdate();
        }
        // check minions
        for (var i = 0, test = this.minionTest.length; i < test;) {
            if (!this.minionTest[i]) {
                i++;
                continue;
            }
            var date = new Date() - this.minionTest[i].connectedTime;
            if (date > this.config.serverMinionInterval)
                this.minionTest.splice(i, 1);
            else
                i++;
        }
    }
    updateLeaderboard() {
        // Update leaderboard with the gamemode's method
        this.leaderboard = [];
        this.leaderboardType = -1;
        this.mode.updateLB(this, this.leaderboard);
        if (!this.mode.specByLeaderboard) {
            // Get client with largest score if gamemode doesn't have a leaderboard
            var clients = this.clients.valueOf();
            // Use sort function
            clients.sort(function (a, b) {
                return b.playerTracker._score - a.playerTracker._score;
            });
            this.largestClient = null;
            if (clients[0])
                this.largestClient = clients[0].playerTracker;
        }
        else {
            this.largestClient = this.mode.rankOne;
        }
    }
    onChatMessage(from, to, message) {
        if (!message || !(message = message.trim()))
            return;
        if (!this.config.serverChat || (from && from.isMuted)) {
            // chat is disabled or player is muted
            return;
        }
        if (from && message.length && message[0] == '/') {
            // player command
            // from.socket.playerCommand.processMessage(from, message);
            return;
        }
        if (message.length > 64) {
            message = message.slice(0, 64);
        }
        if (this.config.serverChatAscii) {
            for (var i = 0; i < message.length; i++) {
                if ((message.charCodeAt(i) < 0x20 || message.charCodeAt(i) > 0x7F) && from) {
                    this.sendChatMessage(null, from, "Message failed - You can use ASCII text only!");
                    return;
                }
            }
        }
        if (this.checkBadWord(message) && from && this.config.badWordFilter === 1) {
            this.sendChatMessage(null, from, "Message failed - Stop insulting others! Keep calm and be friendly please.");
            return;
        }
        this.sendChatMessage(from, to, message);
    }
    checkBadWord(value) {
        if (!value)
            return false;
        value = " " + value.toLowerCase().trim() + " ";
        for (var i = 0; i < this.badWords.length; i++) {
            if (value.indexOf(this.badWords[i]) >= 0) {
                return true;
            }
        }
        return false;
    }
    sendChatMessage(from, to, message) {
        if (from) from.lastMessage = { time: Date.now(), text: message };
        for (var i = 0, len = this.clients.length; i < len; i++) {
            if (!this.clients[i])
                continue;
            if (!to || to == this.clients[i].playerTracker) {
                var Packet = require('./packet');
                if (this.config.separateChatForTeams && this.mode.haveTeams) {
                    //  from equals null if message from server
                    if (from == null || from.team === this.clients[i].playerTracker.team) {
                        this.clients[i].packetHandler.sendPacket(new Packet.ChatMessage(from, message));
                    }
                }
                else {
                    this.clients[i].packetHandler.sendPacket(new Packet.ChatMessage(from, message));
                }
            }
        }
    }
    setNote(to, message) {
        for (var i = 0, len = this.clients.length; i < len; i++) {
            if (!this.clients[i] || to !== this.clients[i])
                continue;
            var Packet = require('./packet');
            this.clients[i].packetHandler.sendPacket(new Packet.Note(message));
            this.clients[i].userNote = message;
        }
    }
    sendAlert(to, message) {
        for (var i = 0, len = this.clients.length; i < len; i++) {
            if (!this.clients[i] || to !== this.clients[i])
                continue;
            var Packet = require('./packet');
            this.clients[i].packetHandler.sendPacket(new Packet.Swal(message));
        }
    }
    timerLoop() {
        var timeStep = 40; // vanilla: 40
        var ts = Date.now();
        var dt = ts - this.timeStamp;
        if (dt < timeStep - 5) {
            setTimeout(this.timerLoopBind, timeStep - 5);
            return;
        }
        if (dt > 120)
            this.timeStamp = ts - timeStep;
        // update average, calculate next
        this.updateTimeAvg += 0.5 * (this.updateTime - this.updateTimeAvg);
        this.timeStamp += timeStep;
        setTimeout(this.mainLoopBind, 0);
        setTimeout(this.timerLoopBind, 0);
    }
    mainLoop() {
        this.stepDateTime = Date.now();
        var tStart = process.hrtime();
        var self = this;
        // Restart
        if (this.ticks > this.config.serverRestart) {
            this.httpServer = null;
            this.wsServer = null;
            this.run = true;
            this.lastNodeId = 1;
            this.lastPlayerId = 1;
            for (var i = 0; i < this.clients.length; i++) {
                var client = this.clients[i];
                client.close();
            }
            ;
            this.nodes = [];
            this.nodesVirus = [];
            this.nodesPush = [];
            this.nodesFood = [];
            this.nodesEjected = [];
            this.nodesPlayer = [];
            this.movingNodes = [];
            if (this.config.serverBots) {
                for (var i = 0; i < this.config.serverBots; i++)
                    this.bots.addBot();
                Logger.info("Added " + this.config.serverBots + " player bots");
            }
            ;
            this.commands;
            this.ticks = 0;
            this.startTime = Date.now();
            this.setBorder(this.config.borderWidth, this.config.borderHeight);
            this.quadTree = new QuadNode(this.border, 64, 32);
        }
        
        // Loop main functions
        if (this.run) {
            // AFK Disconnect
            this.nodesPlayer.forEach((cell) => {
                if (cell.createdAt < this.ticks - 25 * 600) this.removeNode(cell);
            })
            // Move moving nodes first
            this.movingNodes.forEach((cell) => {
                if (cell.isRemoved)
                    return;
                // Scan and check for ejected mass / virus collisions
                this.boostCell(cell);
                this.quadTree.find(cell.quadItem.bound, function (check) {
                    var m = self.checkCellCollision(cell, check);
                    if (cell.type == 3 && check.type == 3 && !self.config.mobilePhysics)
                        self.resolveRigidCollision(m);
                    else
                        self.resolveCollision(m);
                });
                if (!cell.isMoving)
                    this.movingNodes = null;
            });
            // Point closest cell
            this.clients.forEach((client) => {
                var player = client.playerTracker;
                var minDist = Infinity;
                player.cells.forEach((cell) => {
                    var d = player.mouse.difference(cell.position);
                    var distance = d.dist();
                    if (distance < minDist) {
                        player.closestCell = cell;
                        minDist = distance;
                    }
                })
            });
            // Move pushes
            this.nodesPush.forEach((push) => {
                if (push.getAge() > 25 * 3) {
                    return this.removeNode(push);
                }
                this.movePush(push);
                this.boostCell(push);
            });
            // Update players and scan for collisions
            var eatCollisions = [];
            this.nodesPlayer.forEach((cell) => {
                if (cell.isRemoved)
                    return;
                // Scan for eat/rigid collisions and resolve them
                this.quadTree.find(cell.quadItem.bound, function (check) {
                    var m = self.checkCellCollision(cell, check);
                    if (self.checkRigidCollision(m))
                        self.resolveRigidCollision(m);
                    else if (check != cell)
                        eatCollisions.unshift(m);
                });
                this.movePlayer(cell, cell.owner);
                this.instantMerge(cell, cell.owner);
                this.boostCell(cell);
                this.autoSplit(cell, cell.owner);
                // Decay player cells once per second
                if (((this.ticks + 3) % 25) === 0)
                    this.updateSizeDecay(cell);
                // Remove external minions if necessary
                if (cell.owner.isMinion) {
                    cell.owner.socket.close(1000, "Minion");
                    this.removeNode(cell);
                }
            });
            eatCollisions.forEach((m) => {
                this.resolveCollision(m);
            });
            // Remove dead viruses
            if (this.config.virusLifeTime) {
                this.nodesVirus.forEach(virus => {
                    if (this.ticks >= virus.createdAt + this.config.virusLifeTime * 25) this.removeNode(virus);
                });
            }
            if (this.config.ejectLifeTime) {
                this.nodesEjected.forEach(eject => {
                    if (this.ticks >= eject.createdAt + this.config.ejectLifeTime * 25) this.removeNode(eject);
                });
            }
            this.mode.onTick(this);
            this.ticks++;
        }
        if (!this.run && this.mode.IsTournament)
            this.ticks++;
        this.updateClients();
        // update leaderboard
        if (((this.ticks + 7) % 25) === 0)
            this.updateLeaderboard(); // once per second
        // ping server tracker
        if (this.config.serverTracker && (this.ticks % 750) === 0)
            this.pingServerTracker(); // once per 30 seconds
        // update-update time
        var tEnd = process.hrtime(tStart);
        this.updateTime = tEnd[0] * 1e3 + tEnd[1] / 1e6;
    }
    movePush(push) {
        const speed = push.getSpeed();
        const move = Vec2.fromAngle(push.direction).product(speed);
        push.position.add(move);
    }
    instantMerge(cell, client) {
        if (client.rec || client.mergeOverride) {
            cell._canRemerge = true; // cell.boostDistance < 100;
        }
    }
    // update remerge first
    movePlayer(cell, client) {
        if (client.socket.isConnected == false || !client.mouse)
            return; // Do not move
        if (client.frozen && !client.mergeOverride)
            return; // Here too
        if (client.frozen && client.mergeOverride && cell == client.closestCell)
            return; // Here too

        // get movement from vector
        var d = client.mouse.difference(cell.position);
        if (client.mergeOverride && cell !== client.closestCell) {
            d = client.closestCell.position.difference(cell.position);
            cell.speed = 5;
        } else {
            cell.speed = 1;
        }
        var move = cell.getSpeed(d.dist()); // movement speed
        if (!move)
            return; // avoid jittering
        cell.position.add(d.product(move));
        // update remerge
        var time = this.config.playerRecombineTime, base = Math.max(time, cell._size * 0.2) * 25;
        // regular remerge time
        cell._canRemerge = cell.getAge() >= base;
    }
    // decay player cells
    updateSizeDecay(cell) {
        var rate = this.config.playerDecayRate, cap = this.config.playerDecayCap;
        if (!rate || cell._size <= this.config.playerMinSize)
            return;
        // remove size from cell at decay rate
        if (cap && cell._mass > cap)
            rate *= 10;
        var decay = 1 - rate * this.mode.decayMod;
        cell.setSize(Math.sqrt(cell.radius * decay));
    }
    boostCell(cell) {
        if (cell.isMoving && !cell.boostDistance || cell.isRemoved) {
            cell.boostDistance = 0;
            cell.isMoving = false;
            return;
        }
        // decay boost-speed from distance
        var speed = cell.boostDistance / 9; // val: 87
        cell.boostDistance -= speed; // decays from speed
        cell.position.add(cell.boostDirection.product(speed));
        // update boundries
        cell.checkBorder(this.border);
        this.updateNodeQuad(cell);
    }
    autoSplit(cell, client) {
        // get size limit based off of rec mode
        if (client.rec)
            var maxSize = 1e9; // increase limit for rec (1 bil)
        else
            maxSize = this.config.playerMaxSize;
        // check size limit
        if (cell._size < maxSize)
            return;
        if (client.cells.length >= this.config.playerAutosplitCells || this.config.mobilePhysics) {
            // cannot split => just limit
            cell.setSize(maxSize);
        }
        else {
            // split in random direction
            var angle = Math.random() * 2 * Math.PI;
            this.splitPlayerCell(client, cell, angle, cell._mass * .5);
        }
    }
    updateNodeQuad(node) {
        // update quad tree
        var item = node.quadItem.bound;
        item.minx = node.position.x - node._size;
        item.miny = node.position.y - node._size;
        item.maxx = node.position.x + node._size;
        item.maxy = node.position.y + node._size;
        this.quadTree.remove(node.quadItem);
        this.quadTree.insert(node.quadItem);
    }
    // Checks cells for collision
    checkCellCollision(cell, check) {
        var p = check.position.difference(cell.position);
        // create collision manifold
        return {
            cell: cell,
            check: check,
            d: p.dist(),
            p: p // check - cell position
        };
    }
    // Checks if collision is rigid body collision
    checkRigidCollision(m) {
        if (!m.cell.owner || !m.check.owner)
            return false;
        if (m.cell.owner != m.check.owner) {
            // Minions don't collide with their team when the config value is 0
            if (this.mode.haveTeams && m.check.owner.isMi || m.cell.owner.isMi && this.config.minionCollideTeam === 0) {
                return false;
            }
            else {
                // Different owners => same team
                return this.mode.haveTeams &&
                    m.cell.owner.team == m.check.owner.team;
            }
        }
        var r = this.config.mobilePhysics ? 1 : 13;
        if (m.cell.getAge() < r || m.check.getAge() < r) {
            return false; // just splited => ignore
        }
        return !m.cell._canRemerge || !m.check._canRemerge;
    }
    // Resolves rigid body collisions
    resolveRigidCollision(m) {
        var push = (m.cell._size + m.check._size - m.d) / m.d;
        if (push <= 0 || m.d == 0)
            return; // do not extrude
        if (m.cell.owner && m.cell.owner == m.check.owner && m.cell.owner.frozen) {
            return;
        }
        // body impulse
        var rt = (m.cell.radius + m.check.radius) ** 1.05;
        var r1 = push * m.cell.radius / rt;
        var r2 = push * m.check.radius / rt;
        // apply extrusion force
        m.cell.position.subtract(m.p.product(r2));
        m.check.position.add(m.p.product(r1));
    }
    // Resolves non-rigid body collision
    resolveCollision(m) {
        var cell = m.cell;
        var check = m.check;
        if (cell._size > check._size) {
            cell = m.check;
            check = m.cell;
        }
        // Do not resolve removed
        if (cell.isRemoved || check.isRemoved)
            return;
        // check eating distance
        check.div = this.config.mobilePhysics ? 20 : 3;
        if (m.d >= check._size - cell._size / check.div) {
            return; // too far => can't eat
        }
        // collision owned => ignore, resolve, or remerge
        if (cell.owner && cell.owner == check.owner) {
            if (cell.getAge() < 13 || check.getAge() < 13)
                if (!cell.owner.mergeOverride) return; // just splited => ignore
        }
        else if (check._size < cell._size * 1.15 || !check.canEat(cell))
            return; // Cannot eat or cell refuses to be eaten
        // Consume effect
        check.onEat(cell);
        cell.onEaten(check);
        cell.killer = check;
        // Remove cell
        this.removeNode(cell);
        
        if (cell.owner === check.owner && cell.boostDistance > check.boostDistance) check.setBoost(cell.boostDistance, cell.boostDirection.angle())
        // Set mergeOverride to false
        if (cell.owner && cell.owner.cells.length <= 1 && cell.owner.mergeOverride) {
            check.addAnimation(0);
            cell.owner.mergeOverride = false;
        }
    }
    splitPlayerCell(client, parent, angle, mass) {
        var size = Math.sqrt(mass * 100);
        var size1 = Math.sqrt(parent.radius - size * size);
        // Too small to split
        if (!size1 || size1 < this.config.playerMinSize)
            return;
        // Remove size from parent cell
        parent.setSize(size1);
        // Create cell and add it to node list
        var newCell = new Entity.PlayerCell(this, client, parent.position, size, parent.animations);
        newCell.setBoost(this.config.splitVelocity * Math.pow(size, 0.0122), angle);
        this.addNode(newCell);
    }
    randomPos() {
        return new Vec2(this.border.minx + this.border.width * Math.random(),
            this.border.miny + this.border.height * Math.random());
    }
    onField(position) {
        return this.border.minx <= position.x && position.x <= this.border.minx + this.border.width
            && this.border.miny <= position.y && position.y <= this.border.miny + this.border.height;
    }
    spawnPush(position, direction) {
        const push = new Entity.PushPellet(this, null, position, direction);
        this.addNode(push);
    }
    spawnPushes(cell) {
        if (!cell) return;
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
            const add = Vec2.fromAngle(angle).product(cell._size);
            this.spawnPush(cell.position.sum(add), angle);
        }
    }
    spawnFood() {
        var cell = new Entity.Food(this, null, this.randomPos(), this.config.foodMinSize);
        if (this.config.foodMassGrow) {
            var maxGrow = this.config.foodMaxSize - cell._size;
            cell.setSize(cell._size += maxGrow * Math.random());
        }
        cell.color = this.getRandomColor();
        this.addNode(cell);
    }
    spawnVirus(position = this.randomPos(), forced = false) {
        var virus = new Entity.Virus(this, null, position, this.config.virusMinSize, forced);  
        if (!this.onField(position)) return;
        if (forced || !this.willCollide(virus)) {
            this.addNode(virus);
        }
    }
    spawnCells(virusCount, foodCount) {
        for (var i = 0; i < foodCount; i++) {
            this.spawnFood();
        }
        for (var ii = 0; ii < virusCount; ii++) {
            this.spawnVirus();
        }
    }
    spawnPlayer(player, pos) {
        if (this.disableSpawn)
            return; // Not allowed to spawn!
        // Check for special starting size
        var size = this.config.playerStartSize;
        if (player.spawnmass)
            size = player.spawnmass;
        // Check if can spawn from ejected mass
        var index = ~~(this.nodesEjected.length * Math.random());
        var eject = this.nodesEjected[index]; // Randomly selected
        if (Math.random() <= this.config.ejectSpawnPercent &&
            eject && eject.boostDistance < 1) {
            // Spawn from ejected mass
            pos = eject.position.clone();
            player.color = eject.color;
            size = Math.max(size, eject._size * 1.15);
        }
        // Spawn player safely (do not check minions)
        var cell = new Entity.PlayerCell(this, player, pos, size);
        if (this.willCollide(cell) && !player.isMi)
            pos = this.randomPos(); // Not safe => retry
        this.addNode(cell);
        // Set initial mouse coords
        player.mouse.assign(pos);
    }
    willCollide(cell) {
        const x = cell.position.x;
        const y = cell.position.y;
        const r = cell._size;
        const bound = new Quad(x - r, y - r, x + r, y + r);
        return this.quadTree.find(bound, n => n.type == 0);
    }
    splitCells(client) {
        // Split cell order decided by cell age
        var cellToSplit = [];
        for (var i = 0; i < client.cells.length; i++)
            cellToSplit.push(client.cells[i]);
        // Split split-able cells
        cellToSplit.forEach((cell) => {
            var d = client.mouse.difference(cell.position);
            if (d.distSquared() < 1) {
                d.x = 1, d.y = 0;
            }
            if (cell._size < this.config.playerMinSplitSize)
                return; // cannot split
            // Get maximum cells for rec mode
            if (client.rec)
                var max = 200; // rec limit
            else
                max = this.config.playerMaxCells;
            if (client.cells.length >= max)
                return;
            // Now split player cells
            this.splitPlayerCell(client, cell, d.angle(), cell._mass * .5);
        });
    }
    canEjectMass(client) {
        if (client.lastEject === null) {
            // first eject
            client.lastEject = this.ticks;
            return true;
        }
        var dt = this.ticks - client.lastEject;
        if (dt < this.config.ejectCooldown) {
            // reject (cooldown)
            return false;
        }
        client.lastEject = this.ticks;
        return true;
    }
    ejectMass(client, forced = false) {
        if (!forced && !this.canEjectMass(client)) return;
        for (var i = 0; i < client.cells.length; i++) {
            var cell = client.cells[i];
            if (cell._size < this.config.playerMinEjectSize) continue;
            var loss = this.config.ejectSizeLoss;
            var newSize = cell.radius - loss * loss;
            var minSize = this.config.playerMinSize;
            if (newSize < 0 || newSize < minSize * minSize)
                continue; // Too small to eject
            cell.setSize(Math.sqrt(newSize));

            var d = client.mouse.difference(cell.position);
            var sq = d.dist();
            d.x = sq > 1 ? d.x / sq : 1;
            d.y = sq > 1 ? d.y / sq : 0;

            // Get starting position
            var pos = cell.position.sum(d.product(cell._size));
            var angle = d.angle() + (Math.random() * .6) - .3;
            // Create cell and add it to node list
            var ejected;
            if (this.config.ejectVirus) {
                ejected = new Entity.Virus(this, null, pos, this.config.ejectSize);
            } else {
                ejected = new Entity.EjectedMass(this, null, pos, this.config.ejectSize);
            }
            ejected.color = cell.color;
            ejected.setBoost(this.config.ejectVelocity, angle);
            this.addNode(ejected);
        }
    }
    shootVirus(parent, angle) {
        // Create virus and add it to node list
        var pos = parent.position.clone();
        var newVirus = new Entity.Virus(this, null, pos, this.config.virusMinSize, parent.forced);
        newVirus.setBoost(this.config.virusVelocity, angle);
        this.addNode(newVirus);
    }
    ban(info) {
        addBan(info);
    }
    unban(info) {
        removeBan(info);
    }
    loadFiles() {
        //Logger.setVerbosity(this.config.logVerbosity);
        //Logger.setFileVerbosity(this.config.logFileVerbosity);
        // Load bad words
        var fileNameBadWords = this.srcFiles + '/badwords.txt';
        try {
            if (!fs.existsSync(fileNameBadWords)) {
                Logger.warn(fileNameBadWords + " not found");
            }
            else {
                var words = fs.readFileSync(fileNameBadWords, 'utf-8');
                words = words.split(/[\r\n]+/);
                words = words.map(function (arg) {
                    return " " + arg.trim().toLowerCase() + " "; // Formatting
                });
                words = words.filter(function (arg) {
                    return arg.length > 2;
                });
                this.badWords = words;
                Logger.info(this.badWords.length + " bad words loaded");
            }
        }
        catch (err) {
            Logger.error(err.stack);
            Logger.error("Failed to load " + fileNameBadWords + ": " + err.message);
        }
        // Convert config settings
        this.config.serverRestart = this.config.serverRestart === 0 ? 1e999 : this.config.serverRestart * 1500;
    }
    startStatsServer(port) {
        // Create stats
        this.getStats();
        // Show stats
        this.httpServer = http.createServer(function (req, res) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.writeHead(200);
            res.end(this.stats);
        }.bind(this));
        this.httpServer.on('error', function (err) {
            Logger.error("Failed to start stats server: " + err.message);
        });
        var getStatsBind = this.getStats.bind(this);
        this.httpServer.listen(port, function () {
            // Stats server
            Logger.info("Started stats server on port " + port);
            setInterval(getStatsBind, this.config.serverStatsUpdate * 1000);
        }.bind(this));
    }
    getStats() {
        // Get server statistics
        let alivePlayers = 0;
        let spectatePlayers = 0;
        let bots = 0;
        let minions = 0;
        for (const client of this.clients) {
            if (!client || !client.isConnected) continue;
            if (client.playerTracker.isBot) ++bots;
            else if (client.playerTracker.isMi) ++minions;
            else if (client.playerTracker.cells.length) ++alivePlayers;
            else ++spectatePlayers;
        }
        var s = {
            'server_name': this.config.serverName,
            'server_chat': this.config.serverChat ? "true" : "false",
            'border_width': this.border.width,
            'border_height': this.border.height,
            'gamemode': this.mode.name,
            'max_players': this.config.serverMaxConnections,
            'current_players': alivePlayers + spectatePlayers,
            'alive': alivePlayers,
            'spectators': spectatePlayers,
            'bots': bots,
            'minions': minions,
            'update_time': this.updateTimeAvg.toFixed(3),
            'uptime': Math.round((this.stepDateTime - this.startTime) / 1000 / 60),
            'start_time': this.startTime,
            'stats_time': Date.now()
        };
        this.statsObj = s;
        this.stats = JSON.stringify(s);
    }
    // Pings the server tracker, should be called every 30 seconds
    // To list us on the server tracker located at http://ogar.mivabe.nl/master
    pingServerTracker() {
    }
};

const Discord = {
    colors: {
        [process.env.RED_NAME_ROLE]: '#FF2222',
        [process.env.YELLOW_NAME_ROLE]: '#FFD700',
        [process.env.GREEN_NAME_ROLE]: '#22FF22',
        [process.env.BLUE_NAME_ROLE]: '#2299FF',
        [process.env.BLACK_NAME_ROLE]: '#000000',
        [process.env.PINK_NAME_ROLE]: '#F47FDF',
    },
    async getUserId(token) {
        try {
            const { data: { id } } = await axios.get('https://discord.com/api/users/@me', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            return id;
        } catch (e) {
            return false;
        }
    },
    async getUser(userId) {
        try {
            const { data } = await axios.get(`https://discord.com/api/guilds/${process.env.GUILD_ID}/members/${await userId}`, {
                headers: {
                    Authorization: `Bot ${process.env.BOT_TOKEN}`
                }
            });
            return data;
        } catch (e) {
            return false;
        }
    }
}

module.exports = Server;

