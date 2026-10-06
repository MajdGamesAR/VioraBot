"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSuggestion = void 0;
const discord_js_1 = require("discord.js");
const axios_1 = __importDefault(require("axios"));
const Suggestion_1 = require("../models/Suggestion");
const validation_1 = require("../dashboard/validation");
const cooldowns = new Map();
const formatFileSize = (bytes) => {
    return `${(bytes / (1024 * 1024)).toFixed(2)}`;
};
const createEmbedFields = (message, locale) => {
    const fields = [
        {
            name: `👤 ${locale.author}`,
            value: `${message.author.tag} (<@${message.author.id}>)`,
            inline: true
        },
        {
            name: `⏰ ${locale.createdAt}`,
            value: (0, discord_js_1.time)(new Date(), discord_js_1.TimestampStyles.RelativeTime),
            inline: true
        }
    ];
    return fields;
};
const prepareImage = async (url, filename) => {
    try {
        const response = await axios_1.default.get(url, { responseType: 'arraybuffer' });
        return new discord_js_1.AttachmentBuilder(Buffer.from(response.data), { name: filename });
    }
    catch (error) {
        console.error('Failed to download image:', error);
        return null;
    }
};
const isStaff = (member, settings) => {
    if (!member) {
        return false;
    }
    if (member.permissions?.has(discord_js_1.PermissionFlagsBits.Administrator)) {
        return true;
    }
    if (!Array.isArray(settings?.suggestions?.staffRoles) || settings.suggestions.staffRoles.length === 0) {
        return false;
    }
    return settings.suggestions.staffRoles.some((roleId) => member.roles.cache.has(roleId));
};
const persistSuggestion = async (client, suggestionMsg, sourceMessage) => {
    try {
        const existing = await Suggestion_1.Suggestion.findOne({
            guildId: suggestionMsg.guild?.id || sourceMessage.guild?.id,
            messageId: suggestionMsg.id
        });
        if (existing) {
            return existing;
        }
        const record = new Suggestion_1.Suggestion({
            guildId: suggestionMsg.guild?.id || sourceMessage.guild?.id,
            channelId: suggestionMsg.channel?.id,
            messageId: suggestionMsg.id,
            authorId: sourceMessage.author?.id || sourceMessage.id,
            authorName: sourceMessage.author?.tag || sourceMessage.author?.username || null,
            content: sourceMessage.content || suggestionMsg.embeds?.[0]?.description || '',
            status: 'pending'
        });
        await record.save();
        return record;
    }
    catch (error) {
        console.error('Error persisting suggestion:', error);
        return null;
    }
};
const persistDecision = async (client, message, status, actorId, reason) => {
    try {
        const found = await Suggestion_1.Suggestion.findOneAndUpdate({
            guildId: message.guild?.id,
            messageId: message.id
        }, {
            $set: {
                status,
                decidedBy: actorId,
                decisionReason: reason || null,
                decidedAt: new Date()
            },
            $setOnInsert: {
                guildId: message.guild?.id,
                channelId: message.channel?.id,
                messageId: message.id,
                authorId: actorId,
                content: message.embeds?.[0]?.description || '',
                createdAt: new Date()
            }
        }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
        return found;
    }
    catch (error) {
        console.error('Error persisting suggestion decision:', error);
        return null;
    }
};
const createStatusField = (locale, status, moderator, reason) => {
    let value;
    if (status === 'accepted') {
        value = `✅ ${locale.staff.accepted} — <@${moderator}>`;
    }
    else if (status === 'rejected') {
        value = `❌ ${locale.staff.rejected} — <@${moderator}>`;
        if (reason) {
            value += `\n📝 ${reason}`;
        }
    }
    else {
        value = `🕐 ${locale.staff.pendingStatus} — <@${moderator}>`;
    }
    return {
        name: `📊 ${locale.staff.statusTitle}`,
        value,
        inline: false
    };
};
const createStaffButtons = (messageId) => {
    return new discord_js_1.ActionRowBuilder()
        .addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`suggestion_approve_${messageId}`)
        .setLabel('✅ Accept')
        .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
        .setCustomId(`suggestion_reject_${messageId}`)
        .setLabel('❌ Reject')
        .setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
        .setCustomId(`suggestion_pending_${messageId}`)
        .setLabel('🕐 Pending')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
};
const handleSuggestion = async (message) => {
    const client = message.client;
    const settings = client.settings;
    try {
        if (!settings.suggestions?.enabled)
            return;
        if (!message.guild || message.author.bot)
            return;
        if (!settings.suggestions.channels.includes(message.channel.id))
            return;
        if (!(message.channel instanceof discord_js_1.TextChannel) &&
            !(message.channel instanceof discord_js_1.ThreadChannel)) {
            return;
        }
        const guildLocale = settings.defaultLanguage || 'en';
        const locale = client.locales.get(guildLocale)?.suggestions;
        if (!locale) {
            throw new Error('LOCALE_NOT_FOUND');
        }
        const now = Date.now();
        const lastSuggestion = cooldowns.get(message.author.id) || 0;
        if (now - lastSuggestion < settings.suggestions.cooldown) {
            const timeLeft = Math.ceil((settings.suggestions.cooldown - (now - lastSuggestion)) / 1000);
            await message.reply(locale.error.cooldown.replace('{time}', `${timeLeft} seconds`));
            return;
        }
        if (!message.content) {
            await message.reply(locale.error.noContent);
            return;
        }
        if (message.content.length < settings.suggestions.minContentLength) {
            await message.reply(locale.error.tooShort.replace('{min}', settings.suggestions.minContentLength.toString()));
            return;
        }
        if (message.content.length > settings.suggestions.maxContentLength) {
            await message.reply(locale.error.tooLong.replace('{max}', settings.suggestions.maxContentLength.toString()));
            return;
        }
        if (message.attachments.size > 0) {
            const attachment = message.attachments.first();
            if (message.attachments.size > 1) {
                throw new Error('TOO_MANY_IMAGES');
            }
            if (!settings.suggestions.allowImages) {
                throw new Error('IMAGES_NOT_ALLOWED');
            }
            if (attachment && attachment.size > settings.suggestions.maxImageSize) {
                throw new Error('IMAGE_TOO_LARGE');
            }
            if (attachment && !attachment.contentType?.startsWith('image/')) {
                throw new Error('INVALID_FILE_TYPE');
            }
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setColor(settings.suggestions.color)
            .setTimestamp()
            .setDescription(message.content)
            .setFields([...createEmbedFields(message, locale), createStatusField(locale, 'pending', message.author.id, null)])
            .setFooter({
            text: locale.footer.replace('{id}', message.id),
            iconURL: message.author.displayAvatarURL()
        });
        const components = Array.isArray(settings.suggestions.staffRoles) &&
            settings.suggestions.staffRoles.length > 0
            ? [createStaffButtons(message.id)]
            : [];
        if (message.attachments.size > 0) {
            const attachment = message.attachments.first();
            if (attachment && attachment.contentType?.startsWith('image/')) {
                const newAttachment = await prepareImage(attachment.url, attachment.name);
                if (newAttachment) {
                    const suggestionMsg = await message.channel
                        .send({
                        embeds: [embed.setImage('attachment://' + attachment.name)],
                        files: [newAttachment],
                        components
                    }).catch(() => {
                        throw new Error('SEND_ERROR');
                    });
                    await handleReactionsAndThread(suggestionMsg, settings, message, client);
                    await persistSuggestion(client, suggestionMsg, message);
                    await cleanupActions(message, now, settings);
                    return;
                }
            }
        }
        const suggestionMsg = await message.channel
            .send({ embeds: [embed], components }).catch(() => {
            throw new Error('SEND_ERROR');
        });
        await handleReactionsAndThread(suggestionMsg, settings, message, client);
        await persistSuggestion(client, suggestionMsg, message);
        await cleanupActions(message, now, settings);
        return;
    }
    catch (error) {
        console.error('Error handling suggestion:', error);
        if (error instanceof Error) {
            const guildLocale = settings.defaultLanguage || 'en';
            const locale = client.locales.get(guildLocale)?.suggestions.error;
            let errorMessage = 'An error occurred';
            switch (error.message) {
                case 'TOO_MANY_IMAGES':
                    errorMessage = locale?.tooManyImages;
                    break;
                case 'IMAGES_NOT_ALLOWED':
                    errorMessage = 'Images are not allowed in suggestions.';
                    break;
                case 'IMAGE_TOO_LARGE':
                    errorMessage = locale?.imageTooLarge.replace('{size}', formatFileSize(settings.suggestions.maxImageSize));
                    break;
                case 'INVALID_FILE_TYPE':
                    errorMessage = 'Only image files are allowed.';
                    break;
                case 'SEND_ERROR':
                    errorMessage = 'Failed to send suggestion. Please try again later.';
                    break;
                default:
                    errorMessage = 'An unexpected error occurred. Please try again later.';
            }
            try {
                await message.reply({ content: errorMessage });
            }
            catch (replyError) {
                console.error('Failed to send error message:', replyError);
            }
        }
        return;
    }
};
exports.handleSuggestion = handleSuggestion;
const getSuggestionContext = (interaction) => {
    const settings = interaction.client.settings;
    const guildLocale = settings.defaultLanguage || 'en';
    const locale = interaction.client.locales.get(guildLocale)?.suggestions;
    return { settings, locale };
};
const applyDecisionCore = async ({ client, guild, message, actor, status, reason }) => {
    const settings = client.settings;
    const guildLocale = settings.defaultLanguage || 'en';
    const locale = client.locales.get(guildLocale)?.suggestions;
    if (!locale) {
        throw new Error('LOCALE_NOT_FOUND');
    }
    if (!message || !message.embeds?.[0]) {
        throw new Error('MESSAGE_NOT_FOUND');
    }
    const embed = discord_js_1.EmbedBuilder.from(message.embeds[0]);
    const statusField = createStatusField(locale, status, actor.id, reason || null);
    const existingIndex = embed.data.fields?.findIndex((f) => f.name === statusField.name) ?? -1;
    const fields = embed.data.fields || [];
    const newFields = existingIndex >= 0
        ? fields.map((f, i) => (i === existingIndex ? statusField : f))
        : [...fields, statusField];
    embed.setFields(newFields);
    const disabledButtons = message.components.map((row) => {
        const newRow = new discord_js_1.ActionRowBuilder();
        for (const component of row.components) {
            if (component.type === discord_js_1.ComponentType.Button) {
                newRow.addComponents(discord_js_1.ButtonBuilder.from(component).setDisabled(true));
            }
            else {
                newRow.addComponents(component);
            }
        }
        return newRow;
    });
    await message.edit({
        embeds: [embed],
        components: disabledButtons
    });
    await persistDecision(client, message, status, actor.id, reason);
    await sendStaffLog({ client, guild, locale, settings, message, status, reason, actor });
    return { embed, disabledButtons };
};
const updateSuggestionMessage = async (interaction, status, reason) => {
    return applyDecisionCore({
        client: interaction.client,
        guild: interaction.guild,
        message: interaction.message,
        actor: { id: interaction.user.id, tag: interaction.user.tag },
        status,
        reason
    });
};
const sendStaffLog = async (ctx, message, status, reason) => {
    const { settings, locale } = ctx;
    if (!settings.suggestions.logChannelId) {
        return;
    }
    const channel = await ctx.guild?.channels.fetch(settings.suggestions.logChannelId).catch(() => null);
    if (!channel || typeof channel.send !== 'function') {
        return;
    }
    const statusLabel = status === 'accepted'
        ? locale.staff.accepted
        : status === 'rejected'
            ? locale.staff.rejected
            : locale.staff.pendingStatus;
    const logEmbed = new discord_js_1.EmbedBuilder()
        .setTitle(`📊 ${locale.staff.statusTitle}`)
        .setColor(status === 'accepted'
        ? 0x57F287
        : status === 'rejected'
            ? 0xED4245
            : 0xFEE75C)
        .setDescription(message.embeds?.[0]?.description || '')
        .addFields({
        name: `📌 ${locale.updated.replace('{status}', statusLabel)}`,
        value: `${message.url} — <@${ctx.actor.id}>`,
        inline: false
    })
        .setTimestamp();
    if (reason) {
        logEmbed.addFields({
            name: `📝 ${locale.staff.reasonLabel}`,
            value: reason,
            inline: false
        });
    }
    await channel.send({ embeds: [logEmbed] });
};
const dashboardSuggestionDecision = async (client, guildId, suggestionId, status, reason, actor) => {
    if (!client || !guildId || !suggestionId) {
        return { ok: false, error: 'MESSAGE_NOT_FOUND' };
    }
    if (!['accepted', 'rejected', 'pending'].includes(status)) {
        return { ok: false, error: 'INVALID_STATUS' };
    }
    try {
        const record = await Suggestion_1.Suggestion.findOne({ _id: suggestionId, guildId }).lean();
        if (!record) {
            return { ok: false, error: 'SUGGESTION_NOT_FOUND' };
        }
        const transition = (0, validation_1.nextSuggestionStatus)(record.status, status);
        if (!transition.ok) {
            return { ok: false, error: 'INVALID_TRANSITION' };
        }
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return { ok: false, error: 'GUILD_NOT_FOUND' };
        }
        const channel = guild.channels.cache.get(record.channelId) ||
            await guild.channels.fetch(record.channelId).catch(() => null);
        if (!channel || !channel.messages || typeof channel.messages.fetch !== 'function') {
            return { ok: false, error: 'CHANNEL_NOT_FOUND' };
        }
        const message = await channel.messages.fetch(record.messageId).catch(() => null);
        if (!message) {
            return { ok: false, error: 'MESSAGE_NOT_FOUND' };
        }
        const result = await applyDecisionCore({
            client,
            guild,
            message,
            actor: actor && actor.id ? actor : { id: actor?.id || 'dashboard', tag: actor?.username || 'Dashboard' },
            status,
            reason
        });
        return { ok: true, result };
    }
    catch (error) {
        console.error('Error in dashboard suggestion decision:', error);
        return { ok: false, error: 'ERROR' };
    }
};
exports.dashboardSuggestionDecision = dashboardSuggestionDecision;
const handleStaffInteraction = async (interaction) => {
    try {
        const { settings, locale } = getSuggestionContext(interaction);
        if (!locale) {
            throw new Error('LOCALE_NOT_FOUND');
        }
        if (!isStaff(interaction.member, settings)) {
            await interaction.reply({
                content: locale.staff.noPermission,
                ephemeral: true
            });
            return;
        }
        if (interaction.customId.startsWith('suggestion_approve_')) {
            await updateSuggestionMessage(interaction, 'accepted', null);
            await interaction.reply({
                content: locale.staff.updated.replace('{status}', locale.staff.accepted),
                ephemeral: true
            });
            return;
        }
        if (interaction.customId.startsWith('suggestion_pending_')) {
            await updateSuggestionMessage(interaction, 'pending', null);
            await interaction.reply({
                content: locale.staff.updated.replace('{status}', locale.staff.pendingStatus),
                ephemeral: true
            });
            return;
        }
        if (interaction.customId.startsWith('suggestion_reject_')) {
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(interaction.customId.replace('suggestion_reject_', 'suggestion_reject_modal_'))
                .setTitle(locale.staff.statusTitle)
                .addComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
                .setCustomId('suggestion_reject_reason')
                .setLabel(locale.staff.reasonLabel)
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setPlaceholder(locale.staff.reasonPlaceholder)
                .setRequired(false)
                .setMaxLength(1000)));
            await interaction.showModal(modal);
            return;
        }
    }
    catch (error) {
        console.error('Error handling suggestion staff interaction:', error);
        if (interaction.isRepliable() && !interaction.replied) {
            await interaction.reply({
                content: '❌ An error occurred while updating the suggestion.',
                ephemeral: true
            });
        }
    }
};
exports.handleStaffInteraction = handleStaffInteraction;
const handleStaffRejectModal = async (interaction) => {
    try {
        const { settings, locale } = getSuggestionContext(interaction);
        if (!locale) {
            throw new Error('LOCALE_NOT_FOUND');
        }
        if (!isStaff(interaction.member, settings)) {
            await interaction.reply({
                content: locale.staff.noPermission,
                ephemeral: true
            });
            return;
        }
        const reason = interaction.fields?.getTextInputValue('suggestion_reject_reason') || null;
        await updateSuggestionMessage(interaction, 'rejected', reason);
        await interaction.reply({
            content: locale.staff.updated.replace('{status}', locale.staff.rejected),
            ephemeral: true
        });
    }
    catch (error) {
        console.error('Error handling suggestion reject modal:', error);
        if (interaction.isRepliable() && !interaction.replied) {
            await interaction.reply({
                content: '❌ An error occurred while updating the suggestion.',
                ephemeral: true
            });
        }
    }
};
exports.handleStaffRejectModal = handleStaffRejectModal;
const handleReactionsAndThread = async (suggestionMsg, settings, message, client) => {
    if (settings.suggestions.reactions.enabled) {
        try {
            await suggestionMsg.react(settings.suggestions.reactions.upvote);
            await suggestionMsg.react(settings.suggestions.reactions.downvote);
            await suggestionMsg.react(settings.suggestions.reactions.star);
        }
        catch (error) {
            console.error('Failed to add reactions:', error);
        }
    }
    if (settings.suggestions.thread.enabled && message.channel instanceof discord_js_1.TextChannel) {
        try {
            const threadName = settings.suggestions.thread.name
                .replace('{title}', message.content.slice(0, 50) + (message.content.length > 50 ? '...' : ''));
            const thread = await suggestionMsg.startThread({
                name: threadName,
                autoArchiveDuration: settings.suggestions.thread.archiveDuration
            });
            const guildLocale = settings.defaultLanguage || 'en';
            const threadLocale = client.locales.get(guildLocale)?.suggestions;
            const welcomeMessage = threadLocale?.threadWelcome || 'Welcome to the discussion thread for your suggestion! Others can discuss and provide feedback here.';
            await thread.send({
                content: `${message.author} ${welcomeMessage}`
            });
        }
        catch (error) {
            console.error('Failed to create discussion thread:', error);
        }
    }
};
const cleanupActions = async (message, now, settings) => {
    cooldowns.set(message.author.id, now);
    if (settings.suggestions.deleteOriginal) {
        await message.delete().catch(() => {
            console.error('Failed to delete original message');
        });
    }
};