"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const formatDate_1 = require("../utils/formatDate");
exports.default = async (member) => {
    try {
        const client = member.client;
        const settings = client.settings;
        if (!settings.logs?.enabled || !settings.logs.memberJoin?.enabled)
            return;
        const logChannelId = settings.logs.memberJoin.channelId;
        if (!logChannelId)
            return;
        const logChannel = await client.channels.fetch(logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.logs?.memberJoin;
        if (!locale) {
            console.error(`Failed to find member join locale data for ${client.defaultLanguage}`);
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.memberJoin.color)
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
            name: `📅 ${locale.accountCreated}`,
            value: (0, formatDate_1.formatDate)(member.user.createdAt),
            inline: true
        }, {
            name: `⌚ ${locale.joinedAt}`,
            value: (0, formatDate_1.formatDate)(new Date()),
            inline: true
        }, {
            name: `👥 ${locale.memberCount}`,
            value: member.guild.memberCount.toString(),
            inline: true
        })
            .setFooter({ text: `${locale.memberId}: ${member.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging member join:', error);
    }
};
