"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = async (oldMember, newMember) => {
    try {
        const client = oldMember.client;
        const settings = client.settings;
        if (!settings.logs?.enabled || !settings.logs.nicknameUpdate?.enabled)
            return;
        const fullOldMember = oldMember.partial ? await oldMember.fetch() : oldMember;
        const fullNewMember = newMember.partial ? await newMember.fetch() : newMember;
        if (fullOldMember.nickname === fullNewMember.nickname)
            return;
        const logChannelId = settings.logs.nicknameUpdate.channelId;
        if (!logChannelId)
            return;
        const logChannel = await client.channels.fetch(logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.logs?.nicknameUpdate;
        if (!locale) {
            console.error(`Failed to find nickname update locale data for ${client.defaultLanguage}`);
            return;
        }
        const auditLogs = await fullOldMember.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.MemberUpdate,
            limit: 1,
        });
        const nickLog = auditLogs.entries.first();
        const executor = nickLog?.executor;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.nicknameUpdate.color)
            .setThumbnail(fullNewMember.user.displayAvatarURL({ size: 1024 }))
            .addFields({
            name: `👤 ${locale.member}`,
            value: `${fullNewMember.user.tag} (<@${fullNewMember.id}>)`,
            inline: true
        }, {
            name: `🤖 ${locale.bot}`,
            value: fullNewMember.user.bot ? locale.yes : locale.no,
            inline: true
        }, {
            name: `📝 ${locale.oldNickname}`,
            value: fullOldMember.nickname || locale.none,
            inline: true
        }, {
            name: `📝 ${locale.newNickname}`,
            value: fullNewMember.nickname || locale.none,
            inline: true
        }, {
            name: `👮 ${locale.changedBy}`,
            value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
            inline: true
        })
            .setFooter({ text: `${locale.memberId}: ${fullNewMember.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging nickname update:', error);
    }
};
