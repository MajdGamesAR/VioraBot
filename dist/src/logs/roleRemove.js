"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = async (member, role) => {
    try {
        const client = member.client;
        const settings = client.settings;
        if (!settings.logs?.enabled || !settings.logs.roleRemove?.enabled)
            return;
        const logChannelId = settings.logs.roleRemove.channelId;
        if (!logChannelId)
            return;
        const logChannel = await client.channels.fetch(logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.logs?.roleRemove;
        if (!locale) {
            console.error(`Failed to find role remove locale data for ${client.defaultLanguage}`);
            return;
        }
        const auditLogs = await member.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.MemberRoleUpdate,
            limit: 1,
        });
        const roleLog = auditLogs.entries.first();
        const executor = roleLog?.executor;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.roleRemove.color)
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
            name: `📋 ${locale.role}`,
            value: `${role.name} (<@&${role.id}>)`,
            inline: true
        }, {
            name: `👮 ${locale.removedBy}`,
            value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
            inline: true
        })
            .setFooter({ text: `${locale.memberId}: ${member.id} | ${locale.roleId}: ${role.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging role remove:', error);
    }
};
