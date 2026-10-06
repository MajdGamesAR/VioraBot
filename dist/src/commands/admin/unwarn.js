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
    if (!locale?.commands?.unwarn) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.unwarn) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.unwarn) {
        locale = {
            commands: {
                unwarn: {
                    title: "Warning Removed",
                    description: "A warning has been removed from a member",
                    success: "Successfully removed warning",
                    error: "Failed to remove warning",
                    noPermission: "You do not have permission to use this command.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    noWarnings: "This user has no warnings",
                    invalidWarningId: "Invalid warning number. Use !warns to see warning numbers.",
                    cantUnwarnSelf: "You cannot remove your own warnings.",
                    cantUnwarnOwner: "You cannot remove the server owner's warnings.",
                    cantUnwarnHigher: "You cannot remove warnings from a member with a higher role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    unwarnedBy: "Warning removed by {user}",
                    target: "User",
                    warningRemoved: "Warning #{number}",
                    invalidFormat: "Invalid format. Use: !unwarn @user [warning number] [reason]"
                }
            }
        };
    }
    return locale;
};
const checkPermissions = (member) => {
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.unwarn, discord_js_1.PermissionFlagsBits.ModerateMembers);
};
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('Removes a warning from a member')
    .addUserOption(option => option
    .setName('user')
    .setDescription('The member to remove warning from')
    .setRequired(true))
    .addIntegerOption(option => option
    .setName('warning')
    .setDescription('The warning number to remove (see !warns)')
    .setRequired(true)
    .setMinValue(1))
    .addStringOption(option => option
    .setName('reason')
    .setDescription('The reason for removing the warning')
    .setRequired(false));
exports.command = {
    name: 'unwarn',
    enabled: true,
    aliases: ['unwarn', 'removewarn', 'delwarn'],
    async execute(interaction, args, client) {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.unwarn.noPermission,
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
            let warningNumber;
            let reason = null;
            if (isSlash) {
                const targetUser = interaction.options.getUser('user');
                warningNumber = interaction.options.getInteger('warning', true);
                reason = interaction.options.getString('reason');
                targetMember = targetUser
                    ? await guild?.members.fetch(targetUser.id).catch(() => null)
                    : null;
            }
            else {
                if (args.length < 2) {
                    await interaction.reply(locale.commands.unwarn.invalidFormat);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                warningNumber = parseInt(args[1]);
                if (isNaN(warningNumber)) {
                    await interaction.reply(locale.commands.unwarn.invalidWarningId);
                    return;
                }
                reason = args.slice(2).join(' ') || null;
                targetMember = await guild?.members.fetch(targetId).catch(() => null);
            }
            if (!targetMember) {
                const reply = { content: locale.commands.unwarn.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const warnings = await Warning_1.Warning.find({
                guildId: guild?.id,
                userId: targetMember.id
            }).sort({ timestamp: -1 });
            if (warnings.length === 0) {
                const reply = { content: locale.commands.unwarn.noWarnings, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (warningNumber < 1 || warningNumber > warnings.length) {
                const reply = { content: locale.commands.unwarn.invalidWarningId, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const result = await (0, moderationService_1.unwarn)({
                client,
                guild,
                member: executingMember,
                target: targetMember
            }, {
                warningId: warningToRemove._id.toString(),
                reason: reason || locale.commands.unwarn.noReason
            });
            if (!result.ok) {
                const reply = { content: locale.commands.unwarn.commandError, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.unwarn.title)
                .setDescription(locale.commands.unwarn.description)
                .setColor(0x00ff00)
                .addFields({
                name: `👤 ${locale.commands.unwarn.target}`,
                value: targetMember.toString(),
                inline: true
            }, {
                name: `⚠️ ${locale.commands.unwarn.warningRemoved.replace('{number}', warningNumber.toString())}`,
                value: warningToRemove.reason,
                inline: true
            }, {
                name: `📝 ${locale.commands.unwarn.reason}`,
                value: reason || locale.commands.unwarn.noReason,
                inline: false
            })
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setFooter({
                text: locale.commands.unwarn.unwarnedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
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
            console.error('Error executing unwarn command:', error);
            const errorMessage = {
                content: locale.commands.unwarn.commandError,
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
