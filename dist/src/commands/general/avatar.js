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
    .setName('avatar')
    .setDescription('Shows user avatar')
    .addUserOption(option => option
    .setName('target')
    .setDescription('The user to get avatar from (mention or ID)')
    .setRequired(false));
const checkPermissions = (member) => {
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.avatar);
};
const getLocale = (client, preferredLocale) => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    if (!locale?.commands?.avatar) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.avatar) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.avatar) {
        locale = {
            commands: {
                avatar: {
                    title: "User Avatar",
                    description: "Avatar for {user}",
                    serverAvatar: "Server Avatar",
                    globalAvatar: "Global Avatar",
                    noPermission: "You do not have permission to use this command.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    requestedBy: "Requested by {user}",
                    clickHere: "Click here",
                    download: "Download"
                }
            }
        };
    }
    return locale;
};
exports.command = {
    name: 'avatar',
    aliases: settingsManager_1.getSettings().commands?.avatar?.aliases || [],
    enabled: settingsManager_1.getSettings().commands?.avatar?.enabled ?? true,
    execute: async (interaction, _args, client) => {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.avatar.noPermission,
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
            let member;
            if (isSlash) {
                const targetUser = interaction.options.getUser('target');
                member = targetUser
                    ? await guild?.members.fetch(targetUser.id).catch(() => null)
                    : interaction.member;
            }
            else {
                const message = interaction;
                member = message.mentions.members?.first() ||
                    message.targetMember ||
                    message.member;
            }
            if (!member) {
                const reply = { content: locale.commands.avatar.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const globalAvatarURL = member.user.displayAvatarURL({ size: 4096 });
            const serverAvatarURL = member.avatarURL({ size: 4096 });
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.avatar.title)
                .setDescription(locale.commands.avatar.description.replace('{user}', member.user.tag))
                .setColor(member.displayHexColor || '#0099ff');
            if (serverAvatarURL && serverAvatarURL !== globalAvatarURL) {
                embed.addFields({
                    name: locale.commands.avatar.serverAvatar,
                    value: `[${locale.commands.avatar.clickHere}](${serverAvatarURL}) | [${locale.commands.avatar.download}](${serverAvatarURL}?size=4096)`,
                    inline: false
                })
                    .setImage(serverAvatarURL);
            }
            embed.addFields({
                name: locale.commands.avatar.globalAvatar,
                value: `[${locale.commands.avatar.clickHere}](${globalAvatarURL}) | [${locale.commands.avatar.download}](${globalAvatarURL}?size=4096)`,
                inline: false
            });
            if (!serverAvatarURL || serverAvatarURL === globalAvatarURL) {
                embed.setImage(globalAvatarURL);
            }
            embed.setFooter({
                text: locale.commands.avatar.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
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
            console.error('Error executing avatar command:', error);
            const errorMessage = {
                content: locale.commands.avatar.commandError,
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
