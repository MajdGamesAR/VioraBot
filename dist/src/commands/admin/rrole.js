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
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.rrole, discord_js_1.PermissionFlagsBits.ManageRoles);
};
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('rrole')
    .setDescription('Removes a role from a user')
    .addUserOption(option => option
    .setName('user')
    .setDescription('The user to remove role from')
    .setRequired(true))
    .addRoleOption(option => option
    .setName('role')
    .setDescription('The role to remove')
    .setRequired(true))
    .addStringOption(option => option
    .setName('reason')
    .setDescription('The reason for removing the role')
    .setRequired(false));
exports.command = {
    name: 'rrole',
    enabled: true,
    aliases: ['rrole', 'removerole', 'delrole', 'deleterole'],
    async execute(interaction, args, client) {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.rrole.noPermission,
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
            let targetUser;
            let targetRole;
            if (isSlash) {
                targetUser = interaction.options.getUser('user');
                targetRole = interaction.options.getRole('role');
            }
            else {
                const message = interaction;
                const userMention = args[0]?.match(/^<@!?(\d+)>$/) || args[0]?.match(/^\d+$/);
                const roleMention = args[1]?.match(/^<@&(\d+)>$/) || args[1]?.match(/^\d+$/);
                if (!userMention || !roleMention) {
                    await message.reply(locale.commands.rrole.invalidFormat);
                    return;
                }
                targetUser = await guild?.members.fetch(userMention[1]).catch(() => null);
                targetRole = guild?.roles.cache.get(roleMention[1]);
            }
            if (!targetUser || !targetRole) {
                const reply = { content: locale.commands.rrole.userOrRoleNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const targetMember = await guild?.members.fetch(targetUser.id);
            if (!targetMember) {
                const reply = { content: locale.commands.rrole.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (!targetMember.roles.cache.has(targetRole.id)) {
                const reply = { content: locale.commands.rrole.doesNotHaveRole, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (!guild?.members.me?.permissions.has(discord_js_1.PermissionFlagsBits.ManageRoles)) {
                const reply = { content: locale.commands.rrole.botNoPermission, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetRole.position >= guild?.members.me.roles.highest.position) {
                const reply = { content: locale.commands.rrole.roleTooHigh, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetRole.position >= executingMember.roles.highest.position) {
                const reply = { content: locale.commands.rrole.cantManageHigherRole, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const reason = isSlash
                ? interaction.options.getString('reason')
                : args.slice(2).join(' ');
            const result = await (0, moderationService_1.removeRole)({
                client,
                guild,
                member: executingMember,
                target: targetMember,
                options: { checkUserHierarchy: true }
            }, { roleId: targetRole.id, reason: formattedReason });
            if (!result.ok) {
                const reply = { content: locale.commands.rrole.commandError, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.rrole.title)
                .setDescription(locale.commands.rrole.description)
                .setColor(0xff0000)
                .addFields({
                name: `👤 ${locale.commands.rrole.target}`,
                value: targetMember.toString(),
                inline: true
            }, {
                name: `🎭 ${locale.commands.rrole.role}`,
                value: targetRole.toString(),
                inline: true
            }, {
                name: `❓ ${locale.commands.rrole.reason}`,
                value: reason || locale.commands.rrole.noReason,
                inline: false
            })
                .setFooter({
                text: locale.commands.rrole.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
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
            console.error('Error executing rrole command:', error);
            const errorMessage = {
                content: locale.commands.rrole.commandError,
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
const getLocale = (client, preferredLocale) => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    if (!locale?.commands?.rrole) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.rrole) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.rrole) {
        locale = {
            commands: {
                rrole: {
                    title: "Role Removed",
                    description: "A role has been removed from a member",
                    success: "Successfully removed role",
                    error: "Failed to remove role",
                    noPermission: "You do not have permission to use this command.",
                    userNoPermission: "You do not have permission to manage this user's roles.",
                    botNoPermission: "I do not have permission to manage roles.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    userOrRoleNotFound: "User or role not found",
                    invalidFormat: "Invalid format. Use: !rrole @user @role [reason]",
                    roleTooHigh: "That role is higher than my highest role.",
                    cantManageHigherRole: "You cannot manage a role higher than your highest role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    target: "User",
                    role: "Role",
                    doesNotHaveRole: "User does not have this role"
                }
            }
        };
    }
    return locale;
};
