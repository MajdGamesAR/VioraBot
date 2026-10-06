"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = async (oldEmoji, newEmoji) => {
    try {
        console.log('Emoji Update Event Triggered:', oldEmoji.name, '->', newEmoji.name);
        const client = newEmoji.client;
        const settings = client.settings;
        if (!settings.logs?.enabled || !settings.logs.emojiUpdate?.enabled)
            return;
        const logChannelId = settings.logs.emojiUpdate.channelId;
        if (!logChannelId)
            return;
        const logChannel = await client.channels.fetch(logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.logs?.emojiUpdate;
        if (!locale) {
            console.error(`Failed to find emoji update locale data for ${client.defaultLanguage}`);
            return;
        }
        const auditLogs = await newEmoji.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.EmojiUpdate,
            limit: 1,
        });
        const updateLog = auditLogs.entries.first();
        const executor = updateLog?.executor;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.emojiUpdate.color)
            .setThumbnail(newEmoji.url)
            .addFields({
            name: `😀 ${locale.emoji}`,
            value: `<${newEmoji.animated ? 'a' : ''}:${newEmoji.name}:${newEmoji.id}>`,
            inline: true
        }, {
            name: `📝 ${locale.oldName}`,
            value: oldEmoji.name || locale.unknown,
            inline: true
        }, {
            name: `📝 ${locale.newName}`,
            value: newEmoji.name || locale.unknown,
            inline: true
        }, {
            name: `👮 ${locale.updatedBy}`,
            value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
            inline: true
        })
            .setFooter({ text: `${locale.emojiId}: ${newEmoji.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging emoji update:', error);
    }
};
