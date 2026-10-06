"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Suggestion = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const suggestionSchema = new mongoose_1.default.Schema({
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    authorId: { type: String, required: true },
    authorName: { type: String },
    content: { type: String, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    decidedBy: { type: String },
    decisionReason: { type: String },
    decidedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});
suggestionSchema.index({ guildId: 1, status: 1, createdAt: -1 });
suggestionSchema.index({ guildId: 1, createdAt: -1 });
exports.Suggestion = mongoose_1.default.models.Suggestion || mongoose_1.default.model('Suggestion', suggestionSchema);