"use strict";
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ChannelType } = require('discord.js');
const ejs = require('ejs');
const { listTextChannels, fetchTextChannels } = require('../src/dashboard/channelList');

const ROOT = path.join(__dirname, '..', '..');
const GUILD_ID = '111111111111111111';

function channel(id, name, type) {
    return { id, name, type };
}

function fakeGuild({ channels = [], fetchThrows = false } = {}) {
    return {
        id: GUILD_ID,
        channels: {
            cache: {
                has: () => true,
                get: (id) => channels.find((c) => c.id === id) || null,
                values: () => channels[Symbol.iterator](),
                size: channels.length
            },
            fetch: async () => {
                if (fetchThrows) throw new Error('boom');
                return channels;
            }
        }
    };
}

test('welcome channels: lists text and announcement channels only', () => {
    const guild = fakeGuild({
        channels: [
            channel('w', 'welcome', ChannelType.GuildText),
            channel('g', 'general', ChannelType.GuildText),
            channel('n', 'announcements', ChannelType.GuildAnnouncement),
            channel('c', 'category', ChannelType.GuildCategory),
            channel('v', 'voice', ChannelType.GuildVoice),
            channel('f', 'forum', ChannelType.GuildForum),
            channel('s', 'stage', ChannelType.GuildStageVoice),
            channel('t', 'thread', ChannelType.PublicThread),
            channel('d', 'dm', ChannelType.DM)
        ]
    });
    const list = listTextChannels(guild);
    const ids = list.map((c) => c.id).sort();
    assert.deepStrictEqual(ids, ['g', 'n', 'w']);
    assert.deepStrictEqual(list, [
        { id: 'w', name: 'welcome', type: 'GuildText', guildId: GUILD_ID },
        { id: 'g', name: 'general', type: 'GuildText', guildId: GUILD_ID },
        { id: 'n', name: 'announcements', type: 'GuildAnnouncement', guildId: GUILD_ID }
    ]);
});

test('welcome channels: returns empty array for null guild / empty cache', () => {
    assert.deepStrictEqual(listTextChannels(null), []);
    assert.deepStrictEqual(listTextChannels({ id: GUILD_ID, channels: { cache: { values: () => [][Symbol.iterator]() } } }), []);
});

test('welcome channels: survives a failing channel fetch and falls back to the cache', async () => {
    const guild = fakeGuild({
        channels: [channel('w', 'welcome', ChannelType.GuildText)],
        fetchThrows: true
    });
    const list = await fetchTextChannels(guild);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, 'w');
    assert.strictEqual(list[0].type, 'GuildText');
});

test('welcome channels: fetch returns the same contract as listTextChannels', async () => {
    const guild = fakeGuild({
        channels: [channel('w', 'welcome', ChannelType.GuildText)]
    });
    const list = await fetchTextChannels(guild);
    assert.deepStrictEqual(list, [
        { id: 'w', name: 'welcome', type: 'GuildText', guildId: GUILD_ID }
    ]);
});

test('welcome channels: is never empty when the guild has text channels (regression: empty dropdowns)', () => {
    const guild = fakeGuild({
        channels: [channel('w', 'welcome', ChannelType.GuildText)]
    });
    const list = listTextChannels(guild);
    assert.ok(Array.isArray(list) && list.length > 0, 'channel list must not be empty');
});

test('welcome channels: EJS server-renders options into ALL FOUR channel selects', async () => {
    const locale = require(path.join(ROOT, 'dist', 'dashboard', 'locales', 'en.json'));
    const settings = {
        welcomeGoodbye: {
            enabled: false,
            welcome: {
                message: { enabled: true, content: '', delivery: 'dm', channelId: '111' },
                image: { enabled: false, channelId: '222' }
            },
            goodbye: {
                message: { enabled: false, content: '', channelId: '333' },
                image: { enabled: false, channelId: '444' }
            }
        }
    };
    const channels = [
        { id: '111', name: 'welcome' },
        { id: '222', name: 'welcome-images' },
        { id: '333', name: 'goodbye' },
        { id: '444', name: 'goodbye-images' },
        { id: '555', name: 'general' }
    ];
    const html = await ejs.renderFile(path.join(ROOT, 'dist', 'dashboard', 'views', 'welcome.ejs'), {
        locale,
        settings,
        channels,
        members: [],
        templates: [],
        fonts: []
    });
    // all four selects contain the plain channel option (appears once per select)
    assert.strictEqual((html.match(/value="555"/g) || []).length, 4, 'option must appear in all four selects');
    // saved channel IDs are pre-selected in their own select
    assert.ok(html.includes('<option value="111" selected>#welcome</option>'), 'welcome message saved id restored');
    assert.ok(html.includes('<option value="222" selected>#welcome-images</option>'), 'welcome image saved id restored');
    assert.ok(html.includes('<option value="333" selected>#goodbye</option>'), 'goodbye message saved id restored');
    assert.ok(html.includes('<option value="444" selected>#goodbye-images</option>'), 'goodbye image saved id restored');
    // unselected channel is never marked selected
    assert.ok(!html.includes('value="555" selected'), 'unselected channel must not be selected');
    // select elements are non-empty even before the frontend JS runs
    ['wg-welcome-message-channel', 'wg-welcome-image-channel', 'wg-goodbye-message-channel', 'wg-goodbye-image-channel']
        .forEach((id) => {
            assert.strictEqual((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `select id ${id} must be unique`);
            const m = html.match(new RegExp(`id="${id}"[^>]*>((?:.|\\n)*?)<\\/select>`));
            assert.ok(m, `select ${id} exists`);
            assert.ok(m[1].includes('value="555"'), `select ${id} is pre-populated server-side`);
        });
});

test('welcome channels: every elId in welcome.js matches a real select in the rendered page (id-mismatch regression)', async () => {
    const locale = require(path.join(ROOT, 'dist', 'dashboard', 'locales', 'en.json'));
    const settings = {
        welcomeGoodbye: {
            enabled: false,
            welcome: { message: { enabled: true, content: '', delivery: 'dm', channelId: '111' }, image: { enabled: false, channelId: '222' } },
            goodbye: { message: { enabled: false, content: '', channelId: '333' }, image: { enabled: false, channelId: '444' } }
        }
    };
    const channels = [{ id: '111', name: 'welcome' }, { id: '222', name: 'welcome-images' }, { id: '333', name: 'goodbye' }, { id: '444', name: 'goodbye-images' }, { id: '555', name: 'general' }];
    const html = await ejs.renderFile(path.join(ROOT, 'dist', 'dashboard', 'views', 'welcome.ejs'), {
        locale,
        settings,
        channels,
        members: [],
        templates: [],
        fonts: []
    });
    const js = fs.readFileSync(path.join(ROOT, 'dist', 'dashboard', 'public', 'js', 'welcome.js'), 'utf8');
    const elIds = [...js.matchAll(/CHANNEL_SELECT_META[\s\S]*?]\s*;/g)]
        .flatMap((m) => [...m[0].matchAll(/elId:\s*'([^']+)'/g)].map((x) => x[1]));
    // guard: we must actually extract the four channel selectors
    assert.strictEqual(elIds.length, 4, 'expected exactly 4 channel selectors in CHANNEL_SELECT_META, got ' + elIds.length);
    const missing = elIds.filter((id) => !html.includes(`id="${id}"`));
    assert.deepStrictEqual(missing, [], 'frontend references select IDs that do not exist in the rendered page: ' + missing.join(', '));
    // each referenced select must be pre-populated with the fixture channel and be unique
    elIds.forEach((id) => {
        assert.strictEqual((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `select id ${id} must be unique in the page`);
        const m = html.match(new RegExp(`id="${id}"[^>]*>((?:.|\\n)*?)<\\/select>`));
        assert.ok(m && m[1].includes('value="555"'), `select #${id} must contain fetched channel options in the server-rendered HTML`);
    });
});

test('welcome channels: embedded WELCOME_PAGE JSON carries the channel list', async () => {
    const locale = require(path.join(ROOT, 'dist', 'dashboard', 'locales', 'en.json'));
    const html = await ejs.renderFile(path.join(ROOT, 'dist', 'dashboard', 'views', 'welcome.ejs'), {
        locale,
        settings: { welcomeGoodbye: null },
        channels: [{ id: '555', name: 'general' }],
        members: [],
        templates: [],
        fonts: []
    });
    assert.ok(html.includes('channels: [{"id":"555","name":"general"}]'), 'embedded channel JSON must be intact');
});