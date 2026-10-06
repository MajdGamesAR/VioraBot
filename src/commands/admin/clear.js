"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = exports.data = void 0;
const discord_js_1 = require("discord.js");
const settingsManager_1 = require("../../utils/settingsManager");
const permissionChecker_1 = require("../../utils/permissionChecker");
const moderationService_1 = require("../../moderation/moderationService");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clears messages from the channel')
    .addIntegerOption(option => option
    .setName('amount')
    .setDescription('Number of messages to clear (default: 100, max: 100)')
    .setRequired(false)
    .setMinValue(1)
    .setMaxValue(100));
const checkPermissions = (member) => {
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.clear, discord_js_1.PermissionFlagsBits.ManageMessages);
};
const getLocale = (client, preferredLocale) => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    if (!locale?.commands?.clear) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.clear) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.clear) {
        locale = {
            commands: {
                clear: {
                    title: "Messages Cleared",
                    description: "Messages have been cleared from the channel",
                    success: "Successfully cleared {count} messages",
                    error: "Failed to clear messages",
                    noPermission: "You do not have permission to use this command.",
                    botNoPermission: "I do not have permission to manage messages in this channel.",
                    commandError: "An error occurred while executing the command.",
                    invalidAmount: "Please provide a valid number between 1 and 100.",
                    maxAmount: "You can only clear up to 100 messages at once.",
                    requestedBy: "Requested by {user}",
                    amount: "Amount",
                    channel: "Channel",
                    cleared: "Cleared",
                    nothingToDelete: "No messages found to delete.",
                    tooOld: "Cannot delete messages older than 14 days."
                }
            }
        };
    }
    return locale;
};
exports.command = {
    name: 'clear',
    aliases: settingsManager_1.getSettings().commands?.clear?.aliases || [],
    enabled: settingsManager_1.getSettings().commands?.clear?.enabled ?? true,
    execute: async (interaction, args, client) => {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.clear.noPermission,
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
            const channel = isSlash ? interaction.channel : interaction.channel;
            if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
                const reply = { content: locale.commands.clear.commandError, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            let amount;
            if (isSlash) {
                amount = interaction.options.getInteger('amount') || 100;
            }
            else {
                amount = parseInt(args[0]) || 100;
            }
            if (isNaN(amount) || amount < 1) {
                const reply = { content: locale.commands.clear.invalidAmount, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (amount > 100) {
                const reply = { content: locale.commands.clear.maxAmount, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (!isSlash) {
                await interaction.delete().catch(() => { });
            }
            const result = await (0, moderationService_1.clear)({
                client,
                guild,
                member: executingMember,
                channel
            }, { count: amount });
            if (!result.ok) {
                const reply = { content: locale.commands.clear.error, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : channel.send(reply.content));
                return;
            }
            const deletedCount = result.result?.deleted ?? 0;
            if (deletedCount === 0) {
                const reply = { content: locale.commands.clear.nothingToDelete, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : channel.send(reply.content));
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.clear.title)
                .setDescription(locale.commands.clear.description)
                .setColor(0x00ff00)
                .addFields({
                name: `#️⃣ ${locale.commands.clear.channel}`,
                value: channel.toString(),
                inline: true
            }, {
                name: `🗑️ ${locale.commands.clear.amount}`,
                value: deletedCount.toString(),
                inline: true
            })
                .setFooter({
                text: locale.commands.clear.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
            })
                .setTimestamp();
            const reply = { embeds: [embed], flags: 1 << 6 };
            if (isSlash) {
                await interaction.reply(reply);
            }
            else {
                const msg = await channel.send(reply);
                setTimeout(() => msg.delete().catch(() => { }), 5000);
            }
        }
        catch (error) {
            console.error('Error executing clear command:', error);
            const errorMessage = {
                content: locale.commands.clear.commandError,
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
                const messageChannel = interaction.channel;
                if (messageChannel?.type === discord_js_1.ChannelType.GuildText) {
                    await messageChannel.send(errorMessage.content);
                }
            }
        }
    }
};
