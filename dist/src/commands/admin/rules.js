"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = exports.data = void 0;
const discord_js_1 = require("discord.js");
const rulesManager_1 = require("../../rules/rulesManager");
const permissionChecker_1 = require("../../utils/permissionChecker");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('rules')
    .setDescription('Manage the rules system')
    .addSubcommand(subcommand => subcommand
    .setName('setup')
    .setDescription('Setup the rules system')
    .addChannelOption(option => option
    .setName('channel')
    .setDescription('The channel to setup the rules system in')
    .setRequired(true)));
exports.command = {
    name: 'rules',
    enabled: true,
    aliases: ['rule', 'serverrules', 'laws', 'قوانين'],
    async execute(interaction, args, client) {
        try {
            if (interaction instanceof discord_js_1.Message) {
                if (!interaction.guild)
                    return;
                const member = await interaction.guild.members.fetch(interaction.author.id);
                const locale = client.locales.get(client.settings.defaultLanguage)?.rules;
                const hasPermission = (0, permissionChecker_1.checkCommandPermissions)(member, client.settings.commands?.rules, discord_js_1.PermissionFlagsBits.Administrator);
                if (!hasPermission) {
                    await interaction.reply(locale?.messages?.noPermission || '❌ You do not have permission to use this command.');
                    return;
                }
                if (args[0] === 'setup') {
                    const channel = interaction.mentions.channels.first();
                    if (!channel || !channel.isTextBased()) {
                        await interaction.reply(locale?.messages?.invalidChannel || '❌ Please mention a valid text channel.');
                        return;
                    }
                    const rulesManager = new rulesManager_1.RulesManager(client);
                    await rulesManager.setupSystem(channel);
                    await interaction.reply(locale?.messages?.setupSuccess || '✅ Rules system has been set up successfully!');
                }
                else {
                    await interaction.reply(`❌ Invalid subcommand. Use \`${client.settings.prefix}rules setup #channel\``);
                }
                return;
            }
            if (!(interaction instanceof discord_js_1.ChatInputCommandInteraction))
                return;
            if (!interaction.guild)
                return;
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const locale = client.locales.get(client.settings.defaultLanguage)?.rules;
            const hasPermission = (0, permissionChecker_1.checkCommandPermissions)(member, client.settings.commands?.rules, discord_js_1.PermissionFlagsBits.Administrator);
            if (!hasPermission) {
                await interaction.reply({
                    content: locale?.messages?.noPermission || '❌ You do not have permission to use this command.',
                    ephemeral: true
                });
                return;
            }
            const subcommand = interaction.options.getSubcommand();
            if (subcommand === 'setup') {
                const channel = interaction.options.getChannel('channel');
                if (!channel || !channel.isTextBased()) {
                    await interaction.reply({
                        content: locale?.messages?.invalidChannel || '❌ Please provide a valid text channel.',
                        ephemeral: true
                    });
                    return;
                }
                const rulesManager = new rulesManager_1.RulesManager(client);
                await rulesManager.setupSystem(channel);
                await interaction.reply({
                    content: locale?.messages?.setupSuccess || '✅ Rules system has been set up successfully!',
                    ephemeral: true
                });
            }
        }
        catch (error) {
            const locale = client.locales.get(client.settings.defaultLanguage)?.rules;
            console.error('Error executing rules command:', error);
            if (interaction instanceof discord_js_1.ChatInputCommandInteraction) {
                await interaction.reply({
                    content: locale?.messages?.error?.setup || '❌ An error occurred while executing the command.',
                    ephemeral: true
                });
            }
            else if (interaction instanceof discord_js_1.Message) {
                await interaction.reply(locale?.messages?.error?.setup || '❌ An error occurred while executing the command.');
            }
        }
    }
};
