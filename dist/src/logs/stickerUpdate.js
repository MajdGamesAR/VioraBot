"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = async (oldSticker, newSticker) => {
    try {
        const client = newSticker.client;
        const settings = client.settings;
        if (!settings.logs?.enabled || !settings.logs.stickerUpdate?.enabled)
            return;
        console.log('Sticker Update Event Triggered:', oldSticker.name, '->', newSticker.name);
        const logChannelId = settings.logs.stickerUpdate.channelId;
        if (!logChannelId)
            return;
        const logChannel = await client.channels.fetch(logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.logs?.stickerUpdate;
        if (!locale) {
            console.error(`Failed to find sticker update locale data for ${client.defaultLanguage}`);
            return;
        }
        const auditLogs = await newSticker.guild?.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.StickerUpdate,
            limit: 1,
        });
        const updateLog = auditLogs?.entries.first();
        const executor = updateLog?.executor;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.stickerUpdate.color)
            .setThumbnail(newSticker.url)
            .addFields({
            name: `📝 ${locale.oldName}`,
            value: oldSticker.name || locale.unknown,
            inline: true
        }, {
            name: `📝 ${locale.newName}`,
            value: newSticker.name || locale.unknown,
            inline: true
        }, {
            name: `📋 ${locale.oldDescription}`,
            value: oldSticker.description || locale.unknown,
            inline: true
        }, {
            name: `📋 ${locale.newDescription}`,
            value: newSticker.description || locale.unknown,
            inline: true
        }, {
            name: `🏷️ ${locale.oldTags}`,
            value: oldSticker.tags || locale.unknown,
            inline: true
        }, {
            name: `🏷️ ${locale.newTags}`,
            value: newSticker.tags || locale.unknown,
            inline: true
        }, {
            name: `👮 ${locale.updatedBy}`,
            value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
            inline: true
        })
            .setFooter({ text: `${locale.stickerId}: ${newSticker.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging sticker update:', error);
    }
};
