"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESOLVE_REASONS = exports.handleRankCard = exports.handleLevelUp = exports.getLevelingSettings = exports.getLevelingLocale = exports.LEVELING_DEFAULTS = void 0;
const tslib_1 = require("tslib");
const logger_1 = require("../logger");
const levelingDefaults_1 = require("./levelingDefaults");
const imageRenderer_1 = require("./imageRenderer");
const assetStore_1 = require("./assetStore");
Object.defineProperty(exports, "LEVELING_DEFAULTS", { enumerable: true, get: function () { return levelingDefaults_1.LEVELING_DEFAULTS; } });
var RESOLVE_REASONS = ['CHANNEL_NOT_FOUND', 'NO_PERMISSION'];
function getLevelingLocale(settings) {
    return tslib_1.__rest(settings, []);
}
function getLevelingSettings(raw, overrides) {
    var _a;
    var src = overrides || ((raw && raw.leveling) || undefined);
    var resolved;
    if (src) {
        resolved = levelingDefaults_1.normalizeLevelingConfig(src, levelingDefaults_1.LEVELING_DEFAULTS);
    }
    else if (raw && raw.legacyLeveling) {
        resolved = levelingDefaults_1.migrateLegacyLeveling(raw.legacyLeveling);
    }
    else {
        resolved = levelingDefaults_1.normalizeLevelingConfig(null, levelingDefaults_1.LEVELING_DEFAULTS);
    }
    ((_a = raw) === null || _a === void 0 ? void 0 : _a._resolved) && ((_a._resolved.leveling = resolved));
    return resolved;
}
function resolveLevelUpChannel(channelId, settings, client) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var _a;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!channelId) {
                        return [2, { ok: true }];
                    }
                    _a = {};
                    return [4, client.channels.fetch(channelId)];
                case 1:
                    _a.channel = _b.sent();
                    _a.reason = void 0;
                    return [2, _a];
            }
        });
    });
}
function sendLevelUpMessage(user, config, settings, client, details, rank, gain) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var msgCfg, delivery, content, payload, channelRes, channel, dm, err_1, uploadRes, attachment, renderResult;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    msgCfg = config.message || {};
                    delivery = msgCfg.delivery || 'dm';
                    content = (msgCfg.content || '')
                        .replace(/\$userId/g, user.id)
                        .replace(/\$username/g, user.username || user.tag || '');
                    if (!content) {
                        return [2, { ok: false, reason: 'EMPTY_MESSAGE' }];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 9, , 10]);
                    renderResult = imageRenderer_1.renderRankCardImage(user, rank, settings.rankCard);
                    if (!((renderResult === null || renderResult === void 0 ? void 0 : renderResult.ok) === false)) return [3, 2];
                    if (details) {
                        details.diagnostics = details.diagnostics || {};
                        details.diagnostics.img = { error: String(renderResult.error) };
                    }
                    return [2, { ok: false, reason: 'RENDER_FAILED', error: renderResult.error }];
                case 2:
                    if (renderResult.path) return [3, 3];
                    if (details) {
                        details.diagnostics = details.diagnostics || {};
                        details.diagnostics.img = { error: 'RENDERED_CARD_PATH_MISSING' };
                    }
                    return [2, { ok: false, reason: 'RENDER_FAILED', error: 'RENDERED_CARD_PATH_MISSING' }];
                case 3:
                    attachment = { attachment: String(renderResult.path), name: String(renderResult.filename || 'rank_card.png') };
                    payload = { content: content, files: [attachment] };
                    if (!(delivery === 'channel')) return [3, 6];
                    return [4, resolveLevelUpChannel(msgCfg.channelId, settings, client)];
                case 4:
                    channelRes = _a.sent();
                    if (!((channelRes === null || channelRes === void 0 ? void 0 : channelRes.ok) === false)) return [3, 5];
                    return [2, { ok: false, reason: channelRes.reason }];
                case 5:
                    if (!channelRes.channel) return [3, 8];
                    channel = channelRes.channel;
                    if (!('send' in channel)) {
                        return [2, { ok: false, reason: 'CHANNEL_NOT_FOUND' }];
                    }
                    uploadRes = assetStore_1.uploadAsset(attachment.attachment, attachment.name);
                    if (!uploadRes) {
                        if (details) {
                            details.diagnostics = details.diagnostics || {};
                            details.diagnostics.img = { error: 'UPLOAD_FAILED' };
                        }
                        return [2, { ok: false, reason: 'UPLOAD_FAILED' }];
                    }
                    return [4, channel.send(payload)];
                case 6:
                    _a.sent();
                    return [3, 7];
                case 7: return [2, { ok: true, message: content }];
                case 8:
                    if (!msgCfg.channelId) {
                        return [2, { ok: false, reason: 'NO_CHANNEL_ID' }];
                    }
                    return [2, { ok: false, reason: 'CHANNEL_NOT_FOUND' }];
                case 9:
                    err_1 = _a.sent();
                    if (details) {
                        details.diagnostics = details.diagnostics || {};
                        details.diagnostics.msg = { error: String((err_1 === null || err_1 === void 0 ? void 0 : err_1.message) || err_1) };
                    }
                    return [2, { ok: false, reason: 'SEND_FAILED', error: err_1 }];
                case 10: return [2];
            }
        });
    });
}
function formatRankCardMessage(user, rank, config, settings) {
    var _a;
    var text = (config.content || '')
        .replace(/\$userId/g, user.id)
        .replace(/\$username/g, user.username || user.tag || '')
        .replace(/\$level/g, String(rank.level))
        .replace(/\$xp/g, String(rank.xp));
    return { text: text, level: rank.level, xp: rank.xp, roleId: ((_a = config.roleId) !== null && _a !== void 0 ? _a : null) };
}
function handleRankCard(user, rank, config, settings, client, opts) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var details, _a, _b, _c, msgCfg, delivery, channelId, attachment, payload, renderResult, sendResult, warnList, pathArr, _d;
        var _e;
        return tslib_1.__generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _a = opts === null || opts === void 0 ? void 0 : opts.silent;
                    if (_a === void 0) { _a = false; }
                    details = { diagnostics: { msg: {}, img: {} }, fired: false };
                    _c = (_b = opts === null || opts === void 0 ? void 0 : opts.force) !== null && _b !== void 0 ? _b : settings.rankCard.enabled;
                    if (!_c) return [3, 12];
                    _f.label = 1;
                case 1:
                    _f.trys.push([1, 10, , 11]);
                    details.fired = true;
                    renderResult = (0, imageRenderer_1.renderRankCardImage)(user, rank, settings.rankCard);
                    if (renderResult && !renderResult.ok) {
                        details.diagnostics.img = { error: (renderResult.error || 'RENDER_FAILED') };
                        return [2, { status: 'failed', fired: true, details: details, elapsedMs: 0 }];
                    }
                    attachment = {
                        attachment: String(renderResult === null || renderResult === void 0 ? void 0 : renderResult.path),
                        name: String(((_e = renderResult === null || renderResult === void 0 ? void 0 : renderResult.filename) !== null && _e !== void 0 ? _e : 'rank_card.png')),
                    };
                    msgCfg = config.message || {};
                    delivery = msgCfg.delivery || 'withMessage';
                    payload = { files: [attachment] };
                    if (delivery === 'channel' || delivery === 'beforeMessage') {
                        channelId = msgCfg.channelId || settings.rankCard.channelId;
                    }
                    if (!(delivery === 'long')) return [3, 3];
                    return [4, (renderResult === null || renderResult === void 0 ? void 0 : renderResult.path) ? assetStore_1.storeAsset(renderResult.path) : Promise.resolve(null)];
                case 2:
                    _f.sent();
                    _f.label = 3;
                case 3:
                    if (!(delivery === 'withMessage' || delivery === 'channel')) return [3, 7];
                    return [4, (0, assetStore_1.uploadAsset)(attachment.attachment, attachment.name, { useMessage: delivery === 'withMessage' })];
                case 4:
                    sendResult = _f.sent();
                    if (sendResult && !sendResult.ok) {
                        details.diagnostics.img = { error: (sendResult.error || 'UPLOAD_FAILED') };
                        return [2, { status: 'failed', fired: true, details: details, elapsedMs: 0 }];
                    }
                    if (!(delivery === 'channel')) return [3, 6];
                    return [4, resolveLevelUpChannel(channelId, settings, client)];
                case 5:
                    _f.sent();
                    _f.label = 6;
                case 6:
                    if (delivery === 'withMessage') {
                        details.diagnostics.img = { attached: true };
                        return [2, { status: 'done', fired: true, details: details, elapsedMs: 0 }];
                    }
                    _f.label = 7;
                case 7:
                    if (!(delivery === 'beforeMessage')) return [3, 9];
                    warnList = opts === null || opts === void 0 ? void 0 : opts.warnList;
                    pathArr = warnList && warnList.length ? warnList : ['CARD_NOT_FOUND'];
                    details.diagnostics.img = { skipped: pathArr };
                    return [2, { status: 'partial', fired: true, details: details, elapsedMs: 0 }];
                case 8:
                    return [2, { status: 'partial', fired: true, details: details, elapsedMs: 0 }];
                case 9:
                    return [2, { status: 'done', fired: true, details: details, elapsedMs: 0 }];
                case 10:
                    _d = _f.sent();
                    details.diagnostics.img = { error: String((_d === null || _d === void 0 ? void 0 : _d.message) || _d) };
                    return [2, { status: 'failed', fired: true, details: details, elapsedMs: 0 }];
                case 11: return [3, 13];
                case 12:
                    return [2, { status: 'disabled', fired: false, details: details, elapsedMs: 0 }];
                case 13: return [2];
            }
        });
    });
}
function handleLevelUp(user, gain, config, settings, client, opts) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var details, _a, _b, _c, msgCfg, delivery, channelRes, channel, content, result, _d, _e, _f, _g, rank;
        return tslib_1.__generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    _f = _h;
                    _a = opts === null || opts === void 0 ? void 0 : opts.silent;
                    if (_a === void 0) { _a = false; }
                    details = { diagnostics: { msg: {}, img: {} }, fired: false };
                    _c = (_b = opts === null || opts === void 0 ? void 0 : opts.force) !== null && _b !== void 0 ? _b : settings.levelUp.enabled;
                    if (!_c) return [3, 12];
                    _f.label = 1;
                case 1:
                    _f.trys.push([1, 10, , 11]);
                    details.fired = true;
                    msgCfg = config.message || {};
                    delivery = msgCfg.delivery || 'dm';
                    if (!(delivery === 'channel')) return [3, 4];
                    return [4, resolveLevelUpChannel(msgCfg.channelId, settings, client)];
                case 2:
                    channelRes = _f.sent();
                    if (!((channelRes === null || channelRes === void 0 ? void 0 : channelRes.ok) === false)) return [3, 3];
                    return [2, { status: 'failed', fired: true, details: details, elapsedMs: 0 }];
                case 3:
                    if (channelRes.channel && 'send' in channelRes.channel) {
                        channel = channelRes.channel;
                    }
                    _f.label = 4;
                case 4:
                    content = (msgCfg.content || '')
                        .replace(/\$userId/g, user.id)
                        .replace(/\$username/g, user.username || user.tag || '')
                        .replace(/\$level/g, String(gain === null || gain === void 0 ? void 0 : gain.newLevel))
                        .replace(/\$xp/g, String(gain === null || gain === void 0 ? void 0 : gain.totalXp));
                    if (!(delivery === 'channel')) return [3, 6];
                    if (!channel) {
                        return [2, { status: 'failed', fired: true, details: details, elapsedMs: 0 }];
                    }
                    return [4, channel.send({ content: content })];
                case 5:
                    _f.sent();
                    return [3, 9];
                case 6:
                    if (!(delivery === 'dm')) return [3, 8];
                    return [4, sendLevelUpMessage(user, config, settings, client, details)];
                case 7:
                    result = _f.sent();
                    if (result.ok) {
                        return [2, { status: 'done', fired: true, details: details, elapsedMs: 0 }];
                    }
                    return [2, { status: 'failed', fired: true, details: details, elapsedMs: 0 }];
                case 8:
                    return [2, { status: 'failed', fired: true, details: details, elapsedMs: 0 }];
                case 9:
                    return [2, { status: 'done', fired: true, details: details, elapsedMs: 0 }];
                case 10:
                    _g = _f.sent();
                    details.diagnostics.msg = { error: String((_g === null || _g === void 0 ? void 0 : _g.message) || _g) };
                    return [2, { status: 'failed', fired: true, details: details, elapsedMs: 0 }];
                case 11: return [3, 13];
                case 12:
                    return [2, { status: 'disabled', fired: false, details: details, elapsedMs: 0 }];
                case 13: return [2];
            }
        });
    });
}
exports.handleLevelUp = handleLevelUp;
exports.handleRankCard = handleRankCard;
exports.getLevelingLocale = getLevelingLocale;
exports.getLevelingSettings = getLevelingSettings;
exports.RESOLVE_REASONS = RESOLVE_REASONS;