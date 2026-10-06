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
    .setName('server')
    .setDescription('Shows server information');
const checkPermissions = (member) => {
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.server);
};
const getLocale = (client, preferredLocale) => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    if (!locale?.commands?.server) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.server) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.server) {
        locale = {
            commands: {
                server: {
                    title: "Server Information",
                    owner: "Owner",
                    created: "Created",
                    members: "Members",
                    channels: "Channels",
                    roles: "Roles",
                    emojis: "Emojis",
                    boosts: "Boosts",
                    boostTier: "Boost Tier",
                    verificationLevel: "Verification Level",
                    contentFilter: "Content Filter",
                    features: "Features",
                    description: "Description",
                    error: "Failed to fetch server information",
                    noPermission: "You do not have permission to use this command.",
                    commandError: "An error occurred while executing the command.",
                    rolesMore: "...and {count} more",
                    none: "None",
                    requestedBy: "Requested by {user}",
                    total: "Total: {count}",
                    online: "Online: {count}",
                    text: "Text: {count}",
                    voice: "Voice: {count}",
                    categories: "Categories: {count}",
                    animated: "Animated: {count}",
                    static: "Static: {count}",
                    stickers: "Stickers: {count}"
                }
            }
        };
    }
    return locale;
};
const MAX_DISPLAYED_ROLES = 8;
const getVerificationLevel = (level) => {
    const levels = {
        [discord_js_1.GuildVerificationLevel.None]: "None",
        [discord_js_1.GuildVerificationLevel.Low]: "Low",
        [discord_js_1.GuildVerificationLevel.Medium]: "Medium",
        [discord_js_1.GuildVerificationLevel.High]: "High",
        [discord_js_1.GuildVerificationLevel.VeryHigh]: "Highest"
    };
    return levels[level] || "Unknown";
};
const getContentFilter = (filter) => {
    const filters = {
        [discord_js_1.GuildExplicitContentFilter.Disabled]: "Disabled",
        [discord_js_1.GuildExplicitContentFilter.MembersWithoutRoles]: "No Role Members",
        [discord_js_1.GuildExplicitContentFilter.AllMembers]: "All Members"
    };
    return filters[filter] || "Unknown";
};
const getBoostTier = (tier) => {
    const tiers = {
        [discord_js_1.GuildPremiumTier.None]: "None",
        [discord_js_1.GuildPremiumTier.Tier1]: "Level 1",
        [discord_js_1.GuildPremiumTier.Tier2]: "Level 2",
        [discord_js_1.GuildPremiumTier.Tier3]: "Level 3"
    };
    return tiers[tier] || "Unknown";
};
exports.command = {
    name: 'server',
    aliases: settingsManager_1.getSettings().commands?.server?.aliases || [],
    enabled: settingsManager_1.getSettings().commands?.server?.enabled ?? true,
    execute: async (interaction, _args, client) => {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            if (!guild) {
                throw new Error('Command must be used in a server');
            }
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.server.noPermission,
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
            if (guild.members.cache.size !== guild.memberCount) {
                await guild.members.fetch();
            }
            const roles = guild.roles.cache
                .filter(role => role.name !== '@everyone')
                .sort((a, b) => b.position - a.position);
            let rolesDisplay;
            if (roles.size > MAX_DISPLAYED_ROLES) {
                const topRoles = Array.from(roles.values())
                    .slice(0, MAX_DISPLAYED_ROLES);
                rolesDisplay = topRoles.map(role => `<@&${role.id}>`).join(', ') +
                    ` *${locale.commands.server.rolesMore.replace('{count}', (roles.size - MAX_DISPLAYED_ROLES).toString())}*`;
            }
            else {
                rolesDisplay = roles.size ? roles.map(role => `<@&${role.id}>`).join(', ') : locale.commands.server.none;
            }
            const onlineMembers = guild.members.cache.filter(member => member.presence?.status === 'online' ||
                member.presence?.status === 'idle' ||
                member.presence?.status === 'dnd').size;
            const features = guild.features
                .map(feature => feature.toLowerCase()
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' '))
                .join(', ') || locale.commands.server.none;
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.server.title)
                .setColor('#0099ff')
                .setThumbnail(guild.iconURL({ size: 1024 }) || null)
                .setImage(guild.bannerURL({ size: 1024 }) || null)
                .addFields({
                name: '👑 ' + locale.commands.server.owner,
                value: `<@${guild.ownerId}>`,
                inline: true
            }, {
                name: '📅 ' + locale.commands.server.created,
                value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
                inline: true
            }, {
                name: '👥 ' + locale.commands.server.members,
                value: [
                    locale.commands.server.total.replace('{count}', guild.memberCount.toString()),
                    locale.commands.server.online.replace('{count}', onlineMembers.toString())
                ].join('\n'),
                inline: true
            }, {
                name: '📊 ' + locale.commands.server.channels,
                value: [
                    locale.commands.server.categories.replace('{count}', guild.channels.cache.filter(c => c.type === 4).size.toString()),
                    locale.commands.server.text.replace('{count}', guild.channels.cache.filter(c => c.type === 0).size.toString()),
                    locale.commands.server.voice.replace('{count}', guild.channels.cache.filter(c => c.type === 2).size.toString())
                ].join('\n'),
                inline: true
            }, {
                name: '😄 ' + locale.commands.server.emojis,
                value: [
                    locale.commands.server.total.replace('{count}', guild.emojis.cache.size.toString()),
                    locale.commands.server.animated.replace('{count}', guild.emojis.cache.filter(e => e.animated).size.toString()),
                    locale.commands.server.static.replace('{count}', guild.emojis.cache.filter(e => !e.animated).size.toString())
                ].join('\n'),
                inline: true
            }, {
                name: '🎨 ' + locale.commands.server.stickers,
                value: locale.commands.server.total.replace('{count}', guild.stickers.cache.size.toString()),
                inline: true
            }, {
                name: '🚀 ' + locale.commands.server.boosts,
                value: [
                    locale.commands.server.total.replace('{count}', guild.premiumSubscriptionCount?.toString() || '0'),
                    locale.commands.server.boostTier + ': ' + getBoostTier(guild.premiumTier)
                ].join('\n'),
                inline: true
            }, {
                name: '🛡️ ' + locale.commands.server.verificationLevel,
                value: getVerificationLevel(guild.verificationLevel),
                inline: true
            }, {
                name: '⚔️ ' + locale.commands.server.contentFilter,
                value: getContentFilter(guild.explicitContentFilter),
                inline: true
            }, {
                name: '✨ ' + locale.commands.server.features,
                value: features
            }, {
                name: `👑 ${locale.commands.server.roles} [${roles.size}]`,
                value: rolesDisplay
            })
                .setFooter({
                text: locale.commands.server.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
            })
                .setTimestamp();
            if (guild.description) {
                embed.setDescription(guild.description);
            }
            if (isSlash) {
                await interaction.reply({ embeds: [embed] });
            }
            else {
                await interaction.reply({ embeds: [embed] });
            }
        }
        catch (error) {
            console.error('Error executing server command:', error);
            const errorMessage = {
                content: locale.commands.server.commandError,
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
