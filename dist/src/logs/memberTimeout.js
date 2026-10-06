"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const formatDate_1 = require("../utils/formatDate");
exports.default = async (member, _oldTimeout, newTimeout) => {
    try {
        if (!newTimeout)
            return;
        const client = member.client;
        const settings = client.settings;
        if (!settings.logs?.enabled || !settings.logs.memberTimeout?.enabled)
            return;
        const logChannelId = settings.logs.memberTimeout.channelId;
        if (!logChannelId)
            return;
        const logChannel = await client.channels.fetch(logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.logs?.memberTimeout;
        if (!locale) {
            console.error(`Failed to find member timeout locale data for ${client.defaultLanguage}`);
            return;
        }
        const auditLogs = await member.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.MemberUpdate,
            limit: 1,
        });
        const timeoutLog = auditLogs.entries.first();
        const executor = timeoutLog?.executor;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.memberTimeout.color)
            .setThumbnail(member.user.displayAvatarURL({ size: 1024 }))
            .addFields({
            name: `👤 ${locale.member}`,
            value: `${member.user.tag} (<@${member.id}>)`,
            inline: true
        }, {
            name: `🤖 ${locale.bot}`,
            value: member.user.bot ? locale.yes : locale.no,
            inline: true
        }, {
            name: `⏰ ${locale.expires}`,
            value: (0, formatDate_1.formatDate)(newTimeout),
            inline: true
        }, {
            name: `👮 ${locale.timedOutBy}`,
            value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
            inline: true
        }, {
            name: `📝 ${locale.reason}`,
            value: timeoutLog?.reason || locale.noReason,
            inline: true
        })
            .setFooter({ text: `${locale.memberId}: ${member.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging member timeout:', error);
    }
};
