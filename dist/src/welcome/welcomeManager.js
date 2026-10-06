"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMemberLeave = exports.handleMemberJoin = exports.getWelcomeSettings = exports.getWelcomeLocale = exports.WELCOME_DEFAULTS = void 0;
const welcomeGoodbyeManager_1 = require("./welcomeGoodbyeManager");
exports.WELCOME_DEFAULTS = {
    enabled: false,
    channelId: '',
    message: '',
    language: 'en'
};
const getWelcomeLocale = (client, language) => {
    const lang = typeof language === 'string' && language.length > 0
        ? language
        : (client?.defaultLanguage || 'en');
    return client?.locales?.get(lang)?.welcome || client?.locales?.get('en')?.welcome || null;
};
exports.getWelcomeLocale = getWelcomeLocale;
const getWelcomeSettings = (client) => {
    const cfg = (0, welcomeGoodbyeManager_1.getWelcomeGoodbyeSettings)(client);
    return {
        enabled: cfg.enabled,
        channelId: cfg.welcome?.message?.channelId || '',
        message: cfg.welcome?.message?.content || '',
        language: client?.settings?.welcome?.language || 'en'
    };
};
exports.getWelcomeSettings = getWelcomeSettings;
const handleMemberJoin = async (member, options) => (0, welcomeGoodbyeManager_1.handleMemberJoin)(member, options);
exports.handleMemberJoin = handleMemberJoin;
const handleMemberLeave = async (member, options) => (0, welcomeGoodbyeManager_1.handleMemberLeave)(member, options);
exports.handleMemberLeave = handleMemberLeave;