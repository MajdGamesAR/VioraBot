"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = async (channel) => {
    if (!('guild' in channel))
        return;
    const client = channel.client;
    const settings = client.settings;
    if (!settings.logs?.enabled || !settings.logs.channelCreate?.enabled)
        return;
    const logChannelId = settings.logs.channelCreate.channelId;
    if (!logChannelId)
        return;
    const logChannel = client.channels.cache.get(logChannelId);
    if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
        return;
    const locale = client.locales.get(client.defaultLanguage)?.logs?.channelCreate;
    if (!locale) {
        console.error(`Failed to find channel create locale data for ${client.defaultLanguage}`);
        return;
    }
    try {
        const auditLogs = await channel.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.ChannelCreate,
            limit: 1,
        });
        const createLog = auditLogs.entries.first();
        const executor = createLog?.executor;
        const getChannelType = (type) => {
            switch (type) {
                case discord_js_1.ChannelType.GuildText: return locale.types.text;
                case discord_js_1.ChannelType.GuildVoice: return locale.types.voice;
                case discord_js_1.ChannelType.GuildCategory: return locale.types.category;
                case discord_js_1.ChannelType.GuildAnnouncement: return locale.types.news;
                case discord_js_1.ChannelType.GuildStageVoice: return locale.types.stage;
                case discord_js_1.ChannelType.GuildForum: return locale.types.forum;
                default: return locale.types.unknown;
            }
        };
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.channelCreate.color)
            .addFields({
            name: `📝 ${locale.name}`,
            value: channel.name,
            inline: true
        }, {
            name: `👤 ${locale.createdBy}`,
            value: executor ? `${executor.tag} (${executor.id})` : locale.unknown,
            inline: true
        }, {
            name: `📋 ${locale.type}`,
            value: getChannelType(channel.type),
            inline: true
        });
        if (channel.parent) {
            embed.addFields({
                name: `📁 ${locale.category}`,
                value: channel.parent.name,
                inline: true
            });
        }
        embed.addFields({
            name: `📊 ${locale.position}`,
            value: channel.position.toString(),
            inline: true
        });
        if (channel.isTextBased() && 'nsfw' in channel) {
            embed.addFields({
                name: `🔞 ${locale.nsfw}`,
                value: channel.nsfw ? locale.yes : locale.no,
                inline: true
            });
        }
        embed.setFooter({ text: `${locale.channelId}: ${channel.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging channel create:', error);
    }
};
