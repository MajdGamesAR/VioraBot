"use strict";
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'locales');

const makeMember = ({ id = 'member1', highest = 1, admin = false, havePermission = undefined } = {}) => ({
    id,
    roles: { highest: { position: highest } },
    permissions: { has: (perm) => (havePermission !== undefined ? havePermission : admin) }
});

const makeGuild = ({ ownerId = 'owner1', meHighest = 10, meHasPermission = true, meAdmin = false } = {}) => ({
    id: 'guild1',
    ownerId,
    members: {
        me: {
            roles: { highest: { position: meHighest } },
            permissions: { has: () => (meHasPermission !== undefined ? meHasPermission : meAdmin) }
        }
    }
});

test('locale files: en.json and ar.json parse successfully', () => {
    const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
    const ar = JSON.parse(fs.readFileSync(path.join(localesDir, 'ar.json'), 'utf8'));
    assert.ok(en.moderation, 'en has moderation namespace');
    assert.ok(ar.moderation, 'ar has moderation namespace');
    assert.ok(en.automod, 'en has automod namespace');
    assert.ok(ar.automod, 'ar has automod namespace');
    assert.ok(en.logs?.moderation, 'en has logs.moderation');
    assert.ok(ar.logs?.moderation, 'ar has logs.moderation');
    assert.ok(en.protection?.raid, 'en has protection.raid');
    assert.ok(ar.protection?.raid, 'ar has protection.raid');
    assert.ok(en.welcome?.messages?.default, 'en has welcome.messages.default');
    assert.ok(ar.welcome?.messages?.default, 'ar has welcome.messages.default');
});

test('locale files: moderation targetErrors keys match between en and ar', () => {
    const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
    const ar = JSON.parse(fs.readFileSync(path.join(localesDir, 'ar.json'), 'utf8'));
    const enKeys = Object.keys(en.moderation.targetErrors || {}).sort();
    const arKeys = Object.keys(ar.moderation.targetErrors || {}).sort();
    assert.deepStrictEqual(arKeys, enKeys);
    assert.ok(enKeys.includes('userNotFound'));
    assert.ok(enKeys.includes('selfTarget'));
    assert.ok(enKeys.includes('ownerTarget'));
    assert.ok(enKeys.includes('higherUser'));
    assert.ok(enKeys.includes('botMissingPermission'));
});

test('locale files: ticket messages reuse keys match between en and ar', () => {
    const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
    const ar = JSON.parse(fs.readFileSync(path.join(localesDir, 'ar.json'), 'utf8'));
    const keys = ['reopened', 'reopenedLog', 'deleted', 'deletedLog', 'alreadyOpen', 'ownerOnly'];
    for (const key of keys) {
        assert.ok(en.ticket?.messages?.[key], `en.ticket.messages.${key} exists`);
        assert.ok(ar.ticket?.messages?.[key], `ar.ticket.messages.${key} exists`);
    }
    assert.ok(en.ticket?.buttons?.reopen && en.ticket?.buttons?.delete, 'en ticket reopen/delete buttons');
    assert.ok(ar.ticket?.buttons?.reopen && ar.ticket?.buttons?.delete, 'ar ticket reopen/delete buttons');
});

test('autoMod.checkContent: caps rule triggers on heavy uppercase', () => {
    const { checkContent } = require('../src/moderation/contentChecker');
    const result = checkContent('THIS IS A VERY LOUD MESSAGE WITH NO POINT', {
        rules: { caps: { enabled: true, threshold: 80, minLength: 10 } }
    });
    assert.strictEqual(result, 'caps');
});

test('autoMod.checkContent: caps rule does not trigger on normal text', () => {
    const { checkContent } = require('../src/moderation/contentChecker');
    const result = checkContent('this is a normal message', {
        rules: { caps: { enabled: true, threshold: 80, minLength: 10 } }
    });
    assert.strictEqual(result, null);
});

test('autoMod.checkContent: mentions rule triggers above threshold', () => {
    const { checkContent } = require('../src/moderation/contentChecker');
    const result = checkContent('<@123> <@456> <@789> <@101> hello', {
        rules: { mentions: { enabled: true, threshold: 3 } }
    });
    assert.strictEqual(result, 'mentions');
});

test('autoMod.checkContent: invite rule triggers on discord.gg', () => {
    const { checkContent } = require('../src/moderation/contentChecker');
    const result = checkContent('join my server at discord.gg/testserver', {
        rules: { invites: { enabled: true } }
    });
    assert.strictEqual(result, 'invites');
});

test('autoMod.checkContent: links rule triggers on url', () => {
    const { checkContent } = require('../src/moderation/contentChecker');
    const result = checkContent('check this https://example.com now', {
        rules: { links: { enabled: true, threshold: 1 } }
    });
    assert.strictEqual(result, 'links');
});

test('autoMod.checkContent: emojis rule triggers above threshold', () => {
    const { checkContent } = require('../src/moderation/contentChecker');
    const result = checkContent('\u{1F600}\u{1F600}\u{1F600}\u{1F600}\u{1F600} hello world', {
        rules: { emojis: { enabled: true, threshold: 3 } }
    });
    assert.strictEqual(result, 'emojis');
});

test('autoMod.checkContent: badWords rule triggers on listed word', () => {
    const { checkContent } = require('../src/moderation/contentChecker');
    const result = checkContent('this contains a forbiddenword here', {
        rules: { badWords: { enabled: true, words: ['forbiddenword'] } }
    });
    assert.strictEqual(result, 'badWords');
});

test('autoMod.checkContent: disabled rules never trigger', () => {
    const { checkContent } = require('../src/moderation/contentChecker');
    const result = checkContent('discord.gg/test visit www.example.com now', {
        rules: {
            invites: { enabled: false },
            links: { enabled: true, threshold: 1 },
            caps: { enabled: false, threshold: 80, minLength: 5 }
        }
    });
    assert.strictEqual(result, 'links');
});

test('moderationService.validateTarget: returns invalidGuild when guild/member missing', () => {
    const { validateTarget } = require('../src/moderation/validation');
    assert.strictEqual(validateTarget({ member: null, target: null, guild: null }).code, 'invalidGuild');
    assert.strictEqual(validateTarget({ member: makeMember(), target: null, guild: null }).code, 'invalidGuild');
});

test('moderationService.validateTarget: returns targetNotFound', () => {
    const { validateTarget } = require('../src/moderation/validation');
    const guild = makeGuild();
    const result = validateTarget({ member: makeMember(), target: null, guild });
    assert.strictEqual(result.code, 'targetNotFound');
    assert.strictEqual(result.ok, false);
});

test('moderationService.validateTarget: returns selfTarget', () => {
    const { validateTarget } = require('../src/moderation/validation');
    const guild = makeGuild();
    const member = makeMember({ id: 'me1', highest: 5 });
    const result = validateTarget({ member, target: { id: 'me1', roles: { highest: { position: 5 } } }, guild });
    assert.strictEqual(result.code, 'selfTarget');
});

test('moderationService.validateTarget: returns ownerTarget', () => {
    const { validateTarget } = require('../src/moderation/validation');
    const guild = makeGuild({ ownerId: 'owner1' });
    const result = validateTarget({
        member: makeMember({ highest: 99 }),
        target: { id: 'owner1', roles: { highest: { position: 99 } } },
        guild
    });
    assert.strictEqual(result.code, 'ownerTarget');
});

test('moderationService.validateTarget: returns higherUser for non-admin', () => {
    const { validateTarget } = require('../src/moderation/validation');
    const guild = makeGuild();
    const result = validateTarget({
        member: makeMember({ id: 'low', highest: 2, admin: false }),
        target: { id: 'high', roles: { highest: { position: 3 } } },
        guild,
        options: { checkUserHierarchy: true }
    });
    assert.strictEqual(result.code, 'higherUser');
});

test('moderationService.validateTarget: allows equal-highest target for admin', () => {
    const { validateTarget } = require('../src/moderation/validation');
    const guild = makeGuild();
    const result = validateTarget({
        member: makeMember({ id: 'admin', highest: 3, admin: true }),
        target: { id: 'peer', roles: { highest: { position: 3 } } },
        guild,
        options: { checkUserHierarchy: true }
    });
    assert.strictEqual(result.code, 'ok');
});

test('moderationService.validateTarget: returns botMissingPermission', () => {
    const { validateTarget } = require('../src/moderation/validation');
    const guild = makeGuild({ meHasPermission: false });
    const result = validateTarget({
        member: makeMember({ highest: 3 }),
        target: { id: 't', roles: { highest: { position: 1 } } },
        guild,
        options: { botPermission: { name: 'BanMembers' } }
    });
    assert.strictEqual(result.code, 'botMissingPermission');
});

test('moderationService.validateTarget: ok for valid ban target', () => {
    const { validateTarget } = require('../src/moderation/validation');
    const guild = makeGuild();
    const result = validateTarget({
        member: makeMember({ id: 'mod', highest: 5 }),
        target: { id: 'user', roles: { highest: { position: 1 } } },
        guild,
        options: { botPermission: { name: 'BanMembers' }, checkUserHierarchy: true }
    });
    assert.strictEqual(result.code, 'ok');
    assert.strictEqual(result.ok, true);
});

test('moderationService.validateTarget: returns higherBot when target above bot', () => {
    const { validateTarget } = require('../src/moderation/validation');
    const guild = makeGuild({ meHighest: 2 });
    const result = validateTarget({
        member: makeMember({ id: 'mod', highest: 10 }),
        target: { id: 'user', roles: { highest: { position: 5 } } },
        guild,
        options: { checkUserHierarchy: true }
    });
    assert.strictEqual(result.code, 'higherBot');
});

test('settings.json: warnings/automod/logs.moderation/raid defaults exist and are valid', () => {
    const settings = require('../../settings.json');
    assert.ok(settings.warnings && Array.isArray(settings.warnings.punishments));
    assert.ok(settings.automod && settings.automod.rules && typeof settings.automod.rules === 'object');
    assert.ok(settings.logs?.moderation && typeof settings.logs.moderation.enabled === 'boolean');
    assert.ok(settings.protection?.raid && typeof settings.protection.raid.enabled === 'boolean');
    assert.ok(Array.isArray(settings.protection.raid.botWhitelist));
    assert.ok(Array.isArray(settings.suggestions?.staffRoles));
    assert.ok(settings.welcome && typeof settings.welcome.enabled === 'boolean');
    assert.ok(typeof settings.welcome.channelId === 'string');
    assert.ok(typeof settings.welcome.message === 'string');
    assert.ok(typeof settings.welcome.language === 'string');
});

test('welcome formatter: replaces all known placeholders and leaves unknown untouched', () => {
    const formatWelcomeMessage = require('../src/utils/welcomeFormatter').default;
    const member = {
        id: '123456789012345678',
        user: { username: 'sally' },
        displayName: 'Sally Doe',
        guild: { name: 'Viora Community', memberCount: 25 }
    };
    const out = formatWelcomeMessage('Welcome {user} to {server}! You are member #{memberCount}.', member);
    assert.strictEqual(out, 'Welcome <@123456789012345678> to Viora Community! You are member #25.');
});

test('welcome formatter: username falls back to user.username and unknown placeholders persist', () => {
    const formatWelcomeMessage = require('../src/utils/welcomeFormatter').default;
    const member = {
        id: '777',
        user: { username: 'ghost' },
        displayName: null,
        guild: { name: 'Test Guild', memberCount: 42 }
    };
    const out = formatWelcomeMessage('Hello {username}! Keep {unknown} as-is.', member);
    assert.strictEqual(out, 'Hello ghost! Keep {unknown} as-is.');
});

test('settings.json: dist copy matches root canonical', () => {
    const root = require('../../settings.json');
    const dist = require('../../dist/settings.json');
    assert.deepStrictEqual(dist, root);
});