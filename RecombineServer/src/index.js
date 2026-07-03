const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// External modules.
const ReadLine = require("readline");

// Project modules.
const { db } = require('./db');


const Commands = require("./modules/CommandList.js");
const Server = require("./Server.js");
const Logger = require("./modules/Logger.js");

// Create console interface.
const inputInterface = ReadLine.createInterface(process.stdin, process.stdout);

// Create and start instance of server.
const instance = new Server();
db.connect().then(() => {
    Logger.info('Connected to the database');
}).catch((e) => {
    Logger.error('Could not connect to the database. Continuing without it');
    console.error(e);
}).finally(() => {
    instance.start();
    // Welcome message.
    Logger.info(`Running RecombineServer ${instance.version}, a FOSS agar.io server implementation.`);

    // First prompt
    setTimeout(() => process.stdout.write("> "));

    // Catch console input.
    inputInterface.on("line", (input) => {
        const args = input.toLowerCase().split(" ");
        if (Commands[args[0]]) {
            Commands[args[0]](instance, args)
        };
        process.stdout.write("> ");
    });
});

process.on('uncaughtException', (e) => {
    console.error('Uncaught exception:', e);
});

process.on('unhandledRejection', (e) => {
    console.error('Unhandled rejection:', e);
});