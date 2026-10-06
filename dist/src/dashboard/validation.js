"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHistoryFilter = exports.escapeRegex = exports.sanitizeSearchTerm = exports.nextSuggestionStatus = exports.canAccessTicket = exports.validateTicketSettings = exports.validateLoggingSettings = exports.validateWelcomeSettings = exports.validatePunishments = exports.validateWarningsConfig = exports.validateRaidConfig = exports.validateAutomodRules = exports.validateAutomodRule = exports.clampInt = exports.toBoolean = exports.sanitizeIdList = exports.isValidHexColor = exports.isSnowflake = exports.WARNING_ACTIONS = exports.RAID_ACTIONS = exports.AUTOMOD_ACTIONS = exports.DEFAULT_PAGE_LIMIT = exports.MAX_PAGE_LIMIT = void 0;
const SNOWFLAKE_RE = /^[0-9]{15,21}$/;
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DEFAULT_PAGE_LIMIT = 25;
exports.DEFAULT_PAGE_LIMIT = DEFAULT_PAGE_LIMIT;
const MAX_PAGE_LIMIT = 100;
exports.MAX_PAGE_LIMIT = MAX_PAGE_LIMIT;
const AUTOMOD_ACTIONS = ['delete', 'timeout', 'kick', 'ban', 'warn', 'none'];
exports.AUTOMOD_ACTIONS = AUTOMOD_ACTIONS;
const RAID_ACTIONS = ['kick', 'ban', 'none'];
exports.RAID_ACTIONS = RAID_ACTIONS;
const WARNING_ACTIONS = ['timeout', 'kick', 'ban', 'none'];
exports.WARNING_ACTIONS = WARNING_ACTIONS;
const AUTH_ACTIONS = ['warn', 'timeout', 'kick', 'ban', 'unban', 'untimeout', 'purge', 'unwarn', 'automod', 'antiraid'];
const isSnowflake = (value) => typeof value === 'string' && SNOWFLAKE_RE.test(value);
exports.isSnowflake = isSnowflake;
const isValidHexColor = (value) => typeof value === 'string' && HEX_COLOR_RE.test(value);
exports.isValidHexColor = isValidHexColor;
const sanitizeIdList = (input, max = 50) => {
    const source = Array.isArray(input)
        ? input
        : typeof input === 'string'
            ? input.split(',').map((s) => s.trim())
            : [];
    const seen = new Set();
    const out = [];
    for (const item of source) {
        const id = String(item).trim();
        if (!id || !isSnowflake(id) || seen.has(id)) {
            continue;
        }
        seen.add(id);
        out.push(id);
        if (out.length >= max) {
            break;
        }
    }
    return out;
};
exports.sanitizeIdList = sanitizeIdList;
const toBoolean = (value) => typeof value === 'boolean' ? value : typeof value === 'string' ? value === 'true' || value === '1' : false;
exports.toBoolean = toBoolean;
const clampInt = (value, def, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return def;
    }
    const clamped = Math.min(max, Math.max(min, Math.trunc(n)));
    return Number.isSafeInteger(clamped) ? clamped : def;
};
exports.clampInt = clampInt;
const pickKnown = (obj, known) => {
    const out = {};
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return out;
    }
    for (const key of known) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            out[key] = obj[key];
        }
    }
    return out;
};
const validateRuleArrays = (rule) => {
    const out = {};
    for (const key of ['ignoredChannels', 'ignoredRoles']) {
        out[key] = sanitizeIdList(rule[key]);
    }
    return out;
};
const validateAutomodRule = (rule, ruleName) => {
    const name = typeof ruleName === 'string' ? ruleName : 'rule';
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
        return { ok: false, errors: [`${name}: invalid rule object`] };
    }
    const errors = [];
    const clean = {
        enabled: toBoolean(rule.enabled),
        action: String(rule.action || 'delete')
    };
    if (!AUTOMOD_ACTIONS.includes(clean.action)) {
        errors.push(`${name}: action must be one of: ${AUTOMOD_ACTIONS.join(', ')}`);
        clean.action = AUTOMOD_ACTIONS.includes(rule.action) ? rule.action : 'delete';
    }
    clean.threshold = clampInt(rule.threshold, 1, 1, 100000);
    clean.timeWindow = clampInt(rule.timeWindow, 5000, 0, 86400000);
    clean.duration = clampInt(rule.duration, 60000, 0, 2419200000);
    clean.minLength = clampInt(rule.minLength, 10, 1, 4000);
    clean.reason = typeof rule.reason === 'string' && rule.reason.length <= 500
        ? rule.reason.trim()
        : `Automod: ${name} rule triggered`;
    const words = Array.isArray(rule.words)
        ? rule.words.map((w) => String(w).slice(0, 50)).filter((w) => w.length > 0).slice(0, 500)
        : [];
    clean.words = Array.from(new Set(words));
    Object.assign(clean, validateRuleArrays(rule));
    if (clean.action === 'timeout' && clean.duration <= 0) {
        clean.duration = 60000;
    }
    if (name !== 'caps' && name !== 'badWords' && name !== 'invites' && clean.threshold < 1) {
        clean.threshold = 1;
    }
    if (clean.threshold < 0 || clean.timeWindow < 0 || clean.duration < 0 || clean.minLength < 0) {
        errors.push(`${name}: thresholds cannot be negative`);
    }
    return { ok: errors.length === 0, errors, value: clean };
};
exports.validateAutomodRule = validateAutomodRule;
const validateAutomodRules = (rules, allowed = ['spam', 'duplicate', 'flood', 'mentions', 'caps', 'emojis', 'links', 'invites', 'badWords']) => {
    const source = rules && typeof rules === 'object' && !Array.isArray(rules) ? rules : {};
    const known = {};
    for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            known[key] = source[key];
        }
    }
    const out = {};
    const errors = [];
    for (const key of allowed) {
        if (!Object.prototype.hasOwnProperty.call(known, key)) {
            continue;
        }
        const res = validateAutomodRule(known[key], key);
        if (!res.ok) {
            errors.push(...res.errors);
        }
        out[key] = res.value;
    }
    return { ok: errors.length === 0, errors, value: out };
};
exports.validateAutomodRules = validateAutomodRules;
const validateRaidConfig = (config) => {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return { ok: false, errors: ['raid: invalid configuration object'] };
    }
    const errors = [];
    const clean = {
        enabled: toBoolean(config.enabled),
        joinLimit: clampInt(config.joinLimit, 5, 1, 100),
        timeWindow: clampInt(config.timeWindow, 10000, 1000, 3600000),
        cooldown: clampInt(config.cooldown, 60000, 0, 86400000),
        newAccountAgeDays: clampInt(config.newAccountAgeDays, 7, 0, 3650),
        botWhitelist: sanitizeIdList(config.botWhitelist),
        logChannelId: typeof config.logChannelId === 'string' && isSnowflake(config.logChannelId)
            ? config.logChannelId
            : ''
    };
    const actionType = typeof config.action?.type === 'string' ? String(config.action.type) : 'kick';
    if (!RAID_ACTIONS.includes(actionType)) {
        errors.push(`raid: action must be one of: ${RAID_ACTIONS.join(', ')}`);
    }
    clean.action = {
        type: RAID_ACTIONS.includes(actionType) ? actionType : 'kick',
        reason: typeof config.action?.reason === 'string' && config.action.reason.length <= 300
            ? config.action.reason.trim()
            : 'Anti-Raid Protection Triggered'
    };
    if (clean.joinLimit < 1 || clean.timeWindow < 1000 || clean.cooldown < 0 || clean.newAccountAgeDays < 0) {
        errors.push('raid: numeric values out of range');
    }
    return { ok: errors.length === 0, errors, value: clean };
};
exports.validateRaidConfig = validateRaidConfig;
const validatePunishments = (punishments) => {
    if (!Array.isArray(punishments)) {
        return [];
    }
    return punishments
        .filter((p) => p && typeof p === 'object')
        .map((p) => {
        const clean = {
            count: clampInt(p.count, 3, 1, 1000),
            action: WARNING_ACTIONS.includes(p.action) ? String(p.action) : 'timeout',
            duration: clampInt(p.duration, 60000, 0, 2419200000),
            reason: typeof p.reason === 'string' && p.reason.length <= 300 ? p.reason.trim() : 'Automatic punishment'
        };
        return clean;
    })
        .slice(0, 50);
};
exports.validatePunishments = validatePunishments;
const validateWarningsConfig = (config) => {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return { ok: false, errors: ['warnings: invalid configuration object'] };
    }
    const errors = [];
    const clean = {
        enabled: toBoolean(config.enabled),
        logChannelId: typeof config.logChannelId === 'string' && isSnowflake(config.logChannelId)
            ? config.logChannelId
            : '',
        maxWarnings: clampInt(config.maxWarnings, 0, 0, 10000),
        expire: {
            enabled: toBoolean(config.expire?.enabled),
            days: clampInt(config.expire?.days, 30, 1, 3650)
        },
        punishments: validatePunishments(config.punishments)
    };
    if (clean.maxWarnings < 0 || clean.expire.days < 1) {
        errors.push('warnings: numeric values out of range');
    }
    return { ok: errors.length === 0, errors, value: clean };
};
exports.validateWarningsConfig = validateWarningsConfig;
const validateLoggingSettings = (config, allowedKeys) => {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return { ok: false, errors: ['logging: invalid configuration object'] };
    }
    const keys = Array.isArray(allowedKeys) && allowedKeys.length > 0 ? allowedKeys : ['enabled', 'channelId', 'color'];
    const clean = {};
    const errors = [];
    const pick = pickKnown(config, keys);
    for (const key of ['enabled']) {
        if (Object.prototype.hasOwnProperty.call(pick, key)) {
            clean.enabled = toBoolean(pick[key]);
        }
    }
    for (const key of ['channelId']) {
        if (Object.prototype.hasOwnProperty.call(pick, key)) {
            const value = pick[key];
            clean.channelId = typeof value === 'string' && (value === '' || isSnowflake(value)) ? value : '';
            if (typeof value === 'string' && value !== '' && !isSnowflake(value)) {
                errors.push('logging: channelId must be a valid Discord channel id or empty');
            }
        }
    }
    for (const key of ['color']) {
        if (Object.prototype.hasOwnProperty.call(pick, key)) {
            const value = pick[key];
            clean.color = typeof value === 'string' && isValidHexColor(value) ? value : '#3498db';
        }
    }
    for (const key of ['ignoreBots', 'ignoredChannels']) {
        if (key === 'ignoreBots' && Object.prototype.hasOwnProperty.call(pick, key)) {
            clean[key] = toBoolean(pick[key]);
        }
        if (key === 'ignoredChannels' && Object.prototype.hasOwnProperty.call(pick, key)) {
            clean[key] = sanitizeIdList(pick[key]);
        }
    }
    return { ok: errors.length === 0, errors, value: clean };
};
exports.validateLoggingSettings = validateLoggingSettings;
const validateWelcomeSettings = (config) => {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return { ok: false, errors: ['welcome: invalid configuration object'] };
    }
    const errors = [];
    const clean = {
        enabled: toBoolean(config.enabled),
        channelId: '',
        message: '',
        language: 'en'
    };
    const channelValue = config.channelId;
    clean.channelId = typeof channelValue === 'string' && (channelValue === '' || isSnowflake(channelValue)) ? channelValue : '';
    if (typeof channelValue === 'string' && channelValue !== '' && !isSnowflake(channelValue)) {
        errors.push('welcome: channelId must be a valid Discord channel id or empty');
    }
    clean.message = typeof config.message === 'string' ? config.message.slice(0, 2000) : '';
    const language = typeof config.language === 'string' && config.language.trim().length > 0
        ? config.language.trim().slice(0, 10)
        : 'en';
    clean.language = language;
    return { ok: errors.length === 0, errors, value: clean };
};
exports.validateWelcomeSettings = validateWelcomeSettings;
const validateTicketSettings = (config) => {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return { ok: false, errors: ['ticket: invalid configuration object'] };
    }
    const errors = [];
    const clean = {};
    if (Object.prototype.hasOwnProperty.call(config, 'enabled')) {
        clean.enabled = toBoolean(config.enabled);
    }
    if (Object.prototype.hasOwnProperty.call(config, 'logChannelId')) {
        const value = config.logChannelId;
        clean.logChannelId = typeof value === 'string' && (value === '' || isSnowflake(value)) ? value : '';
        if (typeof value === 'string' && value !== '' && !isSnowflake(value)) {
            errors.push('ticket: logChannelId must be a valid channel id or empty');
        }
    }
    if (Object.prototype.hasOwnProperty.call(config, 'adminRoles')) {
        clean.adminRoles = sanitizeIdList(config.adminRoles);
    }
    if (Object.prototype.hasOwnProperty.call(config, 'sections')) {
        clean.sections = validateTicketSections(config.sections);
    }
    return { ok: errors.length === 0, errors, value: clean };
};
exports.validateTicketSettings = validateTicketSettings;
const validateTicketSections = (sections) => {
    if (!Array.isArray(sections)) {
        return [];
    }
    return sections
        .filter((s) => s && typeof s === 'object')
        .map((s) => {
        const run = pickKnown(s, ['name', 'emoji', 'description', 'categoryId', 'logChannelId', 'adminRoles', 'enabled', 'imageUrl']);
        const clean = {
            name: typeof run.name === 'string' && run.name.trim().length > 0 ? run.name.trim().slice(0, 40) : 'Ticket',
            emoji: typeof run.emoji === 'string' ? run.emoji.slice(0, 8) : '🎫',
            description: typeof run.description === 'string' ? run.description.slice(0, 300) : '',
            categoryId: isSnowflake(run.categoryId) ? run.categoryId : '',
            logChannelId: typeof run.logChannelId === 'string' && (run.logChannelId === '' || isSnowflake(run.logChannelId)) ? run.logChannelId : '',
            adminRoles: sanitizeIdList(run.adminRoles),
            enabled: toBoolean(run.enabled),
            imageUrl: typeof run.imageUrl === 'string' ? run.imageUrl.slice(0, 500) : ''
        };
        return clean;
    })
        .slice(0, 25);
};
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
exports.escapeRegex = escapeRegex;
const sanitizeSearchTerm = (value, max = 60) => typeof value === 'string' ? escapeRegex(value.trim().slice(0, max)) : '';
exports.sanitizeSearchTerm = sanitizeSearchTerm;
const parsePaginationParams = (page, limit, sort) => {
    const p = clampInt(page, 1, 1, 100000);
    const l = clampInt(limit, DEFAULT_PAGE_LIMIT, 1, MAX_PAGE_LIMIT);
    const s = sort === 'oldest' ? 'oldest' : 'newest';
    return { page: p, limit: l, sort: s, skip: (p - 1) * l };
};
const buildHistoryFilter = (filters) => {
    const f = filters || {};
    const query = {};
    const guildId = typeof f.guildId === 'string' && isSnowflake(f.guildId) ? f.guildId : f.guildId || null;
    if (guildId) {
        query.guildId = guildId;
    }
    if (typeof f.userId === 'string' && isSnowflake(f.userId)) {
        query.userId = f.userId;
    }
    if (typeof f.moderatorId === 'string' && isSnowflake(f.moderatorId)) {
        query.moderatorId = f.moderatorId;
    }
    if (typeof f.action === 'string' && f.action.trim().length > 0) {
        const action = f.action.trim().toLowerCase();
        const value = AUTH_ACTIONS.includes(action)
            ? action
            : AUTH_ACTIONS.includes(action.replace(/^(automod|antiraid):/, '$1'))
                ? action
                : null;
        if (value && value === action) {
            if (action === 'automod' || action === 'antiraid') {
                query.action = new RegExp(`^${escapeRegex(action)}:`);
            }
            else {
                query.action = action;
            }
        }
    }
    if (typeof f.from === 'string' && !isNaN(Date.parse(f.from))) {
        query.timestamp = { ...(query.timestamp || {}), $gte: new Date(f.from) };
    }
    if (typeof f.to === 'string' && !isNaN(Date.parse(f.to))) {
        query.timestamp = { ...(query.timestamp || {}), $lte: new Date(f.to) };
    }
    const search = sanitizeSearchTerm(f.search, 60);
    if (search) {
        query.$or = [{ targetName: new RegExp(search, 'i') }];
        if (SNOWFLAKE_RE.test(f.search)) {
            query.$or.push({ userId: f.search });
        }
    }
    const { page, limit, sort, skip } = parsePaginationParams(f.page, f.limit, f.sort);
    const options = {
        sort: { timestamp: sort === 'oldest' ? 1 : -1 },
        skip,
        limit,
        lean: true
    };
    return { query, options, page, limit, sort, skip };
};
exports.buildHistoryFilter = buildHistoryFilter;
const verifySuggestionTransition = (currentStatus, action) => {
    const known = ['pending', 'accepted', 'rejected'];
    if (!known.includes(currentStatus) || !known.includes(action)) {
        return false;
    }
    if (currentStatus === 'accepted' || currentStatus === 'rejected') {
        return false;
    }
    return !(action === 'pending' && currentStatus === 'pending');
};
const nextSuggestionStatus = (currentStatus, action) => {
    if (!verifySuggestionTransition(currentStatus, action)) {
        return { ok: false, code: 'invalidTransition' };
    }
    return { ok: true, status: action };
};
exports.nextSuggestionStatus = nextSuggestionStatus;
const canAccessTicket = (actor, ticket, options) => {
    const opts = options || {};
    if (!ticket || !ticket.channelId) {
        return { ok: false, code: 'invalidTicket' };
    }
    const actorId = actor?.id || actor;
    const isOwner = !!actorId && actorId === ticket.userId;
    const isStaff = !!opts.actorIsStaff && opts.actorIsStaff === true;
    const action = opts.action || 'view';
    if (action === 'delete') {
        if (!isStaff) {
            return { ok: false, code: 'staffOnly' };
        }
        return { ok: true };
    }
    if (isStaff || isOwner) {
        return { ok: true };
    }
    return { ok: false, code: 'ownerOnly' };
};
exports.canAccessTicket = canAccessTicket;
const UUID_RE = /^[a-f0-9-]{36}$/i;
const COLOR_OR_RGBA_RE = /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8}))|(rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+))?\s*\))$/;
const ALLOWED_VALIDATION_FONTS = [
    'Arial',
    'Segoe UI',
    'Tahoma',
    'Verdana',
    'Georgia',
    'Times New Roman',
    'Courier New',
    'Trebuchet MS',
    'Impact'
];
const ALLOWED_VALIDATION_ALIGNS = ['left', 'center', 'right'];
const ALLOWED_VALIDATION_DELIVERIES = ['dm', 'channel'];
const ALLOWED_VALIDATION_IMAGE_DELIVERIES = ['withMessage', 'beforeMessage', 'channel'];
const ALLOWED_VALIDATION_BACKGROUND_TYPES = ['none', 'color', 'image', 'transparent'];
const isValidColorValue = (value) => typeof value === 'string' && COLOR_OR_RGBA_RE.test(value.trim());
const isInRange = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const validateBackgroundValue = (background, errors, prefix) => {
    if (!background || typeof background !== 'object' || Array.isArray(background)) {
        return;
    }
    if (background.type !== undefined && !ALLOWED_VALIDATION_BACKGROUND_TYPES.includes(background.type)) {
        errors.push(`${prefix}: background.type must be one of ${ALLOWED_VALIDATION_BACKGROUND_TYPES.join(', ')}`);
    }
    if (background.type === 'image') {
        const source = background.source;
        if (typeof source !== 'string' || source.trim().length === 0) {
            errors.push(`${prefix}: background.image requires a source`);
        }
        else if (source.startsWith('http')) {
            const checked = checkUrl(source);
            if (!checked.ok) {
                errors.push(`${prefix}: background.source URL is invalid (${checked.error})`);
            }
        }
        else if (source.startsWith('upload:')) {
            const id = source.slice('upload:'.length);
            if (!UUID_RE.test(id)) {
                errors.push(`${prefix}: background.source upload id is invalid`);
            }
        }
        else {
            errors.push(`${prefix}: background.source must be an http(s) URL or an uploaded asset id`);
        }
    }
    if (background.fit !== undefined && !['cover', 'contain', 'fill'].includes(background.fit)) {
        errors.push(`${prefix}.fit must be one of cover, contain, fill`);
    }
    if (background.scale !== undefined && !isInRange(background.scale, 0.1, 4)) {
        errors.push(`${prefix}: background.scale must be between 0.1 and 4`);
    }
    if (background.positionX !== undefined && !isInRange(background.positionX, -4096, 4096)) {
        errors.push(`${prefix}: background.positionX out of range`);
    }
    if (background.positionY !== undefined && !isInRange(background.positionY, -4096, 4096)) {
        errors.push(`${prefix}: background.positionY out of range`);
    }
    if (background.overlayOpacity !== undefined && !isInRange(background.overlayOpacity, 0, 1)) {
        errors.push(`${prefix}: background.overlayOpacity must be between 0 and 1`);
    }
    if (background.color !== undefined && !isValidColorValue(background.color)) {
        errors.push(`${prefix}: background.color is invalid`);
    }
};
const validateAvatarValue = (avatar, errors, prefix) => {
    if (!avatar || typeof avatar !== 'object' || Array.isArray(avatar)) {
        return;
    }
    if (avatar.width !== undefined && !isInRange(avatar.width, 1, 1024)) {
        errors.push(`${prefix}: avatar.width must be between 1 and 1024`);
    }
    if (avatar.height !== undefined && !isInRange(avatar.height, 1, 1024)) {
        errors.push(`${prefix}: avatar.height must be between 1 and 1024`);
    }
    if (avatar.scale !== undefined && !isInRange(avatar.scale, 0.1, 4)) {
        errors.push(`${prefix}: avatar.scale must be between 0.1 and 4`);
    }
    if (avatar.radius !== undefined && !isInRange(avatar.radius, 0, 512)) {
        errors.push(`${prefix}: avatar.radius must be between 0 and 512`);
    }
    if (avatar.borderWidth !== undefined && !isInRange(avatar.borderWidth, 0, 128)) {
        errors.push(`${prefix}: avatar.borderWidth must be between 0 and 128`);
    }
    if (avatar.opacity !== undefined && !isInRange(avatar.opacity, 0, 1)) {
        errors.push(`${prefix}: avatar.opacity must be between 0 and 1`);
    }
    if (avatar.x !== undefined && !isInRange(avatar.x, -4096, 8192)) {
        errors.push(`${prefix}: avatar.x out of range`);
    }
    if (avatar.y !== undefined && !isInRange(avatar.y, -4096, 8192)) {
        errors.push(`${prefix}: avatar.y out of range`);
    }
    if (avatar.borderStyle !== undefined && avatar.borderStyle !== 'solid' && avatar.borderStyle !== 'dashed') {
        errors.push(`${prefix}: avatar.borderStyle must be solid or dashed`);
    }
};
const validateTextBlockValue = (text, errors, prefix) => {
    if (!text || typeof text !== 'object' || Array.isArray(text)) {
        return;
    }
    if (text.fontSize !== undefined && !isInRange(text.fontSize, 1, 300)) {
        errors.push(`${prefix}.fontSize must be between 1 and 300`);
    }
    if (text.font !== undefined && !ALLOWED_VALIDATION_FONTS.includes(text.font)) {
        errors.push(`${prefix}.font is not an allowed font`);
    }
    if (text.align !== undefined && !ALLOWED_VALIDATION_ALIGNS.includes(text.align)) {
        errors.push(`${prefix}.align must be left, center or right`);
    }
    if (text.maxWidth !== undefined && !isInRange(text.maxWidth, 1, 2400)) {
        errors.push(`${prefix}.maxWidth must be between 1 and 2400`);
    }
    if (text.lineSpacing !== undefined && !isInRange(text.lineSpacing, 0.5, 3)) {
        errors.push(`${prefix}.lineSpacing must be between 0.5 and 3`);
    }
    if (text.strokeWidth !== undefined && !isInRange(text.strokeWidth, 0, 64)) {
        errors.push(`${prefix}.strokeWidth must be between 0 and 64`);
    }
    if (text.letterSpacing !== undefined && !isInRange(text.letterSpacing, -10, 40)) {
        errors.push(`${prefix}.letterSpacing must be between -10 and 40`);
    }
    if (text.opacity !== undefined && !isInRange(text.opacity, 0, 1)) {
        errors.push(`${prefix}.opacity must be between 0 and 1`);
    }
    if (text.color !== undefined && !isValidColorValue(text.color)) {
        errors.push(`${prefix}.color is invalid`);
    }
    if (text.x !== undefined && !isInRange(text.x, -4096, 8192)) {
        errors.push(`${prefix}.x out of range`);
    }
    if (text.y !== undefined && !isInRange(text.y, -4096, 8192)) {
        errors.push(`${prefix}.y out of range`);
    }
    if (text.content !== undefined && (typeof text.content !== 'string' || text.content.length > 1000)) {
        errors.push(`${prefix}.content must be a string up to 1000 characters`);
    }
    if (text.text !== undefined && (typeof text.text !== 'string' || text.text.length > 200)) {
        errors.push(`${prefix}.text must be a string up to 200 characters`);
    }
};
const validateImageValue = (image, errors, prefix) => {
    if (!image || typeof image !== 'object' || Array.isArray(image)) {
        return;
    }
    if (image.delivery !== undefined && !ALLOWED_VALIDATION_IMAGE_DELIVERIES.includes(image.delivery)) {
        errors.push(`${prefix}.delivery is invalid`);
    }
    if (image.channelId !== undefined && image.channelId !== '' && !isSnowflake(image.channelId)) {
        errors.push(`${prefix}.channelId must be a valid Discord channel id or empty`);
    }
    if (image.canvas) {
        const cw = image.canvas.width;
        const ch = image.canvas.height;
        if (!isInRange(cw, 64, 4096) || !isInRange(ch, 64, 4096)) {
            errors.push(`${prefix}.canvas dimensions must be between 64 and 4096`);
        }
    }
    validateBackgroundValue(image.background, errors, `${prefix}.background`);
    validateAvatarValue(image.avatar, errors, `${prefix}.avatar`);
    validateTextBlockValue(image.username, errors, `${prefix}.username`);
    validateTextBlockValue(image.text, errors, `${prefix}.text`);
};
const validateMessageValue = (message, errors, prefix, withDelivery) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
        return;
    }
    if (message.content !== undefined && (typeof message.content !== 'string' || message.content.length > 2000)) {
        errors.push(`${prefix}.content must be a string up to 2000 characters`);
    }
    if (message.channelId !== undefined && message.channelId !== '' && !isSnowflake(message.channelId)) {
        errors.push(`${prefix}.channelId must be a valid Discord channel id or empty`);
    }
    if (withDelivery && message.delivery !== undefined && !ALLOWED_VALIDATION_DELIVERIES.includes(message.delivery)) {
        errors.push(`${prefix}.delivery must be dm or channel`);
    }
};
const checkUrl = (value) => {
    try {
        const parsed = new URL(value);
        if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || (parsed.username || parsed.password)) {
            return { ok: false, error: 'bad scheme or credentials' };
        }
        return { ok: true };
    }
    catch (_error) {
        return { ok: false, error: 'not a URL' };
    }
};
const validateWelcomeGoodbyeSettings = (config) => {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return { ok: false, errors: ['welcomeGoodbye: invalid configuration object'] };
    }
    const errors = [];
    if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
        errors.push('welcomeGoodbye: enabled must be a boolean');
    }
    const messageConditions = [
        [config.welcome?.message, 'welcome.message', true],
        [config.goodbye?.message, 'goodbye.message', false]
    ];
    for (const [message, prefix, withDelivery] of messageConditions) {
        validateMessageValue(message, errors, prefix, withDelivery);
    }
    validateImageValue(config.welcome?.image, errors, 'welcome.image');
    validateImageValue(config.goodbye?.image, errors, 'goodbye.image');
    if (config.customTemplates !== undefined) {
        if (!Array.isArray(config.customTemplates) || config.customTemplates.length > 20) {
            errors.push('welcomeGoodbye: customTemplates must be an array of up to 20 templates');
        }
        else {
            config.customTemplates.forEach((item, index) => {
                if (!item || typeof item !== 'object') {
                    errors.push(`welcomeGoodbye: customTemplates[${index}] must be an object`);
                    return;
                }
                if (typeof item.name !== 'string' || item.name.trim().length === 0) {
                    errors.push(`welcomeGoodbye: customTemplates[${index}].name is required`);
                }
                if (item.kind !== undefined && item.kind !== 'welcome' && item.kind !== 'goodbye') {
                    errors.push(`welcomeGoodbye: customTemplates[${index}].kind is invalid`);
                }
                validateImageValue(item.config, errors, `welcomeGoodbye:customTemplates[${index}].config`);
            });
        }
    }
    let value = null;
    try {
        const normalize = require('../welcome/welcomeGoodbyeDefaults').normalizeWelcomeGoodbyeConfig;
        value = normalize(config);
    }
    catch (_error) {
        errors.push('welcomeGoodbye: failed to normalize configuration');
    }
    return { ok: errors.length === 0, errors, value };
};
exports.validateWelcomeGoodbyeSettings = validateWelcomeGoodbyeSettings;
const validateImageConfig = (config) => {
    const errors = [];
    validateImageValue(config, errors, 'image');
    if (errors.length === 0) {
        try {
            const normalizeImage = require('../welcome/welcomeGoodbyeDefaults').normalizeImage;
            const defaults = require('../welcome/welcomeGoodbyeDefaults').WELCOME_GOODBYE_DEFAULTS;
            return { ok: true, errors: [], value: normalizeImage(config || {}, defaults.welcome.image) };
        }
        catch (_error) {
            return { ok: false, errors: ['image: failed to normalize image configuration'], value: null };
        }
    }
    return { ok: false, errors, value: null };
};
exports.validateImageConfig = validateImageConfig;