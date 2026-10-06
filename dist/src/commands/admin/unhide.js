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
    .setName('unhide')
    .setDescription('Unhides a channel')
    .addChannelOption(option => option
    .setName('channel')
    .setDescription('The channel to unhide (current channel if not specified)')
    .setRequired(false))
    .addStringOption(option => option
    .setName('reason')
    .setDescription('The reason for unhiding')
    .setRequired(false));
const checkPermissions = (member) => {
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.unhide, discord_js_1.PermissionFlagsBits.ManageChannels);
};
const getLocale = (client, preferredLocale) => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    if (!locale?.commands?.unhide) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.unhide) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.unhide) {
        locale = {
            commands: {
                unhide: {
                    title: "Channel Visibility Changed",
                    description: "Channel visibility has been modified",
                    success: "Channel unhidden successfully",
                    error: "Failed to unhide channel",
                    noPermission: "You do not have permission to use this command.",
                    botNoPermission: "I do not have permission to manage this channel.",
                    commandError: "An error occurred while executing the command.",
                    channelNotFound: "Channel not found",
                    invalidChannel: "Invalid channel type. Must be a text channel.",
                    alreadyVisible: "This channel is already visible",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    unhiddenBy: "Unhidden by {user}",
                    channel: "Channel",
                    status: "Status",
                    visible: "🔓 Visible"
                }
            }
        };
    }
    return locale;
};
exports.command = {
    name: 'unhide',
    aliases: settingsManager_1.getSettings().commands?.unhide?.aliases || [],
    enabled: settingsManager_1.getSettings().commands?.unhide?.enabled ?? true,
    execute: async (interaction, args, client) => {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.unhide.noPermission,
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
            let targetChannel;
            let reason = null;
            if (isSlash) {
                const channel = interaction.options.getChannel('channel') || interaction.channel;
                reason = interaction.options.getString('reason');
                targetChannel = channel;
            }
            else {
                const channelMention = args[0]?.match(/^<#(\d+)>$/)?.[1];
                targetChannel = channelMention
                    ? guild?.channels.cache.get(channelMention)
                    : interaction.channel;
                reason = args.slice(channelMention ? 1 : 0).join(' ') || null;
            }
            if (!targetChannel || targetChannel.type !== discord_js_1.ChannelType.GuildText) {
                const reply = { content: locale.commands.unhide.invalidChannel, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const currentPerms = targetChannel.permissionOverwrites.cache.get(guild.id);
            if (!currentPerms?.deny.has(discord_js_1.PermissionFlagsBits.ViewChannel)) {
                const reply = { content: locale.commands.unhide.alreadyVisible, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.unhide.noReason}`;
            await targetChannel.permissionOverwrites.edit(guild.id, {
                ViewChannel: null
            }, { reason: formattedReason });
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.unhide.title)
                .setDescription(locale.commands.unhide.description)
                .setColor(0x00ff00)
                .addFields({
                name: `#️⃣ ${locale.commands.unhide.channel}`,
                value: targetChannel.toString(),
                inline: true
            }, {
                name: `👁️ ${locale.commands.unhide.status}`,
                value: locale.commands.unhide.visible,
                inline: true
            }, {
                name: `📝 ${locale.commands.unhide.reason}`,
                value: reason || locale.commands.unhide.noReason,
                inline: false
            })
                .setFooter({
                text: locale.commands.unhide.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
            })
                .setTimestamp();
            if (isSlash) {
                await interaction.reply({ embeds: [embed] });
            }
            else {
                await interaction.reply({ embeds: [embed] });
            }
        }
        catch (error) {
            console.error('Error executing unhide command:', error);
            const errorMessage = {
                content: locale.commands.unhide.commandError,
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
