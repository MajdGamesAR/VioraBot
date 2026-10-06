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
const getLocale = (client, preferredLocale) => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    if (!locale?.commands?.role) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.role) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.role) {
        locale = {
            commands: {
                role: {
                    title: "Role Modified",
                    description: "A member's role has been modified",
                    success: "Successfully modified role",
                    error: "Failed to modify role",
                    noPermission: "You do not have permission to use this command.",
                    userNoPermission: "You do not have permission to manage this user's roles.",
                    botNoPermission: "I do not have permission to manage roles.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    userOrRoleNotFound: "User or role not found",
                    invalidFormat: "Invalid format. Use: !role @user @role [reason]",
                    roleTooHigh: "That role is higher than my highest role.",
                    cantManageHigherRole: "You cannot manage a role higher than your highest role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    target: "User",
                    role: "Role",
                    action: "Action",
                    added: "✅ Role Added",
                    removed: "❌ Role Removed"
                }
            }
        };
    }
    return locale;
};
const checkPermissions = (member) => {
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.role, discord_js_1.PermissionFlagsBits.ManageRoles);
};
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('role')
    .setDescription('Gives or removes a role from a user')
    .addUserOption(option => option
    .setName('user')
    .setDescription('The user to modify roles')
    .setRequired(true))
    .addRoleOption(option => option
    .setName('role')
    .setDescription('The role to give/remove')
    .setRequired(true))
    .addStringOption(option => option
    .setName('reason')
    .setDescription('The reason for the role change')
    .setRequired(false));
exports.command = {
    name: 'role',
    enabled: true,
    aliases: ['role', 'giverole', 'removerole'],
    async execute(interaction, args, client) {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.role.noPermission,
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
                    await message.reply(locale.commands.role.invalidFormat);
                    return;
                }
                targetUser = await guild?.members.fetch(userMention[1]).catch(() => null);
                targetRole = guild?.roles.cache.get(roleMention[1]);
            }
            if (!targetUser || !targetRole) {
                const reply = { content: locale.commands.role.userOrRoleNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const targetMember = await guild?.members.fetch(targetUser.id);
            if (!targetMember) {
                const reply = { content: locale.commands.role.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (!guild?.members.me?.permissions.has(discord_js_1.PermissionFlagsBits.ManageRoles)) {
                const reply = { content: locale.commands.role.botNoPermission, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetRole.position >= guild?.members.me.roles.highest.position) {
                const reply = { content: locale.commands.role.roleTooHigh, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetRole.position >= executingMember.roles.highest.position) {
                const reply = { content: locale.commands.role.cantManageHigherRole, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const reason = isSlash
                ? interaction.options.getString('reason')
                : args.slice(2).join(' ');
            const hasRole = targetMember.roles.cache.has(targetRole.id);
            const action = hasRole ? 'remove' : 'add';
            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.role.noReason}`;
            const roleParams = { roleId: targetRole.id, reason: formattedReason };
            const roleCtx = {
                client,
                guild,
                member: executingMember,
                target: targetMember,
                options: { checkUserHierarchy: true }
            };
            const roleResult = action === 'add'
                ? await (0, moderationService_1.addRole)(roleCtx, roleParams)
                : await (0, moderationService_1.removeRole)(roleCtx, roleParams);
            if (!roleResult.ok) {
                const reply = { content: locale.commands.role.commandError, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.role.title)
                .setDescription(locale.commands.role.description)
                .setColor(action === 'add' ? 0x00ff00 : 0xff0000)
                .addFields({
                name: `👤 ${locale.commands.role.target}`,
                value: targetMember.toString(),
                inline: true
            }, {
                name: `🎭 ${locale.commands.role.role}`,
                value: targetRole.toString(),
                inline: true
            }, {
                name: `📝 ${locale.commands.role.action}`,
                value: action === 'add'
                    ? locale.commands.role.added
                    : locale.commands.role.removed,
                inline: true
            }, {
                name: `❓ ${locale.commands.role.reason}`,
                value: reason || locale.commands.role.noReason,
                inline: false
            })
                .setFooter({
                text: locale.commands.role.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
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
            console.error('Error executing role command:', error);
            const errorMessage = {
                content: locale.commands.role.commandError,
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
