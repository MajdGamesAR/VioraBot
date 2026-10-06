"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.purgeExpiredWarnings = exports.checkThreshold = exports.getWarningCount = exports.addWarning = exports.removeWarningById = exports.getWarnings = void 0;
const Warning_1 = require("../models/Warning");
const settingsManager_1 = require("../utils/settingsManager");
const getWarnings = async (guildId, userId) => {
    try {
        if (!guildId || !userId)
            return [];
        const warnings = await Warning_1.Warning.find({ guildId, userId }).sort({ timestamp: 1 }).lean();
        return warnings || [];
    }
    catch (error) {
        console.error('Error fetching warnings:', error);
        return [];
    }
};
exports.getWarnings = getWarnings;
const getWarningCount = async (guildId, userId) => {
    const settings = (0, settingsManager_1.getSettings)();
    const warnings = await getWarnings(guildId, userId);
    const expireDays = settings.warnings?.expire?.enabled ? settings.warnings.expire.days : 0;
    const now = Date.now();
    if (!expireDays) {
        return warnings.length;
    }
    let active = 0;
    for (const warning of warnings) {
        if (!warning.expiresAt) {
            active++;
        }
        else if (new Date(warning.expiresAt).getTime() > now) {
            active++;
        }
    }
    return active;
};
exports.getWarningCount = getWarningCount;
const addWarning = async (data) => {
    try {
        const settings = (0, settingsManager_1.getSettings)();
        let expiresAt = null;
        if (settings.warnings?.expire?.enabled && settings.warnings.expire.days > 0) {
            expiresAt = new Date(Date.now() + settings.warnings.expire.days * 86400000);
        }
        const warning = new Warning_1.Warning({
            guildId: data.guildId,
            userId: data.userId,
            moderatorId: data.moderatorId,
            reason: data.reason || 'No reason provided',
            timestamp: data.timestamp || new Date(),
            expiresAt
        });
        await warning.save();
        return warning;
    }
    catch (error) {
        console.error('Error adding warning:', error);
        return null;
    }
};
exports.addWarning = addWarning;
const removeWarningById = async (warningId, guildId) => {
    try {
        if (!warningId)
            return null;
        const removed = await Warning_1.Warning.findOneAndDelete({ _id: warningId, guildId });
        return removed;
    }
    catch (error) {
        console.error('Error removing warning:', error);
        return null;
    }
};
exports.removeWarningById = removeWarningById;
const purgeExpiredWarnings = async (guildId) => {
    try {
        const now = new Date();
        const query = { expiresAt: { $ne: null, $lte: now } };
        if (guildId) {
            query.guildId = guildId;
        }
        await Warning_1.Warning.deleteMany(query);
    }
    catch (error) {
        console.error('Error purging expired warnings:', error);
    }
};
exports.purgeExpiredWarnings = purgeExpiredWarnings;
const punishmentGuard = new Map();
const checkThreshold = async (client, target, count) => {
    try {
        const settings = client.settings || (0, settingsManager_1.getSettings)();
        const punishments = settings.warnings?.punishments || [];
        if (!settings.warnings?.enabled || punishments.length === 0) {
            return null;
        }
        const sorted = [...punishments]
            .filter(item => item && item.count > 0 && item.action && item.action !== 'none')
            .sort((a, b) => a.count - b.count);
        if (sorted.length === 0) {
            return null;
        }
        const tier = [...sorted].reverse().find(item => count >= item.count);
        if (!tier) {
            return null;
        }
        const guild = target.guild;
        const guardKey = `${guild?.id || 'x'}:${target.id}:${tier.count}`;
        const lastApplied = punishmentGuard.get(guardKey);
        if (lastApplied && Date.now() - lastApplied < 30000) {
            return tier;
        }
        punishmentGuard.set(guardKey, Date.now());
        if (!guild) {
            return tier;
        }
        const moderationService = require('./moderationService');
        await moderationService.enforcePunishment(client, {
            guild,
            target,
            action: tier.action,
            duration: tier.duration || 60000,
            reason: tier.reason || `Automatic punishment after ${count} warnings`,
            source: 'punishment'
        });
        return tier;
    }
    catch (error) {
        console.error('Error checking warning thresholds:', error);
        return null;
    }
};
exports.checkThreshold = checkThreshold;