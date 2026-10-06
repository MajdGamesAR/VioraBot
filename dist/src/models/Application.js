"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Application = void 0;
const mongoose_1 = require("mongoose");
const ApplicationSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    position: { type: String, required: true },
    status: { type: String, required: true, default: 'pending' },
    answers: [{ type: String, required: true }],
    appliedAt: { type: Date, required: true, default: Date.now },
    reviewedAt: { type: Date },
    reviewedBy: { type: String },
    reviewNote: { type: String },
    messageId: { type: String }
});
ApplicationSchema.index({ guildId: 1, status: 1 });
ApplicationSchema.index({ userId: 1 });
exports.Application = (0, mongoose_1.model)('Application', ApplicationSchema);
