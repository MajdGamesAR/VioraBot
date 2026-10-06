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
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.warn, discord_js_1.PermissionFlagsBits.ModerateMembers);
};
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warns a member')
    .addUserOption(option => option
    .setName('user')
    .setDescription('The member to warn')
    .setRequired(true))
    .addStringOption(option => option
    .setName('reason')
    .setDescription('The reason for the warning')
    .setRequired(false));
exports.command = {
    name: 'warn',
    enabled: true,
    aliases: ['warn', 'addwarn'],
    async execute(interaction, args, client) {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.warn.noPermission,
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
                    await interaction.reply(locale.commands.warn.invalidFormat);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                reason = args.slice(1).join(' ') || null;
                targetMember = await guild?.members.fetch(targetId).catch(() => null);
            }
            if (!targetMember) {
                const reply = { content: locale.commands.warn.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetMember.id === executingMember.id) {
                const reply = { content: locale.commands.warn.cantWarnSelf, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetMember.id === guild?.ownerId) {
                const reply = { content: locale.commands.warn.cantWarnOwner, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetMember.roles.highest.position >= executingMember.roles.highest.position &&
                !executingMember.permissions.has(discord_js_1.PermissionFlagsBits.Administrator)) {
                const reply = { content: locale.commands.warn.cantWarnHigher, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const result = await (0, moderationService_1.warn)({
                client,
                guild,
                member: executingMember,
                target: targetMember,
                options: { checkUserHierarchy: true }
            }, { reason: reason || locale.commands.warn.noReason });
            if (!result.ok) {
                const reply = { content: locale.commands.warn.commandError, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const warningCount = result.result?.count ?? 0;
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.warn.title)
                .setDescription(locale.commands.warn.description)
                .setColor(0xffff00)
                .addFields({
                name: `👤 ${locale.commands.warn.target}`,
                value: targetMember.toString(),
                inline: true
            }, {
                name: `🔢 ${locale.commands.warn.totalWarnings}`,
                value: warningCount.toString(),
                inline: true
            }, {
                name: `📝 ${locale.commands.warn.reason}`,
                value: reason || locale.commands.warn.noReason,
                inline: false
            })
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setFooter({
                text: locale.commands.warn.warnedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
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
            console.error('Error executing warn command:', error);
            const errorMessage = {
                content: locale.commands.warn.commandError,
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
    if (!locale?.commands?.warn) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.warn) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.warn) {
        locale = {
            commands: {
                warn: {
                    title: "Member Warned",
                    description: "A member has been warned",
                    success: "Successfully warned member",
                    error: "Failed to warn member",
                    noPermission: "You do not have permission to use this command.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    cantWarnSelf: "You cannot warn yourself.",
                    cantWarnOwner: "You cannot warn the server owner.",
                    cantWarnHigher: "You cannot warn a member with a higher role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    warnedBy: "Warned by {user}",
                    target: "User",
                    totalWarnings: "Total Warnings",
                    invalidFormat: "Invalid format. Use: !warn @user [reason]"
                }
            }
        };
    }
    return locale;
};
