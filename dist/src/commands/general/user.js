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
    .setName('user')
    .setDescription('Shows user information')
    .addUserOption(option => option
    .setName('target')
    .setDescription('The user to get information about (mention or ID)')
    .setRequired(false));
const checkPermissions = (member) => {
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.user);
};
const getLocale = (client, preferredLocale) => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    if (!locale?.commands?.user) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.user) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.user) {
        locale = {
            commands: {
                user: {
                    title: "User Information",
                    joinedServer: "Joined Server",
                    joinedDiscord: "Joined Discord",
                    roles: "Roles",
                    id: "ID",
                    tag: "Tag",
                    nickname: "Nickname",
                    bot: "Bot",
                    error: "Failed to fetch user information",
                    noPermission: "You do not have permission to use this command.",
                    commandError: "An error occurred while executing the command.",
                    rolesMore: "...and {count} more",
                    none: "None",
                    requestedBy: "Requested by {user}",
                    userNotFound: "User not found",
                    invalidUser: "Invalid user specified"
                }
            }
        };
    }
    return locale;
};
const MAX_DISPLAYED_ROLES = 8;
exports.command = {
    name: 'user',
    aliases: settingsManager_1.getSettings().commands?.user?.aliases || [],
    enabled: settingsManager_1.getSettings().commands?.user?.enabled ?? true,
    execute: async (interaction, _args, client) => {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.user.noPermission,
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
                const reply = { content: locale.commands.user.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const userFlags = member.user.flags?.toArray() || [];
            const flagEmojis = {
                BotHTTPInteractions: '🤖',
                VerifiedBot: '✅',
                Staff: '👨‍💼',
                Partner: '🤝',
                BugHunterLevel1: '🐛',
                BugHunterLevel2: '🐛',
                HypeSquadEvents: '🎉',
                PremiumEarlySupporter: '💎',
                VerifiedDeveloper: '👨‍💻'
            };
            const badges = userFlags
                .map(flag => flagEmojis[flag] || '')
                .filter(Boolean)
                .join(' ');
            const roles = member.roles.cache
                .filter(role => role.name !== '@everyone')
                .sort((a, b) => b.position - a.position);
            let rolesDisplay;
            if (roles.size > MAX_DISPLAYED_ROLES) {
                const randomRoles = Array.from(roles.values())
                    .sort(() => Math.random() - 0.5)
                    .slice(0, MAX_DISPLAYED_ROLES);
                rolesDisplay = randomRoles.map(role => `<@&${role.id}>`).join(', ') +
                    ` *${locale.commands.user.rolesMore.replace('{count}', (roles.size - MAX_DISPLAYED_ROLES).toString())}*`;
            }
            else {
                rolesDisplay = roles.size ? roles.map(role => `<@&${role.id}>`).join(', ') : locale.commands.user.none;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`${locale.commands.user.title} ${badges}`)
                .setColor(member.displayHexColor || '#0099ff')
                .setThumbnail(member.user.displayAvatarURL({ size: 1024 }))
                .setImage(member.user.bannerURL({ size: 1024 }) || null)
                .addFields({
                name: '👤 ' + locale.commands.user.tag,
                value: member.user.tag,
                inline: true
            }, {
                name: '🆔 ' + locale.commands.user.id,
                value: member.user.id,
                inline: true
            }, {
                name: '📝 ' + locale.commands.user.nickname,
                value: member.nickname || 'None',
                inline: true
            }, {
                name: '📅 ' + locale.commands.user.joinedServer,
                value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`,
                inline: true
            }, {
                name: '📆 ' + locale.commands.user.joinedDiscord,
                value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
                inline: true
            }, {
                name: `👑 ${locale.commands.user.roles} [${roles.size}]`,
                value: rolesDisplay
            })
                .setFooter({
                text: locale.commands.user.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
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
            console.error('Error executing user command:', error);
            const errorMessage = {
                content: locale.commands.user.commandError,
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
