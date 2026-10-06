"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryPaged = exports.buildHistoryFilter = exports.getUserHistory = exports.recordAction = void 0;
const mongoose_1 = require("mongoose");
const ModerationRecord_1 = require("../models/ModerationRecord");
const validation_1 = require("../dashboard/validation");
const isConnected = () => mongoose_1.default.connection.readyState === 1;
const recordAction = async (data) => {
    try {
        const record = new ModerationRecord_1.ModerationRecord({
            guildId: data.guildId,
            userId: data.userId,
            moderatorId: data.moderatorId || null,
            action: data.action,
            reason: data.reason || null,
            channelId: data.channelId || null,
            targetName: data.targetName || null,
            moderatorName: data.moderatorName || null,
            timestamp: data.timestamp || new Date()
        });
        await record.save();
        return record;
    }
    catch (error) {
        console.error('Error recording moderation action:', error);
        return null;
    }
};
exports.recordAction = recordAction;
const getUserHistory = async (guildId, userId, limit) => {
    try {
        if (!isConnected()) {
            return [];
        }
        const history = await ModerationRecord_1.ModerationRecord.find({ guildId, userId })
            .sort({ timestamp: -1 })
            .limit(limit || 100)
            .lean();
        return history || [];
    }
    catch (error) {
        console.error('Error fetching moderation history:', error);
        return [];
    }
};
exports.getUserHistory = getUserHistory;
const buildHistoryFilter = validation_1.buildHistoryFilter;
exports.buildHistoryFilter = buildHistoryFilter;
const queryPaged = async (filters) => {
    const { query, options, page, limit, sort, skip } = buildHistoryFilter(filters);
    try {
        if (!isConnected()) {
            return { records: [], total: 0, page, limit, sort, pages: 1 };
        }
        const total = await ModerationRecord_1.ModerationRecord.countDocuments(query);
        const records = await ModerationRecord_1.ModerationRecord.find(query)
            .sort(options.sort)
            .skip(skip)
            .limit(limit)
            .lean();
        return {
            records: records || [],
            total,
            page,
            limit,
            sort,
            pages: Math.max(1, Math.ceil(total / limit))
        };
    }
    catch (error) {
        console.error('Error querying moderation history:', error);
        return { records: [], total: 0, page, limit, sort, pages: 1 };
    }
};
exports.queryPaged = queryPaged;