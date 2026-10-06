"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Warning = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const warningSchema = new mongoose_1.default.Schema({
    guildId: { type: String, index: true },
    userId: { type: String, index: true },
    moderatorId: String,
    reason: String,
    timestamp: Date,
    expiresAt: { type: Date, default: null }
});
warningSchema.index({ guildId: 1, userId: 1 });
warningSchema.index({ guildId: 1, expiresAt: 1 });
exports.Warning = mongoose_1.default.models.Warning || mongoose_1.default.model('Warning', warningSchema);
