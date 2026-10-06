"use strict";
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

const {
    WELCOME_GOODBYE_DEFAULTS,
    normalizeWelcomeGoodbyeConfig,
    migrateLegacyWelcome,
    normalizeImage,
    normalizeMessage,
    ALLOWED_FONTS
} = require('../src/welcome/welcomeGoodbyeDefaults');

const {
    formatWelcomeMessage,
    buildWelcomeContext,
    resolveInviteContext,
    WELCOME_VARIABLES
} = require('../src/utils/welcomeFormatter');

const {
    listImageTemplates,
    getImageTemplates,
    applyImageTemplate
} = require('../src/welcome/imageTemplates');

const {
    validateFile,
    validateImageUrl,
    MAX_FILE_SIZE
} = require('../src/welcome/uploadGuard');

const {
    renderWelcomeImage,
    describeLayout,
    CANVAS_SIZE,
    replaceImageVariables,
    fitCoverRect
} = require('../src/welcome/imageRenderer');

const {
    handleMemberJoin,
    handleMemberLeave,
    getWelcomeGoodbyeSettings
} = require('../src/welcome/welcomeGoodbyeManager');

const { validateWelcomeGoodbyeSettings } = require('../src/dashboard/validation');

const enLocale = require('../src/locales/en.json');
const arLocale = require('../src/locales/ar.json');

const MEMBER_ID = '333333333333333333';
const CHANNEL_ID = '111111111111111111';
const GUILD_ID = '222222222222222222';

function makeChannel(opts) {
    const o = opts || {};
    const sent = o.sent || null;
    const send = o.sendable === false ? null : async (content) => {
        if (sent) sent.push(content);
        return {};
    };
    return {
        id: o.id || CHANNEL_ID,
        guild: { id: o.guildId || GUILD_ID },
        send,
        permissionsFor: () => ({ has: (perm) => (o.hasPerms === false ? false : true) })
    };
}

function makeMember(client, o) {
    const opts = o || {};
    return {
        id: opts.id || MEMBER_ID,
        client,
        user: {
            username: opts.username || 'sally',
            displayAvatarURL: () => null
        },
        displayName: opts.displayName !== undefined ? opts.displayName : null,
        send: typeof opts.send === 'function' ? opts.send : async () => ({}),
        guild: {
            id: opts.guildId || GUILD_ID,
            name: opts.guildName || 'Viora Community',
            memberCount: opts.memberCount !== undefined ? opts.memberCount : 25,
            invites: opts.invites || null
        }
    };
}

function makeClient(cfg, opts) {
    const o = opts || {};
    const cache = new Map();
    for (const c of (o.channels || [])) cache.set(c.id, c);
    return {
        defaultLanguage: o.defaultLanguage || 'en',
        settings: cfg === null ? {} : (cfg === undefined ? {} : { welcomeGoodbye: cfg }),
        locales: o.locales || new Map([['en', enLocale], ['ar', arLocale]]),
        channels: { cache },
        user: { id: o.userId || '101010101010101010' }
    };
}

const sampleContext = () => ({
    user: '<@1234567890>',
    userName: 'Sample User',
    memberCount: '42',
    server: 'My Server',
    inviter: 'Unknown',
    inviterName: 'Unknown',
    invites: '0'
});

test('1 default configuration (welcomeGoodbye)', () => {
    const cfg = normalizeWelcomeGoodbyeConfig(null);
    assert.strictEqual(cfg.enabled, false);
    assert.strictEqual(cfg.welcome.message.enabled, true);
    assert.strictEqual(cfg.welcome.message.delivery, 'dm');
    assert.strictEqual(cfg.welcome.message.channelId, '');
    assert.strictEqual(cfg.goodbye.message.enabled, false);
    assert.strictEqual(Array.isArray(cfg.customTemplates), true);
    assert.strictEqual(cfg.welcome.image.delivery, 'withMessage');
    assert.strictEqual(cfg.welcome.image.background.type, 'none');
    assert.strictEqual(cfg.welcome.image.background.fit, 'cover');
    assert.strictEqual(cfg.welcome.image.avatar.circle, true);
    assert.strictEqual(cfg.welcome.image.username.text, '[userName]');
});

test('2 welcome message variable replacement', () => {
    const member = makeMember(null, { username: 'Sally Doe' });
    const msg = 'Hi [user] [userName] [memberCount] [server] [inviter] [inviterName] [invites]';
    const out = formatWelcomeMessage(msg, member, {
        inviteContext: { inviter: '<@555>', inviterName: 'Invite Guy', invites: '7' }
    });
    assert.strictEqual(out, `Hi <@${MEMBER_ID}> Sally Doe 25 Viora Community <@555> Invite Guy 7`);
});

test('3 Arabic localization exists', () => {
    const ar = arLocale.welcomeGoodbye;
    assert.ok(ar && ar.messages && ar.messages.default && ar.messages.default.welcome);
    assert.ok(ar.messages.default.welcome.includes('[user]'));
    assert.ok(ar.messages.default.goodbye.includes('[userName]'));
    assert.strictEqual(ar.unknownInviter, 'غير معروف');
});

test('4 English localization exists', () => {
    const en = enLocale.welcomeGoodbye;
    assert.ok(en && en.messages && en.messages.default && en.messages.default.welcome);
    assert.ok(en.messages.default.welcome.includes('[user]'));
    assert.ok(en.messages.default.goodbye.includes('[userName]'));
    assert.ok(en.messages.default.welcome.indexOf('[user]') === 0 || en.messages.default.welcome.includes('[user]'));
});

test('5 welcome image configuration normalization', () => {
    const img = normalizeImage({
        enabled: true,
        delivery: 'channel',
        channelId: CHANNEL_ID,
        avatar: { x: 500, y: 250, width: 250, height: 250, borderWidth: 100000, scale: 0.01 },
        background: { type: 'evil', fit: 'bogus', source: 'x'.repeat(4000), color: '#ff0000' }
    }, WELCOME_GOODBYE_DEFAULTS.welcome.image);
    assert.strictEqual(img.delivery, 'channel');
    assert.strictEqual(img.avatar.borderWidth, 128);
    assert.strictEqual(img.avatar.scale, 0.1);
    assert.strictEqual(img.background.type, 'none');
    assert.strictEqual(img.background.fit, 'cover');
    assert.strictEqual(img.background.source.length, 512);
    assert.strictEqual(img.background.color, '#ff0000');
});

test('6 avatar positioning (describeLayout)', () => {
    const layout = describeLayout({
        avatar: { x: 500, y: 250, width: 250, height: 250, scale: 1, radius: 0, circle: false }
    });
    assert.strictEqual(layout.avatar.centerX, 500);
    assert.strictEqual(layout.avatar.centerY, 250);
    assert.strictEqual(layout.avatar.left, 375);
    assert.strictEqual(layout.avatar.top, 125);
    assert.strictEqual(layout.avatar.circle, false);
    assert.strictEqual(layout.canvas.width, CANVAS_SIZE.width);
    assert.strictEqual(layout.canvas.height, CANVAS_SIZE.height);
});

test('7 avatar resizing (scale)', () => {
    const layout = describeLayout({
        avatar: { width: 200, height: 100, scale: 2 }
    });
    assert.strictEqual(layout.avatar.effectiveWidth, 400);
    assert.strictEqual(layout.avatar.effectiveHeight, 200);
    const rect = fitCoverRect(200, 100, CANVAS_SIZE.width, CANVAS_SIZE.height, 1, 0, 0);
    assert.ok(rect.width >= CANVAS_SIZE.width && rect.height >= CANVAS_SIZE.height);
});

test('8 username rendering produces an image', async () => {
    const result = await renderWelcomeImage({
        config: normalizeImage({
            enabled: true,
            background: { type: 'color', color: '#1e1e2e' },
            avatar: { enabled: false },
            username: { enabled: true, text: '[userName]', x: 600, y: 300, fontSize: 48, font: 'Arial' },
            text: { enabled: false }
        }, WELCOME_GOODBYE_DEFAULTS.welcome.image),
        context: sampleContext(),
        loader: async () => null
    });
    const buffer = result.buffer;
    assert.ok(Buffer.isBuffer(buffer) && buffer.length > 100);
    assert.strictEqual(buffer.readUInt32BE(0), 0x89504e47);
    assert.strictEqual(result.metadata.avatar, 'omitted');
    assert.strictEqual(result.metadata.background, 'color');
});

test('9 custom text rendering with variables', async () => {
    const config = normalizeImage({
        enabled: true,
        background: { type: 'color', color: '#123456' },
        avatar: { enabled: false },
        username: { enabled: false },
        text: { enabled: true, content: 'Welcome [userName] to [server]!', x: 600, y: 300, fontSize: 28, font: 'Arial' }
    }, WELCOME_GOODBYE_DEFAULTS.welcome.image);
    const result = await renderWelcomeImage({ config, context: sampleContext(), loader: async () => null });
    assert.ok(Buffer.isBuffer(result.buffer) && result.buffer.length > 100);
    const rendered = replaceImageVariables(config.text.content, sampleContext());
    assert.strictEqual(rendered, 'Welcome Sample User to My Server!');
});

test('10 template loading', () => {
    const listed = listImageTemplates();
    assert.strictEqual(listed.length, 6);
    const ids = listed.map((t) => t.id);
    ['classic', 'vioraPurple', 'gaming', 'minimal', 'neon', 'discordCommunity'].forEach((id) => assert.ok(ids.includes(id)));
    const names = listed.map((t) => t.name);
    ['Classic', 'Viora', 'Gaming', 'Minimal', 'Neon', 'Community'].forEach((name) => assert.ok(names.includes(name)));
    const full = getImageTemplates();
    assert.ok(full.every((t) => t.config && t.config.avatar && t.config.text));
    const applied = applyImageTemplate('neon', { enabled: true, delivery: 'dm', channelId: CHANNEL_ID, avatar: { x: 123 } });
    assert.ok(applied);
    assert.strictEqual(applied.enabled, true);
    assert.strictEqual(applied.delivery, 'dm');
    assert.strictEqual(applied.channelId, CHANNEL_ID);
    assert.strictEqual(typeof applied.avatar.x, 'number');
    assert.ok(applied.username && applied.username.text.includes('[userName]'));
    assert.strictEqual(applyImageTemplate('doesNotExist', {}), null);
});

test('11 goodbye configuration is independent from welcome', () => {
    const cfg = normalizeWelcomeGoodbyeConfig({
        welcome: { image: { avatar: { x: 100 } } },
        goodbye: { image: { avatar: { x: 900 }, text: { content: 'Goodbye [userName]' } } }
    });
    assert.strictEqual(cfg.welcome.image.avatar.x, 100);
    assert.strictEqual(cfg.goodbye.image.avatar.x, 900);
    cfg.goodbye.image.avatar.x = 1;
    assert.strictEqual(cfg.welcome.image.avatar.x, 100);
    assert.strictEqual(normalizeMessage({ enabled: true, content: 'bye', channelId: CHANNEL_ID }, WELCOME_GOODBYE_DEFAULTS.goodbye.message, false).channelId, CHANNEL_ID);
});

test('12 invalid channel rejected (join flow)', async () => {
    const client = makeClient({
        enabled: true,
        welcome: {
            message: { enabled: true, content: 'Hello [userName]', delivery: 'channel', channelId: '999999999999999999' },
            image: { enabled: false }
        }
    }, { channels: [makeChannel({ sent: [] })] });
    const member = makeMember(client);
    const res = await handleMemberJoin(member);
    assert.ok(res.status === 'completed');
    assert.strictEqual(res.messageSent, false);
    assert.ok(res.diagnostics.msg);
    assert.strictEqual(res.diagnostics.msg.ok, false);
    assert.strictEqual(res.diagnostics.msg.reason, 'CHANNEL_NOT_FOUND');
});

test('13 invalid upload rejected', async () => {
    const fake = Buffer.from('this is definitely not an image file content', 'utf8');
    const res = await validateFile({ buffer: fake, originalname: 'evil.png' });
    assert.strictEqual(res.ok, false);
    assert.ok(['BAD_MAGIC', 'BAD_EXTENSION'].includes(res.code));
});

test('14 oversized upload rejected', async () => {
    const big = Buffer.alloc(MAX_FILE_SIZE + 1, 0x89);
    const res = await validateFile({ buffer: big, originalname: 'big.png' });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'TOO_LARGE');
});

test('15 invalid image URL handling', async () => {
    assert.strictEqual(validateImageUrl('ftp://example.com/x.png').ok, false);
    assert.strictEqual(validateImageUrl('javascript:alert(1)').ok, false);
    assert.strictEqual(validateImageUrl('http://user:pass@example.com/x.png').ok, false);
    assert.strictEqual(validateImageUrl('https://example.com/bg.png').ok, true);
    const result = await renderWelcomeImage({
        config: normalizeImage({
            enabled: true,
            background: { type: 'image', source: 'https://example.com/__missing__.png' },
            avatar: { enabled: false },
            username: { enabled: false },
            text: { enabled: false }
        }, WELCOME_GOODBYE_DEFAULTS.welcome.image),
        context: sampleContext(),
        loader: async () => null
    });
    assert.strictEqual(result.metadata.backgroundFailed, true);
    assert.ok(Buffer.isBuffer(result.buffer) && result.buffer.length > 100);
});

test('16 missing avatar handled with fallback', async () => {
    const result = await renderWelcomeImage({
        config: normalizeImage({
            enabled: true,
            background: { type: 'color', color: '#000000' },
            avatar: { enabled: true, x: 300, y: 300, width: 200, height: 200 },
            username: { enabled: false },
            text: { enabled: false }
        }, WELCOME_GOODBYE_DEFAULTS.welcome.image),
        context: sampleContext(),
        loader: async () => null
    });
    assert.strictEqual(result.metadata.avatar, 'fallback');
    assert.ok(Buffer.isBuffer(result.buffer) && result.buffer.length > 100);
});

test('17 missing invite handled safely', async () => {
    const ctx = buildWelcomeContext(makeMember(null));
    assert.strictEqual(ctx.inviter, 'Unknown');
    assert.strictEqual(ctx.inviterName, 'Unknown');
    assert.strictEqual(ctx.invites, '0');
    const out = formatWelcomeMessage('[inviter] [inviterName] [invites]', makeMember(null));
    assert.strictEqual(out, 'Unknown Unknown 0');
    assert.ok(await resolveInviteContext(null, null));
});

test('18 guildMemberAdd flow (dm welcome message)', async () => {
    const sent = [];
    const client = makeClient({
        enabled: true,
        welcome: {
            message: { enabled: true, content: 'Welcome [userName]!', delivery: 'dm', channelId: '' },
            image: { enabled: false }
        }
    }, { channels: [] });
    const member = makeMember(client, { username: 'newnoob', send: async (content) => sent.push(content) });
    const res = await handleMemberJoin(member);
    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.messageSent, true);
    assert.strictEqual(sent[0], 'Welcome newnoob!');
    assert.ok(res.diagnostics.msg && res.diagnostics.msg.target === 'dm');
});

test('19 guildMemberRemove flow (channel goodbye message)', async () => {
    const sent = [];
    const channel = makeChannel({ sent });
    const client = makeClient({
        enabled: true,
        goodbye: {
            message: { enabled: true, content: 'Goodbye [userName]!', channelId: CHANNEL_ID },
            image: { enabled: false }
        }
    }, { channels: [channel] });
    const member = makeMember(client, { username: 'leaver' });
    const res = await handleMemberLeave(member);
    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.messageSent, true);
    assert.strictEqual(sent[0], 'Goodbye leaver!');
});

test('20 authorization: welcome API routes are behind dashboard auth guard', () => {
    const src = fs.readFileSync(path.join(ROOT, 'dist', 'dashboard', 'server.js'), 'utf8');
    const authIdx = src.indexOf("req.path.startsWith('/api/')");
    const requireAdminIdx = src.indexOf("['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)");
    const getIdx = src.indexOf("this.app.get('/api/welcome'");
    const postIdx = src.indexOf("this.app.post('/api/welcome/settings'");
    assert.ok(authIdx > -1 && requireAdminIdx > -1);
    assert.ok(getIdx > authIdx, 'GET /api/welcome must be after auth guard');
    assert.ok(postIdx > authIdx, 'POST /api/welcome/settings must be after auth guard');
    assert.ok(postIdx > requireAdminIdx, 'POST /api/welcome/settings must be after requireGuildAdmin');
});

test('21 CSRF: welcome POST routes are registered after csrfProtection middleware', () => {
    const src = fs.readFileSync(path.join(ROOT, 'dist', 'dashboard', 'server.js'), 'utf8');
    const csrfIdx = src.indexOf('this.app.use(this.csrfProtection())');
    const posts = [
        "this.app.post('/api/welcome/settings'",
        "this.app.post('/api/welcome/preview'",
        "this.app.post('/api/welcome/test'",
        "this.app.post('/api/welcome/upload'",
        "this.app.post('/api/welcome/template'",
        "this.app.post('/api/goodbye/settings'"
    ];
    assert.ok(csrfIdx > -1);
    posts.forEach((route) => {
        assert.ok(src.indexOf(route) > csrfIdx, `expected ${route} after csrf middleware`);
    });
});

test('22 guild scoping: cross-guild channel rejected', async () => {
    const other = makeChannel({ guildId: '555555555555555555', sent: [] });
    const client = makeClient({
        enabled: true,
        welcome: {
            message: { enabled: true, content: 'Hi', delivery: 'channel', channelId: CHANNEL_ID },
            image: { enabled: false }
        }
    }, { channels: [other] });
    const member = makeMember(client);
    const res = await handleMemberJoin(member);
    assert.strictEqual(res.messageSent, false);
    assert.strictEqual(res.diagnostics.msg.reason, 'CHANNEL_NOT_FOUND');
});

test('23 settings persistence round-trip preserves other settings', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-test-'));
    const originalCwd = process.cwd();
    try {
        fs.copyFileSync(path.join(ROOT, 'settings.json'), path.join(tmp, 'settings.json'));
        process.chdir(tmp);
        delete require.cache[require.resolve('../src/utils/settingsManager')];
        const sm = require('../src/utils/settingsManager');
        const before = JSON.parse(fs.readFileSync(path.join(tmp, 'settings.json'), 'utf8'));
        const current = sm.getSettings();
        const validated = validateWelcomeGoodbyeSettings({
            enabled: true,
            welcome: {
                message: { enabled: true, content: 'Ready [user]', delivery: 'dm', channelId: '' },
                image: { enabled: false }
            },
            goodbye: {
                message: { enabled: true, content: 'Bye', channelId: CHANNEL_ID },
                image: { enabled: false }
            }
        });
        assert.strictEqual(validated.ok, true);
        assert.ok(validated.value);
        current.welcomeGoodbye = validated.value;
        sm.persist();
        const written = JSON.parse(fs.readFileSync(path.join(tmp, 'settings.json'), 'utf8'));
        assert.strictEqual(written.welcomeGoodbye.enabled, true);
        assert.strictEqual(written.welcomeGoodbye.welcome.message.content, 'Ready [user]');
        assert.strictEqual(written.welcomeGoodbye.goodbye.message.channelId, CHANNEL_ID);
        Object.keys(before).forEach((k) => {
            if (k !== 'welcomeGoodbye') {
                assert.strictEqual(JSON.stringify(written[k]), JSON.stringify(before[k]), `key ${k} must be preserved`);
            }
        });
    }
    finally {
        process.chdir(originalCwd);
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('24 legacy welcome migration preserved and no existing-system regression', () => {
    const migrated = migrateLegacyWelcome({ enabled: true, channelId: CHANNEL_ID, message: 'Hi {user}', language: 'en' });
    assert.strictEqual(migrated.enabled, true);
    assert.strictEqual(migrated.welcome.message.content, 'Hi {user}');
    assert.strictEqual(migrated.welcome.message.delivery, 'channel');
    assert.strictEqual(migrated.welcome.message.channelId, CHANNEL_ID);
    assert.strictEqual(migrated.welcome.image.enabled, false);

    const rootSettings = require(path.join(ROOT, 'settings.json'));
    const distSettings = require(path.join(ROOT, 'dist', 'settings.json'));
    assert.strictEqual(JSON.stringify(rootSettings), JSON.stringify(distSettings), 'settings.json still mirrors dist');
    ['tickets', 'ticket', 'automod', 'antiRaid', 'antiSpam'].forEach((key) => {
        if (rootSettings[key] !== undefined && distSettings[key] !== undefined) {
            assert.strictEqual(JSON.stringify(rootSettings[key]), JSON.stringify(distSettings[key]));
        }
    });

    const getSettings = getWelcomeGoodbyeSettings(makeClient(null));
    assert.strictEqual(getSettings.enabled, false);
    assert.ok(WELCOME_VARIABLES.includes('inviter'));
    assert.ok(WELCOME_VARIABLES.includes('invites'));
    assert.ok(ALLOWED_FONTS.includes('Arial'));
});