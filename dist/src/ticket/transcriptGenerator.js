"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTranscript = createTranscript;
const discord_html_transcripts_1 = __importDefault(require("discord-html-transcripts"));
async function createTranscript(channel) {
    try {
        const transcript = await discord_html_transcripts_1.default.createTranscript(channel, {
            limit: -1,
            filename: `transcript-${channel.id}-${Date.now()}.html`,
            saveImages: true,
            poweredBy: false
        });
        return transcript;
    }
    catch (error) {
        console.error('Error creating transcript:', error);
        throw error;
    }
}
