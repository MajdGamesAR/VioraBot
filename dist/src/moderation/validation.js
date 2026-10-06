"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTarget = void 0;
const isMember = (target) => !!target && typeof target.id === 'string' && 'roles' in target;
const isAdmin = (member) => {
    if (!member || !member.permissions || typeof member.permissions.has !== 'function')
        return false;
    try {
        return member.permissions.has('Administrator');
    }
    catch (_a) {
        return false;
    }
};
const validateTarget = (ctx) => {
    const { member, target, guild, options } = ctx;
    const opts = options || {};
    const hasRoleTracking = (entity) => entity && entity.roles && entity.roles.highest && typeof entity.roles.highest.position === 'number';
    if (!guild || !member) {
        return { ok: false, code: 'invalidGuild' };
    }
    if (!target) {
        return { ok: false, code: 'targetNotFound' };
    }
    if (target.id === member.id) {
        return { ok: false, code: 'selfTarget' };
    }
    if (opts.checkOwner !== false && target.id === guild.ownerId) {
        return { ok: false, code: 'ownerTarget' };
    }
    if (opts.checkUserHierarchy &&
        hasRoleTracking(target) && hasRoleTracking(member) &&
        !isAdmin(member) &&
        target.roles.highest.position >= member.roles.highest.position) {
        return { ok: false, code: 'higherUser' };
    }
    const me = guild.members?.me;
    if (opts.checkBotHierarchy !== false &&
        hasRoleTracking(target) && hasRoleTracking(me) &&
        target.roles.highest.position >= me.roles.highest.position) {
        return { ok: false, code: 'higherBot' };
    }
    if (opts.botPermission && me && me.permissions && typeof me.permissions.has === 'function' &&
        !me.permissions.has(opts.botPermission)) {
        return { ok: false, code: 'botMissingPermission' };
    }
    return { ok: true, code: 'ok' };
};
exports.validateTarget = validateTarget;