"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RulesManager = void 0;
const discord_js_1 = require("discord.js");
const emoji_js_1 = require("../utils/emoji");
const BUTTON_ROW_LIMIT = 5;
const SELECT_MENU_LIMIT = 25;
class RulesManager {
    constructor(client) {
        this.client = client;
    }
    async setupSystem(channel) {
        try {
            const settings = this.client.settings.rules;
            const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.rules;
            if (!settings.enabled) {
                throw new Error(locale?.messages?.disabled || 'Rules system is disabled');
            }
            const mainEmbed = this.createMainEmbed();
            const components = this.createRuleComponents();
            await channel.send({
                embeds: [mainEmbed],
                components
            });
        }
        catch (error) {
            console.error('Error setting up rules system:', error);
            throw error;
        }
    }
    createMainEmbed() {
        const settings = this.client.settings.rules;
        const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.rules;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(settings.mainEmbed.title || locale?.embeds?.main?.title || 'Server Rules')
            .setDescription(settings.mainEmbed.description || locale?.embeds?.main?.description || 'Please read our server rules')
            .setColor(settings.mainEmbed.color)
            .setTimestamp(settings.mainEmbed.timestamp ? new Date() : null);
        if (settings.mainEmbed.thumbnail?.enabled) {
            embed.setThumbnail(settings.mainEmbed.thumbnail.url);
        }
        if (settings.mainEmbed.image?.enabled) {
            embed.setImage(settings.mainEmbed.image.url);
        }
        if (settings.mainEmbed.footer) {
            embed.setFooter({
                text: settings.mainEmbed.footer.text,
                iconURL: settings.mainEmbed.footer.iconUrl || null
            });
        }
        return embed;
    }
    createRuleComponents() {
        const settings = this.client.settings.rules;
        const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.rules;
        if (settings.interface.type === 'select') {
            const selectMenu = new discord_js_1.StringSelectMenuBuilder()
                .setCustomId('rules_select')
                .setPlaceholder(locale?.select?.placeholder || 'Select a rule section')
                .setMaxValues(1);
            settings.sections
                .filter((section) => section.enabled)
                .slice(0, SELECT_MENU_LIMIT)
                .forEach((section) => {
                selectMenu.addOptions({
                    label: section.name,
                    value: `rules_view_${section.name.toLowerCase().replace(/\s+/g, '_')}`,
                    description: section.description,
                    emoji: (0, emoji_js_1.sanitizeEmoji)(section.emoji) || undefined
                });
            });
            return [new discord_js_1.ActionRowBuilder().addComponents(selectMenu)];
        }
        const rows = [];
        let currentRow = new discord_js_1.ActionRowBuilder();
        let buttonCount = 0;
        settings.sections
            .filter((section) => section.enabled)
            .forEach((section) => {
            if (buttonCount >= BUTTON_ROW_LIMIT) {
                rows.push(currentRow);
                currentRow = new discord_js_1.ActionRowBuilder();
                buttonCount = 0;
            }
            const button = new discord_js_1.ButtonBuilder()
                .setCustomId(`rules_view_${section.name.toLowerCase().replace(/\s+/g, '_')}`)
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
        return rows;
    }
    async handleInteraction(interaction) {
        const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.rules;
        try {
            const settings = this.client.settings.rules;
            let sectionName;
            if (interaction.isButton()) {
                sectionName = interaction.customId.replace('rules_view_', '');
            }
            else {
                sectionName = interaction.values[0].replace('rules_view_', '');
            }
            const section = settings.sections.find((s) => s.name.toLowerCase().replace(/\s+/g, '_') === sectionName);
            if (!section || !section.enabled) {
                await interaction.reply({
                    content: locale?.messages?.invalidSection || '❌ Invalid rules section',
                    ephemeral: true
                });
                return;
            }
            const embed = this.createSectionEmbed(section);
            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        }
        catch (error) {
            console.error('Error handling rules interaction:', error);
            await interaction.reply({
                content: locale?.messages?.error?.view || '❌ An error occurred while viewing the rules.',
                ephemeral: true
            });
        }
    }
    createSectionEmbed(section) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`${section.emoji} ${section.name}`)
            .setDescription(Array.isArray(section.rules) ? section.rules.join('\n\n') : section.rules)
            .setColor(section.embed.color)
            .setTimestamp();
        if (section.embed.thumbnail?.enabled) {
            embed.setThumbnail(section.embed.thumbnail.url);
        }
        if (section.embed.image?.enabled) {
            embed.setImage(section.embed.image.url);
        }
        if (section.embed.footer) {
            embed.setFooter({
                text: section.embed.footer.text,
                iconURL: section.embed.footer.iconUrl || null
            });
        }
        return embed;
    }
}
exports.RulesManager = RulesManager;
