"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketManager = void 0;
const discord_js_1 = require("discord.js");
const Ticket_1 = require("../models/Ticket");
const emoji_js_1 = require("../utils/emoji");
const transcriptGenerator_1 = require("./transcriptGenerator");
const pendingDeletes = new Map();
class TicketManager {
    constructor(client) {
        this.client = client;
    }
    getLocale() {
        return this.client.locales.get(this.client.settings.defaultLanguage)?.ticket;
    }
    hasStaffPermission(member, section) {
        if (!member || !section) {
            return false;
        }
        if (member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator)) {
            return true;
        }
        return Array.isArray(section.adminRoles) &&
            section.adminRoles.some((roleId) => member.roles.cache.has(roleId));
    }
    async setupSystem(channel) {
        try {
            const settings = this.client.settings.ticket;
            const locale = this.getLocale();
            if (!settings.enabled) {
                throw new Error(locale?.messages?.disabled || 'Ticket system is disabled');
            }
            const embed = this.createSetupEmbed();
            const components = this.createTicketComponents();
            const buttonCount = components.reduce((total, row) => total + (row.components ? row.components.length : 0), 0);
            console.log(`[ticket-panel] send components=${components.length} buttons=${buttonCount} customId=${buttonCount > 0 ? 'YES' : 'NO'}`);
            await channel.send({
                embeds: [embed],
                components
            });
        }
        catch (error) {
            console.error('Error setting up ticket system:', error);
            throw error;
        }
    }
    createSetupEmbed() {
        const settings = this.client.settings.ticket;
        const locale = this.getLocale();
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale?.embeds?.setup?.title || 'Ticket System')
            .setDescription(locale?.embeds?.setup?.description || 'Click below to create a ticket')
            .setColor(settings.embed.color)
            .setTimestamp();
        if (settings.embed.thumbnail) {
            const thumbnail = settings.embed.thumbnail === '' ? null : settings.embed.thumbnail;
            embed.setThumbnail(thumbnail);
        }
        if (settings.embed.image) {
            const image = settings.embed.image === '' ? null : settings.embed.image;
            embed.setImage(image);
        }
        if (settings.embed.footer) {
            const footerIcon = settings.embed.footerIcon === '' ? null : settings.embed.footerIcon;
            embed.setFooter({
                text: settings.embed.footer,
                iconURL: footerIcon
            });
        }
        return embed;
    }
    createTicketComponents() {
        const settings = this.client.settings.ticket;
        const rows = [];
        let currentRow = new discord_js_1.ActionRowBuilder();
        let buttonCount = 0;
        const rowLimit = 5;
        settings.sections
            .filter((section) => section.enabled)
            .forEach((section) => {
            if (buttonCount >= rowLimit) {
                rows.push(currentRow);
                currentRow = new discord_js_1.ActionRowBuilder();
                buttonCount = 0;
            }
            const button = new discord_js_1.ButtonBuilder()
                .setCustomId(`ticket_create_${section.name.toLowerCase().replace(/\s+/g, '_')}`)
                .setLabel(section.name)
                .setStyle(discord_js_1.ButtonStyle.Primary);
            const emoji = (0, emoji_js_1.sanitizeEmoji)(section.emoji);
            if (emoji) {
                button.setEmoji(emoji);
            }
            currentRow.addComponents(button);
            buttonCount++;
        });
        if (buttonCount > 0) {
            rows.push(currentRow);
        }
        if (rows.length === 0) {
            const locale = this.getLocale();
            rows.push(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId('ticket_create')
                .setLabel(locale?.buttons?.create || 'Create Ticket')
                .setStyle(discord_js_1.ButtonStyle.Primary)));
        }
        return rows;
    }
    async handleInteraction(interaction) {
        const locale = this.getLocale();
        try {
            const settings = this.client.settings.ticket;
            if (!interaction.isButton()) {
                return;
            }
            let section;
            if (interaction.customId === 'ticket_create') {
                section = (settings.sections || []).find((s) => s.name && s.enabled);
            }
            else {
                const sectionName = interaction.customId.replace('ticket_create_', '');
                section = (settings.sections || []).find((s) => s.name.toLowerCase().replace(/\s+/g, '_') === sectionName);
            }
            if (!section || !section.enabled) {
                await interaction.reply({
                    content: interaction.customId === 'ticket_create'
                        ? (locale?.messages?.notConfigured || '❌ The ticket system is not configured yet. Please contact an administrator.')
                        : (locale?.messages?.invalidSection || '❌ Invalid ticket section'),
                    ephemeral: true
                });
                return;
            }
            const existingTickets = await Ticket_1.Ticket.find({
                guildId: interaction.guildId,
                userId: interaction.user.id,
                status: { $in: ['open', 'claimed'] }
            });
            if (existingTickets.length > 0) {
                await interaction.reply({
                    content: locale?.messages?.existingTicket || '❌ You already have an open ticket',
                    ephemeral: true
                });
                return;
            }
            const category = await interaction.guild?.channels.fetch(section.categoryId);
            if (!category || category.type !== discord_js_1.ChannelType.GuildCategory) {
                throw new Error('Invalid category');
            }
            const channelName = `ticket-${interaction.user.username.toLowerCase()}`;
            const ticketChannel = await interaction.guild?.channels.create({
                name: channelName,
                type: discord_js_1.ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: ['ViewChannel']
                    },
                    {
                        id: interaction.user.id,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                    },
                    {
                        id: this.client.user.id,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels']
                    },
                    ...section.adminRoles.map((roleId) => ({
                        id: roleId,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                    }))
                ]
            });
            if (!ticketChannel) {
                throw new Error('Failed to create ticket channel');
            }
            const ticket = await Ticket_1.Ticket.create({
                guildId: interaction.guildId,
                channelId: ticketChannel.id,
                userId: interaction.user.id,
section: section.name,
        category: section.categoryId,
        tags: section.tags || [],
        status: 'open'
    });
            const embed = this.createTicketEmbed(ticket, interaction.member);
            const buttons = this.buildControlButtons(ticket);
            await ticketChannel.send({
                content: `<@${interaction.user.id}> ${locale?.messages?.welcome || 'Welcome to your ticket!'}`,
                embeds: [embed],
                components: [buttons]
            });
            await interaction.reply({
                content: locale?.messages?.created?.replace('{channel}', `<#${ticketChannel.id}>`) ||
                    `✅ Ticket created: <#${ticketChannel.id}>`,
                ephemeral: true
            });
        }
        catch (error) {
            console.error('Error creating ticket:', error);
            await interaction.reply({
                content: locale?.messages?.error?.create || '❌ An error occurred while creating your ticket.',
                ephemeral: true
            });
        }
    }
    buildControlButtons(ticket) {
        const locale = this.getLocale();
        return new discord_js_1.ActionRowBuilder()
            .addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`ticket_claim_${ticket.id}`)
            .setLabel(locale?.buttons?.claim || 'Claim')
            .setStyle(discord_js_1.ButtonStyle.Primary)
            .setEmoji('👋'), new discord_js_1.ButtonBuilder()
            .setCustomId(`ticket_close_${ticket.id}`)
            .setLabel(locale?.buttons?.close || 'Close')
            .setStyle(discord_js_1.ButtonStyle.Danger)
            .setEmoji('🔒'), new discord_js_1.ButtonBuilder()
            .setCustomId(`ticket_reopen_${ticket.id}`)
            .setLabel(locale?.buttons?.reopen || 'Reopen')
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setEmoji('🔓'), new discord_js_1.ButtonBuilder()
            .setCustomId(`ticket_delete_${ticket.id}`)
            .setLabel(locale?.buttons?.delete || 'Delete')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('🗑️'));
    }
    createTicketEmbed(ticket, member) {
        const settings = this.client.settings.ticket;
        const locale = this.getLocale();
        const section = settings.sections.find((s) => s.name === ticket.section);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(settings.embed.color)
            .setAuthor({
            name: member.user.tag,
            iconURL: member.user.displayAvatarURL()
        })
            .addFields([
            {
                name: locale?.embeds?.ticket?.user || '👤 User',
                value: `<@${member.id}>`,
                inline: true
            },
            {
                name: locale?.embeds?.ticket?.created || '📅 Created',
                value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                inline: true
            },
            {
                name: locale?.embeds?.ticket?.section || '🏷️ Section',
                value: `${section?.emoji} ${section?.name}`,
                inline: true
            }
        ])
            .setTimestamp();
        if (ticket.status === 'claimed' && ticket.claimedBy) {
            embed.addFields({
                name: locale?.embeds?.ticket?.claimedBy || 'Claimed By',
                value: `<@${ticket.claimedBy}>`,
                inline: true
            });
        }
        if (ticket.status === 'closed' && ticket.closedReason) {
            embed.addFields({
                name: locale?.embeds?.ticket?.status || 'Status',
                value: `🔒 Closed — ${ticket.closedReason}`,
                inline: false
            });
        }
        if (section.imageUrl) {
            const imageUrl = section.imageUrl === '' ? null : section.imageUrl;
            embed.setImage(imageUrl);
        }
        if (settings.embed.thumbnail) {
            const thumbnail = settings.embed.thumbnail === '' ? null : settings.embed.thumbnail;
            embed.setThumbnail(thumbnail);
        }
        if (settings.embed.footer) {
            const footerIcon = settings.embed.footerIcon === '' ? null : settings.embed.footerIcon;
            embed.setFooter({
                text: settings.embed.footer,
                iconURL: footerIcon
            });
        }
        return embed;
    }
    async handleClaim(interaction) {
        try {
            const ticketId = interaction.customId.replace('ticket_claim_', '');
            const ticket = await Ticket_1.Ticket.findById(ticketId);
            const locale = this.getLocale();
            if (!ticket || ticket.status !== 'open') {
                await interaction.reply({
                    content: locale?.messages?.invalidTicket || '❌ Invalid ticket',
                    ephemeral: true
                });
                return;
            }
            const section = this.client.settings.ticket.sections.find((s) => s.name === ticket.section);
            if (!section) {
                await interaction.reply({
                    content: locale?.messages?.invalidSection || '❌ Invalid ticket section',
                    ephemeral: true
                });
                return;
            }
            const member = interaction.member;
            const hasPermission = this.hasStaffPermission(member, section);
            if (!hasPermission) {
                await interaction.reply({
                    content: locale?.messages?.noPermission || '❌ You do not have permission to claim this ticket',
                    ephemeral: true
                });
                return;
            }
            const assignment = this.client.settings.ticket.assignment || { mode: 'manual', staffRoleIds: [] };
            let assigneeId = interaction.user.id;
            if (assignment.mode === 'auto' && assignment.staffRoleIds && assignment.staffRoleIds.length > 0) {
                try {
                    const staffMembers = (await interaction.guild.members.fetch()).filter((m) => !m.user.bot && m.roles.cache.some((r) => assignment.staffRoleIds.includes(r.id)));
                    if (staffMembers.size > 0) {
                        const workloads = await Promise.all(
                            staffMembers.map(async (m) => ({
                                member: m,
                                count: await Ticket_1.Ticket.countDocuments({ claimedBy: m.id })
                            }))
                        );
                        const leastLoaded = workloads.sort((a, b) => a.count - b.count)[0];
                        assigneeId = leastLoaded.member.id;
                    }
                }
                catch (error) {
                    console.error('Error in auto-assignment:', error);
                }
            }
            ticket.status = 'claimed';
            ticket.claimedBy = assigneeId;
            ticket.claimedAt = new Date();
            await ticket.save();
            const embed = this.createTicketEmbed(ticket, member);
            await interaction.message.edit({
                embeds: [embed],
                components: [this.buildControlButtons(ticket)]
            });
            await interaction.reply({
                content: locale?.messages?.claimed?.replace('{user}', `<@${assigneeId}>`) ||
                    `✅ Ticket claimed by <@${assigneeId}>`,
            });
        }
        catch (error) {
            console.error('Error claiming ticket:', error);
            await interaction.reply({
                content: '❌ An error occurred while claiming the ticket.',
                ephemeral: true
            });
        }
    }
    async showCloseModal(interaction) {
        const ticketId = interaction.customId.replace('ticket_close_', '');
        const ticket = await Ticket_1.Ticket.findById(ticketId);
        const locale = this.getLocale();
        if (!ticket || ticket.status === 'closed') {
            await interaction.reply({
                content: locale?.messages?.invalidTicket || '❌ Invalid ticket',
                ephemeral: true
            });
            return;
        }
        const section = this.client.settings.ticket.sections.find((s) => s.name === ticket.section);
        const member = interaction.member;
        const hasPermission = (section && this.hasStaffPermission(member, section)) || ticket.userId === member.id;
        if (!hasPermission) {
            await interaction.reply({
                content: locale?.messages?.ownerOnly || locale?.messages?.noPermission || '❌ You do not have permission',
                ephemeral: true
            });
            return;
        }
        const modal = new discord_js_1.ModalBuilder()
            .setCustomId(`ticket_close_modal_${ticketId}`)
            .setTitle(locale?.messages?.closedModalTitle || 'Close Ticket')
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
            .setCustomId('ticket_close_reason')
            .setLabel(locale?.messages?.closeReasonLabel || 'Reason for closing')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setPlaceholder(locale?.messages?.closeReasonPlaceholder || 'Provide a reason')
            .setMaxLength(500)
            .setRequired(true)));
        await interaction.showModal(modal);
    }
    async finalizeClose(interaction, reason) {
        const ticketId = interaction.customId.replace('ticket_close_modal_', '');
        const ticket = await Ticket_1.Ticket.findById(ticketId);
        const locale = this.getLocale();
        try {
            if (!ticket || ticket.status === 'closed') {
                await interaction.reply({
                    content: locale?.messages?.invalidTicket || '❌ Invalid ticket',
                    ephemeral: true
                });
                return;
            }
            const section = this.client.settings.ticket.sections.find((s) => s.name === ticket.section);
            if (!section) {
                throw new Error('Invalid ticket section');
            }
            const member = interaction.member;
            const hasPermission = this.hasStaffPermission(member, section) || ticket.userId === member.id;
            if (!hasPermission) {
                await interaction.reply({
                    content: locale?.messages?.ownerOnly || '❌ You do not have permission',
                    ephemeral: true
                });
                return;
            }
            const channel = await interaction.guild?.channels.fetch(ticket.channelId);
            if (!channel) {
                throw new Error('Ticket channel not found');
            }
            await interaction.deferReply();
            const transcript = await (0, transcriptGenerator_1.createTranscript)(channel);
            const logChannel = await interaction.guild?.channels.fetch(section.logChannelId);
            if (logChannel) {
                const logEmbed = new discord_js_1.EmbedBuilder()
                    .setTitle(locale?.embeds?.log?.title || 'Ticket Closed')
                    .setColor(this.client.settings.ticket.embed.color)
                    .addFields([
                    {
                        name: locale?.embeds?.log?.ticket || 'Ticket',
                        value: `#${channel.name}`,
                        inline: true
                    },
                    {
                        name: locale?.embeds?.log?.user || 'User',
                        value: `<@${ticket.userId}>`,
                        inline: true
                    },
                    {
                        name: locale?.embeds?.log?.section || 'Section',
                        value: section.name,
                        inline: true
                    },
                    {
                        name: locale?.embeds?.log?.closedBy || 'Closed By',
                        value: `<@${interaction.user.id}>`,
                        inline: true
                    },
                    {
                        name: locale?.embeds?.log?.createdAt || 'Created At',
                        value: `<t:${Math.floor((ticket.createdAt || Date.now()).getTime() / 1000)}:F>`,
                        inline: true
                    },
{
                name: locale?.embeds?.ticket?.section || '📁 Section',
                value: `${ticket.section}`,
                inline: true
            },
            {
                name: locale?.embeds?.ticket?.category || '📂 Category',
                value: ticket.category ? `<#${ticket.category}>` : '—',
                inline: true
            },
            {
                name: locale?.embeds?.ticket?.tags || '🏷️ Tags',
                value: ticket.tags?.length ? ticket.tags.join(', ') : '—',
                inline: true
            }
        ]);
                if (reason) {
                    logEmbed.addFields({
                        name: locale?.embeds?.log?.closedReason || 'Reason',
                        value: reason,
                        inline: false
                    });
                }
                if (ticket.claimedBy) {
                    logEmbed.addFields({
                        name: locale?.embeds?.log?.claimedBy || 'Claimed By',
                        value: `<@${ticket.claimedBy}>`,
                        inline: true
                    });
                }
                await logChannel.send({
                    embeds: [logEmbed],
                    files: [transcript]
                });
            }
            ticket.status = 'closed';
            ticket.closedBy = interaction.user.id;
            ticket.closedAt = new Date();
            ticket.closedReason = reason || null;
            await ticket.save();
            const controlButtons = this.buildControlButtons(ticket);
            const closeEmbed = new discord_js_1.EmbedBuilder()
                .setDescription(locale?.messages?.closing || '🔒 This ticket will be closed in 5 seconds...')
                .setColor(this.client.settings.ticket.embed.color);
            if (reason) {
                closeEmbed.addFields({
                    name: locale?.embeds?.log?.closedReason || 'Reason',
                    value: reason,
                    inline: false
                });
            }
            await interaction.editReply({
                embeds: [closeEmbed],
                components: [controlButtons]
            });
            const ticketIdKey = ticket.id;
            const deleteTimer = setTimeout(async () => {
                try {
                    const fresh = await Ticket_1.Ticket.findById(ticketIdKey);
                    if (fresh && fresh.status === 'closed') {
                        await channel.delete();
                    }
                }
                catch (error) {
                    console.error('Error deleting ticket channel:', error);
                }
                finally {
                    pendingDeletes.delete(ticketIdKey);
                }
            }, 5000);
            pendingDeletes.set(ticketIdKey, deleteTimer);
        }
        catch (error) {
            console.error('Error closing ticket:', error);
            await interaction.reply({
                content: locale?.messages?.error?.close || '❌ An error occurred while closing the ticket.',
                ephemeral: true
            }).catch(() => null);
        }
    }
    async handleReopen(interaction) {
        const ticketId = interaction.customId.replace('ticket_reopen_', '');
        const ticket = await Ticket_1.Ticket.findById(ticketId);
        const locale = this.getLocale();
        try {
            if (!ticket) {
                await interaction.reply({
                    content: locale?.messages?.invalidTicket || '❌ Invalid ticket',
                    ephemeral: true
                });
                return;
            }
            const section = this.client.settings.ticket.sections.find((s) => s.name === ticket.section);
            const member = interaction.member;
            const hasPermission = (section && this.hasStaffPermission(member, section)) || ticket.userId === member.id;
            if (!hasPermission) {
                await interaction.reply({
                    content: locale?.messages?.ownerOnly || '❌ You do not have permission',
                    ephemeral: true
                });
                return;
            }
            const channel = await interaction.guild?.channels.fetch(ticket.channelId);
            if (!channel) {
                await interaction.reply({
                    content: locale?.messages?.invalidTicket || '❌ Invalid ticket',
                    ephemeral: true
                });
                return;
            }
            const pendingDelete = pendingDeletes.get(ticketId);
            if (pendingDelete) {
                clearTimeout(pendingDelete);
                pendingDeletes.delete(ticketId);
            }
            if (ticket.status !== 'open') {
                await channel.permissionOverwrites.edit(ticket.userId, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
                ticket.status = 'open';
                ticket.closedBy = null;
                ticket.closedAt = null;
                ticket.claimedAt = null;
                ticket.claimedBy = null;
                ticket.reopened = true;
                await ticket.save();
            }
            const embed = this.createTicketEmbed(ticket, interaction.member);
            if (interaction.message && typeof interaction.message.edit === 'function') {
                await interaction.message.edit({
                    embeds: [embed],
                    components: [this.buildControlButtons(ticket)]
                });
            }
            await interaction.reply({
                content: locale?.messages?.reopened || '🔓 Ticket reopened successfully.',
                ephemeral: true
            });
            const logChannel = section && await interaction.guild?.channels.fetch(section.logChannelId);
            if (logChannel) {
                const reopenEmbed = new discord_js_1.EmbedBuilder()
                    .setTitle(locale?.messages?.reopenedLog || 'Ticket Reopened')
                    .setColor(this.client.settings.ticket.embed.color)
                    .addFields({
                    name: locale?.embeds?.log?.ticket || 'Ticket',
                    value: `#${channel.name}`,
                    inline: true
                }, {
                    name: locale?.embeds?.log?.user || 'User',
                    value: `<@${ticket.userId}>`,
                    inline: true
                });
                await logChannel.send({ embeds: [reopenEmbed] });
            }
        }
        catch (error) {
            console.error('Error reopening ticket:', error);
            await interaction.reply({
                content: locale?.messages?.error?.reopen || '❌ An error occurred while reopening the ticket.',
                ephemeral: true
            }).catch(() => null);
        }
    }
    async handleDelete(interaction) {
        const ticketId = interaction.customId.replace('ticket_delete_', '');
        const ticket = await Ticket_1.Ticket.findById(ticketId);
        const locale = this.getLocale();
        try {
            if (!ticket) {
                await interaction.reply({
                    content: locale?.messages?.invalidTicket || '❌ Invalid ticket',
                    ephemeral: true
                });
                return;
            }
            const section = this.client.settings.ticket.sections.find((s) => s.name === ticket.section);
            const member = interaction.member;
            const hasPermission = (section && this.hasStaffPermission(member, section)) || ticket.userId === member.id;
            if (!hasPermission) {
                await interaction.reply({
                    content: locale?.messages?.ownerOnly || '❌ You do not have permission',
                    ephemeral: true
                });
                return;
            }
            const pendingDelete = pendingDeletes.get(ticketId);
            if (pendingDelete) {
                clearTimeout(pendingDelete);
                pendingDeletes.delete(ticketId);
            }
            const channel = await interaction.guild?.channels.fetch(ticket.channelId);
            let transcript = null;
            if (channel) {
                try {
                    transcript = await (0, transcriptGenerator_1.createTranscript)(channel);
                }
                catch (error) {
                    console.error('Error creating transcript on delete:', error);
                }
                await channel.delete();
            }
            ticket.status = 'closed';
            ticket.deleted = true;
            ticket.deletedAt = new Date();
            await ticket.save();
            await interaction.reply({
                content: locale?.messages?.deleted || '🗑️ Ticket deleted successfully.',
                ephemeral: true
            });
            const logChannel = section && await interaction.guild?.channels.fetch(section.logChannelId);
            if (logChannel) {
                const deleteEmbed = new discord_js_1.EmbedBuilder()
                    .setTitle(locale?.messages?.deletedLog || 'Ticket Deleted')
                    .setColor(this.client.settings.ticket.embed.color)
                    .addFields({
                    name: locale?.embeds?.log?.ticket || 'Ticket',
                    value: ticket.channelId,
                    inline: true
                }, {
                    name: locale?.embeds?.log?.user || 'User',
                    value: `<@${ticket.userId}>`,
                    inline: true
                }, {
                    name: locale?.embeds?.log?.closedBy || 'Closed By',
                    value: `<@${interaction.user.id}>`,
                    inline: true
                });
                const files = transcript ? [transcript] : [];
                await logChannel.send({ embeds: [deleteEmbed], files });
            }
        }
        catch (error) {
            console.error('Error deleting ticket:', error);
            await interaction.reply({
                content: locale?.messages?.error?.delete || '❌ An error occurred while deleting the ticket.',
                ephemeral: true
            }).catch(() => null);
        }
    }
}
exports.TicketManager = TicketManager;