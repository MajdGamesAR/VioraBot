"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const fs_1 = require("fs");
const path_1 = require("path");
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("./config"));
const settingsWatcher_1 = require("./src/utils/settingsWatcher");
const settingsManager_1 = require("./src/utils/settingsManager");
const cooldownManager_1 = require("./src/utils/cooldownManager");
const giveawayManager_1 = require("./src/giveaway/giveawayManager");
const channelProtection_1 = require("./src/protection/channelProtection");
const roleProtection_1 = require("./src/protection/roleProtection");
const timeoutProtection_1 = require("./src/protection/timeoutProtection");
const moderationProtection_1 = require("./src/protection/moderationProtection");
const antibotProtection_1 = require("./src/protection/antibotProtection");
const serverProtection_1 = require("./src/protection/serverProtection");
const antispamProtection_1 = require("./src/protection/antispamProtection");
const autoMod_1 = require("./src/moderation/autoMod");
const antiRaid_1 = require("./src/moderation/antiRaid");
const welcomeManager_1 = require("./src/welcome/welcomeManager");
const suggestionHandler_1 = require("./src/suggestions/suggestionHandler");
const tempChannelHandler_1 = require("./src/tempChannels/tempChannelHandler");
const autoReplyHandler_1 = require("./src/autoReply/autoReplyHandler");
const auditLogManager_1 = require("./src/utils/auditLogManager");
const messageDelete_1 = __importDefault(require("./src/logs/messageDelete"));
const messageEdit_1 = __importDefault(require("./src/logs/messageEdit"));
const roleCreate_1 = __importDefault(require("./src/logs/roleCreate"));
const roleDelete_1 = __importDefault(require("./src/logs/roleDelete"));
const roleUpdate_1 = __importDefault(require("./src/logs/roleUpdate"));
const memberJoin_1 = __importDefault(require("./src/logs/memberJoin"));
const memberLeave_1 = __importDefault(require("./src/logs/memberLeave"));
const roleGive_1 = __importDefault(require("./src/logs/roleGive"));
const roleRemove_1 = __importDefault(require("./src/logs/roleRemove"));
const messageBulkDelete_1 = __importDefault(require("./src/logs/messageBulkDelete"));
const nicknameUpdate_1 = __importDefault(require("./src/logs/nicknameUpdate"));
const serverUpdate_1 = __importDefault(require("./src/logs/serverUpdate"));
const memberBan_1 = __importDefault(require("./src/logs/memberBan"));
const memberUnban_1 = __importDefault(require("./src/logs/memberUnban"));
const memberKick_1 = __importDefault(require("./src/logs/memberKick"));
const memberTimeout_1 = __importDefault(require("./src/logs/memberTimeout"));
const memberUntimeout_1 = __importDefault(require("./src/logs/memberUntimeout"));
const emojiCreate_1 = __importDefault(require("./src/logs/emojiCreate"));
const emojiDelete_1 = __importDefault(require("./src/logs/emojiDelete"));
const emojiUpdate_1 = __importDefault(require("./src/logs/emojiUpdate"));
const stickerCreate_1 = __importDefault(require("./src/logs/stickerCreate"));
const stickerDelete_1 = __importDefault(require("./src/logs/stickerDelete"));
const stickerUpdate_1 = __importDefault(require("./src/logs/stickerUpdate"));
const threadCreate_1 = __importDefault(require("./src/logs/threadCreate"));
const threadDelete_1 = __importDefault(require("./src/logs/threadDelete"));
const threadUpdate_1 = __importDefault(require("./src/logs/threadUpdate"));
const voiceJoin_1 = __importDefault(require("./src/logs/voiceJoin"));
const voiceLeave_1 = __importDefault(require("./src/logs/voiceLeave"));
const voiceMove_1 = __importDefault(require("./src/logs/voiceMove"));
const voiceServerMute_1 = __importDefault(require("./src/logs/voiceServerMute"));
const voiceServerDeafen_1 = __importDefault(require("./src/logs/voiceServerDeafen"));
const inviteCreate_1 = __importDefault(require("./src/logs/inviteCreate"));
const channelCreate_1 = __importDefault(require("./src/logs/channelCreate"));
const channelDelete_1 = __importDefault(require("./src/logs/channelDelete"));
const channelUpdate_1 = __importDefault(require("./src/logs/channelUpdate"));
const cleanupTranscripts_1 = require("./src/ticket/cleanupTranscripts");
const server_1 = require("./dashboard/server");
class ModBot extends discord_js_1.Client {
    constructor() {
        super({
            intents: [
                discord_js_1.GatewayIntentBits.Guilds,
                discord_js_1.GatewayIntentBits.GuildMembers,
                discord_js_1.GatewayIntentBits.GuildMessages,
                discord_js_1.GatewayIntentBits.MessageContent,
                discord_js_1.GatewayIntentBits.GuildVoiceStates,
                discord_js_1.GatewayIntentBits.DirectMessages,
                discord_js_1.GatewayIntentBits.DirectMessageReactions,
                discord_js_1.GatewayIntentBits.DirectMessageTyping,
                discord_js_1.GatewayIntentBits.GuildPresences,
                discord_js_1.GatewayIntentBits.GuildEmojisAndStickers,
                discord_js_1.GatewayIntentBits.GuildModeration,
                discord_js_1.GatewayIntentBits.GuildInvites
            ],
            partials: [discord_js_1.Partials.Channel, discord_js_1.Partials.Message]
        });
        this.settingsWatcher = null;
        this.dashboard = null;
        this.defaultLanguage = 'en';
        this.localeMap = {
            'en-US': 'en',
            'en-GB': 'en',
            'ar-SA': 'ar',
            'ar': 'ar',
            'en': 'en'
        };
        this.commands = new discord_js_1.Collection();
        this.aliases = new discord_js_1.Collection();
        this.locales = new discord_js_1.Collection();
        this.commandStats = {};
        this.dailyStats = new Map();
        this.settings = settingsManager_1.getSettings();
        this.defaultLanguage = this.settings.defaultLanguage || 'en';
        this.cooldownManager = new cooldownManager_1.CooldownManager();
    }
    async deployCommands(commands) {
        try {
            console.log(`Started refreshing ${commands.length} application (/) commands.`);
            const rest = new discord_js_1.REST().setToken(config_1.default.token);
            await rest.put(discord_js_1.Routes.applicationCommands(config_1.default.clientId), { body: commands });
            console.log('Successfully reloaded application (/) commands.');
        }
        catch (error) {
            console.error('Error deploying commands:', error);
        }
    }
    async init() {
        try {
            const classifyMongoError = (error) => {
                const errorName = (error && error.name) || 'UNKNOWN';
                const errorCode = error && error.code;
                const message = ((error && error.message) || '').toString();
                const has = (re) => re.test(message);
                if (errorName === 'MongoParseError' || has(/invalid scheme|invalid connection string|connection string/i)) {
                    return 'INVALID_URI';
                }
                if (errorName === 'MongoAuthenticationError' || has(/authentication failed|first.*auth|auth.*failed/i)) {
                    return 'AUTHENTICATION_FAILED';
                }
                if (has(/whitelist|ip address|is not allowed|would be whitelisted/i)) {
                    return 'IP_NOT_ALLOWED';
                }
                if (has(/enotfound|eai_again|getaddrinfo|dns/i)) {
                    return 'DNS_ERROR';
                }
                if (errorCode === 8002 || has(/srv|service locator/i)) {
                    return 'SRV_ERROR';
                }
                if (has(/econnrefused/i)) {
                    return 'ECONNREFUSED';
                }
                if (has(/tls|certificate|sslv3|tls handshake/i)) {
                    return 'TLS_ERROR';
                }
                if (errorName === 'MongoServerSelectionError' || has(/server selection/i)) {
                    return 'SERVER_SELECTION_ERROR';
                }
                if (has(/timed out|timeout|deadline/i)) {
                    return 'TIMEOUT';
                }
                return 'UNKNOWN';
            };
            const envToken = process.env.BOT_TOKEN || '';
            const envClientId = process.env.CLIENT_ID || '';
            const cfgSecret = config_1.default.dashboard.secret || '';
            const envSecret = process.env.SESSION_SECRET || '';
            console.log(`Dashboard session diagnostic: env SESSION_SECRET ${envSecret ? 'PRESENT' : 'MISSING'} length=${envSecret.length} config.dashboard.secret ${cfgSecret ? 'PRESENT' : 'MISSING'} length=${cfgSecret.length} sameSource=${(cfgSecret && cfgSecret === envSecret) ? 'YES' : 'NO'}`);
            config_1.default.dashboard.secret = config_1.default.dashboard.secret || envSecret;
            if (!config_1.default.dashboard.secret) {
                console.error('SESSION_SECRET MISSING: dashboard sessions cannot start.');
                throw new Error('Configuration error: SESSION_SECRET is required.');
            }
            config_1.default.token = config_1.default.token || envToken;
            config_1.default.clientId = config_1.default.clientId || envClientId;
            config_1.default.mainGuildId = config_1.default.mainGuildId || process.env.MAIN_GUILD_ID || '';
            config_1.default.dashboard.callbackUrl = config_1.default.dashboard.callbackUrl || process.env.CALLBACK_URL || '';
            config_1.default.dashboard.port = config_1.default.dashboard.port || parseInt(process.env.DASHBOARD_PORT, 10) || 3000;
            config_1.default.dashboard.oauth.clientId = config_1.default.dashboard.oauth.clientId || config_1.default.clientId;
            config_1.default.dashboard.oauth.clientSecret = config_1.default.dashboard.oauth.clientSecret || process.env.DASHBOARD_CLIENT_SECRET || '';
            config_1.default.defaultPrefix = config_1.default.defaultPrefix || process.env.DEFAULT_PREFIX || '!';
            const envDashClientId = process.env.DASHBOARD_CLIENT_ID || '';
            const envDashClientSecret = process.env.DASHBOARD_CLIENT_SECRET || '';
            console.log(`OAuth diagnostic: DASHBOARD_CLIENT_ID ${envDashClientId ? 'PRESENT' : 'MISSING'} length=${envDashClientId.length} DASHBOARD_CLIENT_SECRET ${envDashClientSecret ? 'PRESENT' : 'MISSING'} length=${envDashClientSecret.length} clientId-after-fallback ${config_1.default.dashboard.oauth.clientId ? 'PRESENT' : 'MISSING'} length=${config_1.default.dashboard.oauth.clientId.length} clientSecret-after-fallback ${config_1.default.dashboard.oauth.clientSecret ? 'PRESENT' : 'MISSING'} length=${config_1.default.dashboard.oauth.clientSecret.length}`);
            const cfgUri = config_1.default.mongoUri || '';
            const cfgUriValid = cfgUri.startsWith('mongodb://') || cfgUri.startsWith('mongodb+srv://');
            config_1.default.mongoUri = cfgUriValid ? cfgUri : (process.env.MONGO_URI || '');
            const uri = config_1.default.mongoUri || '';
            const uriValid = uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://');
            const uriClass = !uri ? 'EMPTY' : uriValid ? 'VALID_FORMAT' : 'INVALID_PREFIX';
            const uriCreds = /:\/\/[^/:]+:[^@]*@/.test(uri) ? 'YES' : 'NO';
            console.log(`MongoDB diagnostic: uri class=${uriClass} length=${uri.length} empty=${uri ? 'NO' : 'YES'} validPrefix=${uriValid ? 'YES' : 'NO'} credentials=${uriCreds} fallback=${cfgUriValid ? 'NO' : 'YES'}`);
            if (!uriValid) {
                console.error(`RUNTIME_MONGO_URI = ${uriClass}`);
                console.error('MongoDB diagnostic type: INVALID_URI');
                console.error('MongoDB diagnostic fields: name=MongoParseError code=n/a codeName=n/a');
                throw new Error('MongoDB connection failed.');
            }
            try {
                const beforeState = mongoose_1.default.connection.readyState;
                await mongoose_1.default.connect(uri);
                const afterState = mongoose_1.default.connection.readyState;
                console.log('Connected to MongoDB');
                console.log(`MongoDB diagnostic: readyState before=${beforeState} after=${afterState}`);
            }
            catch (error) {
                const diagnosticType = classifyMongoError(error);
                const errorName = (error && error.name) || 'UNKNOWN';
                const errorCode = (error && error.code !== undefined && error.code !== null) ? `code=${error.code}` : 'code=n/a';
                const errorCodeName = (error && error.codeName) || 'n/a';
                console.error(`MongoDB diagnostic type: ${diagnosticType}`);
                console.error(`MongoDB diagnostic fields: name=${errorName} ${errorCode} codeName=${errorCodeName}`);
                throw new Error('MongoDB connection failed.');
            }
            mongoose_1.default.connection.on('error', () => {
                console.error('MongoDB connection failed.');
            });
            const localesPath = (0, path_1.join)(__dirname, 'src', 'locales');
            try {
                const localeFiles = (0, fs_1.readdirSync)(localesPath);
                for (const file of localeFiles) {
                    try {
                        const localePath = (0, path_1.join)(localesPath, file);
                        const locale = JSON.parse((0, fs_1.readFileSync)(localePath, 'utf-8'));
                        const localeName = file.split('.')[0];
                        this.locales.set(localeName, locale);
                        console.log(`Loaded locale: ${localeName}`);
                    }
                    catch (error) {
                        console.error(`Error loading locale ${file}:`, error);
                    }
                }
                console.log('Locales loaded successfully');
            }
            catch (error) {
                console.error('Error accessing locales directory:', error);
                process.exit(1);
            }
            const slashCommands = [];
            const commandFolders = (0, fs_1.readdirSync)((0, path_1.join)(__dirname, 'src', 'commands'));
            for (const folder of commandFolders) {
                const commandFiles = (0, fs_1.readdirSync)((0, path_1.join)(__dirname, 'src', 'commands', folder));
                for (const file of commandFiles) {
                    const command = require((0, path_1.join)(__dirname, 'src', 'commands', folder, file));
                    if ('data' in command) {
                        slashCommands.push(command.data.toJSON());
                    }
                    if (command.command) {
                        this.commands.set(command.command.name, command);
                    }
                }
            }
            this.refreshAliases(settingsManager_1.getSettings());
            await this.deployCommands(slashCommands);
            this.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
                if (interaction.isButton()) {
                    if (interaction.customId.startsWith('apply_accept_') || interaction.customId.startsWith('apply_reject_')) {
                        try {
                            const { ApplicationManager } = await Promise.resolve().then(() => __importStar(require('./src/apply/applyManager')));
                            const applicationManager = new ApplicationManager(this);
                            await applicationManager.handleReview(interaction);
                        }
                        catch (error) {
                            console.error('Error handling application review:', error);
                            await interaction.reply({
                                content: '❌ An error occurred while processing your request.',
                                ephemeral: true
                            });
                        }
                        return;
                    }
                    else if (interaction.customId.startsWith('giveaway_')) {
                        try {
                            const { handleGiveawayButton } = await Promise.resolve().then(() => __importStar(require('./src/giveaway/giveawayManager')));
                            await handleGiveawayButton(interaction, this);
                        }
                        catch (error) {
                            console.error('Error handling giveaway button:', error);
                            await interaction.reply({
                                content: 'An error occurred while processing your request.',
                                ephemeral: true
                            });
                        }
                        return;
                    }
                    else if (interaction.customId.startsWith('apply_')) {
                        try {
                            const { ApplicationManager } = await Promise.resolve().then(() => __importStar(require('./src/apply/applyManager')));
                            const applicationManager = new ApplicationManager(this);
                            await applicationManager.handleButton(interaction);
                        }
                        catch (error) {
                            console.error('Error handling apply button:', error);
                            await interaction.reply({
                                content: '❌ An error occurred while processing your request.',
                                ephemeral: true
                            });
                        }
                        return;
                    }
                }
                else if (interaction.isModalSubmit()) {
                    if (interaction.customId.startsWith('apply_modal_')) {
                        try {
                            const { ApplicationManager } = await Promise.resolve().then(() => __importStar(require('./src/apply/applyManager')));
                            const applicationManager = new ApplicationManager(this);
                            await applicationManager.handleModal(interaction);
                        }
                        catch (error) {
                            console.error('Error handling apply modal:', error);
                            await interaction.reply({
                                content: '❌ An error occurred while processing your request.',
                                ephemeral: true
                            });
                        }
                        return;
                    }
                    else if (interaction.customId.startsWith('apply_reject_')) {
                        try {
                            const { ApplicationManager } = await Promise.resolve().then(() => __importStar(require('./src/apply/applyManager')));
                            const applicationManager = new ApplicationManager(this);
                            await applicationManager.handleReject(interaction);
                        }
                        catch (error) {
                            console.error('Error handling reject modal:', error);
                            await interaction.reply({
                                content: '❌ An error occurred while processing your request.',
                                ephemeral: true
                            });
                        }
                        return;
                    }
                    else if (interaction.customId.startsWith('ticket_close_modal_')) {
                        try {
                            const { TicketManager } = await Promise.resolve().then(() => __importStar(require('./src/ticket/ticketManager')));
                            const ticketManager = new TicketManager(this);
                            const reason = interaction.fields.getTextInputValue('ticket_close_reason');
                            await ticketManager.finalizeClose(interaction, reason);
                        }
                        catch (error) {
                            console.error('Error finalizing ticket close:', error);
                            await interaction.reply({
                                content: '❌ An error occurred while closing the ticket.',
                                ephemeral: true
                            });
                        }
                        return;
                    }
                    else if (interaction.customId.startsWith('suggestion_reject_modal_')) {
                        try {
                            const { handleStaffRejectModal } = await Promise.resolve().then(() => __importStar(require('./src/suggestions/suggestionHandler')));
                            await handleStaffRejectModal(interaction);
                        }
                        catch (error) {
                            console.error('Error handling suggestion reject modal:', error);
                            await interaction.reply({
                                content: '❌ An error occurred while updating the suggestion.',
                                ephemeral: true
                            });
                        }
                        return;
                    }
                }
                if ((interaction.isButton() || interaction.isStringSelectMenu()) &&
                    (interaction.customId === 'rules_select' ||
                        interaction.customId.startsWith('rules_view_'))) {
                    try {
                        const { RulesManager } = await Promise.resolve().then(() => __importStar(require('./src/rules/rulesManager')));
                        const rulesManager = new RulesManager(this);
                        await rulesManager.handleInteraction(interaction);
                    }
                    catch (error) {
                        console.error('Error handling rules interaction:', error);
                        if (interaction.isRepliable() && !interaction.replied) {
                            await interaction.reply({
                                content: '❌ An error occurred while viewing the rules.',
                                ephemeral: true
                            });
                        }
                    }
                    return;
                }
                if (interaction.isButton() || interaction.isStringSelectMenu()) {
                    if (interaction.customId === 'ticket_create' ||
                        interaction.customId.startsWith('ticket_create_')) {
                        try {
                            const { TicketManager } = await Promise.resolve().then(() => __importStar(require('./src/ticket/ticketManager')));
                            const ticketManager = new TicketManager(this);
                            if (interaction.isButton()) {
                                await ticketManager.handleInteraction(interaction);
                            }
                        }
                        catch (error) {
                            console.error('Error handling ticket creation:', error);
                            if (interaction.isRepliable() && !interaction.replied) {
                                await interaction.reply({
                                    content: '❌ An error occurred while creating your ticket.',
                                    ephemeral: true
                                });
                            }
                        }
                        return;
                    }
                    if (interaction.isButton() && interaction.customId.startsWith('ticket_claim_')) {
                        try {
                            const { TicketManager } = await Promise.resolve().then(() => __importStar(require('./src/ticket/ticketManager')));
                            const ticketManager = new TicketManager(this);
                            await ticketManager.handleClaim(interaction);
                        }
                        catch (error) {
                            console.error('Error handling ticket claim:', error);
                            if (interaction.isRepliable() && !interaction.replied) {
                                await interaction.reply({
                                    content: '❌ An error occurred while claiming the ticket.',
                                    ephemeral: true
                                });
                            }
                        }
                        return;
                    }
                    if (interaction.isButton() && interaction.customId.startsWith('ticket_close_')) {
                        try {
                            const { TicketManager } = await Promise.resolve().then(() => __importStar(require('./src/ticket/ticketManager')));
                            const ticketManager = new TicketManager(this);
                            await ticketManager.showCloseModal(interaction);
                        }
                        catch (error) {
                            console.error('Error handling ticket close:', error);
                            if (interaction.isRepliable() && !interaction.replied) {
                                await interaction.reply({
                                    content: '❌ An error occurred while closing the ticket.',
                                    ephemeral: true
                                });
                            }
                        }
                        return;
                    }
                    if (interaction.isButton() && interaction.customId.startsWith('ticket_reopen_')) {
                        try {
                            const { TicketManager } = await Promise.resolve().then(() => __importStar(require('./src/ticket/ticketManager')));
                            const ticketManager = new TicketManager(this);
                            await ticketManager.handleReopen(interaction);
                        }
                        catch (error) {
                            console.error('Error handling ticket reopen:', error);
                            if (interaction.isRepliable() && !interaction.replied) {
                                await interaction.reply({
                                    content: '❌ An error occurred while reopening the ticket.',
                                    ephemeral: true
                                });
                            }
                        }
                        return;
                    }
                    if (interaction.isButton() && interaction.customId.startsWith('ticket_delete_')) {
                        try {
                            const { TicketManager } = await Promise.resolve().then(() => __importStar(require('./src/ticket/ticketManager')));
                            const ticketManager = new TicketManager(this);
                            await ticketManager.handleDelete(interaction);
                        }
                        catch (error) {
                            console.error('Error handling ticket delete:', error);
                            if (interaction.isRepliable() && !interaction.replied) {
                                await interaction.reply({
                                    content: '❌ An error occurred while deleting the ticket.',
                                    ephemeral: true
                                });
                            }
                        }
                        return;
                    }
                    if (interaction.isButton() &&
                        (interaction.customId.startsWith('suggestion_approve_') ||
                            interaction.customId.startsWith('suggestion_reject_') ||
                            interaction.customId.startsWith('suggestion_pending_'))) {
                        try {
                            const { handleStaffInteraction } = await Promise.resolve().then(() => __importStar(require('./src/suggestions/suggestionHandler')));
                            await handleStaffInteraction(interaction);
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
                        return;
                    }
                }
                if (!interaction.isChatInputCommand())
                    return;
                const command = this.commands.get(interaction.commandName);
                if (!command || !command.command.enabled) {
                    await interaction.reply({
                        content: 'This command is currently disabled.',
                        ephemeral: true
                    });
                    return;
                }
                const cooldown = this.settings.commands?.[interaction.commandName]?.cooldown;
                if (cooldown > 0) {
                    const remaining = this.cooldownManager.getRemaining(interaction.user.id, interaction.commandName, cooldown);
                    if (remaining > 0) {
                        await interaction.reply({
                            content: `Please wait ${Math.ceil(remaining / 1000)} second(s) before using this command again.`,
                            ephemeral: true
                        });
                        return;
                    }
                }
                try {
                    await command.command.execute(interaction, [], this);
                    this.trackCommand(interaction.commandName);
                }
                catch (error) {
                    console.error(error);
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
                    }
                    else {
                        await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
                    }
                }
            });
            this.on(discord_js_1.Events.MessageCreate, async (message) => {
                if (message.author.bot)
                    return;
                if (message.guild && message.member) {
                    await (0, autoMod_1.handleMessage)(message);
                    if (!this.settings.automod?.enabled) {
                        await (0, antispamProtection_1.handleMessage)(message);
                    }
                }
                await (0, suggestionHandler_1.handleSuggestion)(message);
                await (0, autoReplyHandler_1.handleAutoReply)(message);
                const args = message.content.trim().split(/ +/);
                const firstToken = args.shift();
                if (!firstToken || !message.content.startsWith(config_1.default.defaultPrefix))
                    return;
                const commandName = firstToken.toLowerCase();
                let command = this.commands.get(commandName);
                if (!command && this.aliases.has(commandName)) {
                    command = this.commands.get(this.aliases.get(commandName));
                }
                if (!command || !command.command.enabled) {
                    return;
                }
                const cooldown = this.settings.commands?.[command.command.name]?.cooldown;
                if (cooldown > 0) {
                    const remaining = this.cooldownManager.getRemaining(message.author.id, command.command.name, cooldown);
                    if (remaining > 0) {
                        await message.reply(`Please wait ${Math.ceil(remaining / 1000)} second(s) before using this command again.`);
                        return;
                    }
                }
                try {
                    if (command.command.name === 'user' && args.length > 0) {
                        const targetId = args[0].replace(/[<@!>]/g, '');
                        try {
                            const member = await message.guild?.members.fetch(targetId);
                            if (member) {
                                message.targetMember = member;
                            }
                        }
                        catch (error) {
                            console.error('Error fetching member:', error);
                        }
                    }
                    await command.command.execute(message, args, this);
                    this.trackCommand(command.command.name);
                }
                catch (error) {
                    console.error(error);
                    await message.reply('There was an error executing that command.');
                }
            });
            this.settingsWatcher = new settingsWatcher_1.SettingsWatcher(this);
            this.settingsWatcher.start();
            this.on(discord_js_1.Events.MessageDelete, messageDelete_1.default);
            this.on(discord_js_1.Events.MessageUpdate, messageEdit_1.default);
            this.on(discord_js_1.Events.GuildRoleCreate, roleCreate_1.default);
            this.on(discord_js_1.Events.GuildRoleDelete, roleDelete_1.default);
            this.on(discord_js_1.Events.GuildRoleUpdate, roleUpdate_1.default);
            this.on(discord_js_1.Events.ChannelCreate, (channel) => {
                if ('guild' in channel) {
                    (0, channelProtection_1.handleChannelCreate)(channel);
                    (0, channelCreate_1.default)(channel);
                }
            });
            this.on(discord_js_1.Events.ChannelDelete, (channel) => {
                if ('guild' in channel) {
                    (0, channelProtection_1.handleChannelDelete)(channel);
                    (0, channelDelete_1.default)(channel);
                }
            });
            this.on(discord_js_1.Events.ChannelUpdate, (oldChannel, newChannel) => {
                if ('guild' in oldChannel && 'guild' in newChannel) {
                    (0, channelProtection_1.handleChannelUpdate)(oldChannel, newChannel);
                    (0, channelUpdate_1.default)(oldChannel, newChannel);
                }
            });
            this.on(discord_js_1.Events.GuildMemberAdd, async (member) => {
                if (member.user.bot) {
                    try {
                        const auditExecutor = await (0, auditLogManager_1.getAuditExecutor)(member.guild, discord_js_1.AuditLogEvent.BotAdd, { targetId: member.id });
                        if (auditExecutor) {
                            const executor = await member.guild.members.fetch(auditExecutor.id);
                            await (0, antibotProtection_1.handleBotAdd)(member, executor);
                        }
                        if (this.settings.autoRoles?.enabled && this.settings.autoRoles.bots?.enabled) {
                            try {
                                const botRoleIds = this.settings.autoRoles.bots.roleIds;
                                if (botRoleIds && botRoleIds.length > 0) {
                                    for (const roleId of botRoleIds) {
                                        const role = member.guild.roles.cache.get(roleId);
                                        if (role) {
                                            await member.roles.add(role, 'Auto role for bots');
                                            console.log(`Assigned auto role ${role.name} to bot ${member.user.tag}`);
                                        }
                                    }
                                }
                            }
                            catch (error) {
                                console.error('Error assigning auto roles to bot:', error);
                            }
                        }
                    }
                    catch (error) {
                        console.error('Error handling bot add protection:', error);
                    }
                }
                else {
                    if (this.settings.autoRoles?.enabled && this.settings.autoRoles.members?.enabled) {
                        try {
                            const memberRoleIds = this.settings.autoRoles.members.roleIds;
                            if (memberRoleIds && memberRoleIds.length > 0) {
                                for (const roleId of memberRoleIds) {
                                    const role = member.guild.roles.cache.get(roleId);
                                    if (role) {
                                        await member.roles.add(role, 'Auto role for members');
                                        console.log(`Assigned auto role ${role.name} to member ${member.user.tag}`);
                                    }
                                }
                            }
                        }
                        catch (error) {
                            console.error('Error assigning auto roles to member:', error);
                        }
                    }
                }
                await (0, memberJoin_1.default)(member);
                await (0, antiRaid_1.handleMemberJoin)(member);
                await (0, welcomeManager_1.handleMemberJoin)(member);
            });
            this.on(discord_js_1.Events.GuildMemberRemove, async (member) => {
                try {
                    await memberLeave_1.default(member);
                }
                catch (error) {
                    console.error('Error handling member leave log:', error);
                }
                try {
                    await (0, welcomeManager_1.handleMemberLeave)(member);
                }
                catch (error) {
                    console.error('Error handling goodbye flow:', error);
                }
            });
            this.on(discord_js_1.Events.GuildMemberUpdate, async (oldMember, newMember) => {
                if (oldMember.nickname !== newMember.nickname) {
                    await (0, nicknameUpdate_1.default)(oldMember, newMember);
                }
                const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
                for (const [_, role] of addedRoles) {
                    await (0, roleGive_1.default)(newMember, role);
                }
                const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
                for (const [_, role] of removedRoles) {
                    await (0, roleRemove_1.default)(newMember, role);
                }
                if (oldMember.communicationDisabledUntil !== newMember.communicationDisabledUntil) {
                    if (newMember.communicationDisabledUntil) {
                        await (0, memberTimeout_1.default)(newMember, oldMember.communicationDisabledUntil, newMember.communicationDisabledUntil);
                    }
                    else {
                        await (0, memberUntimeout_1.default)(newMember);
                    }
                }
                const wasTimedOut = !oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled();
                const wasUntimedOut = oldMember.isCommunicationDisabled() && !newMember.isCommunicationDisabled();
                if (wasTimedOut || wasUntimedOut) {
                    try {
                        const auditExecutor = await (0, auditLogManager_1.getAuditExecutor)(newMember.guild, discord_js_1.AuditLogEvent.MemberUpdate, { targetId: newMember.id });
                        if (!auditExecutor)
                            return;
                        const executor = await newMember.guild.members.fetch(auditExecutor.id);
                        if (wasTimedOut) {
                            await (0, timeoutProtection_1.handleTimeout)(newMember, executor);
                        }
                        else {
                            await (0, timeoutProtection_1.handleUntimeout)(newMember, executor);
                        }
                    }
                    catch (error) {
                        console.error('Error handling timeout protection:', error);
                    }
                }
            });
            this.on(discord_js_1.Events.MessageBulkDelete, messageBulkDelete_1.default);
            this.on(discord_js_1.Events.GuildUpdate, async (oldGuild, newGuild) => {
                await (0, serverUpdate_1.default)(oldGuild, newGuild);
                try {
                    const auditExecutor = await (0, auditLogManager_1.getAuditExecutor)(newGuild, discord_js_1.AuditLogEvent.GuildUpdate);
                    if (auditExecutor) {
                        const executor = await newGuild.members.fetch(auditExecutor.id);
                        await (0, serverProtection_1.handleServerUpdate)(oldGuild, newGuild, executor);
                    }
                }
                catch (error) {
                    console.error('Error handling server update protection:', error);
                }
            });
            this.on(discord_js_1.Events.GuildBanAdd, async (ban) => {
                await (0, memberBan_1.default)(ban);
                try {
                    const auditExecutor = await (0, auditLogManager_1.getAuditExecutor)(ban.guild, discord_js_1.AuditLogEvent.MemberBanAdd, { targetId: ban.user.id });
                    if (auditExecutor) {
                        const executor = await ban.guild.members.fetch(auditExecutor.id);
                        await (0, moderationProtection_1.handleBan)(ban.user, executor);
                    }
                }
                catch (error) {
                    console.error('Error handling ban protection:', error);
                }
            });
            this.on(discord_js_1.Events.GuildBanRemove, async (ban) => {
                await (0, memberUnban_1.default)(ban);
                try {
                    const auditExecutor = await (0, auditLogManager_1.getAuditExecutor)(ban.guild, discord_js_1.AuditLogEvent.MemberBanRemove, { targetId: ban.user.id });
                    if (auditExecutor) {
                        const executor = await ban.guild.members.fetch(auditExecutor.id);
                        await (0, moderationProtection_1.handleUnban)(ban.user, executor);
                    }
                }
                catch (error) {
                    console.error('Error handling unban protection:', error);
                }
            });
            this.on(discord_js_1.Events.GuildMemberRemove, async (member) => {
                try {
                    const auditExecutor = await (0, auditLogManager_1.getAuditExecutor)(member.guild, discord_js_1.AuditLogEvent.MemberKick, { targetId: member.id });
                    if (auditExecutor && member.joinedAt) {
                        const executor = await member.guild.members.fetch(auditExecutor.id);
                        await (0, memberKick_1.default)(member);
                        await (0, moderationProtection_1.handleKick)(member, executor);
                    }
                }
                catch (error) {
                    console.error('Error checking for kick:', error);
                }
            });
            this.on(discord_js_1.Events.GuildEmojiCreate, emojiCreate_1.default);
            this.on(discord_js_1.Events.GuildEmojiDelete, emojiDelete_1.default);
            this.on(discord_js_1.Events.GuildEmojiUpdate, emojiUpdate_1.default);
            this.on(discord_js_1.Events.GuildStickerCreate, stickerCreate_1.default);
            this.on(discord_js_1.Events.GuildStickerDelete, stickerDelete_1.default);
            this.on(discord_js_1.Events.GuildStickerUpdate, stickerUpdate_1.default);
            this.on(discord_js_1.Events.ThreadCreate, threadCreate_1.default);
            this.on(discord_js_1.Events.ThreadDelete, threadDelete_1.default);
            this.on(discord_js_1.Events.ThreadUpdate, threadUpdate_1.default);
            this.on(discord_js_1.Events.VoiceStateUpdate, (oldState, newState) => {
                (0, voiceJoin_1.default)(oldState, newState);
                (0, voiceLeave_1.default)(oldState, newState);
                (0, voiceMove_1.default)(oldState, newState);
                (0, voiceServerMute_1.default)(oldState, newState);
                (0, voiceServerDeafen_1.default)(oldState, newState);
            });
            this.on(discord_js_1.Events.InviteCreate, inviteCreate_1.default);
            this.on(discord_js_1.Events.GuildRoleCreate, roleProtection_1.handleRoleCreate);
            this.on(discord_js_1.Events.GuildRoleDelete, roleProtection_1.handleRoleDelete);
            this.on(discord_js_1.Events.GuildRoleUpdate, roleProtection_1.handleRoleUpdate);
            this.on(discord_js_1.Events.GuildMemberUpdate, (oldMember, newMember) => {
                const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
                const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
                for (const [_, role] of addedRoles) {
                    (0, roleProtection_1.handleRoleAdd)(newMember, role);
                }
                for (const [_, role] of removedRoles) {
                    (0, roleProtection_1.handleRoleRemove)(newMember, role);
                }
            });
            this.on(discord_js_1.Events.VoiceStateUpdate, tempChannelHandler_1.handleVoiceStateUpdate);
            await this.login(config_1.default.token);
            console.log(`Logged in as ${this.user?.tag}`);
            this.dashboard = new server_1.Dashboard(this);
            await this.dashboard.start();
            (0, cleanupTranscripts_1.startTranscriptCleanup)();
            await (0, giveawayManager_1.restoreGiveaways)(this);
            this.refreshAliases(settingsManager_1.getSettings());
            this.startStatsSampler();
        }
        catch (error) {
            console.error('Error during initialization:', error);
            throw error;
        }
    }
    async destroy() {
        if (this.settingsWatcher) {
            this.settingsWatcher.stop();
        }
        if (this.dashboard) {
            try {
                await this.dashboard.stop();
            }
            catch (error) {
                console.error('Error stopping dashboard:', error);
            }
        }
        await super.destroy();
    }
    getLocale(guildLocale) {
        return this.localeMap[guildLocale] || this.defaultLanguage || 'en';
    }
    refreshAliases(settings = this.settings) {
        this.aliases.clear();
        for (const [name, command] of this.commands) {
            const sources = [];
            if (command.command?.aliases && Array.isArray(command.command.aliases)) {
                sources.push(...command.command.aliases);
            }
            if (settings.commands?.[name]?.aliases && Array.isArray(settings.commands[name].aliases)) {
                sources.push(...settings.commands[name].aliases);
            }
            if (name === 'giveaway' && Array.isArray(settings.giveaway?.aliases)) {
                sources.push(...settings.giveaway.aliases);
            }
            for (const alias of new Set(sources)) {
                this.aliases.set(alias, name);
            }
        }
        console.log(`Registered ${this.aliases.size} aliases across ${this.commands.size} commands`);
    }
    trackCommand(commandName) {
        this.commandStats[commandName] = (this.commandStats[commandName] || 0) + 1;
        const day = new Date().toISOString().slice(0, 10);
        const bucket = this.dailyStats.get(day) || { commands: 0, users: 0 };
        bucket.commands++;
        this.dailyStats.set(day, bucket);
    }
    startStatsSampler() {
        const timer = setInterval(() => {
            const day = new Date().toISOString().slice(0, 10);
            const bucket = this.dailyStats.get(day) || { commands: 0, users: 0 };
            bucket.users = this.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0);
            this.dailyStats.set(day, bucket);
        }, 60000);
        if (timer.unref) {
            timer.unref();
        }
    }
    reloadSettings() {
        try {
            const newSettings = settingsManager_1.getSettings();
            this.settings = newSettings;
            if (newSettings.defaultLanguage !== this.defaultLanguage) {
                this.defaultLanguage = newSettings.defaultLanguage;
            }
            this.refreshAliases(newSettings);
            console.log('Settings reloaded successfully');
        }
        catch (error) {
            console.error('Error reloading settings:', error);
        }
    }
}
const bot = new ModBot();
exports.startup = bot.init();
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await bot.destroy();
    process.exit(0);
});
