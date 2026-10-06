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
    .setName('banner')
    .setDescription('Shows user or server banner')
    .addUserOption(option => option
    .setName('target')
    .setDescription('The user to get banner from (mention or ID)')
    .setRequired(false));
const checkPermissions = (member) => {
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.banner);
};
const getLocale = (client, preferredLocale) => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    if (!locale?.commands?.banner) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.banner) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.banner) {
        locale = {
            commands: {
                banner: {
                    title: "User Banner",
                    description: "Banner for {user}",
                    serverBanner: "Server Banner",
                    userBanner: "User Banner",
                    noBanner: "No banner set",
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
    name: 'banner',
    aliases: settingsManager_1.getSettings().commands?.banner?.aliases || [],
    enabled: settingsManager_1.getSettings().commands?.banner?.enabled ?? true,
    execute: async (interaction, _args, client) => {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.banner.noPermission,
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
                const reply = { content: locale.commands.banner.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.banner.title)
                .setDescription(locale.commands.banner.description.replace('{user}', member.user.tag))
                .setColor(member.displayHexColor || '#0099ff');
            if (guild?.bannerURL()) {
                const serverBannerURL = guild.bannerURL({ size: 4096 });
                embed.addFields({
                    name: locale.commands.banner.serverBanner,
                    value: serverBannerURL
                        ? `[${locale.commands.banner.clickHere}](${serverBannerURL}) | [${locale.commands.banner.download}](${serverBannerURL}?size=4096)`
                        : locale.commands.banner.noBanner,
                    inline: false
                });
            }
            const user = await member.user.fetch(true);
            const userBannerURL = user.bannerURL({ size: 4096 });
            embed.addFields({
                name: locale.commands.banner.userBanner,
                value: userBannerURL
                    ? `[${locale.commands.banner.clickHere}](${userBannerURL}) | [${locale.commands.banner.download}](${userBannerURL}?size=4096)`
                    : locale.commands.banner.noBanner,
                inline: false
            });
            if (userBannerURL) {
                embed.setImage(userBannerURL);
            }
            else if (guild?.bannerURL()) {
                embed.setImage(guild.bannerURL({ size: 4096 }) || null);
            }
            embed.setFooter({
                text: locale.commands.banner.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
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
            console.error('Error executing banner command:', error);
            const errorMessage = {
                content: locale.commands.banner.commandError,
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
