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
    .setName('kick')
    .setDescription('Kicks a member from the server')
    .addUserOption(option => option
    .setName('target')
    .setDescription('The member to kick')
    .setRequired(true))
    .addStringOption(option => option
    .setName('reason')
    .setDescription('The reason for kicking')
    .setRequired(false));
const checkPermissions = (member) => {
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.kick, discord_js_1.PermissionFlagsBits.KickMembers);
};
const getLocale = (client, preferredLocale) => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    if (!locale?.commands?.kick) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.kick) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.kick) {
        locale = {
            commands: {
                kick: {
                    title: "Member Kicked",
                    description: "A member has been kicked from the server",
                    success: "Successfully kicked {user}",
                    error: "Failed to kick {user}",
                    noPermission: "You do not have permission to use this command.",
                    userNoPermission: "You do not have permission to kick this user.",
                    botNoPermission: "I do not have permission to kick this user.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    cantKickSelf: "You cannot kick yourself.",
                    cantKickOwner: "You cannot kick the server owner.",
                    cantKickHigher: "You cannot kick a member with a higher role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason: {reason}",
                    noReason: "No reason provided",
                    kickedBy: "Kicked by {user}",
                    target: "Target",
                    kicked: "Kicked"
                }
            }
        };
    }
    return locale;
};
exports.command = {
    name: 'kick',
    aliases: settingsManager_1.getSettings().commands?.kick?.aliases || [],
    enabled: settingsManager_1.getSettings().commands?.kick?.enabled ?? true,
    execute: async (interaction, args, client) => {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.kick.noPermission,
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
                const targetUser = interaction.options.getUser('target');
                reason = interaction.options.getString('reason');
                targetMember = targetUser
                    ? await guild?.members.fetch(targetUser.id).catch(() => null)
                    : null;
            }
            else {
                if (args.length === 0) {
                    await interaction.reply(locale.commands.kick.userNotFound);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                reason = args.slice(1).join(' ') || null;
                targetMember = await guild?.members.fetch(targetId).catch(() => null);
            }
            if (!targetMember) {
                const reply = { content: locale.commands.kick.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetMember.id === executingMember.id) {
                const reply = { content: locale.commands.kick.cantKickSelf, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetMember.id === guild?.ownerId) {
                const reply = { content: locale.commands.kick.cantKickOwner, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetMember.roles.highest.position >= executingMember.roles.highest.position) {
                const reply = { content: locale.commands.kick.cantKickHigher, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (!guild?.members.me?.permissions.has(discord_js_1.PermissionFlagsBits.KickMembers)) {
                const reply = { content: locale.commands.kick.botNoPermission, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.kick.noReason}`;
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.kick.title)
                .setDescription(locale.commands.kick.description)
                .setColor(0xff0000)
                .addFields({
                name: `👤 ${locale.commands.kick.target}`,
                value: targetMember.user.tag,
                inline: true
            }, {
                name: `🔨 ${locale.commands.kick.kicked}`,
                value: locale.commands.kick.kickedBy.replace('{user}', executingMember.user.tag),
                inline: true
            }, {
                name: `📝 ${locale.commands.kick.reason}`,
                value: reason || locale.commands.kick.noReason,
                inline: false
            })
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setFooter({
                text: locale.commands.kick.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
            })
                .setTimestamp();
            const result = await (0, moderationService_1.kick)({
                client,
                guild,
                member: executingMember,
                target: targetMember,
                options: {
                    botPermission: discord_js_1.PermissionFlagsBits.KickMembers,
                    checkUserHierarchy: true
                }
            }, { reason: formattedReason });
            if (!result.ok) {
                const reply = { content: locale.commands.kick.commandError, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (isSlash) {
                await interaction.reply({ embeds: [embed] });
            }
            else {
                await interaction.reply({ embeds: [embed] });
            }
        }
        catch (error) {
            console.error('Error executing kick command:', error);
            const errorMessage = {
                content: locale.commands.kick.commandError,
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
