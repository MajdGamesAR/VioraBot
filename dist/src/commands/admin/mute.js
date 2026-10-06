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
    return (0, permissionChecker_1.checkCommandPermissions)(member, settingsManager_1.getSettings().commands?.mute, discord_js_1.PermissionFlagsBits.ManageRoles);
};
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mutes a member')
    .addUserOption(option => option
    .setName('user')
    .setDescription('The member to mute')
    .setRequired(true))
    .addStringOption(option => option
    .setName('reason')
    .setDescription('The reason for the mute')
    .setRequired(false));
async function ensureMuteRole(guild) {
    let muteRole = guild.roles.cache.find((role) => role.name === 'Muted');
    if (!muteRole) {
        try {
            muteRole = await guild.roles.create({
                name: 'Muted',
                color: '#808080',
                reason: 'Creating muted role for mute command',
                permissions: []
            });
            guild.channels.cache.forEach(async (channel) => {
                if (channel.type === discord_js_1.ChannelType.GuildText || channel.type === discord_js_1.ChannelType.GuildVoice) {
                    await channel.permissionOverwrites.create(muteRole, {
                        SendMessages: false,
                        AddReactions: false,
                        Speak: false,
                        Stream: false
                    });
                }
            });
        }
        catch (error) {
            console.error('Error creating mute role:', error);
            return null;
        }
    }
    return muteRole;
}
exports.command = {
    name: 'mute',
    enabled: true,
    aliases: ['mute', 'silence'],
    async execute(interaction, args, client) {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.mute.noPermission,
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
                    await interaction.reply(locale.commands.mute.invalidFormat);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                reason = args.slice(1).join(' ') || null;
                targetMember = await guild?.members.fetch(targetId).catch(() => null);
            }
            if (!targetMember) {
                const reply = { content: locale.commands.mute.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetMember.id === executingMember.id) {
                const reply = { content: locale.commands.mute.cantMuteSelf, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetMember.id === guild?.ownerId) {
                const reply = { content: locale.commands.mute.cantMuteOwner, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetMember.roles.highest.position >= executingMember.roles.highest.position) {
                const reply = { content: locale.commands.mute.cantMuteHigher, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const muteRole = await ensureMuteRole(guild);
            if (!muteRole) {
                const reply = { content: locale.commands.mute.roleCreationError, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            if (targetMember.roles.cache.has(muteRole.id)) {
                const reply = { content: locale.commands.mute.alreadyMuted, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const result = await (0, moderationService_1.mute)({
                client,
                guild,
                member: executingMember,
                target: targetMember,
                options: {
                    botPermission: discord_js_1.PermissionFlagsBits.ManageRoles,
                    checkUserHierarchy: true
                }
            }, { roleId: muteRole.id, reason: formattedReason });
            if (!result.ok) {
                const reply = { content: locale.commands.mute.commandError, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.mute.title)
                .setDescription(locale.commands.mute.description)
                .setColor(0xff0000)
                .addFields({
                name: `👤 ${locale.commands.mute.target}`,
                value: targetMember.toString(),
                inline: true
            }, {
                name: `🔨 ${locale.commands.mute.action}`,
                value: locale.commands.mute.mutedBy.replace('{user}', executingMember.user.tag),
                inline: true
            }, {
                name: `📝 ${locale.commands.mute.reason}`,
                value: reason || locale.commands.mute.noReason,
                inline: false
            })
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setFooter({
                text: locale.commands.mute.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
            })
                .setTimestamp();
            if (isSlash) {
                await interaction.reply({ embeds: [embed] });
            }
            else {
                await interaction.reply({ embeds: [embed] });
            }
        }
        catch (error) {
            console.error('Error executing mute command:', error);
            const errorMessage = {
                content: locale.commands.mute.commandError,
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
    if (!locale?.commands?.mute) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.mute) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.mute) {
        locale = {
            commands: {
                mute: {
                    title: "Member Muted",
                    description: "A member has been muted",
                    success: "Successfully muted member",
                    error: "Failed to mute member",
                    noPermission: "You do not have permission to use this command.",
                    userNoPermission: "You do not have permission to mute this user.",
                    botNoPermission: "I do not have permission to mute users.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    cantMuteSelf: "You cannot mute yourself.",
                    cantMuteOwner: "You cannot mute the server owner.",
                    cantMuteHigher: "You cannot mute a member with a higher role.",
                    alreadyMuted: "This user is already muted.",
                    roleCreationError: "Failed to create or find mute role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    mutedBy: "Muted by {user}",
                    target: "User",
                    action: "Action",
                    invalidFormat: "Invalid format. Use: !mute @user [reason]"
                }
            }
        };
    }
    return locale;
};
