"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkContent = void 0;
const countMentions = (content) => (content.match(/<@[!&]?\d+>/g) || []).length;
const countEmojis = (content) => (content.match(/(<a?:\w+:\d+>|[\u{1F1E6}-\u{1F1FF}\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}])/gu) || []).length;
const countLinks = (content) => {
    const urlMatches = (content.match(/https?:\/\/[^\s]+/gi) || []).length;
    const wwwMatches = (content.match(/www\.[^\s]+/gi) || []).length;
    return urlMatches + wwwMatches;
};
const hasInvite = (content) => /(?:discord\.(?:gg|io|me|li)|discordapp\.com\/invite)\/[a-z0-9_-]+/i.test(content);
const isCaps = (content, threshold, minLength) => {
    if (typeof threshold !== 'number' || typeof minLength !== 'number')
        return false;
    if (content.length < minLength)
        return false;
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length < minLength)
        return false;
    const upper = (letters.match(/[A-Z]/g) || []).length;
    return upper / letters.length >= threshold / 100;
};
const hasBadWord = (content, words) => {
    if (!Array.isArray(words) || words.length === 0)
        return false;
    const lower = content.toLowerCase();
    return words.some(word => word && lower.includes(word.toLowerCase()));
};
const checkContent = (content, config) => {
    if (typeof content !== 'string' || content.length === 0 || !config)
        return null;
    const rules = config.rules || {};
    if (rules.caps?.enabled && rules.caps.threshold && rules.caps.minLength &&
        isCaps(content, rules.caps.threshold, rules.caps.minLength)) {
        return 'caps';
    }
    if (rules.emojis?.enabled && rules.emojis.threshold &&
        countEmojis(content) >= rules.emojis.threshold) {
        return 'emojis';
    }
    if (rules.mentions?.enabled && rules.mentions.threshold &&
        countMentions(content) >= rules.mentions.threshold) {
        return 'mentions';
    }
    if (rules.invites?.enabled && hasInvite(content)) {
        return 'invites';
    }
    if (rules.links?.enabled && countLinks(content) >= (rules.links.threshold || 1)) {
        return 'links';
    }
    if (rules.badWords?.enabled && hasBadWord(content, rules.badWords.words)) {
        return 'badWords';
    }
    return null;
};
exports.checkContent = checkContent;