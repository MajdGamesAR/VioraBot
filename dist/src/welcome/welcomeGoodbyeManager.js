"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMemberLeave = exports.handleMemberJoin = exports.getWelcomeGoodbyeLocale = exports.getWelcomeGoodbyeSettings = exports.WELCOME_GOODBYE_DEFAULTS = void 0;
const welcomeGoodbyeDefaults_1 = require("./welcomeGoodbyeDefaults");
const welcomeFormatter_1 = require("../utils/welcomeFormatter");
const imageRenderer_1 = require("./imageRenderer");
const assetStore_1 = require("./assetStore");
exports.WELCOME_GOODBYE_DEFAULTS = welcomeGoodbyeDefaults_1.WELCOME_GOODBYE_DEFAULTS;
const RESOLVE_REASONS = ['CHANNEL_NOT_FOUND', 'NO_PERMISSION'];
const getWelcomeGoodbyeLocale = (client, language) => {
    const lang = typeof language === 'string' && language.length > 0
        ? language
        : (client?.defaultLanguage || client?.settings?.defaultLanguage || 'en');
    return client?.locales?.get(lang)?.welcomeGoodbye || client?.locales?.get('en')?.welcomeGoodbye || null;
};
exports.getWelcomeGoodbyeLocale = getWelcomeGoodbyeLocale;
const getWelcomeGoodbyeSettings = (client) => {
    const raw = client?.settings;
    if (!raw) {
        return (0, welcomeGoodbyeDefaults_1.normalizeWelcomeGoodbyeConfig)(null);
    }
    if (raw.welcomeGoodbye && typeof raw.welcomeGoodbye === 'object') {
        return (0, welcomeGoodbyeDefaults_1.normalizeWelcomeGoodbyeConfig)(raw.welcomeGoodbye);
    }
    if (raw.welcome && typeof raw.welcome === 'object') {
        return (0, welcomeGoodbyeDefaults_1.migrateLegacyWelcome)(raw.welcome);
    }
    return (0, welcomeGoodbyeDefaults_1.normalizeWelcomeGoodbyeConfig)(null);
};
exports.getWelcomeGoodbyeSettings = getWelcomeGoodbyeSettings;
const resolveChannel = (client, guild, channelId) => {
    if (!channelId) {
        return { ok: false, reason: 'CHANNEL_NOT_FOUND' };
    }
    const channel = client?.channels?.cache?.get(channelId);
    if (!channel || typeof channel.send !== 'function') {
        return { ok: false, reason: 'CHANNEL_NOT_FOUND' };
    }
    const channelGuild = channel.guild || null;
    if (!channelGuild || channelGuild.id !== guild?.id) {
        return { ok: false, reason: 'CHANNEL_NOT_FOUND' };
    }
    const permissions = typeof channel.permissionsFor === 'function'
        ? channel.permissionsFor(client?.user?.id)
        : null;
    if (permissions && (!permissions.has('ViewChannel') || !permissions.has('SendMessages'))) {
        return { ok: false, reason: 'NO_PERMISSION' };
    }
    return { ok: true, channel };
};
const sendToChannel = async (resolved, content, files, diagnostics, label) => {
    try {
        if (resolved.channel.send) {
            await resolved.channel.send(files && files.length > 0 ? { content, files } : content);
            diagnostics[label] = { ok: true, target: 'channel' };
            return { ok: true };
        }
        diagnostics[label] = { ok: false, reason: 'NO_SEND' };
        return { ok: false, reason: 'NO_SEND' };
    }
    catch (_error) {
        diagnostics[label] = { ok: false, reason: 'SEND_FAILED' };
        return { ok: false, reason: 'SEND_FAILED' };
    }
};
const sendToDm = async (member, content, files, diagnostics, label) => {
    try {
        if (typeof member.send !== 'function') {
            diagnostics[label] = { ok: false, reason: 'NO_DM_SEND' };
            return { ok: false, reason: 'NO_DM_SEND' };
        }
        await member.send(files && files.length > 0 ? { content, files } : content);
        diagnostics[label] = { ok: true, target: 'dm' };
        return { ok: true };
    }
    catch (_error) {
        diagnostics[label] = { ok: false, reason: 'DM_FAILED' };
        return { ok: false, reason: 'DM_FAILED' };
    }
};
const renderImage = async (member, config, context, options) => {
    const defaultBackgroundResolver = async (source) => {
        if (typeof source === 'string' && source.startsWith('upload:')) {
            const id = source.slice('upload:'.length);
            const loaded = await (0, assetStore_1.loadUploaded)(id, member?.guild?.id || '');
            return loaded ? loaded.buffer : null;
        }
        return null;
    };
    const avatarUrl = (() => {
        try {
            return typeof member?.user?.displayAvatarURL === 'function'
                ? member.user.displayAvatarURL({ extension: 'png', size: 256 })
                : null;
        }
        catch (_error) {
            return null;
        }
    })();
    const result = await (0, imageRenderer_1.renderWelcomeImage)({
        config,
        context,
        avatarUrl,
        loader: options?.loader,
        resolveBackground: options?.resolveBackground || defaultBackgroundResolver,
        outputFormat: options?.outputFormat
    });
    const { AttachmentBuilder } = require('discord.js');
    const attachment = new AttachmentBuilder(result.buffer, { name: options?.fileName || 'welcome.png' });
    return { buffer: result.buffer, metadata: result.metadata, attachment };
};
const handleMemberJoin = async (member, options) => {
    try {
        const client = member?.client;
        const cfg = (0, exports.getWelcomeGoodbyeSettings)(client);
        if (!cfg.enabled) {
            console.log('[welcomeGoodbye] enabled=NO');
            return { status: 'disabled' };
        }
        console.log('[welcomeGoodbye] enabled=YES');
        const guild = member?.guild;
        const details = { status: 'completed', diagnostics: {}, messageSent: false, imageSent: false };
        if (!guild) {
            console.log('[welcomeGoodbye] flow=FAILED reason=GUILD_MISSING');
            return { status: 'skipped', reason: 'GUILD_MISSING' };
        }
        const inviteContext = await (0, welcomeFormatter_1.resolveInviteContext)(client, guild);
        const context = (0, welcomeFormatter_1.buildWelcomeContext)(member, inviteContext);
        const locale = (0, exports.getWelcomeGoodbyeLocale)(client, 'en');
        const msgCfg = cfg.welcome.message;
        const imgCfg = cfg.welcome.image;
        let content = '';
        if (msgCfg.enabled) {
            content = (0, welcomeFormatter_1.formatWelcomeMessage)(msgCfg.content || locale?.messages?.default?.welcome || '', member, { inviteContext });
            if (!content) {
                console.log('[welcomeGoodbye] msg=skipped reason=EMPTY_MESSAGE');
                details.diagnostics.msg = { ok: false, reason: 'EMPTY_MESSAGE' };
                content = '';
            }
        }
        let imageData = null;
        if (imgCfg.enabled) {
            try {
                const rendered = await renderImage(member, imgCfg, context, options);
                imageData = rendered;
                console.log(`[welcomeGoodbye] img=rendered avatar=${rendered.metadata.avatar} fmt=png`);
            }
            catch (error) {
                console.log('[welcomeGoodbye] img=FAILED reason=EXCEPTION');
                details.diagnostics.img = { ok: false, reason: 'EXCEPTION' };
            }
        }
        if (imageData) {
            const delivery = imgCfg.delivery || 'withMessage';
            if (delivery === 'channel') {
                const channelResolved = resolveChannel(client, guild, imgCfg.channelId);
                if (channelResolved.ok) {
                    await sendToChannel(channelResolved, '', [imageData.attachment], details.diagnostics, 'img');
                    details.imageSent = true;
                }
                else {
                    console.log(`[welcomeGoodbye] img=skipped reason=${channelResolved.reason}`);
                    details.diagnostics.img = { ok: false, reason: channelResolved.reason };
                }
            }
            else if (delivery === 'beforeMessage') {
                const target = msgCfg.delivery === 'dm'
                    ? { kind: 'dm' }
                    : { kind: 'channel', resolved: resolveChannel(client, guild, msgCfg.channelId) };
                if (target.kind === 'dm') {
                    const resultDm = await sendToDm(member, '', [imageData.attachment], details.diagnostics, 'img');
                    details.imageSent = resultDm.ok;
                }
                else if (target.resolved.ok) {
                    const resultChannel = await sendToChannel(target.resolved, '', [imageData.attachment], details.diagnostics, 'img');
                    details.imageSent = resultChannel.ok;
                }
                else {
                    console.log(`[welcomeGoodbye] img=skipped reason=${target.resolved.reason}`);
                    details.diagnostics.img = { ok: false, reason: target.resolved.reason };
                }
                if (content) {
                    const resultMsg = await sendWelcomeMessage(member, msgCfg, content, details);
                    details.messageSent = resultMsg.ok;
                }
            }
            else {
                const withMessage = content && (details.messageSent || imgCfg.delivery === 'withMessage');
                if (withMessage) {
                    if (msgCfg.delivery === 'dm') {
                        const resultDm = await sendToDm(member, content, [imageData.attachment], details.diagnostics, 'both');
                        details.messageSent = resultDm.ok;
                        details.imageSent = resultDm.ok;
                    }
                    else {
                        const channelResolved = resolveChannel(client, guild, msgCfg.channelId);
                        if (channelResolved.ok) {
                            const resultChannel = await sendToChannel(channelResolved, content, [imageData.attachment], details.diagnostics, 'both');
                            details.messageSent = resultChannel.ok;
                            details.imageSent = resultChannel.ok;
                        }
                        else {
                            console.log(`[welcomeGoodbye] msg=skipped reason=${channelResolved.reason}`);
                            details.diagnostics.both = { ok: false, reason: channelResolved.reason };
                        }
                    }
                }
                else {
                    const target = msgCfg.delivery === 'dm'
                        ? { kind: 'dm' }
                        : { kind: 'channel', resolved: resolveChannel(client, guild, msgCfg.channelId) };
                    if (target.kind === 'dm') {
                        const resultDm = await sendToDm(member, content, [imageData.attachment], details.diagnostics, 'both');
                        details.imageSent = resultDm.ok;
                        details.messageSent = resultDm.ok && !!content;
                    }
                    else if (target.resolved.ok) {
                        const resultChannel = await sendToChannel(target.resolved, content, [imageData.attachment], details.diagnostics, 'both');
                        details.imageSent = resultChannel.ok;
                        details.messageSent = resultChannel.ok && !!content;
                    }
                    else {
                        console.log(`[welcomeGoodbye] img=skipped reason=${target.resolved.reason}`);
                    }
                }
            }
        }
        if (content && !details.messageSent) {
            const resultMsg = await sendWelcomeMessage(member, msgCfg, content, details);
            details.messageSent = resultMsg.ok;
        }
        console.log(`[welcomeGoodbye] flow=done msg=${details.messageSent ? 'sent' : 'skipped'} img=${details.imageSent ? 'sent' : 'skipped'}`);
        return details;
    }
    catch (_error) {
        console.log('[welcomeGoodbye] flow=FAILED reason=EXCEPTION');
        return { status: 'failed' };
    }
};
exports.handleMemberJoin = handleMemberJoin;
const sendWelcomeMessage = async (member, msgCfg, content, details) => {
    if (!content) {
        return { ok: false, reason: 'EMPTY_MESSAGE' };
    }
    const client = member?.client;
    const guild = member?.guild;
    const delivery = msgCfg.delivery || 'dm';
    if (delivery === 'dm') {
        const result = await sendToDm(member, content, [], details.diagnostics, 'msg');
        console.log(`[welcomeGoodbye] msg=${result.ok ? 'sent' : 'FAILED'} target=dm`);
        return result;
    }
    const channelResolved = resolveChannel(client, guild, msgCfg.channelId);
    if (!channelResolved.ok) {
        console.log(`[welcomeGoodbye] msg=skipped reason=${channelResolved.reason}`);
        details.diagnostics.msg = { ok: false, reason: channelResolved.reason };
        return { ok: false, reason: channelResolved.reason };
    }
    const result = await sendToChannel(channelResolved, content, [], details.diagnostics, 'msg');
    console.log(`[welcomeGoodbye] msg=${result.ok ? 'sent' : 'FAILED'} target=channel`);
    return result;
};
const handleMemberLeave = async (member, options) => {
    try {
        const client = member?.client;
        const cfg = (0, exports.getWelcomeGoodbyeSettings)(client);
        if (!cfg.enabled) {
            console.log('[welcomeGoodbye] enabled=NO');
            return { status: 'disabled' };
        }
        console.log('[welcomeGoodbye] goodbye enabled=YES');
        const guild = member?.guild;
        const details = { status: 'completed', diagnostics: {}, messageSent: false, imageSent: false };
        if (!guild) {
            return { status: 'skipped', reason: 'GUILD_MISSING' };
        }
        const inviteContext = await (0, welcomeFormatter_1.resolveInviteContext)(client, guild);
        const context = (0, welcomeFormatter_1.buildWelcomeContext)(member, inviteContext);
        const locale = (0, exports.getWelcomeGoodbyeLocale)(client, 'en');
        const msgCfg = cfg.goodbye.message;
        const imgCfg = cfg.goodbye.image;
        let content = '';
        if (msgCfg.enabled) {
            content = (0, welcomeFormatter_1.formatWelcomeMessage)(msgCfg.content || locale?.messages?.default?.goodbye || '', member, { inviteContext });
            if (!content) {
                details.diagnostics.msg = { ok: false, reason: 'EMPTY_MESSAGE' };
            }
        }
        let imageData = null;
        if (imgCfg.enabled) {
            try {
                imageData = await renderImage(member, imgCfg, context, { ...options, fileName: 'goodbye.png' });
                console.log(`[welcomeGoodbye] img=rendered avatar=${imageData.metadata.avatar} fmt=png`);
            }
            catch (_error) {
                console.log('[welcomeGoodbye] img=FAILED reason=EXCEPTION');
                details.diagnostics.img = { ok: false, reason: 'EXCEPTION' };
            }
        }
        const channelResolved = resolveChannel(client, guild, msgCfg.channelId);
        if (imageData) {
            const delivery = imgCfg.delivery || 'withMessage';
            if (delivery === 'channel') {
                const imgChannel = resolveChannel(client, guild, imgCfg.channelId);
                if (imgChannel.ok) {
                    const result = await sendToChannel(imgChannel, '', [imageData.attachment], details.diagnostics, 'img');
                    details.imageSent = result.ok;
                }
                else {
                    console.log(`[welcomeGoodbye] img=skipped reason=${imgChannel.reason}`);
                }
            }
            else if (delivery === 'beforeMessage') {
                if (channelResolved.ok) {
                    const resultImg = await sendToChannel(channelResolved, '', [imageData.attachment], details.diagnostics, 'img');
                    details.imageSent = resultImg.ok;
                }
            }
            else if (content && channelResolved.ok) {
                const result = await sendToChannel(channelResolved, content, [imageData.attachment], details.diagnostics, 'both');
                details.messageSent = result.ok;
                details.imageSent = result.ok;
            }
            else if (channelResolved.ok) {
                const result = await sendToChannel(channelResolved, '', [imageData.attachment], details.diagnostics, 'img');
                details.imageSent = result.ok;
            }
            else {
                console.log(`[welcomeGoodbye] goodbye skips: msg channel=${channelResolved.reason}`);
            }
        }
        if (content && !details.messageSent) {
            if (channelResolved.ok) {
                const result = await sendToChannel(channelResolved, content, [], details.diagnostics, 'msg');
                details.messageSent = result.ok;
            }
            else {
                console.log(`[welcomeGoodbye] msg=skipped reason=${channelResolved.reason}`);
            }
        }
        console.log(`[welcomeGoodbye] goodbye flow=done msg=${details.messageSent ? 'sent' : 'skipped'} img=${details.imageSent ? 'sent' : 'skipped'}`);
        return details;
    }
    catch (_error) {
        console.log('[welcomeGoodbye] flow=FAILED reason=EXCEPTION');
        return { status: 'failed' };
    }
};
exports.handleMemberLeave = handleMemberLeave;
exports.RESOLVE_REASONS = RESOLVE_REASONS;