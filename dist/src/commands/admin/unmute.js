"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = exports.data = void 0;
const discord_js_1 = require("discord.js");
const settingsManager_1 = require("../../utils/settingsManager");
const permissionChecker_1 = require("../../utils/permissionChecker");
const checkPermissions = (member) => {
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.unmute, discord_js_1.PermissionFlagsBits.ManageRoles);
};
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmutes a member')
    .addUserOption(option => option
    .setName('user')
    .setDescription('The member to unmute')
    .setRequired(true))
    .addStringOption(option => option
    .setName('reason')
    .setDescription('The reason for unmuting')
    .setRequired(false));
exports.command = {
    name: 'unmute',
    enabled: true,
    aliases: ['unmute', 'unsilence'],
    async execute(interaction, args, client) {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.unmute.noPermission,
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
            let targetMember;
            let reason = null;
            if (isSlash) {
                const targetUser = interaction.options.getUser('user');
                reason = interaction.options.getString('reason');
                targetMember = targetUser
                    ? await guild?.members.fetch(targetUser.id).catch(() => null)
                    : null;
            }
            else {
                if (args.length < 1) {
                    await interaction.reply(locale.commands.unmute.invalidFormat);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                reason = args.slice(1).join(' ') || null;
                targetMember = await guild?.members.fetch(targetId).catch(() => null);
            }
            if (!targetMember) {
                const reply = { content: locale.commands.unmute.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const muteRole = guild?.roles.cache.find((role) => role.name === 'Muted');
            if (!muteRole) {
                const reply = { content: locale.commands.unmute.roleNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (!targetMember.roles.cache.has(muteRole.id)) {
                const reply = { content: locale.commands.unmute.notMuted, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetMember.roles.highest.position >= executingMember.roles.highest.position) {
                const reply = { content: locale.commands.unmute.cantUnmuteHigher, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.unmute.noReason}`;
            await targetMember.roles.remove(muteRole, formattedReason);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.unmute.title)
                .setDescription(locale.commands.unmute.description)
                .setColor(0x00ff00)
                .addFields({
                name: `👤 ${locale.commands.unmute.target}`,
                value: targetMember.toString(),
                inline: true
            }, {
                name: `🔨 ${locale.commands.unmute.action}`,
                value: locale.commands.unmute.unmutedBy.replace('{user}', executingMember.user.tag),
                inline: true
            }, {
                name: `📝 ${locale.commands.unmute.reason}`,
                value: reason || locale.commands.unmute.noReason,
                inline: false
            })
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setFooter({
                text: locale.commands.unmute.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
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
            console.error('Error executing unmute command:', error);
            const errorMessage = {
                content: locale.commands.unmute.commandError,
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
const getLocale = (client, preferredLocale) => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    if (!locale?.commands?.unmute) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.unmute) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.unmute) {
        locale = {
            commands: {
                unmute: {
                    title: "Member Unmuted",
                    description: "A member has been unmuted",
                    success: "Successfully unmuted member",
                    error: "Failed to unmute member",
                    noPermission: "You do not have permission to use this command.",
                    userNoPermission: "You do not have permission to unmute this user.",
                    botNoPermission: "I do not have permission to unmute users.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    roleNotFound: "Muted role not found",
                    notMuted: "This user is not muted.",
                    cantUnmuteHigher: "You cannot unmute a member with a higher role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    unmutedBy: "Unmuted by {user}",
                    target: "User",
                    action: "Action",
                    invalidFormat: "Invalid format. Use: !unmute @user [reason]"
                }
            }
        };
    }
    return locale;
};
