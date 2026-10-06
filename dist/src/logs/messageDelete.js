"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const MAX_FIELD_LENGTH = 1024;
function truncateText(text, maxLength) {
    if (!text)
        return '';
    if (text.length <= maxLength)
        return text;
    return text.substring(0, maxLength - 3) + '...';
}
exports.default = async (message) => {
    console.log('Message Delete Event Triggered', message.id);
    if (!message.guild)
        return;
    const client = message.client;
    const settings = client.settings;
    if (!settings.logs?.enabled || !settings.logs.messageDelete?.enabled)
        return;
    const logChannelId = settings.logs.messageDelete.channelId;
    if (!logChannelId)
        return;
    const logChannel = client.channels.cache.get(logChannelId);
    if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
        return;
    const locale = client.locales.get(client.defaultLanguage)?.logs?.messageDelete;
    if (!locale) {
        console.error(`Failed to find message delete locale data for ${client.defaultLanguage}`);
        return;
    }
    const ignoredChannels = settings.logs.messageDelete.ignoredChannels;
    if (ignoredChannels.includes(message.channel.id))
        return;
    if (settings.logs.messageDelete.ignoreBots && message.author?.bot)
        return;
    try {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description.replace('{channel}', message.channel.toString()))
            .setColor(settings.logs.messageDelete.color)
            .addFields({
            name: `📝 ${locale.content}`,
            value: truncateText(message.content || locale.noContent, MAX_FIELD_LENGTH),
            inline: false
        }, {
            name: `👤 ${locale.author}`,
            value: message.author ? `<@${message.author.id}> (${message.author.tag})` : 'Unknown',
            inline: true
        }, {
            name: `#️⃣ ${locale.channel}`,
            value: `<#${message.channel.id}> (${message.channel.type === discord_js_1.ChannelType.DM ? 'DM' : message.channel.name})`,
            inline: true
        })
            .setFooter({
            text: `${locale.messageId}: ${message.id} | ${locale.authorId}: ${message.author?.id || 'Unknown'}`
        })
            .setTimestamp();
        if (message.attachments?.size > 0) {
            const attachmentsList = message.attachments.map(a => `• [${a.name}](${a.proxyURL})`).join('\n');
            embed.addFields({
                name: `📎 ${locale.attachments} (${message.attachments.size})`,
                value: attachmentsList,
                inline: false
            });
        }
        if (message.embeds?.length > 0) {
            embed.addFields({
                name: `🔗 ${locale.embeds}`,
                value: locale.embedsCount
                    .replace('{count}', message.embeds.length.toString())
                    .replace('{plural}', message.embeds.length > 1 ? 's' : ''),
                inline: false
            });
        }
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging deleted message:', error);
    }
};
