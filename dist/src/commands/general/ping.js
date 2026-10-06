"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = exports.data = void 0;
const discord_js_1 = require("discord.js");
const settingsManager_1 = require("../../utils/settingsManager");
const permissionChecker_1 = require("../../utils/permissionChecker");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('ping')
    .setDescription('Shows bot latency information');
const checkPermissions = (member) => {
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.ping);
};
const getLocale = (client, preferredLocale) => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    if (!locale?.commands?.ping) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.ping) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.ping) {
        locale = {
            commands: {
                ping: {
                    title: "Bot Latency",
                    description: "Current latency metrics for the bot",
                    websocket: "WebSocket",
                    roundtrip: "Roundtrip",
                    message: "Message",
                    database: "Database",
                    api: "API",
                    calculating: "Calculating...",
                    noPermission: "You do not have permission to use this command.",
                    commandError: "An error occurred while executing the command.",
                    requestedBy: "Requested by {user}",
                    status: "Status",
                    excellent: "Excellent",
                    good: "Good",
                    okay: "Okay",
                    poor: "Poor"
                }
            }
        };
    }
    return locale;
};
const getLatencyColor = (ping) => {
    if (ping < 100)
        return 0x00ff00;
    if (ping < 200)
        return 0xffff00;
    if (ping < 300)
        return 0xffa500;
    return 0xff0000;
};
const getLatencyStatus = (ping, locale) => {
    if (ping < 100)
        return `🟢 ${locale.commands.ping.excellent}`;
    if (ping < 200)
        return `🟡 ${locale.commands.ping.good}`;
    if (ping < 300)
        return `🟠 ${locale.commands.ping.okay}`;
    return `🔴 ${locale.commands.ping.poor}`;
};
const formatPing = (ping) => {
    return `${Math.round(ping)}ms`;
};
exports.command = {
    name: 'ping',
    aliases: settingsManager_1.getSettings().commands?.ping?.aliases || [],
    enabled: settingsManager_1.getSettings().commands?.ping?.enabled ?? true,
    execute: async (interaction, _args, client) => {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.ping.noPermission,
                    flags: 1 << 6
                };
                if (isSlash) {
                    await interaction.reply(noPermissionMessage);
                }
                else {
                    await interaction.reply(noPermissionMessage.content);
                }
                return;
            }
            const wsLatency = client.ws.ping;
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.ping.title)
                .setDescription(locale.commands.ping.description)
                .setColor(getLatencyColor(wsLatency))
                .addFields({
                name: `📡 ${locale.commands.ping.websocket}`,
                value: formatPing(wsLatency),
                inline: true
            }, {
                name: `🔄 ${locale.commands.ping.roundtrip}`,
                value: locale.commands.ping.calculating,
                inline: true
            }, {
                name: `📊 ${locale.commands.ping.status}`,
                value: getLatencyStatus(wsLatency, locale),
                inline: false
            })
                .setFooter({
                text: locale.commands.ping.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
            })
                .setTimestamp();
            const start = Date.now();
            const response = await (isSlash
                ? interaction.reply({ embeds: [embed], fetchReply: true })
                : interaction.reply({ embeds: [embed] }));
            const roundtripLatency = Date.now() - start;
            embed.setColor(getLatencyColor(Math.max(wsLatency, roundtripLatency)))
                .spliceFields(1, 1, {
                name: `🔄 ${locale.commands.ping.roundtrip}`,
                value: formatPing(roundtripLatency),
                inline: true
            })
                .spliceFields(2, 1, {
                name: `📊 ${locale.commands.ping.status}`,
                value: getLatencyStatus(Math.max(wsLatency, roundtripLatency), locale),
                inline: false
            });
            await response.edit({ embeds: [embed] });
        }
        catch (error) {
            console.error('Error executing ping command:', error);
            const errorMessage = {
                content: locale.commands.ping.commandError,
                flags: 1 << 6
            };
            if (interaction instanceof discord_js_1.ChatInputCommandInteraction) {
                if (!interaction.replied) {
                    await interaction.reply(errorMessage);
                }
                else {
                    await interaction.followUp(errorMessage);
                }
            }
            else {
                await interaction.reply(errorMessage.content);
            }
        }
    }
};
