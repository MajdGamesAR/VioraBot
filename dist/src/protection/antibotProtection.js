"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBotAdd = void 0;
const discord_js_1 = require("discord.js");
const handleBotAdd = async (bot, executor) => {
    const client = bot.client;
    const settings = client.settings;
    if (!settings.protection.enabled || settings.protection.antibot.enabled === false)
        return;
    try {
        if (executor.roles.cache.some(role => settings.protection.antibot.action.ignoredRoles.includes(role.id)))
            return;
        if (settings.protection.antibot.whitelistedBots.includes(bot.id))
            return;
        await takeAction(executor, settings.protection.antibot.action.reason);
        await sendProtectionLog(client, executor, bot.user);
        await bot.kick('Bot not whitelisted');
    }
    catch (error) {
        console.error('Error in antibot protection:', error);
    }
};
exports.handleBotAdd = handleBotAdd;
const takeAction = async (member, reason) => {
    const client = member.client;
    const settings = client.settings;
    const { action } = settings.protection.antibot;
    try {
        switch (action.type) {
            case 'removeRoles':
                const roles = member.roles.cache.filter(role => !action.ignoredRoles.includes(role.id));
                await member.roles.remove(roles, reason);
                break;
            case 'kick':
                await member.kick(reason);
                break;
            case 'ban':
                await member.ban({
                    reason,
                    deleteMessageSeconds: action.duration || undefined
                });
                break;
        }
    }
    catch (error) {
        console.error('Error taking protection action:', error);
    }
};
const sendProtectionLog = async (client, member, bot) => {
    const settings = client.settings;
    try {
        if (!settings.protection?.logChannelId)
            return;
        const logChannel = member.guild.channels.cache.get(settings.protection.logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.protection.antibot;
        if (!locale)
            return;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.protection.antibot.color)
            .addFields([
            {
                name: `👤 ${locale.member}`,
                value: `${member.user.tag} (<@${member.id}>)`,
                inline: true
            },
            {
                name: `🤖 ${locale.bot}`,
                value: `${bot.tag} (<@${bot.id}>)`,
                inline: true
            },
            {
                name: `🛡️ ${locale.action}`,
                value: locale.actions[settings.protection.antibot.action.type],
                inline: true
            }
        ])
            .setFooter({
            text: `${locale.memberId}: ${member.id} | ${locale.botId}: ${bot.id}`
        })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error sending protection log:', error);
    }
};
