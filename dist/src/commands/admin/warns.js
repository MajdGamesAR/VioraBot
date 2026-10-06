"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = exports.data = void 0;
const discord_js_1 = require("discord.js");
const settingsManager_1 = require("../../utils/settingsManager");
const permissionChecker_1 = require("../../utils/permissionChecker");
const warningManager_1 = require("../../moderation/warningManager");
const getLocale = (client, preferredLocale) => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    if (!locale?.commands?.warns) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.warns) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.warns) {
        locale = {
            commands: {
                warns: {
                    title: "Member Warnings",
                    description: "Warning history for member",
                    noWarnings: "This member has no warnings",
                    error: "Failed to fetch warnings",
                    noPermission: "You do not have permission to use this command.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    requestedBy: "Requested by {user}",
                    target: "User",
                    totalWarnings: "Total Warnings",
                    warning: "Warning",
                    moderator: "Moderator",
                    reason: "Reason",
                    date: "Date",
                    moreWarnings: "And {count} more warnings...",
                    invalidFormat: "Invalid format. Use: !warns @user"
                }
            }
        };
    }
    return locale;
};
const checkPermissions = (member) => {
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.warns, discord_js_1.PermissionFlagsBits.ModerateMembers);
};
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('warns')
    .setDescription('Shows warnings for a member')
    .addUserOption(option => option
    .setName('user')
    .setDescription('The member to check warnings for')
    .setRequired(true));
exports.command = {
    name: 'warns',
    enabled: true,
    aliases: ['warns', 'warnings', 'checkwarns'],
    async execute(interaction, args, client) {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.warns.noPermission,
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
            if (isSlash) {
                const targetUser = interaction.options.getUser('user');
                targetMember = targetUser
                    ? await guild?.members.fetch(targetUser.id).catch(() => null)
                    : null;
            }
            else {
                if (args.length < 1) {
                    await interaction.reply(locale.commands.warns.invalidFormat);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                targetMember = await guild?.members.fetch(targetId).catch(() => null);
            }
            if (!targetMember) {
                const reply = { content: locale.commands.warns.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const warnings = await (0, warningManager_1.getWarnings)(guild?.id, targetMember.id);
            warnings.reverse();
            if (warnings.length === 0) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(locale.commands.warns.title)
                    .setDescription(locale.commands.warns.noWarnings)
                    .setColor(0x00ff00)
                    .addFields({
                    name: `👤 ${locale.commands.warns.target}`,
                    value: targetMember.toString(),
                    inline: true
                })
                    .setThumbnail(targetMember.user.displayAvatarURL())
                    .setFooter({
                    text: locale.commands.warns.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
                })
                    .setTimestamp();
                if (isSlash) {
                    await interaction.reply({ embeds: [embed] });
                }
                else {
                    await interaction.reply({ embeds: [embed] });
                }
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.warns.title)
                .setDescription(locale.commands.warns.description)
                .setColor(0xffff00)
                .addFields({
                name: `👤 ${locale.commands.warns.target}`,
                value: targetMember.toString(),
                inline: true
            }, {
                name: `🔢 ${locale.commands.warns.totalWarnings}`,
                value: warnings.length.toString(),
                inline: true
            })
                .setThumbnail(targetMember.user.displayAvatarURL());
            warnings.slice(0, 10).forEach((warning, index) => {
                const moderator = guild?.members.cache.get(warning.moderatorId);
                embed.addFields({
                    name: `${locale.commands.warns.warning} #${index + 1}`,
                    value: `${locale.commands.warns.moderator}: ${moderator ? moderator.toString() : 'Unknown'}\n${locale.commands.warns.reason}: ${warning.reason}\n${locale.commands.warns.date}: <t:${Math.floor(warning.timestamp.getTime() / 1000)}:F>`,
                    inline: false
                });
            });
            if (warnings.length > 10) {
                embed.setFooter({
                    text: locale.commands.warns.moreWarnings.replace('{count}', (warnings.length - 10).toString())
                });
            }
            else {
                embed.setFooter({
                    text: locale.commands.warns.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
                });
            }
            embed.setTimestamp();
            if (isSlash) {
                await interaction.reply({ embeds: [embed] });
            }
            else {
                await interaction.reply({ embeds: [embed] });
            }
        }
        catch (error) {
            console.error('Error executing warns command:', error);
            const errorMessage = {
                content: locale.commands.warns.commandError,
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
