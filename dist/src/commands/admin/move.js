"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = exports.data = void 0;
const discord_js_1 = require("discord.js");
const settingsManager_1 = require("../../utils/settingsManager");
const permissionChecker_1 = require("../../utils/permissionChecker");
const moderationService_1 = require("../../moderation/moderationService");
const checkPermissions = (member) => {
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.move, discord_js_1.PermissionFlagsBits.MoveMembers);
};
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('move')
    .setDescription('Moves a member to your voice channel')
    .addUserOption(option => option
    .setName('user')
    .setDescription('The member to move')
    .setRequired(true))
    .addStringOption(option => option
    .setName('reason')
    .setDescription('The reason for moving')
    .setRequired(false));
exports.command = {
    name: 'move',
    enabled: true,
    aliases: ['move', 'moveto', 'vcmove'],
    async execute(interaction, args, client) {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.move.noPermission,
                    flags: 1 << 6
                };
                if (isSlash) {
                    await interaction.reply(noPermissionMessage);
                }
                else {
                    await interaction.reply(noPermissionMessage.content);
                }
                return;
            }
            if (!executingMember.voice?.channelId) {
                const reply = { content: locale.commands.move.notInVoice, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (!guild?.members.me?.permissions.has(discord_js_1.PermissionFlagsBits.MoveMembers)) {
                const reply = { content: locale.commands.move.botNoPermission, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            let targetMember;
            let reason = null;
            if (isSlash) {
                const targetUser = interaction.options.getUser('user');
                reason = interaction.options.getString('reason');
                targetMember = targetUser
                    ? await guild?.members.fetch(targetUser.id).catch(() => null)
                    : null;
            }
            else {
                if (args.length < 1) {
                    await interaction.reply(locale.commands.move.invalidFormat);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                reason = args.slice(1).join(' ') || null;
                targetMember = await guild?.members.fetch(targetId).catch(() => null);
            }
            if (!targetMember) {
                const reply = { content: locale.commands.move.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const targetVoiceState = targetMember.voice;
            if (!targetVoiceState.channelId) {
                const reply = { content: locale.commands.move.targetNotInVoice, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetVoiceState.channelId === executingMember.voice.channelId) {
                const reply = { content: locale.commands.move.alreadyInChannel, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetMember.roles.highest.position >= executingMember.roles.highest.position &&
                !executingMember.permissions.has(discord_js_1.PermissionFlagsBits.Administrator)) {
                const reply = { content: locale.commands.move.cantMoveHigher, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.move.noReason}`;
            const oldChannel = targetVoiceState.channel;
            try {
                const result = await (0, moderationService_1.moveMember)({
                    client,
                    guild,
                    member: executingMember,
                    target: targetMember,
                    options: {
                        botPermission: discord_js_1.PermissionFlagsBits.MoveMembers,
                        checkUserHierarchy: true
                    }
                }, { channelId: executingMember.voice.channel.id, reason: formattedReason });
                if (!result.ok) {
                    const reply = { content: locale.commands.move.error, flags: 1 << 6 };
                    if (isSlash) {
                        if (!interaction.replied) {
                            await interaction.reply(reply);
                        }
                        else {
                            await interaction.followUp(reply);
                        }
                    }
                    else {
                        await interaction.reply(reply.content);
                    }
                    return;
                }
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(locale.commands.move.title)
                    .setDescription(locale.commands.move.description)
                    .setColor(0x00ff00)
                    .addFields({
                    name: `👤 ${locale.commands.move.target}`,
                    value: targetMember.toString(),
                    inline: true
                }, {
                    name: `🔊 ${locale.commands.move.from}`,
                    value: oldChannel?.name || 'Unknown',
                    inline: true
                }, {
                    name: `📍 ${locale.commands.move.to}`,
                    value: executingMember.voice.channel.name,
                    inline: true
                }, {
                    name: `📝 ${locale.commands.move.reason}`,
                    value: reason || locale.commands.move.noReason,
                    inline: false
                })
                    .setThumbnail(targetMember.user.displayAvatarURL())
                    .setFooter({
                    text: locale.commands.move.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
                })
                    .setTimestamp();
                if (isSlash) {
                    await interaction.reply({ embeds: [embed] });
                }
                else {
                    await interaction.reply({ embeds: [embed] });
                }
            }
            catch (moveError) {
                console.error('Error moving member:', moveError);
                const reply = { content: locale.commands.move.error, flags: 1 << 6 };
                if (isSlash) {
                    const slashInteraction = interaction;
                    if (!slashInteraction.replied) {
                        await slashInteraction.reply(reply);
                    }
                    else {
                        await slashInteraction.followUp(reply);
                    }
                }
                else {
                    await interaction.reply(reply.content);
                }
            }
        }
        catch (error) {
            console.error('Error executing move command:', error);
            const errorMessage = {
                content: locale.commands.move.commandError,
                flags: 1 << 6
            };
            if (interaction instanceof discord_js_1.ChatInputCommandInteraction) {
                if (!interaction.replied) {
                    await interaction.reply(errorMessage);
                }
                else {
                    await interaction.followUp(errorMessage);
                }
            }
            else {
                await interaction.reply(errorMessage.content);
            }
        }
    }
};
const getLocale = (client, preferredLocale) => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    if (!locale?.commands?.move) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.move) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.move) {
        locale = {
            commands: {
                move: {
                    title: "Member Moved",
                    description: "A member has been moved to a different voice channel",
                    success: "Successfully moved member",
                    error: "Failed to move member",
                    noPermission: "You do not have permission to use this command.",
                    userNoPermission: "You do not have permission to move this user.",
                    botNoPermission: "I do not have permission to move users.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    notInVoice: "You must be in a voice channel to use this command.",
                    targetNotInVoice: "This user is not in a voice channel.",
                    alreadyInChannel: "This user is already in your voice channel.",
                    cantMoveHigher: "You cannot move a member with a higher role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    movedBy: "Moved by {user}",
                    target: "User",
                    from: "From Channel",
                    to: "To Channel",
                    invalidFormat: "Invalid format. Use: !move @user [reason]"
                }
            }
        };
    }
    return locale;
};
