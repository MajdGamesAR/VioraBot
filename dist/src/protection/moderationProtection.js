"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUnban = exports.handleBan = exports.handleKick = void 0;
const discord_js_1 = require("discord.js");
const actionTracker = new Map();
const actionGuard = new Map();
const shouldSkipAction = (executorId, type) => {
    const key = `${executorId}:${type}`;
    const last = actionGuard.get(key);
    if (last && Date.now() - last < 30000) {
        return true;
    }
    actionGuard.set(key, Date.now());
    return false;
};
const resetCounters = (userId, settings) => {
    const now = Date.now();
    const userData = actionTracker.get(userId);
    if (userData && now - userData.lastReset >= settings.protection.moderation.limits.timeWindow) {
        actionTracker.set(userId, {
            kicks: 0,
            bans: 0,
            unbans: 0,
            lastReset: now
        });
    }
};
const takeAction = async (member, reason) => {
    const client = member.client;
    const settings = client.settings;
    const { action } = settings.protection.moderation;
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
const sendProtectionLog = async (client, member, actionType, targetUser, limitType, limit) => {
    const settings = client.settings;
    try {
        if (!settings.protection?.logChannelId)
            return;
        const logChannel = member.guild.channels.cache.get(settings.protection.logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.protection.moderation;
        if (!locale)
            return;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.protection.moderation.color)
            .addFields([
            {
                name: `👤 ${locale.member}`,
                value: `${member.user.tag} (<@${member.id}>)`,
                inline: true
            },
            {
                name: `🎯 ${locale.targetMember}`,
                value: `${targetUser instanceof discord_js_1.User ? targetUser.tag : targetUser.user.tag} (<@${targetUser.id}>)`,
                inline: true
            },
            {
                name: `⚡ ${locale.actionType}`,
                value: locale.types[actionType],
                inline: true
            },
            {
                name: `🛡️ ${locale.action}`,
                value: locale.actions[settings.protection.moderation.action.type],
                inline: true
            },
            {
                name: `⏰ ${locale.timeWindow}`,
                value: `${settings.protection.moderation.limits.timeWindow / 1000} ${locale.seconds}`,
                inline: true
            },
            {
                name: `📊 ${locale.limit}`,
                value: `${locale[limitType]}: ${limit}`,
                inline: true
            }
        ])
            .setFooter({ text: `${locale.memberId}: ${member.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error sending protection log:', error);
    }
};
const handleKick = async (member, executor) => {
    const client = member.client;
    const settings = client.settings;
    if (!settings.protection.enabled || settings.protection.moderation.enabled === false)
        return;
    try {
        if (executor.roles.cache.some(role => settings.protection.moderation.action.ignoredRoles.includes(role.id)))
            return;
        resetCounters(executor.id, settings);
        let userData = actionTracker.get(executor.id);
        if (!userData) {
            userData = {
                kicks: 0,
                bans: 0,
                unbans: 0,
                lastReset: Date.now()
            };
            actionTracker.set(executor.id, userData);
        }
        userData.kicks++;
        if (userData.kicks >= settings.protection.moderation.limits.kickLimit) {
            if (shouldSkipAction(executor.id, 'moderation:kick'))
                return;
            await takeAction(executor, settings.protection.moderation.action.reason);
            await sendProtectionLog(client, executor, 'kick', member, 'kickLimit', settings.protection.moderation.limits.kickLimit);
        }
    }
    catch (error) {
        console.error('Error in kick protection:', error);
    }
};
exports.handleKick = handleKick;
const handleBan = async (user, executor) => {
    const client = executor.client;
    const settings = client.settings;
    if (!settings.protection.enabled || settings.protection.moderation.enabled === false)
        return;
    try {
        if (executor.roles.cache.some(role => settings.protection.moderation.action.ignoredRoles.includes(role.id)))
            return;
        resetCounters(executor.id, settings);
        let userData = actionTracker.get(executor.id);
        if (!userData) {
            userData = {
                kicks: 0,
                bans: 0,
                unbans: 0,
                lastReset: Date.now()
            };
            actionTracker.set(executor.id, userData);
        }
        userData.bans++;
        if (userData.bans >= settings.protection.moderation.limits.banLimit) {
            if (shouldSkipAction(executor.id, 'moderation:ban'))
                return;
            await takeAction(executor, settings.protection.moderation.action.reason);
            await sendProtectionLog(client, executor, 'ban', user, 'banLimit', settings.protection.moderation.limits.banLimit);
        }
    }
    catch (error) {
        console.error('Error in ban protection:', error);
    }
};
exports.handleBan = handleBan;
const handleUnban = async (user, executor) => {
    const client = executor.client;
    const settings = client.settings;
    if (!settings.protection.enabled || settings.protection.moderation.enabled === false)
        return;
    try {
        if (executor.roles.cache.some(role => settings.protection.moderation.action.ignoredRoles.includes(role.id)))
            return;
        resetCounters(executor.id, settings);
        let userData = actionTracker.get(executor.id);
        if (!userData) {
            userData = {
                kicks: 0,
                bans: 0,
                unbans: 0,
                lastReset: Date.now()
            };
            actionTracker.set(executor.id, userData);
        }
        userData.unbans++;
        if (userData.unbans >= settings.protection.moderation.limits.unbanLimit) {
            if (shouldSkipAction(executor.id, 'moderation:unban'))
                return;
            await takeAction(executor, settings.protection.moderation.action.reason);
            await sendProtectionLog(client, executor, 'unban', user, 'unbanLimit', settings.protection.moderation.limits.unbanLimit);
        }
    }
    catch (error) {
        console.error('Error in unban protection:', error);
    }
};
exports.handleUnban = handleUnban;
