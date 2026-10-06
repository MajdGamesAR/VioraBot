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
const checkPermissions = (member) => {
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.rtimeout, discord_js_1.PermissionFlagsBits.ModerateMembers);
};
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('rtimeout')
    .setDescription('Removes timeout from a member')
    .addUserOption(option => option
    .setName('user')
    .setDescription('The member to remove timeout from')
    .setRequired(true))
    .addStringOption(option => option
    .setName('reason')
    .setDescription('The reason for removing timeout')
    .setRequired(false));
exports.command = {
    name: 'rtimeout',
    enabled: true,
    aliases: ['rtimeout', 'removetimeout', 'untimeout'],
    async execute(interaction, args, client) {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.rtimeout.noPermission,
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
                    await interaction.reply(locale.commands.rtimeout.invalidFormat);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                reason = args.slice(1).join(' ') || null;
                targetMember = await guild?.members.fetch(targetId).catch(() => null);
            }
            if (!targetMember) {
                const reply = { content: locale.commands.rtimeout.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (!targetMember.communicationDisabledUntil) {
                const reply = { content: locale.commands.rtimeout.notTimedOut, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (!guild?.members.me?.permissions.has(discord_js_1.PermissionFlagsBits.ModerateMembers)) {
                const reply = { content: locale.commands.rtimeout.botNoPermission, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetMember.roles.highest.position >= executingMember.roles.highest.position) {
                const reply = { content: locale.commands.rtimeout.cantManageHigherRole, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const result = await (0, moderationService_1.removeTimeout)({
                client,
                guild,
                member: executingMember,
                target: targetMember,
                options: {
                    botPermission: discord_js_1.PermissionFlagsBits.ModerateMembers,
                    checkUserHierarchy: true
                }
            }, { reason: formattedReason });
            if (!result.ok) {
                const reply = { content: locale.commands.rtimeout.commandError, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.rtimeout.title)
                .setDescription(locale.commands.rtimeout.description)
                .setColor(0x00ff00)
                .addFields({
                name: `👤 ${locale.commands.rtimeout.target}`,
                value: targetMember.toString(),
                inline: true
            }, {
                name: `🔨 ${locale.commands.rtimeout.action}`,
                value: locale.commands.rtimeout.timeoutRemovedBy.replace('{user}', executingMember.user.tag),
                inline: true
            }, {
                name: `📝 ${locale.commands.rtimeout.reason}`,
                value: reason || locale.commands.rtimeout.noReason,
                inline: false
            })
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setFooter({
                text: locale.commands.rtimeout.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
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
            console.error('Error executing rtimeout command:', error);
            const errorMessage = {
                content: locale.commands.rtimeout.commandError,
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
    if (!locale?.commands?.rtimeout) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.rtimeout) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.rtimeout) {
        locale = {
            commands: {
                rtimeout: {
                    title: "Timeout Removed",
                    description: "A member's timeout has been removed",
                    success: "Successfully removed timeout",
                    error: "Failed to remove timeout",
                    noPermission: "You do not have permission to use this command.",
                    userNoPermission: "You do not have permission to manage this user's timeout.",
                    botNoPermission: "I do not have permission to manage timeouts.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    notTimedOut: "This user is not timed out.",
                    cantManageHigherRole: "You cannot manage a user with a higher role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    timeoutRemovedBy: "Timeout removed by {user}",
                    target: "User",
                    action: "Action",
                    invalidFormat: "Invalid format. Use: !rtimeout @user [reason]"
                }
            }
        };
    }
    return locale;
};
