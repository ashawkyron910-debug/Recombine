const Logger = require("./Logger");

class CommandsList {
    constructor() {
        // Command descriptions
        this.help.description = "List of currently available commands";
        this.playerlist.description = "Produce a list of clients currently connected to the server";
        this.minion.description = "Give minions to a player";
        this.addbot.description = "Add player bots to this server";
        this.rmbot.description = "Remove bots from the server";
        this.banid.description = "Ban player by ID";
        this.banip.description = "Ban player by IP";
        this.unbanip.description = "Unban player by IP";
        this.msg.description = "Send server message";
        this.kick.description = "Kick a client from the game";
        this.killall.description = "Remove all client cells from the game";
        this.kill.description = "Remove specific player";
        this.exit.description = "Exit the server";
        this.stats.description = "Generate current server stats";
        this.gm.description = "Toggle player godmode";
        // this.aliases.description = "Generate command aliases";
        this.mass.description = "Set mass of every player cell";
        this.speed.description = "Set custom player speed";
        this.merge.description = "Make player merging";
        this.ureload.description = "Reload users";
        this.freload.description = "Reload server files (e. g. ban list, server roles)";
        this.swal.description = "Send the alert package to all players";
        this.note.description = "Set personal note about player";
        this.shortlist.description = "Get the short list of server players";
        this.name.description = "Set name of the player";
        this.time.description = "Get current time";
        this.namecolor.description = "Set name color of the player";
    };

    name(server, args) {
        const ID = parseInt(args[1]);
        const name = args.slice(2).join(' ');

        if (isNaN(ID)) {
            return Logger.warn('Please provide a numerical player ID or 0 to send the alert to all players.');
        };

        server.clients.forEach(socket => {
            const player = socket.playerTracker;
            if (ID === 0 && socket.isFake) return;
            if (ID <= 0 || player.pID === ID) {
                Logger.info(`Set name of ${player._name} to ${name || player.originalName || player._name}`);
                player.forceName(name);
            }
        });
    }

    namecolor(server, args) {
        const ID = parseInt(args[1]);
        
        const color = args[2];

        if (isNaN(ID)) {
            return Logger.warn('Please provide a numerical player ID or 0 to change the name color of all players.');
        };

        server.clients.forEach(socket => {
            const player = socket.playerTracker;
            if (ID === 0 && socket.isFake) return;
            if (ID <= 0 || player.pID === ID) {
                Logger.info(`Set name color of ${player._name} to ${color || player.originalNameColor || player.nameColor}`);
                player.forceNameColor(color);
            }
        });
    }

    swal(server, args) {
        const ID = parseInt(args[1]);

        if (isNaN(ID)) {
            return Logger.warn('Please provide a numerical player ID or 0 to send the alert to all players.');
        };

        const message = args.slice(2).join(' ');
        server.clients.forEach(socket => {
            const player = socket.playerTracker;
            if (socket.isFake) return;
            if (ID === 0 || player.pID === ID) {
                server.sendAlert(socket, message);
                Logger.info(`Sent alert to ${player._name}`);
            }
        });
    }

    note(server, args) {
        const ID = parseInt(args[1]);

        if (isNaN(ID)) {
            return Logger.warn('Please provide a numerical player ID');
        };

        const message = args.slice(2).join(' ');
        server.clients.forEach(socket => {
            const player = socket.playerTracker;
            if (socket.isFake) return;
            if (player.pID === ID) {
                server.setNote(socket, message);
                Logger.info(`Set note about ${player._name}`);
            }
        });
    }

    shortlist(server, args) {
        const query = args[1] ? String(args[1]).toLowerCase() : '';
        // Sort client IDs in descending order.
        server.clients.sort((a, b) => {return a.playerTracker.pID - b.playerTracker.pID});

        server.clients.forEach(socket => {
            const client = socket.playerTracker;
            const lastMessageTimeStamp = client.lastMessage.time ?? 0;
            const dateTime = new Date(lastMessageTimeStamp); 
	        const text = String(client.lastMessage.text).substr(0, 16);
            const result = `${dateTime.getHours()}:${dateTime.getMinutes()}:${dateTime.getSeconds()} - ${text}`;

            // Ignore disconnnected sockets.
            if (!socket.isConnected) {
                return;
            }
            if (!query || [client._name, client.pID, socket.info.token, socket.info.note].some((p) => String(p).toLowerCase().includes(query))) {
                console.log(`${client.pID}. ${client._name || "An unnamed cell"} ${socket.info.note ? `{${socket.info.note}} ` : ''}${lastMessageTimeStamp ? `[${result}] ` : ''}(${!socket.playerTracker.gm ? 'not-' : ''}god)`);
            }
        });
    }

    time() {
        const dateTime = new Date(); 
        const result = `${dateTime.getHours()}:${dateTime.getMinutes()}:${dateTime.getSeconds()}`;
	console.log(`Now: ${result}`);
    }

    freload(server) {
        server.loadFiles();
        Logger.info('Files reloaded');
    }

    banid(server, args) {
        const ID = parseInt(args[1]);

        if (isNaN(ID)) {
            return Logger.warn(`Please provide a numerical player ID.`);
        };

        server.clients.forEach(socket => {
            const client = socket.playerTracker;
            if (client.pID == ID && !client.isMi && !client.isBot) {
                server.ban(socket.info);
                socket.close(1000, 'Banned!');
                Logger.info(`Banned ${client._name} (${socket.remoteAddress})`);
            }
        });
    }

    banip(server, args) {
        const IP = String(args[1]);

        server.ban({ ip: IP });
        server.clients.forEach(socket => {
            // const client = socket.playerTracker;
            if (socket.remoteAddress == IP && !client.isMi && !client.isBot) {
                socket.close(1000, 'Banned!');
            }
        });
        Logger.info(`Banned ${IP}`);
    }

    respawn(server, args) {
        const ID = args[1];

        server.clients.forEach(socket => {
            const client = socket.playerTracker;
            if (client.pID == ID) {
                server.respawnPlayer(client);
            }
        });
        Logger.info(`Banned ${IP}`);
    }

    unbanip(server, args) {
        const IP = args[1];

        server.unban({ ip: IP });
        Logger.info(`Unbanned ${IP}`);
    }

    speed(server, args) {
        const ID = parseInt(args[1]);
        const amount = parseFloat(args[2]) || 0;

        if (isNaN(ID)) {
            return Logger.warn(`Please provide a numerical player ID.`);
        };

        server.clients.forEach(socket => {
            const client = socket.playerTracker;
            if (client.pID == ID) {
                client.speed = amount;
                Logger.info(`Set speed of ${client._name} to ${amount}`);
            }
        });
    }

    gm(server, args) {
        const ID = parseInt(args[1]);

        if (isNaN(ID)) {
            return Logger.warn(`Please provide a numerical player ID.`);
        };

        server.clients.forEach(socket => {
            const client = socket.playerTracker;
            if (client.pID == ID) {
                client.gm = !client.gm;
                Logger.info(`Set godmode of ${client._name} to ${client.gm}`);
            }
        });
    }

    merge(server, args) {
        const ID = parseInt(args[1]);

        if (isNaN(ID)) {
            return Logger.warn(`Please provide a numerical player ID.`);
        };

        server.clients.forEach(socket => {
            const client = socket.playerTracker;
            if (client.pID == ID) {
                // Process errors
                if (!client.cells.length) return Logger.warn("That player is either dead or not playing!");
                if (client.cells.length == 1) return Logger.warn("Client already has one cell!");
                // Set client's merge override
                client.mergeOverride = !client.mergeOverride;
                if (client.mergeOverride) Logger.print(client._name + " is now force merging");
                else Logger.print(client._name + " isn't force merging anymore");
            }
        });
    }

    msg(server, args) {
        const message = args.slice(1).join(' ');

        server.clients.forEach(socket => {
            const client = socket.playerTracker;
            server.sendChatMessage(null, client, message);
        });
    }

    help() {
        const commands = Object.getOwnPropertyNames(CommandsList.prototype); // List of methods.
        commands.shift(); // Remove constructor.

        Logger.info(`The server currently supports a total of ${commands.length} commands.`);

        // Print each command and its description.
        commands.forEach(command => {
            const commandObj = CommandsList.prototype[command]; // Command object

            // Ignore aliases, only print commands.
            if(CommandsList.prototype[commandObj.name] && !CommandsList.prototype[commandObj.name].isAlias) {
                console.log(`${commands.indexOf(command) + 1}. ${command}: ${commandObj.description}`);
            };
        });
    };

    playerlist(server, args) {
        const query = args[1] ? String(args[1]).toLowerCase() : '';
        // Sort client IDs in descending order.
        server.clients.sort((a, b) => {return a.playerTracker.pID - b.playerTracker.pID});

        server.clients.forEach(socket => {
            const client = socket.playerTracker;
            const lastMessageTimeStamp = client.lastMessage.time ?? 0;
            const dateTime = new Date(lastMessageTimeStamp); 
                const text = String(client.lastMessage.text).substr(0, 16);
            const result = `${dateTime.getHours()}:${dateTime.getMinutes()}:${dateTime.getSeconds()} - ${text}`;

            // Ignore disconnnected sockets.
            if(!socket.isConnected) {
                return;
            };

            if (!query || [client._name, client.pID, socket.info.token, socket.info.note].some((p) => String(p).toLowerCase().includes(query))) {
                Logger.info(`Info record for client ${client.pID}: `);
                console.log(`- isMinion: ${client.isMi}`);
                console.log(`- protocol:  ${client.protocol || "none"}`);
                console.log(`- remoteAdress: ${client.remoteAddress || "none"}`);
                console.log(`- spectate: ${client.spectate}`);
                console.log(`- name: ${client._name || "none"}`);
                console.log(`- cells: ${client.cells.length}`);
                console.log(`- score: ${Math.floor(client._score)}`);
                console.log(`- position: {x: ${Math.floor(client.centerPos.x)}, y: ${Math.floor(client.centerPos.y)}}`);
                console.log(`- ip: ${socket.remoteAddress + ":" + socket.remotePort}`);
                console.log(`- token: ${socket.info.token}`);
                console.log(`- note: ${socket.info.note || "none"}`)
                console.log(`- last message: ${result}`);
                console.log(`- gm: ${socket.playerTracker.gm}`);
                console.log(`\n`);
            }
        });
    };

    ureload(server) {
        server.reloadUsers();
        Logger.info("Users reloaded!");
    }

    minion(server, args) {
        const ID = parseInt(args[1]);
        const amount = parseInt(args[2]) || 1;
        const name = args.splice(3).join(" ");

        if (isNaN(ID)) {
            return Logger.warn(`Please provide a numerical player ID.`);
        };

        for (let key in server.clients) {
            const client = server.clients[key].playerTracker;

            // Check if server is empty.
            if(!server.clients.length) {
                return Logger.warn("The server is empty.");
            };

            // Only use the right ID, skip all others.
            if(client.pID != ID) {
                return;
            };

            // Remove minions if no amount is provided.
            if (client.hasMinions == true) {
                // Set hasMinions flag to false.
                client.hasMinions = false;
                return Logger.info(`Removed ${client._name}'s minions.`);
            };

            // Exclude disconnected players.
            if (!server.clients[key].isConnected) {
                return Logger.warn(`${client._name} isn't connected`)
            };


            // Add the provided (or default) amount of minions to the client specified.
            for (let i = 0; i < amount; i++) {
                server.bots.addMinion(client, name);
            };

            // Set hasMinions flag to true.
            client.hasMinions = true;

            return Logger.success(`Gave ${amount} minions to ${client._name}`);
        };
    };

    addbot(server, args) {
        const amount = parseInt(args[1]) || 1;

        // Add the provide amount of bots to the server.
        for (let i = 0; i != amount; i++) {
            server.bots.addBot();
        };

        return Logger.success(`Added ${amount} player bot${amount > 1 ? "s"  : ""} to the game. Use the rmbot command to remove them.`);
    };

    rmbot(server, args) {
        const amount = parseInt(args[1]) || server.clients.length;
        let total = 0;

        server.clients.forEach(socket => {
            const client = socket.playerTracker;
            if(!socket.isConnected && total <= amount) {
                socket.close()
                return total++;
            };
        });

        return Logger.success(`Removed a total ${total} bots out of the requested amount of ${amount}.`)
    };

    kick(server, args) {
        const ID = parseInt(args[1]) || args[1];
        let total = 0;

        // Check if server is empty.
        if(!server.clients.length) {
            return Logger.warn("The server is empty.");
        };


        server.clients.forEach(socket => {
            const client = socket.playerTracker;

            if(client.pID == ID || ID == "all") {
                socket.close();
               return total++;
            };
        });

        if(total > 0) {
            return Logger.success(`Kicked ${total} client${total > 1 ? "s" : ""}.`);
        } else if (total == 0 && ID != "all") {
            return Logger.warn(`Please provide an amount of bots to kick. Or provide "all" to kick all bots.`)
        };
    };

    kill(server, args) {
        const ID = parseInt(args[1]);
        var total = 0;

        if (isNaN(ID)) {
            return Logger.warn(`Please provide a numerical player ID.`);
        };

        server.clients.forEach(socket => {
            const client = socket.playerTracker;
            if (client.pID == ID) {
                while (client.cells.length) {
                    server.removeNode(client.cells[0]);
                    total++;
                };
            }
        });

        if (total == 0) {
            return Logger.warn('Player already had 0 cells');
        }
        return Logger.success(`Removed ${total} player cells`);
    };

    killall(server, split) {
        // Check if server is empty.
        if(!server.clients.length) {
            return Logger.warn("The server is empty.");
        };

        server.clients.forEach(socket => {
            const client = socket.playerTracker;

            while (client.cells.length) {
                server.removeNode(client.cells[0]);
            };
        });

        return Logger.success("Removed all players.");
    };

    mass(server, args) {
        const ID = parseInt(args[1]);
        const mass = Math.sqrt((parseInt(args[2])) * 100);

        if (isNaN(ID)) {
            return Logger.warn(`Please provide a numerical player ID.`);
        };

        if(isNaN(mass)) {
            return Logger.warn(`Please provide a numerical mass.`);
        };

        server.clients.forEach(socket => {
            const client = socket.playerTracker;

            if(client.pID == ID) {
                client.cells.forEach(cell => {
                    cell.setSize(mass);
                });

                return Logger.success(`Set ${client._name || "An unnamed cell"}'s mass to ${mass}`);
            };
        });

    };

    exit(server, args) {
        const exitCode = args[1]; // Optional exit code.

        Logger.info("Exiting server...");
        return process.exit(exitCode);
    };

    stats(server, args) {
        Logger.info(`Connected players: ${server.clients.length} / ${server.config.serverMaxConnections}`);
        Logger.info(`Clients: ${server.clients.length}`);
        Logger.info(`Server uptime: ${Math.floor(process.uptime() / 60)}`);
        Logger.info(`Process memory usage ${Math.round(process.memoryUsage().heapUsed / 1048576 * 10) / 10 }/${Math.round(process.memoryUsage().heapTotal / 1048576 * 10) / 10} mb`);
        Logger.info(`Update time: ${server.updateTimeAvg.toFixed(3)}ms`);
    }

    // aliases(server, args) {
    //     const commands = Object.getOwnPropertyNames(CommandsList.prototype); // List of methods.
    //     commands.shift(); // Remove constructor.

    //     commands.forEach(command => {
    //         const commandObj = CommandsList.prototype[command]; // Command object.
    //         const aliasName = commandObj.name[0] + commandObj.name[commandObj.name.length - 1]; // Alias name.

    //         // Ignore aliases, only print commands.
    //         if(CommandsList.prototype[commandObj.name]) {
    //             CommandsList.prototype[aliasName] = (server, args) => CommandsList.prototype[commandObj.name](server, args);
    //             CommandsList.prototype[aliasName].isAlias = true;
    //         };
    //     });

    //     return Logger.success("Aliases generated.");
    // };
};

module.exports = new CommandsList();
