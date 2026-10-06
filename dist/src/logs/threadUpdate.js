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
exports.default = async (oldThread, newThread) => {
    try {
        const client = oldThread.client;
        const settings = client.settings;
        if (!settings.logs?.enabled || !settings.logs.threadUpdate?.enabled)
            return;
        const logChannelId = settings.logs.threadUpdate.channelId;
        if (!logChannelId)
            return;
        const logChannel = await client.channels.fetch(logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.logs?.threadUpdate;
        if (!locale) {
            console.error(`Failed to find thread update locale data for ${client.defaultLanguage}`);
            return;
        }
        const auditLogs = await oldThread.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.ThreadUpdate,
            limit: 1,
        });
        const updateLog = auditLogs.entries.first();
        const executor = updateLog?.executor;
        const getThreadType = (type) => {
            switch (type) {
                case discord_js_1.ChannelType.PublicThread: return locale.types.public;
                case discord_js_1.ChannelType.PrivateThread: return locale.types.private;
                case discord_js_1.ChannelType.AnnouncementThread: return locale.types.announcement;
                default: return locale.types.unknown;
            }
        };
        const fields = [];
        if (oldThread.name !== newThread.name) {
            fields.push({
                name: `📝 ${locale.name}`,
                value: `${locale.before}: ${oldThread.name}\n${locale.after}: ${newThread.name}`,
                inline: false
            });
        }
        if (oldThread.autoArchiveDuration !== newThread.autoArchiveDuration) {
            fields.push({
                name: `⏰ ${locale.autoArchiveDuration}`,
                value: `${locale.before}: ${formatArchiveDuration(oldThread.autoArchiveDuration, locale)}\n${locale.after}: ${formatArchiveDuration(newThread.autoArchiveDuration, locale)}`,
                inline: false
            });
        }
        if (oldThread.rateLimitPerUser !== newThread.rateLimitPerUser) {
            fields.push({
                name: `🐌 ${locale.slowMode}`,
                value: `${locale.before}: ${oldThread.rateLimitPerUser || '0'}s\n${locale.after}: ${newThread.rateLimitPerUser || '0'}s`,
                inline: false
            });
        }
        if (oldThread.archived !== newThread.archived) {
            fields.push({
                name: `📦 ${locale.archived}`,
                value: `${locale.before}: ${oldThread.archived ? locale.yes : locale.no}\n${locale.after}: ${newThread.archived ? locale.yes : locale.no}`,
                inline: false
            });
        }
        if (oldThread.locked !== newThread.locked) {
            fields.push({
                name: `🔒 ${locale.locked}`,
                value: `${locale.before}: ${oldThread.locked ? locale.yes : locale.no}\n${locale.after}: ${newThread.locked ? locale.yes : locale.no}`,
                inline: false
            });
        }
        if (oldThread.type === discord_js_1.ChannelType.PrivateThread &&
            newThread.type === discord_js_1.ChannelType.PrivateThread &&
            oldThread.invitable !== newThread.invitable) {
            fields.push({
                name: `✉️ ${locale.invitable}`,
                value: `${locale.before}: ${oldThread.invitable ? locale.yes : locale.no}\n${locale.after}: ${newThread.invitable ? locale.yes : locale.no}`,
                inline: false
            });
        }
        if (oldThread.type !== newThread.type) {
            fields.push({
                name: `📋 ${locale.type}`,
                value: `${locale.before}: ${getThreadType(oldThread.type)}\n${locale.after}: ${getThreadType(newThread.type)}`,
                inline: false
            });
        }
        if (fields.length > 0) {
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.title)
                .setDescription(locale.description)
                .setColor(settings.logs.threadUpdate.color)
                .addFields([
                ...fields,
                {
                    name: `👤 ${locale.updatedBy}`,
                    value: executor ? `${executor.tag} (${executor.id})` : locale.unknown,
                    inline: false
                }
            ])
                .setFooter({ text: `${locale.threadId}: ${newThread.id}` })
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }
    }
    catch (error) {
        console.error('Error logging thread update:', error);
    }
};
