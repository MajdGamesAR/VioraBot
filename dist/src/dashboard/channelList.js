"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchTextChannels = fetchTextChannels;
exports.listTextChannels = listTextChannels;
const discord_js_1 = require("discord.js");
function toChannelArray(cache) {
    if (!cache) {
        return [];
    }
    if (Array.isArray(cache)) {
        return cache;
    }
    if (typeof cache.values === 'function') {
        return Array.from(cache.values());
    }
    if (typeof cache.toJSON === 'function') {
        return cache.toJSON();
    }
    return [];
}
function isTextLikeChannel(channel) {
    return !!channel && (channel.type === discord_js_1.ChannelType.GuildText || channel.type === discord_js_1.ChannelType.GuildAnnouncement);
}
function listTextChannels(guild) {
    if (!guild || !guild.channels) {
        return [];
    }
    const guildId = guild.id;
    return toChannelArray(guild.channels.cache)
        .filter(isTextLikeChannel)
        .map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type === discord_js_1.ChannelType.GuildAnnouncement ? 'GuildAnnouncement' : 'GuildText',
        guildId
    }));
}
async function fetchTextChannels(guild) {
    if (!guild || !guild.channels) {
        return [];
    }
    try {
        if (typeof guild.channels.fetch === 'function') {
            await guild.channels.fetch();
        }
    }
    catch (_error) {
        // cold cache, rate-limited or permission-restricted guild: fall back to the cache
    }
    return listTextChannels(guild);
}