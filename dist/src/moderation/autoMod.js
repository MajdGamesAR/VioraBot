"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkContent = exports.handleMessage = void 0;
const discord_js_1 = require("discord.js");
const warningManager_1 = require("./warningManager");
const moderationLogger_1 = require("../logs/moderationLogger");
const moderationHistory_1 = require("./moderationHistory");
const contentChecker_1 = require("./contentChecker");
const tracker = new Map();
const getKey = (userId, channelId) => `${userId}:${channelId}`;
const isIgnored = (channelId, member, ruleConfig) => {
    if (Array.isArray(ruleConfig.ignoredChannels) && ruleConfig.ignoredChannels.includes(channelId))
        return true;
    if (Array.isArray(ruleConfig.ignoredRoles) && ruleConfig.ignoredRoles.length > 0 &&
        member.roles.cache.some(role => ruleConfig.ignoredRoles.includes(role.id))) {
        return true;
    }
    return false;
};
const applyRuleAction = async (member, message, ruleConfig, ruleName) => {
    const client = member.client;
    const action = ruleConfig.action || 'delete';
    const reason = ruleConfig.reason || `Automod: ${ruleName} rule triggered`;
    try {
        switch (action) {
            case 'delete':
                await message.delete().catch(() => null);
                break;
            case 'timeout':
                await member.timeout(ruleConfig.duration || 60000, reason);
                await message.delete().catch(() => null);
                break;
            case 'kick':
                await member.kick(reason);
                break;
            case 'ban':
                await member.ban({ reason, deleteMessageSeconds: 0 });
                break;
            case 'warn': {
                const current = await (0, warningManager_1.getWarningCount)(member.guild.id, member.id);
                await (0, warningManager_1.addWarning)({
                    guildId: member.guild.id,
                    userId: member.id,
                    moderatorId: client.user?.id,
                    reason
                });
                await (0, warningManager_1.checkThreshold)(client, member, current + 1);
                await message.delete().catch(() => null);
                break;
            }
            case 'none':
            default:
                break;
        }
    }
    catch (error) {
        console.error('Error applying automod action:', error);
        return;
    }
    await (0, moderationLogger_1.logModerationAction)(client, member.guild, {
        action: 'automod',
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
        action: `automod:${ruleName}`,
        reason,
        targetName: member.user?.tag || null,
        moderatorName: client.user?.tag || null
    });
};
const trackMessages = async (message, automod) => {
    const rules = automod.rules || {};
    const content = message.content;
    const key = getKey(message.author.id, message.channel.id);
    const now = Date.now();
    let data = tracker.get(key);
    if (!data) {
        data = { times: [], duplicateCount: 1, lastContent: content.toLowerCase() };
        tracker.set(key, data);
    }
    const maxWindow = Math.max(rules.spam?.timeWindow || 5000, rules.flood?.timeWindow || 10000);
    data.times = data.times.filter(time => now - time < maxWindow);
    data.times.push(now);
    if (content.toLowerCase() === data.lastContent) {
        data.duplicateCount++;
    }
    else {
        data.duplicateCount = 1;
        data.lastContent = content.toLowerCase();
    }
    const channelId = message.channel.id;
    if (rules.spam?.enabled && rules.spam.threshold && rules.spam.timeWindow &&
        data.times.length >= rules.spam.threshold && !isIgnored(channelId, message.member, rules.spam)) {
        tracker.delete(key);
        await applyRuleAction(message.member, message, rules.spam, 'spam');
        return;
    }
    if (rules.duplicate?.enabled && rules.duplicate.threshold &&
        data.duplicateCount >= rules.duplicate.threshold && !isIgnored(channelId, message.member, rules.duplicate)) {
        tracker.delete(key);
        await applyRuleAction(message.member, message, rules.duplicate, 'duplicate');
        return;
    }
    if (rules.flood?.enabled && rules.flood.threshold && rules.flood.timeWindow &&
        data.times.length >= rules.flood.threshold && !isIgnored(channelId, message.member, rules.flood)) {
        tracker.delete(key);
        await applyRuleAction(message.member, message, rules.flood, 'flood');
        return;
    }
    if (data.times.length > 50) {
        data.times = data.times.slice(-25);
    }
    tracker.set(key, data);
};
const handleMessage = async (message) => {
    const client = message.client;
    if (!message.guild || !message.member || message.author.bot || !message.channel)
        return;
    const settings = client.settings;
    const automod = settings.automod;
    if (!automod || automod.enabled === false)
        return;
    if (!(message.channel instanceof discord_js_1.TextChannel) && !(message.channel instanceof discord_js_1.ThreadChannel))
        return;
    const content = message.content;
    if (typeof content !== 'string' || content.length === 0)
        return;
    try {
        if (Array.isArray(automod.staffRoles) && automod.staffRoles.length > 0 &&
            message.member.roles.cache.some(role => automod.staffRoles.includes(role.id))) {
            return;
        }
        const rule = contentChecker_1.checkContent(content, automod);
        if (!rule) {
            await trackMessages(message, automod);
            return;
        }
        const ruleConfig = automod.rules[rule];
        if (!ruleConfig || ruleConfig.enabled === false) {
            await trackMessages(message, automod);
            return;
        }
        if (isIgnored(message.channel.id, message.member, ruleConfig))
            return;
        await applyRuleAction(message.member, message, ruleConfig, rule);
    }
    catch (error) {
        console.error('Error in autoMod handler:', error);
    }
};
exports.handleMessage = handleMessage;
exports.checkContent = contentChecker_1.checkContent;
const staleDataSweep = () => {
    const now = Date.now();
    for (const [key, data] of tracker) {
        if (data.times.length === 0 || now - data.times[data.times.length - 1] > 120000) {
            tracker.delete(key);
        }
    }
};
const sweepInterval = setInterval(staleDataSweep, 60000);
if (sweepInterval.unref) {
    sweepInterval.unref();
}