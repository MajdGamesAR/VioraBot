"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = async (role) => {
    if (!role.guild)
        return;
    const client = role.client;
    const settings = client.settings;
    if (!settings.logs?.enabled || !settings.logs.roleCreate?.enabled)
        return;
    const logChannelId = settings.logs.roleCreate.channelId;
    if (!logChannelId)
        return;
    const logChannel = client.channels.cache.get(logChannelId);
    if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
        return;
    const locale = client.locales.get(client.defaultLanguage)?.logs?.roleCreate;
    if (!locale) {
        console.error(`Failed to find role create locale data for ${client.defaultLanguage}`);
        return;
    }
    try {
        const auditLogs = await role.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.RoleCreate,
            limit: 1,
        });
        const createLog = auditLogs.entries.first();
        const executor = createLog?.executor;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.roleCreate.color)
            .addFields({
            name: `📝 ${locale.name}`,
            value: role.name,
            inline: true
        }, {
            name: `👤 ${locale.createdBy}`,
            value: executor ? `${executor.tag} (${executor.id})` : locale.unknown,
            inline: true
        }, {
            name: `🎨 ${locale.color}`,
            value: role.hexColor,
            inline: true
        }, {
            name: `📊 ${locale.position}`,
            value: role.position.toString(),
            inline: true
        }, {
            name: `🔝 ${locale.hoisted}`,
            value: role.hoist ? locale.yes : locale.no,
            inline: true
        }, {
            name: `💬 ${locale.mentionable}`,
            value: role.mentionable ? locale.yes : locale.no,
            inline: true
        }, {
            name: `🔒 ${locale.permissions}`,
            value: `\`\`\`${role.permissions.toArray().join(', ') || 'None'}\`\`\``,
            inline: false
        })
            .setFooter({ text: `${locale.roleId}: ${role.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging role create:', error);
    }
};
