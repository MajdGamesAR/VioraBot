"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = async (oldState, newState) => {
    try {
        if (oldState.serverMute === newState.serverMute)
            return;
        const client = newState.client;
        const settings = client.settings;
        if (!settings.logs?.enabled || !settings.logs.voiceServerMute?.enabled)
            return;
        const logChannelId = settings.logs.voiceServerMute.channelId;
        if (!logChannelId)
            return;
        const logChannel = await client.channels.fetch(logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.logs?.voiceServerMute;
        if (!locale) {
            console.error(`Failed to find voice server mute locale data for ${client.defaultLanguage}`);
            return;
        }
        const auditLogs = await newState.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.MemberUpdate,
            limit: 1,
        });
        const muteLog = auditLogs.entries.first();
        const executor = muteLog?.executor;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.voiceServerMute.color)
            .addFields([
            {
                name: `👤 ${locale.member}`,
                value: `${newState.member?.user.tag} (<@${newState.member?.id}>)`,
                inline: true
            },
            {
                name: `🔊 ${locale.channel}`,
                value: newState.channel ? `${newState.channel.name} (<#${newState.channelId}>)` : locale.unknown,
                inline: true
            },
            {
                name: `📢 ${locale.status}`,
                value: newState.serverMute ? locale.muted : locale.unmuted,
                inline: true
            },
            {
                name: `👮 ${locale.mutedBy}`,
                value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
                inline: true
            }
        ])
            .setFooter({ text: `${locale.memberId}: ${newState.member?.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging voice server mute:', error);
    }
};
