"use strict";
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const MEMBER_ID = '333333333333333333';
const CHANNEL_ID = '111111111111111111';
const GUILD_ID = '222222222222222222';

const { createCanvas, loadImage } = require('@napi-rs/canvas');

const {
    normalizeImage,
    normalizeWelcomeGoodbyeConfig,
    WELCOME_GOODBYE_DEFAULTS
} = require('../src/welcome/welcomeGoodbyeDefaults');

const {
    renderWelcomeImage,
    fitRect,
    CANVAS_SIZE
} = require('../src/welcome/imageRenderer');

const {
    handleMemberJoin
} = require('../src/welcome/welcomeGoodbyeManager');

const assetStore = require('../src/welcome/assetStore');

const enLocale = require('../src/locales/en.json');

function makeRedPng(length) {
    const size = length || 64;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, size, size);
    return canvas.toBuffer('image/png');
}

async function pixelAt(buffer, x, y) {
    const img = await loadImage(buffer);
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] };
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
        permissionsFor: () => ({ has: () => true })
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
        locales: o.locales || new Map([['en', enLocale]]),
        channels: { cache },
        user: { id: o.userId || '101010101010101010' }
    };
}

test('welcome render: configured URL background is drawn into the final canvas (no silent skip)', async () => {
    const redPng = makeRedPng(64);
    const result = await renderWelcomeImage({
        config: normalizeImage({
            enabled: true,
            background: { type: 'image', source: 'https://example.com/bg.png', fit: 'cover' },
            avatar: { enabled: false },
            username: { enabled: false },
            text: { enabled: false }
        }, WELCOME_GOODBYE_DEFAULTS.welcome.image),
        context: sampleContext(),
        loader: async () => redPng
    });
    assert.strictEqual(result.metadata.background, 'image');
    assert.strictEqual(result.metadata.backgroundFailed, false);
    const px = await pixelAt(result.buffer, 8, 8);
    assert.ok(px.r > 200 && px.g < 80 && px.b < 80,
        `background must be visible at the corner, got rgba(${px.r},${px.g},${px.b},${px.a})`);
});

test('welcome render: background overlay darkens the final image', async () => {
    const redPng = makeRedPng(64);
    const renderWith = async (overlay) => renderWelcomeImage({
        config: normalizeImage({
            enabled: true,
            background: { type: 'image', source: 'https://example.com/bg.png', overlay, overlayColor: '#000000', overlayOpacity: 0.5 },
            avatar: { enabled: false },
            username: { enabled: false },
            text: { enabled: false }
        }, WELCOME_GOODBYE_DEFAULTS.welcome.image),
        context: sampleContext(),
        loader: async () => redPng
    });
    const plain = await renderWith(false);
    const overlaid = await renderWith(true);
    const p1 = await pixelAt(plain.buffer, 8, 8);
    const p2 = await pixelAt(overlaid.buffer, 8, 8);
    assert.ok(p1.r > 200, 'plain background must be bright red');
    assert.ok(p2.r >= 90 && p2.r <= 180, `overlay must darken the background, got r=${p2.r}`);
    assert.ok(p2.r < p1.r, 'overlaid pixel must be darker than the plain pixel');
});

test('welcome render: real member join with an uploaded background (no options) sends the final image WITH the background', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-render-'));
    const originalCwd = process.cwd();
    process.chdir(tmp);
    try {
        const stored = await assetStore.storeUpload({
            buffer: makeRedPng(64),
            ext: 'png',
            width: 64,
            height: 64,
            guildId: GUILD_ID,
            kind: 'background'
        });
        const sent = [];
        const channel = makeChannel({ sent });
        const client = makeClient({
            enabled: true,
            welcome: {
                message: { enabled: false, content: '', delivery: 'dm', channelId: '' },
                image: {
                    enabled: true,
                    delivery: 'channel',
                    channelId: CHANNEL_ID,
                    background: { type: 'image', source: `upload:${stored.id}`, fit: 'cover', scale: 1, positionX: 0, positionY: 0, overlay: false },
                    avatar: { enabled: true, x: 600, y: 300, width: 200, height: 200 },
                    username: { enabled: true, text: '[userName]', x: 600, y: 300, fontSize: 48, font: 'Arial' },
                    text: { enabled: true, content: 'Welcome [userName] [server]', x: 600, y: 480, fontSize: 28, font: 'Arial' }
                }
            }
        }, { channels: [channel] });
        const member = makeMember(client);
        const res = await handleMemberJoin(member);
        assert.strictEqual(res.status, 'completed');
        assert.strictEqual(res.imageSent, true, 'final image must be sent for channel delivery');
        assert.ok(sent.length > 0);
        const attachment = sent[0].files && sent[0].files[0];
        assert.ok(attachment, 'expected an attachment on the sent message');
        assert.ok(Buffer.isBuffer(attachment.attachment) && attachment.attachment.length > 100);
        const px = await pixelAt(attachment.attachment, 8, 8);
        assert.ok(px.r > 200 && px.g < 80 && px.b < 80,
            `uploaded background must be present in the final Discord image, got rgba(${px.r},${px.g},${px.b},${px.a})`);
    }
    finally {
        process.chdir(originalCwd);
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('welcome render: background fit/scale/position math matches the editor contract', () => {
    const rect = fitRect(64, 64, CANVAS_SIZE.width, CANVAS_SIZE.height, 0.5, 40, -10, 'cover');
    assert.strictEqual(rect.width, 600);
    assert.strictEqual(rect.height, 600);
    assert.strictEqual(rect.x, 340);
    assert.strictEqual(rect.y, -10);
});

test('welcome render: transparent background produces a transparent PNG at the configured canvas size', async () => {
    const result = await renderWelcomeImage({
        config: normalizeImage({
            enabled: true,
            canvas: { width: 800, height: 400 },
            background: { type: 'transparent', color: '#1e1e2e' },
            avatar: { enabled: false },
            username: { enabled: false },
            text: { enabled: false }
        }, WELCOME_GOODBYE_DEFAULTS.welcome.image),
        context: sampleContext()
    });
    assert.strictEqual(result.metadata.background, 'transparent');
    assert.strictEqual(result.metadata.backgroundFailed, false);
    assert.strictEqual(result.metadata.width, 800);
    assert.strictEqual(result.metadata.height, 400);
    const img = await loadImage(result.buffer);
    assert.strictEqual(img.width, 800);
    assert.strictEqual(img.height, 400);
    const px = await pixelAt(result.buffer, 400, 200);
    assert.strictEqual(px.a, 0, `transparent background must stay transparent, got rgba(${px.r},${px.g},${px.b},${px.a})`);
});

test('welcome render: transparent background type and canvas size survive normalization', () => {
    const norm = normalizeImage({
        canvas: { width: 640, height: 480 },
        background: { type: 'transparent', color: '#1e1e2e' }
    }, WELCOME_GOODBYE_DEFAULTS.welcome.image);
    assert.strictEqual(norm.background.type, 'transparent');
    assert.strictEqual(norm.canvas.width, 640);
    assert.strictEqual(norm.canvas.height, 480);

    const config = normalizeWelcomeGoodbyeConfig({
        welcome: {
            image: {
                canvas: { width: 640, height: 480 },
                background: { type: 'transparent' }
            }
        }
    });
    assert.strictEqual(config.welcome.image.background.type, 'transparent');
    assert.strictEqual(config.welcome.image.canvas.width, 640);
    assert.strictEqual(config.welcome.image.canvas.height, 480);
});

test('welcome render: server template gallery previews build without error for every built-in template', async () => {
    const { listImageTemplates, applyImageTemplate } = require('../src/welcome/imageTemplates');
    const templates = listImageTemplates();
    assert.ok(templates.length > 0, 'expected at least one built-in template');
    for (const tpl of templates) {
        const config = applyImageTemplate(tpl.id, null);
        assert.ok(config, `template ${tpl.id} must produce a config`);
        const result = await renderWelcomeImage({
            config: normalizeImage(config, WELCOME_GOODBYE_DEFAULTS.welcome.image),
            context: sampleContext(),
            avatarUrl: null,
            loader: async () => makeRedPng(32),
            silent: true
        });
        assert.ok(result.buffer && result.buffer.length > 1);
        assert.strictEqual(result.metadata.backgroundFailed, false, `template ${tpl.id} preview must not fail its background`);
    }
});