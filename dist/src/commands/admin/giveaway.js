"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = exports.data = void 0;
const discord_js_1 = require("discord.js");
const settingsManager_1 = require("../../utils/settingsManager");
const giveawayManager_1 = require("../../giveaway/giveawayManager");
const parseDuration = (input) => {
    const match = input.match(/^(\d+)([mhdw])$/i);
    if (!match)
        return null;
    const [, amount, unit] = match;
    const value = parseInt(amount);
    switch (unit.toLowerCase()) {
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        case 'w':
            const days = value * 7;
            if (days > 28)
                return null;
            return days * 24 * 60 * 60 * 1000;
        default:
            return null;
    }
};
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create a new giveaway')
    .addStringOption(option => option.setName('prize')
    .setDescription('What is being given away?')
    .setRequired(true))
    .addStringOption(option => option.setName('duration')
    .setDescription('How long should the giveaway last? (e.g., 1h, 1d)')
    .setRequired(true))
    .addIntegerOption(option => option.setName('winners')
    .setDescription('How many winners?')
    .setMinValue(1)
    .setMaxValue(10)
    .setRequired(true))
    .addChannelOption(option => option.setName('channel')
    .setDescription('Which channel to start the giveaway in?')
    .setRequired(false));
exports.command = {
    name: 'giveaway',
    enabled: settingsManager_1.getSettings().giveaway?.enabled ?? true,
    aliases: settingsManager_1.getSettings().giveaway?.aliases || ['gcreate', 'gstart', 'giveawaystart'],
    async execute(interaction, args, client) {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = interaction.guild;
        const locale = client.locales.get(guild?.preferredLocale || client.defaultLanguage)?.commands?.giveaway;
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!executingMember.permissions.has(discord_js_1.PermissionFlagsBits.ManageGuild)) {
                const response = locale?.error?.noPermission || "You don't have permission to create giveaways.";
                if (isSlash) {
                    await interaction.reply({ content: response, ephemeral: true });
                }
                else {
                    await interaction.reply(response);
                }
                return;
            }
            let prize, duration, winners, channel;
            if (isSlash) {
                const slashInteraction = interaction;
                prize = slashInteraction.options.getString('prize', true);
                const durationStr = slashInteraction.options.getString('duration', true);
                duration = parseDuration(durationStr) || 0;
                winners = slashInteraction.options.getInteger('winners', true);
                channel = (slashInteraction.options.getChannel('channel') || interaction.channel);
            }
            else {
                if (args.length < 3) {
                    await interaction.reply('Usage: !giveaway <duration> <winners> <prize>');
                    return;
                }
                duration = parseDuration(args[0]) || 0;
                winners = parseInt(args[1]);
                prize = args.slice(2).join(' ');
                channel = interaction.channel;
            }
            await (0, giveawayManager_1.createGiveaway)(client, {
                prize,
                duration,
                winners,
                channel,
                hostId: isSlash ? interaction.user.id : interaction.author.id
            });
            const response = locale?.success?.created?.replace('{channel}', channel.toString()) ||
                `Giveaway created in ${channel}!`;
            if (isSlash) {
                await interaction.reply({ content: response, ephemeral: true });
            }
            else {
                await interaction.reply(response);
            }
        }
        catch (error) {
            console.error('Error executing giveaway command:', error);
            const response = locale?.error?.unknown || 'An error occurred while creating the giveaway.';
            if (isSlash) {
                await interaction.reply({ content: response, ephemeral: true });
            }
            else {
                await interaction.reply(response);
            }
        }
    }
};
