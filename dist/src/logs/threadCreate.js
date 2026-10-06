"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const formatArchiveDuration = (duration, locale) => {
    if (!duration)
        return locale.unknown;
    switch (duration) {
        case 60:
            return `1 ${locale.hour || 'hour'}`;
        case 1440:
            return `1 ${locale.day || 'day'}`;
        case 4320:
            return `3 ${locale.days || 'days'}`;
        case 10080:
            return `7 ${locale.days || 'days'}`;
        default:
            return `${duration} ${locale.minutes}`;
    }
};
exports.default = async (thread) => {
    try {
        const client = thread.client;
        const settings = client.settings;
        if (!settings.logs?.enabled || !settings.logs.threadCreate?.enabled)
            return;
        const logChannelId = settings.logs.threadCreate.channelId;
        if (!logChannelId)
            return;
        const logChannel = await client.channels.fetch(logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.logs?.threadCreate;
        if (!locale) {
            console.error(`Failed to find thread create locale data for ${client.defaultLanguage}`);
            return;
        }
        const auditLogs = await thread.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.ThreadCreate,
            limit: 1,
        });
        const createLog = auditLogs.entries.first();
        const executor = createLog?.executor;
        const getThreadType = (type) => {
            switch (type) {
                case discord_js_1.ChannelType.PublicThread: return locale.types.public;
                case discord_js_1.ChannelType.PrivateThread: return locale.types.private;
                case discord_js_1.ChannelType.AnnouncementThread: return locale.types.announcement;
                default: return locale.types.unknown;
            }
        };
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.threadCreate.color)
            .addFields([
            {
                name: `📝 ${locale.name}`,
                value: thread.name,
                inline: true
            },
            {
                name: `📋 ${locale.type}`,
                value: getThreadType(thread.type),
                inline: true
            },
            {
                name: `📁 ${locale.parent}`,
                value: thread.parent ? thread.parent.name : locale.unknown,
                inline: true
            },
            {
                name: `⏰ ${locale.autoArchiveDuration}`,
                value: formatArchiveDuration(thread.autoArchiveDuration, locale),
                inline: true
            },
            {
                name: `🐌 ${locale.slowMode}`,
                value: thread.rateLimitPerUser ? `${thread.rateLimitPerUser}s` : locale.no,
                inline: true
            },
            {
                name: `🔒 ${locale.private}`,
                value: thread.type === discord_js_1.ChannelType.PrivateThread ? locale.yes : locale.no,
                inline: true
            },
            {
                name: `👤 ${locale.createdBy}`,
                value: executor ? `${executor.tag} (${executor.id})` : locale.unknown,
                inline: true
            }
        ])
            .setFooter({ text: `${locale.threadId}: ${thread.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging thread create:', error);
    }
};
