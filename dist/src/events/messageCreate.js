"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = exports.once = exports.name = void 0;
const config_1 = __importDefault(require("../../config"));
exports.name = 'messageCreate';
exports.once = false;
const execute = async (message, client) => {
    if (message.author.bot)
        return;
    if (!message.content.startsWith(config_1.default.defaultPrefix))
        return;
    const args = message.content.slice(config_1.default.defaultPrefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName)
        return;
    const command = client.commands.get(commandName) ||
        client.commands.get(client.aliases.get(commandName));
    if (!command || !command.enabled)
        return;
    try {
        await command.execute(message, args, client);
    }
    catch (error) {
        console.error(error);
        await message.reply('There was an error executing that command.');
    }
};
exports.execute = execute;
