"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveInviteContext = exports.buildWelcomeContext = exports.formatWelcomeMessage = exports.welcomePlaceholders = exports.WELCOME_VARIABLES = exports.WELCOME_PLACEHOLDER_RE = void 0;
const WELCOME_VARIABLES = ['user', 'userName', 'memberCount', 'server', 'inviter', 'inviterName', 'invites'];
exports.WELCOME_VARIABLES = WELCOME_VARIABLES;
const WELCOME_PLACEHOLDER_RE = /\{(user|username|server|memberCount)\}/g;
exports.WELCOME_PLACEHOLDER_RE = WELCOME_PLACEHOLDER_RE;
const PLACEHOLDER_RE = /\[(user|userName|memberCount|server|inviter|inviterName|invites)\]|\{(user|username|server|memberCount)\}/g;
const fallbackInviteContext = () => ({ inviter: null, inviterName: 'Unknown', invites: '0' });
const resolveInviteContext = async (client, guild) => {
    try {
        if (!guild || typeof guild.invites?.fetch !== 'function') {
            return fallbackInviteContext();
        }
        const invites = await guild.invites.fetch();
        const inviterTarget = invites
            .filter((invite) => invite.inviter && invite.uses !== undefined)
            .sort((a, b) => (b.uses || 0) - (a.uses || 0))
            .first();
        if (!inviterTarget || !inviterTarget.inviter) {
            return fallbackInviteContext();
        }
        return {
            inviter: `<@${inviterTarget.inviter.id}>`,
            inviterName: inviterTarget.inviter.displayName || inviterTarget.inviter.username || 'Unknown',
            invites: String(inviterTarget.uses || 0)
        };
    }
    catch (_error) {
        return fallbackInviteContext();
    }
};
exports.resolveInviteContext = resolveInviteContext;
const buildWelcomeContext = (member, inviteContext) => {
    const user = member?.user || {};
    const guild = member?.guild || {};
    const invite = inviteContext || fallbackInviteContext();
    const userName = String(member?.displayName || member?.nickname || user?.globalName || user?.username || '');
    const server = String(guild?.name || '');
    const memberCount = String(guild?.memberCount ?? '');
    return {
        user: `<@${member?.id || ''}>`,
        userName,
        memberCount,
        server,
        inviter: invite.inviter || 'Unknown',
        inviterName: invite.inviterName || 'Unknown',
        invites: String(invite.invites ?? '0')
    };
};
exports.buildWelcomeContext = buildWelcomeContext;
const welcomeReplacements = (member, inviteContext) => {
    const context = buildWelcomeContext(member, inviteContext);
    return {
        '[user]': context.user,
        '[userName]': context.userName,
        '[memberCount]': context.memberCount,
        '[server]': context.server,
        '[inviter]': context.inviter,
        '[inviterName]': context.inviterName,
        '[invites]': context.invites,
        '{user}': context.user,
        '{username}': context.userName,
        '{server}': context.server,
        '{memberCount}': context.memberCount
    };
};
const welcomePlaceholders = (member, inviteContext) => welcomeReplacements(member, inviteContext);
exports.welcomePlaceholders = welcomePlaceholders;
const formatWelcomeMessage = (message, member, options) => {
    const template = typeof message === 'string' ? message : '';
    const replacements = welcomeReplacements(member, options?.inviteContext);
    const out = template.replace(PLACEHOLDER_RE, (matched) => {
        if (matched in replacements) {
            return replacements[matched];
        }
        return matched;
    });
    return out;
};
exports.formatWelcomeMessage = formatWelcomeMessage;
exports.default = formatWelcomeMessage;