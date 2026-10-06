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
    .setName('hide')
    .setDescription('Hides a channel')
    .addChannelOption(option => option
    .setName('channel')
    .setDescription('The channel to hide (current channel if not specified)')
    .setRequired(false))
    .addStringOption(option => option
    .setName('reason')
    .setDescription('The reason for hiding')
    .setRequired(false));
const checkPermissions = (member) => {
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.hide, discord_js_1.PermissionFlagsBits.ManageChannels);
};
const getLocale = (client, preferredLocale) => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    if (!locale?.commands?.hide) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.hide) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.hide) {
        locale = {
            commands: {
                hide: {
                    title: "Channel Visibility Changed",
                    description: "Channel visibility has been modified",
                    success: "Channel hidden successfully",
                    error: "Failed to hide channel",
                    noPermission: "You do not have permission to use this command.",
                    botNoPermission: "I do not have permission to manage this channel.",
                    commandError: "An error occurred while executing the command.",
                    channelNotFound: "Channel not found",
                    invalidChannel: "Invalid channel type. Must be a text channel.",
                    alreadyHidden: "This channel is already hidden",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    hiddenBy: "Hidden by {user}",
                    channel: "Channel",
                    status: "Status",
                    hidden: "🔒 Hidden"
                }
            }
        };
    }
    return locale;
};
exports.command = {
    name: 'hide',
    aliases: settingsManager_1.getSettings().commands?.hide?.aliases || [],
    enabled: settingsManager_1.getSettings().commands?.hide?.enabled ?? true,
    execute: async (interaction, args, client) => {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.hide.noPermission,
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
                const reply = { content: locale.commands.hide.invalidChannel, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const currentPerms = targetChannel.permissionOverwrites.cache.get(guild.id);
            if (currentPerms?.deny.has(discord_js_1.PermissionFlagsBits.ViewChannel)) {
                const reply = { content: locale.commands.hide.alreadyHidden, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.hide.noReason}`;
            const result = await (0, moderationService_1.hideChannel)({
                client,
                guild,
                member: executingMember,
                channel: targetChannel
            }, { reason: formattedReason });
            if (!result.ok) {
                const reply = { content: locale.commands.hide.commandError, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.hide.title)
                .setDescription(locale.commands.hide.description)
                .setColor(0x2f3136)
                .addFields({
                name: `#️⃣ ${locale.commands.hide.channel}`,
                value: targetChannel.toString(),
                inline: true
            }, {
                name: `👁️ ${locale.commands.hide.status}`,
                value: locale.commands.hide.hidden,
                inline: true
            }, {
                name: `📝 ${locale.commands.hide.reason}`,
                value: reason || locale.commands.hide.noReason,
                inline: false
            })
                .setFooter({
                text: locale.commands.hide.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
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
            console.error('Error executing hide command:', error);
            const errorMessage = {
                content: locale.commands.hide.commandError,
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
