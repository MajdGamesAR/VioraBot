"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldTranscripts = cleanupOldTranscripts;
exports.startTranscriptCleanup = startTranscriptCleanup;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const TRANSCRIPT_AGE_LIMIT = 7 * 24 * 60 * 60 * 1000;
async function cleanupOldTranscripts() {
    try {
        const transcriptsDir = (0, path_1.join)(process.cwd(), 'transcripts');
        const files = await (0, promises_1.readdir)(transcriptsDir);
        const now = Date.now();
        for (const file of files) {
            if (!file.endsWith('.html'))
                continue;
            const filePath = (0, path_1.join)(transcriptsDir, file);
            const timestamp = parseInt(file.split('-')[2]?.split('.')[0] || '0');
            if (now - timestamp > TRANSCRIPT_AGE_LIMIT) {
                await (0, promises_1.unlink)(filePath).catch(console.error);
            }
        }
    }
    catch (error) {
        console.error('Error cleaning up transcripts:', error);
    }
}
function startTranscriptCleanup() {
    setInterval(cleanupOldTranscripts, 24 * 60 * 60 * 1000);
    cleanupOldTranscripts().catch(console.error);
}
