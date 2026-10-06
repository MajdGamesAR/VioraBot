"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = async (invite) => {
    try {
        const client = invite.client;
        const settings = client.settings;
        if (!settings.logs?.enabled || !settings.logs.inviteCreate?.enabled)
            return;
        if (!invite.guild)
            return;
        const logChannel = await client.channels.fetch(settings.logs.inviteCreate.channelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.logs?.inviteCreate;
        if (!locale)
            return;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.inviteCreate.color)
            .addFields([
            {
                name: `👤 ${locale.createdBy}`,
                value: invite.inviter ? `${invite.inviter.tag} (<@${invite.inviter.id}>)` : locale.unknown,
                inline: true
            },
            {
                name: `🔊 ${locale.channel}`,
                value: invite.channel ? `${invite.channel.name} (<#${invite.channel.id}>)` : locale.unknown,
                inline: true
            },
            {
                name: `⏰ ${locale.expiresAt}`,
                value: invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>` : locale.never,
                inline: true
            },
            {
                name: `🔗 ${locale.code}`,
                value: `discord.gg/${invite.code}`,
                inline: true
            },
            {
                name: `📊 ${locale.maxUses}`,
                value: invite.maxUses ? invite.maxUses.toString() : locale.unlimited,
                inline: true
            },
            {
                name: `🔄 ${locale.temporary}`,
                value: invite.temporary ? locale.yes : locale.no,
                inline: true
            }
        ])
            .setFooter({ text: `${locale.inviteCode}: ${invite.code}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
        console.log(`Logged invite creation: ${invite.code}`);
    }
    catch (error) {
        console.error('Error in invite create log:', error);
    }
};
