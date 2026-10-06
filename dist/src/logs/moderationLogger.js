"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logModerationAction = void 0;
const discord_js_1 = require("discord.js");
const ACTION_COLORS = {
    ban: 0xff0000,
    unban: 0x2ecc71,
    kick: 0xe67e22,
    timeout: 0xf1c40f,
    untimeout: 0x2ecc71,
    warn: 0xffff00,
    unwarn: 0x2ecc71,
    clear: 0x3498db,
    lock: 0xf1c40f,
    unlock: 0x2ecc71,
    hide: 0xf1c40f,
    unhide: 0x2ecc71,
    setnick: 0x3498db,
    role: 0x3498db,
    rrole: 0x3498db,
    move: 0x3498db,
    mute: 0xf1c40f,
    unmute: 0x2ecc71,
    automod: 0xff0000,
    antiraid: 0xff0000,
    punishment: 0xff6600
};
const FALLBACK_LABELS = {
    title: "Moderation Action",
    action: "Action",
    target: "Target",
    moderator: "Moderator",
    reason: "Reason",
    duration: "Duration",
    ids: "IDS"
};
const getTargetTag = (target) => {
    if (!target)
        return "Unknown";
    if (target.user && target.user.tag)
        return target.user.tag;
    if (target.tag)
        return target.tag;
    return target.username || "Unknown";
};
const logModerationAction = async (client, guild, opts) => {
    try {
        const options = opts || {};
        const settings = client.settings || {};
        const action = options.action || 'moderation';
        const channelId = options.channelId ||
            settings.logs?.moderation?.channelId ||
            settings.protection?.logChannelId;
        if (!channelId)
            return;
        const channel = guild.channels.cache.get(channelId);
        if (!channel || typeof channel.send !== 'function')
            return;
        const locale = client.locales?.get(client.defaultLanguage)?.logs?.moderation || FALLBACK_LABELS;
        const targetTag = getTargetTag(options.target);
        const modTag = getTargetTag(options.moderator);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title || FALLBACK_LABELS.title)
            .setDescription(`**${action.toUpperCase()}**`)
            .setColor(options.color || ACTION_COLORS[action] || ACTION_COLORS.moderation || 0x3498db)
            .addFields({
            name: `🔨 ${locale.action || FALLBACK_LABELS.action}`,
            value: action,
            inline: true
        }, {
            name: `👤 ${locale.target || FALLBACK_LABELS.target}`,
            value: `${targetTag}${options.targetId ? ` (<@${options.targetId}>)` : ''}`,
            inline: true
        }, {
            name: `🛡️ ${locale.moderator || FALLBACK_LABELS.moderator}`,
            value: modTag,
            inline: true
        });
        if (options.reason) {
            embed.addFields({
                name: `📝 ${locale.reason || FALLBACK_LABELS.reason}`,
                value: options.reason.slice(0, 1024),
                inline: false
            });
        }
        if (options.duration) {
            embed.addFields({
                name: `⏳ ${locale.duration || FALLBACK_LABELS.duration}`,
                value: `${options.duration} ms`,
                inline: true
            });
        }
        if (options.showIds) {
            embed.addFields({
                name: `🆔 ${locale.ids || FALLBACK_LABELS.ids}`,
                value: `${options.targetId || 'N/A'}${options.moderatorId ? ` | ${options.moderatorId}` : ''}`,
                inline: true
            });
        }
        embed.setTimestamp();
        await channel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error sending moderation log:', error);
    }
};
exports.logModerationAction = logModerationAction;