"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsWatcher = void 0;
const fs_1 = require("fs");
const settingsManager_1 = require("./settingsManager");
class SettingsWatcher {
    constructor(client) {
        this.client = client;
        this.settingsPath = settingsManager_1.getSettingsPath();
        this.lastContent = (0, fs_1.readFileSync)(this.settingsPath, 'utf8');
        this.updateSettings(this.lastContent);
    }
    updateSettings(content) {
        try {
            const newSettings = JSON.parse(content);
            settingsManager_1.setCache(newSettings);
            this.client.settings = newSettings;
            if (newSettings.defaultLanguage !== this.client.defaultLanguage) {
                this.client.defaultLanguage = newSettings.defaultLanguage;
            }
            for (const [commandName, command] of this.client.commands) {
                if (command.command) {
                    command.command.enabled = newSettings.commands?.[commandName]?.enabled ?? true;
                }
            }
            if (typeof this.client.refreshAliases === 'function') {
                this.client.refreshAliases(newSettings);
            }
            console.log('Settings reloaded successfully');
        }
        catch (error) {
            console.error('Error updating settings:', error);
        }
    }
    start() {
        (0, fs_1.watchFile)(this.settingsPath, { interval: 1000 }, () => {
            try {
                const currentContent = (0, fs_1.readFileSync)(this.settingsPath, 'utf8');
                if (currentContent !== this.lastContent) {
                    this.updateSettings(currentContent);
                    this.lastContent = currentContent;
                }
            }
            catch (error) {
                console.error('Error in settings watcher:', error);
            }
        });
    }
    stop() {
        try {
            const { unwatchFile } = require('fs');
            unwatchFile(this.settingsPath);
        }
        catch (error) {
            console.error('Error stopping settings watcher:', error);
        }
    }
}
exports.SettingsWatcher = SettingsWatcher;
