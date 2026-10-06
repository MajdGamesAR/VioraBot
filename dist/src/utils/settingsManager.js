"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.persist = exports.setCache = exports.updateSettings = exports.getSettings = exports.getSettingsPath = exports.loadSettings = exports.SETTINGS_PATH = void 0;
const fs = require("fs");
const path = require("path");
const SETTINGS_PATH = path.join(process.cwd(), 'settings.json');
exports.SETTINGS_PATH = SETTINGS_PATH;
let cache = null;
let initialized = false;
function getSettingsPath() {
    return SETTINGS_PATH;
}
exports.getSettingsPath = getSettingsPath;
function loadSettings() {
    try {
        if (!fs.existsSync(SETTINGS_PATH)) {
            const defaultSettings = {
                defaultLanguage: 'en',
                commands: {},
                logs: {},
                protection: { enabled: true, modules: {} }
            };
            fs.writeFileSync(SETTINGS_PATH, JSON.stringify(defaultSettings, null, 4), 'utf8');
            cache = defaultSettings;
            console.log(`Created default settings file at ${SETTINGS_PATH}`);
        }
        else {
            cache = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
        }
        initialized = true;
        return cache;
    }
    catch (error) {
        console.error(`Error reading settings file: ${error}`);
        throw new Error('Failed to load settings.json file');
    }
}
exports.loadSettings = loadSettings;
function getSettings() {
    if (!initialized) {
        return loadSettings();
    }
    return cache;
}
exports.getSettings = getSettings;
function setCache(settings) {
    cache = settings;
    initialized = true;
    return cache;
}
exports.setCache = setCache;
function updateSettings(mutator) {
    const settings = getSettings();
    if (typeof mutator === 'function') {
        mutator(settings);
    }
    else if (mutator !== undefined && mutator !== null) {
        Object.assign(settings, mutator);
    }
    persist();
    return settings;
}
exports.updateSettings = updateSettings;
function persist() {
    if (!initialized) {
        loadSettings();
    }
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(cache, null, 4), 'utf8');
    return cache;
}
exports.persist = persist;