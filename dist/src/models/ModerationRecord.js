"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModerationRecord = void 0;
const mongoose_1 = require("mongoose");
const moderationRecordSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    moderatorId: { type: String },
    action: { type: String, required: true },
    reason: { type: String },
    channelId: { type: String },
    targetName: { type: String },
    moderatorName: { type: String },
    timestamp: { type: Date, default: Date.now }
});
moderationRecordSchema.index({ guildId: 1, userId: 1, timestamp: -1 });
moderationRecordSchema.index({ guildId: 1, moderatorId: 1, timestamp: -1 });
moderationRecordSchema.index({ guildId: 1, action: 1, timestamp: -1 });
exports.ModerationRecord = mongoose_1.models.ModerationRecord || (0, mongoose_1.model)('ModerationRecord', moderationRecordSchema);