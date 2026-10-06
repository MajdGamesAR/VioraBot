"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = exports.data = void 0;
const discord_js_1 = require("discord.js");
const ticketManager_1 = require("../../ticket/ticketManager");
const permissionChecker_1 = require("../../utils/permissionChecker");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage the ticket system')
    .addSubcommand(subcommand => subcommand
    .setName('setup')
    .setDescription('Setup the ticket system')
    .addChannelOption(option => option
    .setName('channel')
    .setDescription('The channel to setup the ticket system in')
    .setRequired(true)));
exports.command = {
    name: 'ticket',
    enabled: true,
    aliases: ['tickets'],
    async execute(interaction, _, client) {
        try {
            if (!(interaction instanceof discord_js_1.ChatInputCommandInteraction))
                return;
            if (!interaction.guild)
                return;
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const locale = client.locales.get(client.settings.defaultLanguage)?.ticket;
            const hasPermission = (0, permissionChecker_1.checkCommandPermissions)(member, client.settings.commands?.ticket, discord_js_1.PermissionFlagsBits.Administrator);
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
                        content: '❌ Please provide a valid text channel.',
                        ephemeral: true
                    });
                    return;
                }
                const ticketManager = new ticketManager_1.TicketManager(client);
                await ticketManager.setupSystem(channel);
                await interaction.reply({
                    content: '✅ Ticket system has been set up successfully!',
                    ephemeral: true
                });
            }
        }
        catch (error) {
            console.error('Error executing ticket command:', error);
            if (interaction instanceof discord_js_1.ChatInputCommandInteraction) {
                await interaction.reply({
                    content: '❌ An error occurred while executing the command.',
                    ephemeral: true
                });
            }
        }
    }
};
