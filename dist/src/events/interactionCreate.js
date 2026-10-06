"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.once = exports.name = void 0;
exports.execute = execute;
const ticketManager_1 = require("../ticket/ticketManager");
const suggestionHandler_1 = require("../suggestions/suggestionHandler");
const applyManager_1 = require("../apply/applyManager");
exports.name = 'interactionCreate';
exports.once = false;
async function execute(interaction, client) {
    try {
        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('ticket_close_modal_')) {
                const ticketManager = new ticketManager_1.TicketManager(client);
                const reason = interaction.fields.getTextInputValue('ticket_close_reason');
                await ticketManager.finalizeClose(interaction, reason);
                return;
            }
            if (interaction.customId.startsWith('suggestion_reject_modal_')) {
                await (0, suggestionHandler_1.handleStaffRejectModal)(interaction);
                return;
            }
        }
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
            if (interaction.customId === 'ticket_create' ||
                interaction.customId.startsWith('ticket_create_')) {
                const ticketManager = new ticketManager_1.TicketManager(client);
                if (interaction.isButton()) {
                    await ticketManager.handleInteraction(interaction);
                }
                return;
            }
            if (interaction.isButton() && interaction.customId.startsWith('ticket_claim_')) {
                const ticketManager = new ticketManager_1.TicketManager(client);
                await ticketManager.handleClaim(interaction);
                return;
            }
            if (interaction.isButton() && interaction.customId.startsWith('ticket_close_')) {
                const ticketManager = new ticketManager_1.TicketManager(client);
                await ticketManager.showCloseModal(interaction);
                return;
            }
            if (interaction.isButton() && interaction.customId.startsWith('ticket_reopen_')) {
                const ticketManager = new ticketManager_1.TicketManager(client);
                await ticketManager.handleReopen(interaction);
                return;
            }
            if (interaction.isButton() && interaction.customId.startsWith('ticket_delete_')) {
                const ticketManager = new ticketManager_1.TicketManager(client);
                await ticketManager.handleDelete(interaction);
                return;
            }
            if (interaction.isButton() &&
                (interaction.customId.startsWith('suggestion_approve_') ||
                    interaction.customId.startsWith('suggestion_reject_') ||
                    interaction.customId.startsWith('suggestion_pending_'))) {
                await (0, suggestionHandler_1.handleStaffInteraction)(interaction);
                return;
            }
            if (interaction.isButton() && interaction.customId.startsWith('apply_')) {
                const applicationManager = new applyManager_1.ApplicationManager(client);
                await applicationManager.handleButton(interaction);
                return;
            }
        }
    }
    catch (error) {
        console.error('Error handling interaction:', error);
        if (interaction.isRepliable() && !interaction.replied) {
            await interaction.reply({
                content: '❌ An error occurred while processing your request.',
                ephemeral: true
            }).catch(() => {
                console.error('Could not send error response');
            });
        }
    }
}