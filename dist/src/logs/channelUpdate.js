"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = async (oldChannel, newChannel) => {
    if (!('guild' in oldChannel) || !('guild' in newChannel))
        return;
    const client = oldChannel.client;
    const settings = client.settings;
    if (!settings.logs?.enabled || !settings.logs.channelUpdate?.enabled)
        return;
    const logChannelId = settings.logs.channelUpdate.channelId;
    if (!logChannelId)
        return;
    const logChannel = client.channels.cache.get(logChannelId);
    if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
        return;
    const locale = client.locales.get(client.defaultLanguage)?.logs?.channelUpdate;
    if (!locale) {
        console.error(`Failed to find channel update locale data for ${client.defaultLanguage}`);
        return;
    }
    const changes = [];
    if (oldChannel.name !== newChannel.name) {
        changes.push({
            name: locale.name,
            oldValue: oldChannel.name,
            newValue: newChannel.name
        });
    }
    if ('parent' in oldChannel && 'parent' in newChannel &&
        oldChannel.parent?.id !== newChannel.parent?.id) {
        changes.push({
            name: locale.category,
            oldValue: oldChannel.parent?.name || locale.noCategory,
            newValue: newChannel.parent?.name || locale.noCategory
        });
    }
    if ('position' in oldChannel && 'position' in newChannel &&
        oldChannel.position !== newChannel.position) {
        changes.push({
            name: locale.position,
            oldValue: oldChannel.position.toString(),
            newValue: newChannel.position.toString()
        });
    }
    if (oldChannel.isTextBased() && newChannel.isTextBased() &&
        'nsfw' in oldChannel && 'nsfw' in newChannel &&
        oldChannel.nsfw !== newChannel.nsfw) {
        changes.push({
            name: locale.nsfw,
            oldValue: oldChannel.nsfw ? locale.yes : locale.no,
            newValue: newChannel.nsfw ? locale.yes : locale.no
        });
    }
    if ('permissionOverwrites' in oldChannel && 'permissionOverwrites' in newChannel) {
        const oldOverwrites = oldChannel.permissionOverwrites.cache;
        const newOverwrites = newChannel.permissionOverwrites.cache;
        newOverwrites.forEach((newOverwrite, id) => {
            const oldOverwrite = oldOverwrites.get(id);
            if (!oldOverwrite) {
                const target = newOverwrite.type === 0 ? `<@&${id}>` : `<@${id}>`;
                const allowPerms = new discord_js_1.PermissionsBitField(newOverwrite.allow).toArray();
                const denyPerms = new discord_js_1.PermissionsBitField(newOverwrite.deny).toArray();
                if (allowPerms.length > 0) {
                    changes.push({
                        name: `${locale.permissions} (${target})`,
                        oldValue: locale.noPermissions,
                        newValue: `✅ ${allowPerms.join(', ')}`
                    });
                }
                if (denyPerms.length > 0) {
                    changes.push({
                        name: `${locale.permissions} (${target})`,
                        oldValue: locale.noPermissions,
                        newValue: `❌ ${denyPerms.join(', ')}`
                    });
                }
            }
            else {
                if (!newOverwrite.allow.equals(oldOverwrite.allow) ||
                    !newOverwrite.deny.equals(oldOverwrite.deny)) {
                    const target = newOverwrite.type === 0 ? `<@&${id}>` : `<@${id}>`;
                    const oldAllowPerms = new discord_js_1.PermissionsBitField(oldOverwrite.allow).toArray();
                    const oldDenyPerms = new discord_js_1.PermissionsBitField(oldOverwrite.deny).toArray();
                    const newAllowPerms = new discord_js_1.PermissionsBitField(newOverwrite.allow).toArray();
                    const newDenyPerms = new discord_js_1.PermissionsBitField(newOverwrite.deny).toArray();
                    if (!newOverwrite.allow.equals(oldOverwrite.allow)) {
                        changes.push({
                            name: `${locale.permissions} ✅ (${target})`,
                            oldValue: oldAllowPerms.length > 0 ? oldAllowPerms.join(', ') : locale.noPermissions,
                            newValue: newAllowPerms.length > 0 ? newAllowPerms.join(', ') : locale.noPermissions
                        });
                    }
                    if (!newOverwrite.deny.equals(oldOverwrite.deny)) {
                        changes.push({
                            name: `${locale.permissions} ❌ (${target})`,
                            oldValue: oldDenyPerms.length > 0 ? oldDenyPerms.join(', ') : locale.noPermissions,
                            newValue: newDenyPerms.length > 0 ? newDenyPerms.join(', ') : locale.noPermissions
                        });
                    }
                }
            }
        });
        oldOverwrites.forEach((oldOverwrite, id) => {
            if (!newOverwrites.has(id)) {
                const target = oldOverwrite.type === 0 ? `<@&${id}>` : `<@${id}>`;
                const allowPerms = new discord_js_1.PermissionsBitField(oldOverwrite.allow).toArray();
                const denyPerms = new discord_js_1.PermissionsBitField(oldOverwrite.deny).toArray();
                if (allowPerms.length > 0 || denyPerms.length > 0) {
                    changes.push({
                        name: `${locale.permissions} (${target})`,
                        oldValue: `${allowPerms.length > 0 ? `✅ ${allowPerms.join(', ')}\n` : ''}${denyPerms.length > 0 ? `❌ ${denyPerms.join(', ')}` : ''}`,
                        newValue: locale.permissionsRemoved
                    });
                }
            }
        });
    }
    if (changes.length === 0)
        return;
    try {
        const auditLogs = await newChannel.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.ChannelUpdate,
            limit: 1,
        });
        const updateLog = auditLogs.entries.first();
        const executor = updateLog?.executor;
        const getChannelType = (type) => {
            switch (type) {
                case discord_js_1.ChannelType.GuildText: return locale.types.text;
                case discord_js_1.ChannelType.GuildVoice: return locale.types.voice;
                case discord_js_1.ChannelType.GuildCategory: return locale.types.category;
                case discord_js_1.ChannelType.GuildAnnouncement: return locale.types.news;
                case discord_js_1.ChannelType.GuildStageVoice: return locale.types.stage;
                case discord_js_1.ChannelType.GuildForum: return locale.types.forum;
                default: return locale.types.unknown;
            }
        };
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.channelUpdate.color)
            .addFields({
            name: `📝 ${locale.name}`,
            value: newChannel.name,
            inline: true
        }, {
            name: `👤 ${locale.updatedBy}`,
            value: executor ? `${executor.tag} (${executor.id})` : locale.unknown,
            inline: true
        }, {
            name: `📋 ${locale.type}`,
            value: getChannelType(newChannel.type),
            inline: true
        }, {
            name: `📋 ${locale.changes}`,
            value: changes.map(change => `**${change.name}**\n${locale.before}: \`${change.oldValue}\`\n${locale.after}: \`${change.newValue}\``).join('\n\n'),
            inline: false
        })
            .setFooter({ text: `${locale.channelId}: ${newChannel.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging channel update:', error);
    }
};
