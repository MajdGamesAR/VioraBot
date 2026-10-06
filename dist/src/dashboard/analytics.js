"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllTimeCounts = exports.getStaffStats = exports.getRecentActivity = exports.getAnalytics = exports.getOverview = void 0;
const mongoose_1 = require("mongoose");
const ModerationRecord_1 = require("../models/ModerationRecord");
const Warning_1 = require("../models/Warning");
const Ticket_1 = require("../models/Ticket");
const Suggestion_1 = require("../models/Suggestion");
const isConnected = () => {
    try {
        return mongoose_1.default.connection?.readyState === 1;
    }
    catch (_a) {
        return false;
    }
};
const safeCount = async (model, query) => {
    try {
        if (!isConnected()) {
            return 0;
        }
        return await model.countDocuments(query);
    }
    catch (error) {
        console.error('Error counting documents:', error);
        return 0;
    }
};
const safeAggregate = async (model, pipeline, fallback) => {
    try {
        if (!isConnected()) {
            return fallback;
        }
        const result = await model.aggregate(pipeline);
        return result || fallback;
    }
    catch (error) {
        console.error('Error running aggregation:', error);
        return fallback;
    }
};
const startOfDayUtc = (daysAgo) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d;
};
const dayKey = (date) => date.toISOString().split('T')[0];
const buildDayLabels = (days) => {
    const labels = [];
    for (let i = days - 1; i >= 0; i--) {
        labels.push(dayKey(startOfDayUtc(i)));
    }
    return labels;
};
const groupByAction = (rows) => {
    const counts = {};
    for (const item of rows) {
        const action = String(item.action || 'unknown');
        let bucket = 'other';
        if (action.startsWith('automod:')) {
            bucket = 'automod';
        }
        else if (action.startsWith('antiraid:')) {
            bucket = 'antiraid';
        }
        else if (action === 'warn') {
            bucket = 'warn';
        }
        else if (action === 'kick') {
            bucket = 'kick';
        }
        else if (action === 'ban') {
            bucket = 'ban';
        }
        else if (action === 'timeout') {
            bucket = 'timeout';
        }
        else {
            bucket = 'other';
        }
        counts[bucket] = (counts[bucket] || 0) + item.count;
    }
    return counts;
};
const fillSeries = (days, rows, picker) => {
    const present = {};
    for (const item of rows) {
        present[String(item._id)] = item.count;
    }
    const labels = buildDayLabels(days);
    return labels.map((day) => picker(present[day]));
};
const getOverview = async (guild) => {
    const guildId = guild?.id;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayQuery = guildId ? { guildId, timestamp: { $gte: today } } : { timestamp: { $gte: today } };
    const actionToday = await safeAggregate(ModerationRecord_1.ModerationRecord, [
        { $match: todayQuery },
        { $group: { _id: '$action', count: { $sum: 1 } } }
    ], []);
    const buckets = groupByAction(actionToday.map((r) => ({ action: r._id, count: r.count })));
    const [warningsToday, openTickets, closedTickets, pendingSuggestions, decidedSuggestions, modActionsDay, guildRecords, guildWarnings, automodToday, antiraidToday] = await Promise.all([
        safeCount(Warning_1.Warning, guildId ? { guildId, timestamp: { $gte: today } } : { timestamp: { $gte: today } }),
        safeCount(Ticket_1.Ticket, guildId ? { guildId, status: 'open' } : { status: 'open' }),
        safeCount(Ticket_1.Ticket, guildId ? { guildId, deleted: true } : { deleted: true }),
        safeCount(Suggestion_1.Suggestion, guildId ? { guildId, status: 'pending' } : { status: 'pending' }),
        safeCount(Suggestion_1.Suggestion, guildId ? { guildId, status: { $in: ['accepted', 'rejected'] } } : { status: { $in: ['accepted', 'rejected'] } }),
        safeCount(ModerationRecord_1.ModerationRecord, todayQuery),
        safeCount(ModerationRecord_1.ModerationRecord, guildId ? { guildId } : {}),
        safeCount(Warning_1.Warning, guildId ? { guildId } : {}),
        safeCount(ModerationRecord_1.ModerationRecord, { ...(guildId ? { guildId } : {}), action: /^automod:/ }),
        safeCount(ModerationRecord_1.ModerationRecord, { ...(guildId ? { guildId } : {}), action: /^antiraid:/ })
    ]);
    const members = guild?.members?.cache;
    let onlineMembers = 0;
    if (members && typeof members.reduce === 'function') {
        onlineMembers = members.reduce((acc, member) => acc + (member.presence?.status === 'online' ? 1 : 0), 0);
    }
    return {
        guild: guild ? {
            id: guild.id,
            name: guild.name || 'Unknown Server',
            icon: guild.iconURL?.() || null,
            memberCount: guild.memberCount || 0,
            onlineMembers: onlineMembers || null,
            channels: guild.channels?.cache?.size || 0,
            roles: guild.roles?.cache?.size || 0,
            boosts: guild.premiumSubscriptionCount || 0,
            joinedAt: guild.joinedAt?.toISOString?.() || null
        } : null,
        today: {
            total: modActionsDay,
            warn: buckets.warn || 0,
            kick: buckets.kick || 0,
            ban: buckets.ban || 0,
            timeout: buckets.timeout || 0,
            automod: buckets.automod || 0,
            antiraid: buckets.antiraid || 0,
            other: buckets.other || 0,
            warnings: warningsToday
        },
        totals: {
            records: guildRecords,
            warnings: guildWarnings,
            automod: automodToday,
            antiraid: antiraidToday
        },
        tickets: {
            open: openTickets,
            closed: closedTickets,
            pending: 0,
            total: openTickets + closedTickets
        },
        suggestions: {
            pending: pendingSuggestions,
            decided: decidedSuggestions,
            total: pendingSuggestions + decidedSuggestions
        }
    };
};
exports.getOverview = getOverview;
const getAnalytics = async ({ guildId, period, days: requestedDays } = {}) => {
    const days = Math.min(90, Math.max(1, requestedDays || 30));
    const start = startOfDayUtc(days - 1);
    const match = { timestamp: { $gte: start } };
    if (guildId) {
        match.guildId = guildId;
    }
    const records = await safeAggregate(ModerationRecord_1.ModerationRecord, [
        { $match: match },
        { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, action: 1 } },
        { $group: { _id: '$day', count: { $sum: 1 } } }
    ], []);
    const actions = {};
    const matchActions = activeFilter(guildId, start);
    const actionRows = await safeAggregate(ModerationRecord_1.ModerationRecord, [
        { $match: matchActions },
        { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, action: 1 } },
        { $group: { _id: { day: '$day', action: '$action' }, count: { $sum: 1 } } }
    ], []);
    for (const row of actionRows) {
        const { day, action } = row._id;
        const bucket = !action ? 'other' : action.startsWith('automod:') ? 'automod' : action.startsWith('antiraid:') ? 'antiraid' : action === 'warn' ? 'warn' : action === 'kick' ? 'kick' : action === 'ban' ? 'ban' : action === 'timeout' ? 'timeout' : 'other';
        if (!actions[bucket]) {
            actions[bucket] = {};
        }
        actions[bucket][day] = row.count;
    }
    const ticketMatch = { createdAt: { $gte: start } };
    if (guildId) {
        ticketMatch.guildId = guildId;
    }
    const tickets = await safeAggregate(Ticket_1.Ticket, [
        { $match: ticketMatch },
        { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } } },
        { $group: { _id: '$day', count: { $sum: 1 } } }
    ], []);
    const suggestions = await safeAggregate(Suggestion_1.Suggestion, [
        { $match: ticketMatch },
        { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } } },
        { $group: { _id: '$day', count: { $sum: 1 } } }
    ], []);
    const staff = await getStaffStats({ guildId, since: start, limit: 10 });
    const labels = buildDayLabels(days);
    const zero = (map) => labels.map((day) => map[day] || 0);
    return {
        period: period || 'month',
        labels,
        datasets: {
            moderation: zero(actionMap(records)),
            warn: zero(actions.warn || {}),
            kick: zero(actions.kick || {}),
            ban: zero(actions.ban || {}),
            timeout: zero(actions.timeout || {}),
            automod: zero(actions.automod || {}),
            antiraid: zero(actions.antiraid || {}),
            tickets: zero(actionMap(tickets)),
            suggestions: zero(actionMap(suggestions)),
            total: zero(actionMap(records)).map((n, i) => n)
        },
        staff
    };
};
exports.getAnalytics = getAnalytics;
const actionMap = (rows) => {
    const map = {};
    for (const item of rows) {
        map[item._id] = item.count;
    }
    return map;
};
const activeFilter = (guildId, start) => {
    const match = { timestamp: { $gte: start } };
    if (guildId) {
        match.guildId = guildId;
    }
    return match;
};
const getStaffStats = async ({ guildId, since, limit } = {}) => {
    const match = guildId ? { guildId } : {};
    if (since) {
        match.timestamp = { $gte: since };
    }
    const rows = await safeAggregate(ModerationRecord_1.ModerationRecord, [
        { $match: match },
        { $group: {
                _id: '$moderatorId',
                name: { $first: '$moderatorName' },
                total: { $sum: 1 },
                warns: { $sum: { $cond: [{ $eq: ['$action', 'warn'] }, 1, 0] } },
                kicks: { $sum: { $cond: [{ $eq: ['$action', 'kick'] }, 1, 0] } },
                bans: { $sum: { $cond: [{ $eq: ['$action', 'ban'] }, 1, 0] } },
                timeouts: { $sum: { $cond: [{ $eq: ['$action', 'timeout'] }, 1, 0] } },
                unwarns: { $sum: { $cond: [{ $eq: ['$action', 'unwarn'] }, 1, 0] } },
                purges: { $sum: { $cond: [{ $eq: ['$action', 'purge'] }, 1, 0] } },
                automod: { $sum: { $cond: [{ $regexMatch: { input: '$action', regex: '^automod:' } }, 1, 0] } },
                antiraid: { $sum: { $cond: [{ $regexMatch: { input: '$action', regex: '^antiraid:' } }, 1, 0] } },
                lastActivity: { $max: '$timestamp' }
            } },
        { $sort: { total: -1 } },
        { $limit: Math.min(limit || 50, 200) }
    ], []);
    return (rows || []).map((row, index) => ({
        rank: index + 1,
        id: row._id,
        name: row.name || (row._id ? row._id : 'System'),
        total: row.total || 0,
        warns: row.warns || 0,
        kicks: row.kicks || 0,
        bans: row.bans || 0,
        timeouts: row.timeouts || 0,
        unwarns: row.unwarns || 0,
        purges: row.purges || 0,
        automod: row.automod || 0,
        antiraid: row.antiraid || 0,
        lastActivity: row.lastActivity || null
    }));
};
exports.getStaffStats = getStaffStats;
const getRecentActivity = async ({ guildId, limit } = {}) => {
    const query = guildId ? { guildId } : {};
    const rows = await safeAggregate(ModerationRecord_1.ModerationRecord, [
        { $match: query },
        { $sort: { timestamp: -1 } },
        { $limit: Math.min(limit || 20, 100) }
    ], []);
    return (rows || []).map((row) => ({
        id: row._id?.toString?.(),
        guildId: row.guildId,
        action: row.action,
        userId: row.userId,
        targetName: row.targetName || row.userId,
        moderatorId: row.moderatorId,
        moderatorName: row.moderatorName || null,
        reason: row.reason || null,
        timestamp: row.timestamp
    }));
};
exports.getRecentActivity = getRecentActivity;
const getAllTimeCounts = async ({ guildId } = {}) => {
    const match = guildId ? { guildId } : {};
    return {
        records: await safeCount(ModerationRecord_1.ModerationRecord, match),
        warnings: await safeCount(Warning_1.Warning, match)
    };
};
exports.getAllTimeCounts = getAllTimeCounts;