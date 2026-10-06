"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAutoReply = void 0;
const discord_js_1 = require("discord.js");
const cooldowns = new Map();
const handleAutoReply = async (message) => {
    const client = message.client;
    const settings = client.settings.autoReply;
    try {
        if (!settings?.enabled)
            return;
        if (!message.guild || message.author.bot)
            return;
        if (!('send' in message.channel))
            return;
        const channelId = message.channel.id;
        if (settings.channels.enabled.length > 0 && !settings.channels.enabled.includes(channelId)) {
            return;
        }
        if (settings.channels.disabled.includes(channelId)) {
            return;
        }
        if (settings.roles.enabled.length > 0 &&
            !message.member?.roles.cache.some(role => settings.roles.enabled.includes(role.id)))
            return;
        if (message.member?.roles.cache.some(role => settings.roles.disabled.includes(role.id)))
            return;
        const now = Date.now();
        const userCooldowns = cooldowns.get(message.author.id) || {};
        for (const [sectionName, section] of Object.entries(settings.sections)) {
            if (!section.enabled)
                continue;
            if (userCooldowns[sectionName] &&
                now - userCooldowns[sectionName] < settings.cooldown)
                continue;
            const matches = section.triggers.some((trigger) => {
                const content = settings.caseSensitive ?
                    message.content : message.content.toLowerCase();
                const triggerText = settings.caseSensitive ?
                    trigger : trigger.toLowerCase();
                switch (settings.matchType) {
                    case 'exact':
                        return content === triggerText;
                    case 'startsWith':
                        return content.startsWith(triggerText);
                    case 'endsWith':
                        return content.endsWith(triggerText);
                    case 'regex':
                        try {
                            return new RegExp(triggerText).test(content);
                        }
                        catch {
                            return false;
                        }
                    case 'includes':
                    default:
                        return content.includes(triggerText);
                }
            });
            if (!matches)
                continue;
            if (Math.random() * 100 > settings.chance)
                continue;
            const response = section.responses[Math.floor(Math.random() * section.responses.length)];
            if (message.channel instanceof discord_js_1.TextChannel ||
                message.channel instanceof discord_js_1.ThreadChannel ||
                message.channel instanceof discord_js_1.NewsChannel) {
                const replyOptions = { content: response };
                if (settings.replyToMessage) {
                    replyOptions.reply = { messageReference: message.id };
                }
                else if (settings.mentionUser) {
                    replyOptions.content = `${message.author} ${response}`;
                }
                await message.channel.send(replyOptions);
                userCooldowns[sectionName] = now;
                cooldowns.set(message.author.id, userCooldowns);
                break;
            }
        }
    }
    catch (error) {
        console.error('Error handling auto reply:', error);
    }
};
exports.handleAutoReply = handleAutoReply;
