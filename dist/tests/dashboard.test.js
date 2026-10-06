"use strict";
const { test } = require('node:test');
const assert = require('node:assert');
const {
    isSnowflake,
    isValidHexColor,
    sanitizeIdList,
    toBoolean,
    clampInt,
    validateWarningsConfig,
    validateAutomodRule,
    validateAutomodRules,
    validateRaidConfig,
    validateWelcomeSettings,
    buildHistoryFilter,
    nextSuggestionStatus,
    canAccessTicket,
    DEFAULT_PAGE_LIMIT,
    MAX_PAGE_LIMIT
} = require('../src/dashboard/validation');

test('isSnowflake accepts valid snowflakes and rejects others', () => {
    assert.strictEqual(isSnowflake('123456789012345678'), true);
    assert.strictEqual(isSnowflake('1'), false);
    assert.strictEqual(isSnowflake('abc'), false);
    assert.strictEqual(isSnowflake('1234567890123456789012'), false);
    assert.strictEqual(isSnowflake(123456789012345678), false);
    assert.strictEqual(isSnowflake('12345'), false);
});

test('isValidHexColor validates 3/6 digit hex only', () => {
    assert.strictEqual(isValidHexColor('#3498db'), true);
    assert.strictEqual(isValidHexColor('#fff'), true);
    assert.strictEqual(isValidHexColor('3498db'), false);
    assert.strictEqual(isValidHexColor('#GGGGGG'), false);
    assert.strictEqual(isValidHexColor('#1234567'), false);
});

test('sanitizeIdList dedupes, trims and caps at max', () => {
    const input = [(' 123 ').padStart(18, '0'), '456'.padStart(18, '0'), '123'.padStart(18, '0'), 'notanid', '456'.padStart(18, '0')];
    const out = sanitizeIdList(input, 50);
    assert.deepStrictEqual(out, ['456'.padStart(18, '0'), '123'.padStart(18, '0')]);
    const capped = sanitizeIdList(Array.from({ length: 80 }, (_, i) => String(i + 1).padStart(18, '0')), 10);
    assert.strictEqual(capped.length, 10);
});

test('clampInt clamps to min/max and falls back to default on non-numbers', () => {
    assert.strictEqual(clampInt('5', 1, 1, 100), 5);
    assert.strictEqual(clampInt(null, 25, 1, 100), 1);
    assert.strictEqual(clampInt('500', 25, 1, 100), 100);
    assert.strictEqual(clampInt('-5', 25, 1, 100), 1);
    assert.strictEqual(clampInt('abc', 7, 1, 100), 7);
    assert.strictEqual(clampInt(3.9, 1, 1, 10), 3);
});

test('toBoolean parses booleans and truthy strings only', () => {
    assert.strictEqual(toBoolean(true), true);
    assert.strictEqual(toBoolean(false), false);
    assert.strictEqual(toBoolean('true'), true);
    assert.strictEqual(toBoolean('1'), true);
    assert.strictEqual(toBoolean('yes'), false);
    assert.strictEqual(toBoolean(''), false);
});

test('validateWarningsConfig accepts a valid configuration', () => {
    const res = validateWarningsConfig({
        enabled: true,
        maxWarnings: 3,
        logChannelId: '123456789012345678',
        expire: { enabled: true, days: 30 },
        punishments: [{ count: 3, action: 'timeout', duration: 60000 }]
    });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.value.maxWarnings, 3);
    assert.strictEqual(res.value.expire.days, 30);
    assert.strictEqual(res.value.punishments.length, 1);
});

test('validateWarningsConfig clamps out-of-range and rejects unknown actions', () => {
    const res = validateWarningsConfig({
        enabled: true,
        maxWarnings: -5,
        punishments: [{ count: 1, action: 'explode' }]
    });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.value.maxWarnings, 0);
    assert.strictEqual(res.value.punishments[0].action, 'timeout');
    assert.strictEqual(res.value.punishments[0].count, 1);
});

test('validateAutomodRule clamps thresholds to bounds', () => {
    const res = validateAutomodRule({ action: 'ban', threshold: 999999, timeWindow: -1, duration: 60000 }, 'spam');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.value.action, 'ban');
    assert.strictEqual(res.value.threshold, 100000);
    assert.strictEqual(res.value.timeWindow, 0);
});

test('validateAutomodRules rejects invalid action names', () => {
    const res = validateAutomodRules({ spam: { action: 'nuke', enabled: true } }, ['spam']);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.value.spam.action, 'delete');
});

test('validateAutomodRules ignores unknown rule keys (prototype safety)', () => {
    const res = validateAutomodRules({ __proto__: { spam: { action: 'ban' } }, spam: { action: 'warn' } }, ['spam']);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.value.spam.action, 'warn');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(res.value, '__proto__'), false);
});

test('validateRaidConfig accepts valid config and sanitizes whitelist', () => {
    const res = validateRaidConfig({
        enabled: true,
        joinLimit: 8,
        timeWindow: 10000,
        cooldown: 60000,
        newAccountAgeDays: 7,
        botWhitelist: '123456789012345678, junk',
        action: { type: 'ban', reason: 'Raid' }
    });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.value.joinLimit, 8);
    assert.deepStrictEqual(res.value.botWhitelist, ['123456789012345678']);
    assert.strictEqual(res.value.action.type, 'ban');
});

test('validateRaidConfig rejects invalid action', () => {
    const res = validateRaidConfig({ action: { type: 'delete' } });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.value.action.type, 'kick');
});

test('buildHistoryFilter binds guildId and validates userId/moderatorId', () => {
    const f = buildHistoryFilter({
        guildId: '123456789012345678',
        userId: '987654321098765432',
        moderatorId: 'not-an-id',
        action: 'ban'
    });
    assert.strictEqual(f.query.guildId, '123456789012345678');
    assert.strictEqual(f.query.userId, '987654321098765432');
    assert.strictEqual(f.query.moderatorId, undefined);
    assert.strictEqual(f.query.action, 'ban');
});

test('buildHistoryFilter maps automod/antiraid actions to prefix regex', () => {
    const automod = buildHistoryFilter({ guildId: '1'.repeat(18), action: 'automod' });
    assert.ok(automod.query.action instanceof RegExp);
    assert.strictEqual(automod.query.action.source, '^automod:');
    const antiraid = buildHistoryFilter({ guildId: '1'.repeat(18), action: 'antiraid' });
    assert.strictEqual(antiraid.query.action.source, '^antiraid:');
});

test('buildHistoryFilter pagination defaults and max limit', () => {
    const d = buildHistoryFilter({ guildId: '1'.repeat(18) });
    assert.strictEqual(d.page, 1);
    assert.strictEqual(d.limit, DEFAULT_PAGE_LIMIT);
    assert.strictEqual(d.limit, 25);
    const big = buildHistoryFilter({ guildId: '1'.repeat(18), page: '5000', limit: '9999' });
    assert.strictEqual(big.limit, MAX_PAGE_LIMIT);
    assert.strictEqual(big.limit, 100);
    assert.strictEqual(big.page, 5000);
});

test('buildHistoryFilter sanitizes search term and escapes regex', () => {
    const f = buildHistoryFilter({ guildId: '1'.repeat(18), search: 'user (name)*' });
    assert.ok(f.query.$or);
    assert.ok(f.query.$or[0].targetName instanceof RegExp);
    const plain = buildHistoryFilter({ guildId: '1'.repeat(18), search: '123456789012345678' });
    assert.strictEqual(plain.query.$or[1].userId, '123456789012345678');
});

test('buildHistoryFilter supports date range filtering', () => {
    const f = buildHistoryFilter({
        guildId: '1'.repeat(18),
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-10T00:00:00.000Z'
    });
    assert.ok(f.query.timestamp.$gte instanceof Date);
    assert.ok(f.query.timestamp.$lte instanceof Date);
    const bad = buildHistoryFilter({ guildId: '1'.repeat(18), from: 'nope' });
    assert.strictEqual(bad.query.timestamp, undefined);
});

test('nextSuggestionStatus enforces final-state transitions', () => {
    assert.deepStrictEqual(nextSuggestionStatus('pending', 'accepted'), { ok: true, status: 'accepted' });
    assert.deepStrictEqual(nextSuggestionStatus('pending', 'rejected'), { ok: true, status: 'rejected' });
    assert.deepStrictEqual(nextSuggestionStatus('pending', 'pending'), { ok: false, code: 'invalidTransition' });
    assert.strictEqual(nextSuggestionStatus('accepted', 'rejected').ok, false);
    assert.strictEqual(nextSuggestionStatus('rejected', 'accepted').ok, false);
    assert.strictEqual(nextSuggestionStatus('banana', 'accepted').ok, false);
});

test('canAccessTicket enforces staff for delete, owner/staff for view', () => {
    const ticket = { channelId: '123', userId: 'ownerId' };
    assert.deepStrictEqual(canAccessTicket({ id: 'ownerId' }, ticket, {}), { ok: true });
    assert.strictEqual(canAccessTicket({ id: 'stranger' }, ticket, {}).ok, false);
    assert.strictEqual(canAccessTicket({ id: 'stranger' }, ticket, { actorIsStaff: true }).ok, true);
    assert.strictEqual(canAccessTicket({ id: 'ownerId' }, ticket, { actorIsStaff: false, action: 'delete' }).ok, false);
    assert.deepStrictEqual(canAccessTicket({ id: 'staff' }, ticket, { actorIsStaff: true, action: 'delete' }), { ok: true });
    assert.strictEqual(canAccessTicket({ id: 'x' }, null, {}).ok, false);
});

test('canAccessTicket guards missing channel id', () => {
    assert.strictEqual(canAccessTicket({ id: 'x' }, { userId: 'x' }, {}).ok, false);
});

test('validateWelcomeSettings accepts valid configuration and normalizes fields', () => {
    const res = validateWelcomeSettings({
        enabled: true,
        channelId: '123456789012345678',
        message: 'Welcome {user}!',
        language: 'ar'
    });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.value.enabled, true);
    assert.strictEqual(res.value.channelId, '123456789012345678');
    assert.strictEqual(res.value.message, 'Welcome {user}!');
    assert.strictEqual(res.value.language, 'ar');
});

test('validateWelcomeSettings rejects invalid channelId and clamps message length', () => {
    const res = validateWelcomeSettings({
        enabled: 'true',
        channelId: 'not-a-channel',
        message: 'x'.repeat(5000),
        language: ''
    });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.value.channelId, '');
    assert.strictEqual(res.value.message.length, 2000);
    assert.strictEqual(res.value.language, 'en');
});

test('validateWelcomeSettings rejects non-object input', () => {
    assert.strictEqual(validateWelcomeSettings(null).ok, false);
    assert.strictEqual(validateWelcomeSettings('welcome').ok, false);
});