"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const settingsManager_1 = require("./src/utils/settingsManager");
if (typeof process.loadEnvFile === 'function') {
    try {
        process.loadEnvFile(path_1.join(__dirname, '..', '.env'));
    }
    catch (_a) {
        // .env file is optional; environment variables may be set by the process.
    }
}
const getEnv = (name) => {
    const v = process.env[name];
    return v && v.trim() ? v.trim() : '';
};
const REQUIRED_ENV = ['BOT_TOKEN', 'CLIENT_ID', 'MONGO_URI', 'SESSION_SECRET', 'CALLBACK_URL'];
const missing = REQUIRED_ENV.filter(name => !getEnv(name));
if (missing.length > 0) {
    const message = `Missing required environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`;
    throw new Error(message);
}
const config = {
    token: getEnv('BOT_TOKEN'),
    clientId: getEnv('CLIENT_ID'),
    mongoUri: getEnv('MONGO_URI'),
    defaultPrefix: getEnv('DEFAULT_PREFIX') || '-',
    mainGuildId: getEnv('MAIN_GUILD_ID'),
    defaultLanguage: getEnv('DEFAULT_LANGUAGE') || 'en',
    dashboard: {
        port: parseInt(getEnv('DASHBOARD_PORT'), 10) || 3000,
        secret: getEnv('SESSION_SECRET'),
        callbackUrl: getEnv('CALLBACK_URL'),
        oauth: {
            clientId: getEnv('DASHBOARD_CLIENT_ID') || getEnv('CLIENT_ID'),
            clientSecret: getEnv('DASHBOARD_CLIENT_SECRET'),
            scopes: ['identify', 'guilds']
        },
        ownerIds: []
    }
};
const settings = settingsManager_1.getSettings();
exports.default = {
    ...config,
    ...settings,
    token: config.token,
    clientId: config.clientId,
    mongoUri: config.mongoUri,
    defaultPrefix: config.defaultPrefix,
    mainGuildId: config.mainGuildId,
    dashboard: config.dashboard
};