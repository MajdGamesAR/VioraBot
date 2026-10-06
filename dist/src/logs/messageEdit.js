"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const MAX_FIELD_LENGTH = 1024;
const MAX_CONTENT_PREVIEW = 200;
function truncateText(text, maxLength) {
    if (!text)
        return '';
    if (text.length <= maxLength)
        return text;
    return text.substring(0, maxLength - 3) + '...';
}
exports.default = async (oldMessage, newMessage) => {
    if (!oldMessage.guild || !newMessage.guild)
        return;
    const client = oldMessage.client;
    const settings = client.settings;
    if (!settings.logs?.enabled || !settings.logs.messageEdit?.enabled)
        return;
    const logChannelId = settings.logs.messageEdit.channelId;
    if (!logChannelId)
        return;
    const logChannel = client.channels.cache.get(logChannelId);
    if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
        return;
    const locale = client.locales.get(client.defaultLanguage)?.logs?.messageEdit;
    if (!locale) {
        console.error(`Failed to find message edit locale data for ${client.defaultLanguage}`);
        return;
    }
    const ignoredChannels = settings.logs.messageEdit.ignoredChannels;
    if (ignoredChannels.includes(oldMessage.channel.id))
        return;
    if (settings.logs.messageEdit.ignoreBots && oldMessage.author?.bot)
        return;
    if (oldMessage.content === newMessage.content)
        return;
    try {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description.replace('{channel}', oldMessage.channel.toString()))
            .setColor(settings.logs.messageEdit.color)
            .addFields({
            name: `📝 ${locale.before}`,
            value: `\`\`\`${truncateText(oldMessage.content || locale.noContent, MAX_CONTENT_PREVIEW)}\`\`\``,
            inline: false
        }, {
            name: `📝 ${locale.after}`,
            value: `\`\`\`${truncateText(newMessage.content || locale.noContent, MAX_CONTENT_PREVIEW)}\`\`\``,
            inline: false
        }, {
            name: `👤 ${locale.author}`,
            value: oldMessage.author ? `<@${oldMessage.author.id}> (${oldMessage.author.tag})` : 'Unknown',
            inline: true
        }, {
            name: `#️⃣ ${locale.channel}`,
            value: `<#${oldMessage.channel.id}> (${oldMessage.channel.type === discord_js_1.ChannelType.DM ? 'DM' : oldMessage.channel.name})`,
            inline: true
        }, {
            name: `🔗 ${locale.jumpToMessage}`,
            value: `[${locale.jumpToMessage}](${newMessage.url})`,
            inline: true
        })
            .setFooter({
            text: `${locale.messageId}: ${newMessage.id} | ${locale.authorId}: ${oldMessage.author?.id || 'Unknown'}`
        })
            .setTimestamp();
        if (oldMessage.attachments?.size !== newMessage.attachments?.size) {
            const oldAttachments = oldMessage.attachments?.size > 0
                ? oldMessage.attachments.map(a => `• [${a.name}](${a.proxyURL})`).join('\n')
                : locale.noAttachments;
            const newAttachments = newMessage.attachments?.size > 0
                ? newMessage.attachments.map(a => `• [${a.name}](${a.proxyURL})`).join('\n')
                : locale.noAttachments;
            embed.addFields({
                name: `📎 ${locale.oldAttachments} (${oldMessage.attachments?.size || 0})`,
                value: truncateText(oldAttachments, MAX_FIELD_LENGTH),
                inline: true
            }, {
                name: `📎 ${locale.newAttachments} (${newMessage.attachments?.size || 0})`,
                value: truncateText(newAttachments, MAX_FIELD_LENGTH),
                inline: true
            });
        }
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging edited message:', error);
    }
};
