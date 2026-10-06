"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleVoiceStateUpdate = void 0;
const discord_js_1 = require("discord.js");
const userChannels = new Map();
const handleVoiceStateUpdate = async (oldState, newState) => {
    const client = newState.client;
    const settings = client.settings;
    try {
        if (!settings.tempChannels?.enabled)
            return;
        if (!newState.guild)
            return;
        const guildLocale = settings.defaultLanguage || 'en';
        const locale = client.locales.get(guildLocale)?.tempChannels;
        if (!locale)
            return;
        if (newState.channelId === settings.tempChannels.parentChannelId) {
            await handleChannelCreation(newState, settings, locale);
        }
        if (oldState.channel && userChannels.has(oldState.channel.id)) {
            await handleChannelDeletion(oldState, settings, locale);
        }
    }
    catch (error) {
        console.error('Error handling temp channel:', error);
    }
};
exports.handleVoiceStateUpdate = handleVoiceStateUpdate;
const handleChannelCreation = async (state, settings, locale) => {
    try {
        if (!hasPermission(state.member, settings)) {
            await state.member?.send(locale.error.noPermission);
            await state.disconnect();
            return;
        }
        if (!settings.tempChannels.multipleAllowed && hasExistingChannel(state.member)) {
            await state.member?.send(locale.error.alreadyHasChannel);
            await state.disconnect();
            return;
        }
        const category = state.guild.channels.cache.get(settings.tempChannels.category);
        if (!category) {
            await state.member?.send(locale.error.categoryNotFound);
            await state.disconnect();
            return;
        }
        const channelName = settings.tempChannels.defaultName.replace('{user}', state.member.displayName);
        const channel = await state.guild.channels.create({
            name: channelName,
            type: discord_js_1.ChannelType.GuildVoice,
            parent: category,
            userLimit: settings.tempChannels.defaultUserLimit,
            permissionOverwrites: getChannelPermissions(state.member, settings)
        });
        await state.setChannel(channel);
        userChannels.set(channel.id, state.member.id);
        await state.member?.send(locale.success.created);
    }
    catch (error) {
        console.error('Error creating temp channel:', error);
        await state.member?.send(locale.error.createFailed);
        await state.disconnect();
    }
};
const handleChannelDeletion = async (state, settings, locale) => {
    if (!settings.tempChannels.deleteWhenEmpty)
        return;
    const channel = state.channel;
    if (channel.members.size === 0) {
        try {
            const owner = await state.guild.members.fetch(userChannels.get(channel.id));
            await owner.send(locale.success.emptied.replace('{time}', (settings.tempChannels.deleteDelay / 1000).toString()));
        }
        catch (error) {
            console.error('Failed to send deletion warning:', error);
        }
        setTimeout(async () => {
            try {
                if (channel.members.size === 0) {
                    await channel.delete();
                    userChannels.delete(channel.id);
                }
            }
            catch (error) {
                console.error('Failed to delete temp channel:', error);
            }
        }, settings.tempChannels.deleteDelay);
    }
};
const hasPermission = (member, settings) => {
    const { enabledRoleIds, disabledRoleIds } = settings.tempChannels.permissions;
    if (disabledRoleIds.some((id) => member.roles.cache.has(id)))
        return false;
    if (enabledRoleIds.length > 0) {
        return enabledRoleIds.some((id) => member.roles.cache.has(id));
    }
    return true;
};
const hasExistingChannel = (member) => {
    return Array.from(userChannels.values()).includes(member.id);
};
const getChannelPermissions = (member, settings) => {
    const getPermissionFlags = (perms) => {
        return perms.map(perm => discord_js_1.PermissionsBitField.Flags[perm]);
    };
    const fullPermissions = [
        discord_js_1.PermissionsBitField.Flags.ManageChannels,
        discord_js_1.PermissionsBitField.Flags.ManageRoles,
        discord_js_1.PermissionsBitField.Flags.MuteMembers,
        discord_js_1.PermissionsBitField.Flags.DeafenMembers,
        discord_js_1.PermissionsBitField.Flags.MoveMembers,
        discord_js_1.PermissionsBitField.Flags.PrioritySpeaker,
        discord_js_1.PermissionsBitField.Flags.Stream,
        discord_js_1.PermissionsBitField.Flags.Connect,
        discord_js_1.PermissionsBitField.Flags.Speak,
        discord_js_1.PermissionsBitField.Flags.UseVAD,
        discord_js_1.PermissionsBitField.Flags.ViewChannel
    ];
    const perms = [
        {
            id: member.id,
            allow: settings.tempChannels.fullPermissions
                ? fullPermissions
                : getPermissionFlags(settings.tempChannels.userPermissions.manage)
        },
        {
            id: member.guild.id,
            allow: [
                discord_js_1.PermissionsBitField.Flags.ViewChannel,
                discord_js_1.PermissionsBitField.Flags.Connect,
                discord_js_1.PermissionsBitField.Flags.Speak,
                discord_js_1.PermissionsBitField.Flags.Stream,
                discord_js_1.PermissionsBitField.Flags.UseVAD
            ]
        }
    ];
    return perms;
};
