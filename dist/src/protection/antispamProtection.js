"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMessage = void 0;
const discord_js_1 = require("discord.js");
const messageTracker = new Map();
const getUserKey = (userId, channelId) => `${userId}-${channelId}`;
const takeAction = async (member, channel, messages) => {
    const client = member.client;
    const settings = client.settings;
    const { action } = settings.protection.antispam;
    try {
        switch (action.type) {
            case 'timeout':
                await member.timeout(action.duration, action.reason);
                if (messages.length > 0) {
                    await channel.bulkDelete(messages);
                }
                break;
            case 'deleteMessages':
                if (messages.length > 0) {
                    await channel.bulkDelete(messages);
                }
                break;
            case 'kick':
                await member.kick(action.reason || 'Antispam Protection Triggered');
                break;
            case 'disableChannel':
                await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: false });
                setTimeout(async () => {
                    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: null });
                }, action.duration);
                break;
        }
    }
    catch (error) {
        console.error('Error taking protection action:', error);
    }
};
const sendProtectionLog = async (client, guild, member, channel, messageCount, duplicateCount) => {
    const settings = client.settings;
    try {
        if (!guild) {
            console.log(`[anti-spam] protection log unavailable guild=NULL channel=${(channel && channel.id) || 'NULL'}`);
            return;
        }
        if (!member) {
            console.log(`[anti-spam] protection log unavailable guild=${guild.id} member=NULL channel=${(channel && channel.id) || 'NULL'}`);
            return;
        }
        if (!settings.protection?.logChannelId) {
            console.log(`[anti-spam] protection log unavailable guild=${guild.id} member=YES logChannel=NO`);
            return;
        }
        const logChannel = guild.channels.cache.get(settings.protection.logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText) {
            console.log(`[anti-spam] protection log unavailable guild=${guild.id} member=YES logChannel=YES targetChannel=INVALID`);
            return;
        }
        const locale = client.locales.get(client.defaultLanguage)?.protection.antispam;
        if (!locale)
            return;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(0xff0000)
            .addFields([
            {
                name: `👤 ${locale.member}`,
                value: `${member.user.tag} (<@${member.id}>)`,
                inline: true
            },
            {
                name: `📝 ${locale.channel}`,
                value: `${channel.name} (<#${channel.id}>)`,
                inline: true
            },
            {
                name: `🛡️ ${locale.action}`,
                value: locale.actions[settings.protection.antispam.action.type],
                inline: true
            },
            {
                name: `📊 ${locale.messageCount}`,
                value: messageCount.toString(),
                inline: true
            },
            {
                name: `🔄 ${locale.duplicateCount}`,
                value: duplicateCount.toString(),
                inline: true
            },
            {
                name: `⏰ ${locale.timeWindow}`,
                value: `${settings.protection.antispam.limits.timeWindow / 1000} ${locale.seconds}`,
                inline: true
            }
        ])
            .setTimestamp();
        if (settings.protection.antispam.action.type === 'timeout') {
            embed.addFields({
                name: `⏳ ${locale.timeoutDuration}`,
                value: `${settings.protection.antispam.action.duration / 60000} ${locale.minutes}`,
                inline: true
            });
        }
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error sending protection log:', error);
    }
};
const handleMessage = async (message) => {
    const client = message.client;
    const settings = client.settings;
    if (!message.guild || !message.member || message.author.bot || !message.channel)
        return;
    if (!settings.protection.enabled || !settings.protection.antispam?.enabled)
        return;
    if (!(message.channel instanceof discord_js_1.TextChannel))
        return;
    try {
        if (settings.protection.antispam.action.ignoredChannels.includes(message.channel.id))
            return;
        if (message.member.roles.cache.some(role => settings.protection.antispam.action.ignoredRoles.includes(role.id)))
            return;
        const userKey = getUserKey(message.author.id, message.channel.id);
        const now = Date.now();
        let userData = messageTracker.get(userKey);
        if (!userData) {
            userData = {
                messages: [],
                lastMessageTime: now,
                duplicateCount: 1,
                lastContent: message.content.toLowerCase()
            };
            messageTracker.set(userKey, userData);
            return;
        }
        const timeDiff = now - userData.lastMessageTime;
        if (timeDiff > settings.protection.antispam.limits.timeWindow) {
            userData.messages = [];
            userData.duplicateCount = 1;
            userData.lastContent = message.content.toLowerCase();
        }
        else {
            userData.messages.push(message);
            if (message.content.toLowerCase() === userData.lastContent) {
                userData.duplicateCount++;
            }
            else {
                userData.duplicateCount = 1;
                userData.lastContent = message.content.toLowerCase();
            }
            if (userData.messages.length >= settings.protection.antispam.limits.messageLimit ||
                userData.duplicateCount >= settings.protection.antispam.limits.duplicateLimit) {
                console.log(`Anti-spam triggered for ${message.author.tag} in ${message.channel.name}:`, {
                    messageCount: userData.messages.length,
                    duplicateCount: userData.duplicateCount,
                    timeWindow: timeDiff
                });
                const triggerGuild = message.guild;
                const triggerMember = message.member;
                await takeAction(triggerMember, message.channel, userData.messages);
                await sendProtectionLog(client, triggerGuild, triggerMember, message.channel, userData.messages.length, userData.duplicateCount);
                messageTracker.delete(userKey);
                return;
            }
        }
        userData.lastMessageTime = now;
        messageTracker.set(userKey, userData);
    }
    catch (error) {
        console.error('Error in anti-spam protection:', error);
    }
};
exports.handleMessage = handleMessage;
const staleDataSweep = () => {
    const now = Date.now();
    for (const [key, userData] of messageTracker) {
        if (now - userData.lastMessageTime > 120000) {
            messageTracker.delete(key);
        }
    }
};
const sweepInterval = setInterval(staleDataSweep, 60000);
if (sweepInterval.unref) {
    sweepInterval.unref();
}
