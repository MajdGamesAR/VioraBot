"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Giveaway = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const mongoose_2 = require("mongoose");
const giveawaySchema = new mongoose_2.Schema({
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    guildId: { type: String, required: true },
    hostId: { type: String, required: true },
    prize: { type: String, required: true },
    winners: { type: Number, required: true },
    endsAt: { type: Date, required: true },
    ended: { type: Boolean, default: false },
    winnerIds: [{ type: String }],
    participants: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
});
giveawaySchema.index({ guildId: 1, ended: 1 });
giveawaySchema.index({ endsAt: 1 });
exports.Giveaway = mongoose_1.default.models.Giveaway || mongoose_1.default.model('Giveaway', giveawaySchema);
