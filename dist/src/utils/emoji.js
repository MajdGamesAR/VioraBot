"use strict";
function sanitizeEmoji(emoji) {
    if (typeof emoji !== 'string') {
        return null;
    }
    const value = emoji.trim();
    if (value.length === 0) {
        return null;
    }
    if (value.includes(':')) {
        return /^<a?:\w+:\d{17,20}>$/.test(value) ? value : null;
    }
    return value;
}
module.exports = { sanitizeEmoji };