"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMemberJoin = void 0;
const discord_js_1 = require("discord.js");
const moderationLogger_1 = require("../logs/moderationLogger");
const moderationHistory_1 = require("./moderationHistory");
const joinTracker = new Map();
const actionGuard = new Map();
const RAID_COOLDOWN = 60000;
const sendRaidLog = async (client, member, payload) => {
    const settings = client.settings;
    try {
        const channelId = settings.protection.raid.logChannelId || settings.protection.logChannelId;
        if (!channelId)
            return;
        const logChannel = member.guild.channels.cache.get(channelId);
        if (!logChannel || typeof logChannel.send !== 'function')
            return;
        const locale = client.locales?.get(client.defaultLanguage)?.protection?.raid;
        if (!locale)
            return;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(payload.actionType === 'none' ? 0xffaa00 : 0xff0000)
            .addFields({
            name: `👤 ${locale.member || 'Member'}`,
            value: `${member.user.tag} (<@${member.id}>)`,
            inline: true
        }, {
            name: `🪪 ${locale.newAccount || 'New Account'}`,
            value: payload.isNewAccount ? (locale.yesNo?.yes || 'Yes') : (locale.yesNo?.no || 'No'),
            inline: true
        }, {
            name: `🤖 ${locale.bot || 'Bot'}`,
            value: payload.isBot ? (locale.yesNo?.yes || 'Yes') : (locale.yesNo?.no || 'No'),
            inline: true
        }, {
            name: `📊 ${locale.joinsInWindow || 'Joins in Window'}`,
            value: payload.joins.toString(),
            inline: true
        }, {
            name: `🛡️ ${locale.action || 'Action'}`,
            value: payload.actionType,
            inline: true
        })
            .setFooter({ text: `${locale.memberId || 'Member ID'}: ${member.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error sending raid log:', error);
    }
};
const applyRaidAction = async (member, cfg) => {
    const client = member.client;
    const action = cfg.action?.type || 'none';
    const reason = cfg.action?.reason || 'Anti-Raid Protection Triggered';
    if (action === 'none') {
        return 'none';
    }
    try {
        switch (action) {
            case 'timeout':
                await member.timeout(cfg.action.duration || 3600000, reason);
                break;
            case 'kick':
                await member.kick(reason);
                break;
            case 'ban':
                await member.ban({ reason, deleteMessageSeconds: 0 });
                break;
            default:
                return 'none';
        }
        await (0, moderationLogger_1.logModerationAction)(client, member.guild, {
            action: 'antiraid',
            target: member,
            targetId: member.id,
            moderator: client.user,
            moderatorId: client.user?.id,
            reason,
            color: 0xff0000
        });
        await (0, moderationHistory_1.recordAction)({
            guildId: member.guild.id,
            userId: member.id,
            moderatorId: client.user?.id,
            action: `antiraid:${action}`,
            reason,
            targetName: member.user?.tag || null,
            moderatorName: client.user?.tag || null
        });
        return action;
    }
    catch (error) {
        console.error('Error applying raid action:', error);
        return 'none';
    }
};
const handleMemberJoin = async (member) => {
    const client = member.client;
    const settings = client.settings;
    if (!settings.protection?.enabled)
        return;
    const cfg = settings.protection.raid;
    if (!cfg || cfg.enabled === false)
        return;
    try {
        if (Array.isArray(cfg.ignoredRoles) && cfg.ignoredRoles.length > 0 &&
            member.roles.cache.some(role => cfg.ignoredRoles.includes(role.id))) {
            return;
        }
        const guildId = member.guild.id;
        const windowMs = cfg.timeWindow || 10000;
        const joinLimit = cfg.joinLimit || 5;
        const now = Date.now();
        let joins = joinTracker.get(guildId) || [];
        joins = joins.filter(time => now - time < windowMs);
        joins.push(now);
        joinTracker.set(guildId, joins.slice(-50));
        if (joins.length < joinLimit)
            return;
        const isBot = !!member.user.bot;
        const whitelisted = Array.isArray(cfg.botWhitelist) && cfg.botWhitelist.includes(member.user.id);
        const accountAgeMs = now - member.user.createdTimestamp;
        const newAccountDays = cfg.newAccountAgeDays || 7;
        const isNewAccount = accountAgeMs < newAccountDays * 86400000;
        const identifiable = (isBot && !whitelisted) || isNewAccount;
        const guardKey = `raid:${guildId}`;
        const lastTrigger = actionGuard.get(guardKey);
        const actionType = identifiable && cfg.action?.type ? cfg.action.type : 'none';
        if (!lastTrigger || now - lastTrigger > RAID_COOLDOWN) {
            actionGuard.set(guardKey, now);
            if (identifiable) {
                await applyRaidAction(member, cfg);
            }
        }
        await sendRaidLog(client, member, {
            joins: joins.length,
            isBot,
            isNewAccount,
            actionType
        });
    }
    catch (error) {
        console.error('Error in anti-raid handler:', error);
    }
};
exports.handleMemberJoin = handleMemberJoin;
const staleDataSweep = () => {
    const now = Date.now();
    for (const [key, joins] of joinTracker) {
        const maxWindow = 60000;
        const filtered = joins.filter(time => now - time < maxWindow);
        if (filtered.length === 0) {
            joinTracker.delete(key);
        }
        else {
            joinTracker.set(key, filtered);
        }
    }
    for (const [key, time] of actionGuard) {
        if (now - time > RAID_COOLDOWN) {
            actionGuard.delete(key);
        }
    }
};
const sweepInterval = setInterval(staleDataSweep, 60000);
if (sweepInterval.unref) {
    sweepInterval.unref();
}