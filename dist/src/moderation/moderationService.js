"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTarget = exports.addRole = exports.removeRole = exports.moveMember = exports.setNickname = exports.unhideChannel = exports.hideChannel = exports.unlockChannel = exports.lockChannel = exports.clear = exports.unwarn = exports.warn = exports.removeTimeout = exports.timeout = exports.kick = exports.ban = exports.enforcePunishment = exports.unmute = exports.mute = void 0;
const discord_js_1 = require("discord.js");
const moderationLogger_1 = require("../logs/moderationLogger");
const moderationHistory_1 = require("./moderationHistory");
const warningManager_1 = require("./warningManager");
const validation_1 = require("./validation");
const recordAndLog = async (client, guild, data) => {
    const { action, target, moderator, reason, duration, color } = data;
    await (0, moderationLogger_1.logModerationAction)(client, guild, {
        action,
        target,
        targetId: target?.id,
        moderator,
        moderatorId: moderator?.id,
        reason,
        duration,
        color,
        showIds: true
    });
    await (0, moderationHistory_1.recordAction)({
        guildId: guild?.id,
        userId: target?.id,
        moderatorId: moderator?.id,
        action,
        reason: reason || null,
        channelId: null,
        targetName: target?.user?.tag || target?.tag || target?.username || null,
        moderatorName: moderator?.user?.tag || moderator?.tag || moderator?.username || null
    });
};
const validateTarget = validation_1.validateTarget;
exports.validateTarget = validateTarget;
const ban = async (ctx, params) => {
    const p = params || {};
    const v = validateTarget(ctx);
    if (!v.ok)
        return v;
    try {
        const reason = p.reason || 'No reason provided';
        await ctx.target.ban({ reason, deleteMessageSeconds: p.clearDays || 0 });
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'ban',
            target: ctx.target,
            moderator: ctx.member,
            reason,
            color: 0xff0000
        });
        return { ok: true, code: 'ok', result: ctx.target };
    }
    catch (error) {
        console.error('Error executing ban:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.ban = ban;
const kick = async (ctx, params) => {
    const p = params || {};
    const v = validateTarget(ctx);
    if (!v.ok)
        return v;
    try {
        const reason = p.reason || 'No reason provided';
        await ctx.target.kick(reason);
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'kick',
            target: ctx.target,
            moderator: ctx.member,
            reason,
            color: 0xe67e22
        });
        return { ok: true, code: 'ok', result: ctx.target };
    }
    catch (error) {
        console.error('Error executing kick:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.kick = kick;
const timeout = async (ctx, params) => {
    const p = params || {};
    const v = validateTarget(ctx);
    if (!v.ok)
        return v;
    try {
        const duration = p.durationMs || 60000;
        const reason = p.reason || 'No reason provided';
        await ctx.target.timeout(duration, reason);
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'timeout',
            target: ctx.target,
            moderator: ctx.member,
            reason,
            duration,
            color: 0xf1c40f
        });
        return { ok: true, code: 'ok', result: ctx.target };
    }
    catch (error) {
        console.error('Error executing timeout:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.timeout = timeout;
const removeTimeout = async (ctx, params) => {
    const p = params || {};
    const v = validateTarget(ctx);
    if (!v.ok)
        return v;
    try {
        if (!ctx.target.communicationDisabledUntil) {
            return { ok: false, code: 'notTimedOut' };
        }
        const reason = p.reason || 'No reason provided';
        await ctx.target.timeout(null, reason);
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'untimeout',
            target: ctx.target,
            moderator: ctx.member,
            reason,
            color: 0x2ecc71
        });
        return { ok: true, code: 'ok', result: ctx.target };
    }
    catch (error) {
        console.error('Error executing untimeout:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.removeTimeout = removeTimeout;
const warn = async (ctx, params) => {
    const p = params || {};
    const v = validateTarget(ctx);
    if (!v.ok)
        return v;
    try {
        const reason = p.reason || 'No reason provided';
        const warning = await (0, warningManager_1.addWarning)({
            guildId: ctx.guild.id,
            userId: ctx.target.id,
            moderatorId: ctx.member.id,
            reason
        });
        if (!warning) {
            return { ok: false, code: 'actionFailed' };
        }
        const count = await (0, warningManager_1.getWarningCount)(ctx.guild.id, ctx.target.id);
        const punishment = await (0, warningManager_1.checkThreshold)(ctx.client, ctx.target, count);
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'warn',
            target: ctx.target,
            moderator: ctx.member,
            reason,
            color: 0xffff00
        });
        return { ok: true, code: 'ok', result: { count, punishment, warning } };
    }
    catch (error) {
        console.error('Error executing warn:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.warn = warn;
const unwarn = async (ctx, params) => {
    const p = params || {};
    if (!ctx.guild || !ctx.member) {
        return { ok: false, code: 'invalidGuild' };
    }
    try {
        if (!p.warningId) {
            return { ok: false, code: 'warningNotFound' };
        }
        const removed = await (0, warningManager_1.removeWarningById)(p.warningId, ctx.guild.id);
        if (!removed) {
            return { ok: false, code: 'warningNotFound' };
        }
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'unwarn',
            target: ctx.target || { id: removed.userId, username: removed.userId },
            moderator: ctx.member,
            reason: p.reason || 'No reason provided',
            color: 0x2ecc71
        });
        return { ok: true, code: 'ok', result: removed };
    }
    catch (error) {
        console.error('Error executing unwarn:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.unwarn = unwarn;
const clear = async (ctx, params) => {
    const p = params || {};
    try {
        if (!ctx.channel || typeof ctx.channel.bulkDelete !== 'function') {
            return { ok: false, code: 'invalidChannel' };
        }
        const count = Math.max(1, Math.min(Number(p.count) || 1, 100));
        const fetched = await ctx.channel.messages.fetch({ limit: Math.min(count + 1, 100) });
        const deletable = fetched.filter(msg => Date.now() - msg.createdTimestamp < 1209600000);
        const deleted = await ctx.channel.bulkDelete(deletable, true);
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'clear',
            target: { id: ctx.guild?.id, username: ctx.channel.name || ctx.channel.id },
            moderator: ctx.member,
            reason: `${count} messages cleared in ${ctx.channel.name || 'channel'}`,
            color: 0x3498db
        });
        return { ok: true, code: 'ok', result: { deleted: deleted.size || 0 } };
    }
    catch (error) {
        console.error('Error executing clear:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.clear = clear;
const lockChannel = async (ctx, params) => {
    const p = params || {};
    try {
        const channel = ctx.channel;
        if (!channel) {
            return { ok: false, code: 'invalidChannel' };
        }
        const everyone = ctx.guild?.roles.everyone;
        await channel.permissionOverwrites.edit(everyone, { SendMessages: false }, p.reason);
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'lock',
            target: { id: channel.id, username: channel.name || channel.id },
            moderator: ctx.member,
            reason: p.reason || 'No reason provided',
            color: 0xf1c40f
        });
        return { ok: true, code: 'ok', result: channel };
    }
    catch (error) {
        console.error('Error executing lock:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.lockChannel = lockChannel;
const unlockChannel = async (ctx, params) => {
    const p = params || {};
    try {
        const channel = ctx.channel;
        if (!channel) {
            return { ok: false, code: 'invalidChannel' };
        }
        const everyone = ctx.guild?.roles.everyone;
        await channel.permissionOverwrites.edit(everyone, { SendMessages: null }, p.reason);
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'unlock',
            target: { id: channel.id, username: channel.name || channel.id },
            moderator: ctx.member,
            reason: p.reason || 'No reason provided',
            color: 0x2ecc71
        });
        return { ok: true, code: 'ok', result: channel };
    }
    catch (error) {
        console.error('Error executing unlock:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.unlockChannel = unlockChannel;
const hideChannel = async (ctx, params) => {
    const p = params || {};
    try {
        const channel = ctx.channel;
        if (!channel) {
            return { ok: false, code: 'invalidChannel' };
        }
        const everyone = ctx.guild?.roles.everyone;
        await channel.permissionOverwrites.edit(everyone, { ViewChannel: false }, p.reason);
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'hide',
            target: { id: channel.id, username: channel.name || channel.id },
            moderator: ctx.member,
            reason: p.reason || 'No reason provided',
            color: 0xf1c40f
        });
        return { ok: true, code: 'ok', result: channel };
    }
    catch (error) {
        console.error('Error executing hide:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.hideChannel = hideChannel;
const unhideChannel = async (ctx, params) => {
    const p = params || {};
    try {
        const channel = ctx.channel;
        if (!channel) {
            return { ok: false, code: 'invalidChannel' };
        }
        const everyone = ctx.guild?.roles.everyone;
        await channel.permissionOverwrites.edit(everyone, { ViewChannel: null }, p.reason);
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'unhide',
            target: { id: channel.id, username: channel.name || channel.id },
            moderator: ctx.member,
            reason: p.reason || 'No reason provided',
            color: 0x2ecc71
        });
        return { ok: true, code: 'ok', result: channel };
    }
    catch (error) {
        console.error('Error executing unhide:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.unhideChannel = unhideChannel;
const setNickname = async (ctx, params) => {
    const p = params || {};
    const v = validateTarget(ctx);
    if (!v.ok)
        return v;
    try {
        const nickname = p.nickname || null;
        await ctx.target.setNickname(nickname, p.reason);
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'setnick',
            target: ctx.target,
            moderator: ctx.member,
            reason: p.reason || 'No reason provided',
            color: 0x3498db
        });
        return { ok: true, code: 'ok', result: ctx.target };
    }
    catch (error) {
        console.error('Error executing setNickname:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.setNickname = setNickname;
const moveMember = async (ctx, params) => {
    const p = params || {};
    const v = validateTarget(ctx);
    if (!v.ok)
        return v;
    try {
        if (!ctx.target.voice?.channel) {
            return { ok: false, code: 'targetNotInVoice' };
        }
        const channel = ctx.guild.channels.cache.get(p.channelId);
        if (!channel || channel.type !== discord_js_1.ChannelType.GuildVoice) {
            return { ok: false, code: 'invalidChannel' };
        }
        await ctx.target.voice.setChannel(channel, p.reason);
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'move',
            target: ctx.target,
            moderator: ctx.member,
            reason: p.reason || 'No reason provided',
            color: 0x3498db
        });
        return { ok: true, code: 'ok', result: ctx.target };
    }
    catch (error) {
        console.error('Error executing moveMember:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.moveMember = moveMember;
const mute = async (ctx, params) => {
    const p = params || {};
    const v = validateTarget(ctx);
    if (!v.ok)
        return v;
    try {
        if (!p.roleId) {
            return { ok: false, code: 'muteRoleNotFound' };
        }
        const role = ctx.guild.roles.cache.get(p.roleId);
        if (!role) {
            return { ok: false, code: 'muteRoleNotFound' };
        }
        if (ctx.target.roles.cache.has(p.roleId)) {
            return { ok: false, code: 'alreadyMuted' };
        }
        const reason = p.reason || 'No reason provided';
        await ctx.target.roles.add(role, reason);
        if (p.durationMs && p.durationMs > 0) {
            setTimeout(async () => {
                try {
                    const fresh = ctx.guild.members.cache.get(ctx.target.id);
                    if (fresh && fresh.roles.cache.has(p.roleId)) {
                        await fresh.roles.remove(p.roleId, 'Mute duration expired');
                    }
                }
                catch (error) {
                    console.error('Error removing expired mute:', error);
                }
            }, p.durationMs);
        }
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'mute',
            target: ctx.target,
            moderator: ctx.member,
            reason,
            duration: p.durationMs,
            color: 0xf1c40f
        });
        return { ok: true, code: 'ok', result: ctx.target };
    }
    catch (error) {
        console.error('Error executing mute:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.mute = mute;
const unmute = async (ctx, params) => {
    const p = params || {};
    const v = validateTarget(ctx);
    if (!v.ok)
        return v;
    try {
        if (!p.roleId) {
            return { ok: false, code: 'muteRoleNotFound' };
        }
        if (!ctx.target.roles.cache.has(p.roleId)) {
            return { ok: false, code: 'notMuted' };
        }
        const reason = p.reason || 'No reason provided';
        await ctx.target.roles.remove(p.roleId, reason);
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'unmute',
            target: ctx.target,
            moderator: ctx.member,
            reason,
            color: 0x2ecc71
        });
        return { ok: true, code: 'ok', result: ctx.target };
    }
    catch (error) {
        console.error('Error executing unmute:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.unmute = unmute;
const addRole = async (ctx, params) => {
    const p = params || {};
    const v = validateTarget(ctx);
    if (!v.ok)
        return v;
    try {
        if (!ctx.guild.roles.cache.has(p.roleId)) {
            return { ok: false, code: 'roleNotFound' };
        }
        const role = ctx.guild.roles.cache.get(p.roleId);
        if (role.id === ctx.guild.roles.everyone.id) {
            return { ok: false, code: 'invalidRole' };
        }
        if (ctx.target.roles.cache.has(p.roleId)) {
            return { ok: false, code: 'hasRole' };
        }
        const me = ctx.guild.members.me;
        if (me && role.position >= me.roles.highest.position) {
            return { ok: false, code: 'higherBotRole' };
        }
        if (!ctx.member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator) &&
            role.position >= ctx.member.roles.highest.position) {
            return { ok: false, code: 'higherUserRole' };
        }
        const reason = p.reason || 'No reason provided';
        await ctx.target.roles.add(role, reason);
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'role',
            target: ctx.target,
            moderator: ctx.member,
            reason: `${reason} (${role.name})`,
            color: 0x3498db
        });
        return { ok: true, code: 'ok', result: role };
    }
    catch (error) {
        console.error('Error executing addRole:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.addRole = addRole;
const removeRole = async (ctx, params) => {
    const p = params || {};
    const v = validateTarget(ctx);
    if (!v.ok)
        return v;
    try {
        if (!ctx.guild.roles.cache.has(p.roleId)) {
            return { ok: false, code: 'roleNotFound' };
        }
        const role = ctx.guild.roles.cache.get(p.roleId);
        if (role.id === ctx.guild.roles.everyone.id) {
            return { ok: false, code: 'invalidRole' };
        }
        if (!ctx.target.roles.cache.has(p.roleId)) {
            return { ok: false, code: 'noRole' };
        }
        const me = ctx.guild.members.me;
        if (me && role.position >= me.roles.highest.position) {
            return { ok: false, code: 'higherBotRole' };
        }
        const reason = p.reason || 'No reason provided';
        await ctx.target.roles.remove(role, reason);
        await recordAndLog(ctx.client, ctx.guild, {
            action: 'rrole',
            target: ctx.target,
            moderator: ctx.member,
            reason: `${reason} (${role.name})`,
            color: 0x3498db
        });
        return { ok: true, code: 'ok', result: role };
    }
    catch (error) {
        console.error('Error executing removeRole:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.removeRole = removeRole;
const enforcePunishment = async (client, opts) => {
    const { guild, target, action, duration, reason, source } = opts;
    try {
        if (!target || !guild) {
            return { ok: false, code: 'targetNotFound' };
        }
        switch (action) {
            case 'timeout':
                await target.timeout(duration || 60000, reason);
                break;
            case 'kick':
                await target.kick(reason);
                break;
            case 'ban':
                await target.ban({ reason, deleteMessageSeconds: 0 });
                break;
            case 'removeRoles':
                await target.roles.remove(guild.roles.highest ? target.roles.cache.filter(role => role.id !== guild.id) : target.roles.cache, reason);
                break;
            case 'none':
            default:
                return { ok: true, code: 'none' };
        }
        await (0, moderationLogger_1.logModerationAction)(client, guild, {
            action: source || 'punishment',
            target,
            targetId: target.id,
            moderator: client.user,
            moderatorId: client.user?.id,
            reason,
            duration,
            color: 0xff6600
        });
        await (0, moderationHistory_1.recordAction)({
            guildId: guild.id,
            userId: target.id,
            moderatorId: client.user?.id,
            action: `${source || 'punishment'}:${action}`,
            reason: reason || null,
            targetName: target.user?.tag || target.tag || null,
            moderatorName: client.user?.tag || null
        });
        return { ok: true, code: 'ok' };
    }
    catch (error) {
        console.error('Error enforcing punishment:', error);
        return { ok: false, code: 'actionFailed' };
    }
};
exports.enforcePunishment = enforcePunishment;