"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dashboard = void 0;
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const path_1 = __importDefault(require("path"));
const config_1 = __importDefault(require("../config"));
const fs_1 = require("fs");
const path_2 = require("path");
const express_ejs_layouts_1 = __importDefault(require("express-ejs-layouts"));
const discord_js_1 = require("discord.js");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const axios_1 = __importDefault(require("axios"));
const crypto = require("crypto");
const settingsManager_1 = require("../src/utils/settingsManager");
const Warning_1 = require("../src/models/Warning");
const ModerationRecord_1 = require("../src/models/ModerationRecord");
const Ticket_1 = require("../src/models/Ticket");
const Suggestion_1 = require("../src/models/Suggestion");
const analytics_1 = require("../src/dashboard/analytics");
const validation_1 = require("../src/dashboard/validation");
const channelList_1 = require("../src/dashboard/channelList");
const suggestionHandler_1 = require("../src/suggestions/suggestionHandler");
const moderationService_1 = require("../src/moderation/moderationService");
const warningManager_1 = require("../src/moderation/warningManager");
const moderationHistory_1 = require("../src/moderation/moderationHistory");
const transcriptGenerator_1 = require("../src/ticket/transcriptGenerator");
const multer = require("multer");
const uploadGuard_1 = require("../src/welcome/uploadGuard");
const assetStore_1 = require("../src/welcome/assetStore");
const imageRenderer_1 = require("../src/welcome/imageRenderer");
const imageTemplates_1 = require("../src/welcome/imageTemplates");
const welcomeGoodbyeDefaults_1 = require("../src/welcome/welcomeGoodbyeDefaults");
const welcomeGoodbyeManager_1 = require("../src/welcome/welcomeGoodbyeManager");
const welcomeFormatter_1 = require("../src/utils/welcomeFormatter");
class Dashboard {
    constructor(client) {
        this.client = client;
        this.locales = {};
        this.app = (0, express_1.default)();
        this.startTime = new Date();
        this.isProduction = process.env.NODE_ENV === 'production';
        this.oauth = config_1.default.dashboard.oauth || {};
        this.ownerIds = config_1.default.dashboard.ownerIds || [];
        this.rateLimitStore = new Map();
        this.loadLocales();
        this.setup();
        this.routes();
    }
    loadLocales() {
        try {
            const localesPath = path_1.default.join(__dirname, 'locales');
            this.locales = {
                en: JSON.parse((0, fs_1.readFileSync)(path_1.default.join(localesPath, 'en.json'), 'utf-8')),
                ar: JSON.parse((0, fs_1.readFileSync)(path_1.default.join(localesPath, 'ar.json'), 'utf-8'))
            };
        }
        catch (error) {
            console.error('Error loading dashboard locales:', error);
        }
    }
    getLocale(lang = 'en') {
        return this.locales[lang] || this.locales['en'];
    }
    getUptime() {
        const now = new Date();
        const diff = now.getTime() - this.startTime.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (days > 0)
            return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0)
            return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }
    getPing() {
        return Math.round(this.client.ws.ping);
    }
getBreadcrumbs(path) {
        const parts = path.split('/').filter(Boolean);
        if (parts.length === 0)
            return 'Dashboard';
        return parts.map((part, index) => {
            const isLast = index === parts.length - 1;
            const formattedPart = part.charAt(0).toUpperCase() + part.slice(1);
            return isLast ? formattedPart : `${formattedPart} /`;
        }).join(' ');
    }
    clientView() {
        return { guilds: this.client.guilds };
    }
    configView() {
        return {
            mainGuildId: config_1.default.mainGuildId,
            defaultPrefix: config_1.default.defaultPrefix
        };
    }
    mainGuild() {
        return this.client.guilds.cache.get(config_1.default.mainGuildId) || null;
    }
    staffRoleIds(settings) {
        const s = settings || this.client.settings || {};
        const ids = new Set();
        const collect = (value) => {
            if (Array.isArray(value)) {
                value.forEach((id) => {
                    if (typeof id === 'string' && /^\d+$/.test(id)) {
                        ids.add(id);
                    }
                });
            }
        };
        collect(s.suggestions?.staffRoles);
        collect(s.automod?.staffRoles);
        (s.ticket?.sections || []).forEach((section) => collect(section.adminRoles));
        return ids;
    }
    isStaffMember(member, settings) {
        if (!member) {
            return false;
        }
        if (member.permissions?.has?.('Administrator')) {
            return true;
        }
        if (!member.roles?.cache) {
            return false;
        }
        const ids = this.staffRoleIds(settings);
        if (ids.size === 0) {
            return false;
        }
        return member.roles.cache.some((role) => ids.has(role.id));
    }
    isUserOwner(user) {
        return !!(user && this.ownerIds.length > 0 && this.ownerIds.includes(user.id));
    }
    hasGuildPermission(permissions, bit) {
        if (typeof permissions === 'string' && /^\d+$/.test(permissions)) {
            const value = BigInt(permissions);
            return (value & BigInt(bit)) !== 0n;
        }
        return false;
    }
    async requireGuildAdmin(req, res, next) {
        try {
            if (!this.isAuthenticated(req)) {
                if (req.path.startsWith('/api/')) {
                    if (req.path === '/api/logs/update') console.log(`[logs-update] middleware-authenticated=NO status=401`);
                    return res.status(401).json({ success: false, error: 'Unauthorized' });
                }
                return res.redirect('/auth/login');
            }
            const user = req.session.user;
            const isOwner = this.isUserOwner(user);
            const isGuildAdmin = !!(user && user.isGuildAdmin === true);
            let isStaff = false;
            if (!isOwner && !isGuildAdmin && user && user.id) {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (guild) {
                    const member = guild.members.cache.get(user.id) ||
                        await guild.members.fetch(user.id).catch(() => null);
                    isStaff = this.isStaffMember(member, this.client.settings);
                }
            }
            if (isOwner || isGuildAdmin || isStaff) {
                if (req.path === '/api/logs/update') console.log(`[logs-update] middleware-authenticated=YES middleware-authorized=YES owner=${isOwner} guildAdmin=${isGuildAdmin} staff=${isStaff} status=PASS`);
                return next();
            }
            if (req.path.startsWith('/api/')) {
                if (req.path === '/api/logs/update') console.log(`[logs-update] middleware-authenticated=YES middleware-authorized=NO status=403`);
                return res.status(403).json({ success: false, error: 'You need administrator permissions to perform this action.' });
            }
            return res.status(403).render('error', {
                title: '403 - Forbidden',
                error: { code: 403, message: 'You need administrator permissions to perform this action.' },
                path: req.path
            });
        }
        catch (error) {
            const errName = error && error.name ? String(error.name) : 'UNKNOWN';
            if (req.path === '/api/logs/update') console.log(`[logs-update] middleware-error name=${errName} status=403`);
            if (req.path.startsWith('/api/')) {
                return res.status(403).json({ success: false, error: 'You need administrator permissions to perform this action.' });
            }
            return res.status(403).render('error', {
                title: '403 - Forbidden',
                error: { code: 403, message: 'You need administrator permissions to perform this action.' },
                path: req.path
            });
        }
    }
    isAuthenticated(req) {
        return !!(req.session && req.session.user &&
            (req.session.user.isGuildMember || this.isUserOwner(req.session.user)));
    }
    requireOwner(req, res, next) {
        if (!this.isAuthenticated(req)) {
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }
            return res.redirect('/auth/login');
        }
        if (!this.isUserOwner(req.session.user)) {
            if (req.path.startsWith('/api/')) {
                return res.status(403).json({ success: false, error: 'Forbidden' });
            }
            return res.status(403).render('error', {
                title: '403 - Forbidden',
                error: { code: 403, message: 'You do not have permission to access this page.' }
            });
        }
        next();
    }
    rateLimiter(limit = 120, windowMs = 60000) {
        const store = this.rateLimitStore;
        return (req, res, next) => {
            const ip = req.ip || req.connection?.remoteAddress || 'unknown';
            const now = Date.now();
            let bucket = store.get(ip);
            if (!bucket || bucket.resetAt <= now) {
                bucket = { count: 0, resetAt: now + windowMs };
            }
            bucket.count++;
            store.set(ip, bucket);
            if (store.size > 5000) {
                for (const [key, b] of store) {
                    if (b.resetAt <= now) {
                        store.delete(key);
                    }
                }
            }
            if (bucket.count > limit) {
                res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000).toString());
                return res.status(429).json({ success: false, error: 'Too many requests, please slow down.' });
            }
            next();
        };
    }
    csrfProtection() {
        return (req, res, next) => {
            const method = req.method;
            if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
                return next();
            }
            const origin = req.headers.origin || req.headers.referer || '';
            if (!origin) {
                return next();
            }
            const host = req.get('host');
            let valid = false;
            try {
                valid = new URL(origin).host === host;
            }
            catch (_error) {
                valid = false;
            }
            if (!valid) {
                if (req.path === '/api/logs/update') console.log(`[logs-update] middleware-csrf=REJECTED status=403`);
                return res.status(403).json({ success: false, error: 'Invalid request origin.' });
            }
            next();
        };
    }
    buildTrends() {
        const days = Array.from(this.client.dailyStats?.entries() || [])
            .sort((a, b) => a[0].localeCompare(b[0]));
        let commandsDelta = 0;
        if (days.length >= 2) {
            commandsDelta = days[days.length - 1][1].commands - days[days.length - 2][1].commands;
        }
        else if (days.length === 1) {
            commandsDelta = days[0][1].commands;
        }
        const trend = (delta) => ({
            percentage: delta === 0 ? 0 : Math.abs(delta),
            direction: delta >= 0 ? 'up' : 'down',
            period: 'day'
        });
        return {
            servers: { percentage: 0, direction: 'up', period: 'week' },
            users: { percentage: 0, direction: 'up', period: 'month' },
            commands: trend(commandsDelta)
        };
    }
    setup() {
        this.app.set('view engine', 'ejs');
        this.app.set('views', path_1.default.join(__dirname, 'views'));
        this.app.use(express_ejs_layouts_1.default);
this.app.set('layout', 'layouts/main');
        this.app.set('layout extractScripts', true);
        this.app.set('layout extractStyles', true);
        this.app.disable('x-powered-by');
        this.app.use((req, res, next) => {
            res.locals = {
                ...res.locals,
                locale: this.getLocale(res.locals.currentLang),
                path: req.path,
                currentLang: res.locals.currentLang || 'en',
                title: 'Dashboard',
                renderPartial: (name) => {
                    try {
                        const partialPath = path_1.default.join(__dirname, 'views', 'partials', `${name}.ejs`);
                        return require('ejs').render(require('fs').readFileSync(partialPath, 'utf8'), res.locals);
                    }
                    catch (error) {
                        console.error(`Error rendering partial ${name}:`, error);
                        return `<div class="error">Error loading ${name}</div>`;
                    }
                }
            };
            next();
        });
        this.app.use(express_1.default.static(path_1.default.join(__dirname, 'public')));
        this.app.use((req, res, next) => {
            res.locals.path = req.path;
            next();
        });
const isProduction = process.env.NODE_ENV === 'production';
        this.app.use((0, express_session_1.default)({
            secret: config_1.default.dashboard.secret,
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: isProduction,
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000
            }
        }));
        this.app.use(express_1.default.json());
        this.app.use((0, cookie_parser_1.default)());
        this.app.use((req, res, next) => {
            const lang = req.query.lang ||
                req.cookies?.preferredLanguage ||
                'en';
            const validLang = ['en', 'ar'].includes(lang) ? lang : 'en';
res.cookie('preferredLanguage', validLang, {
                maxAge: 365 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                path: '/',
                secure: isProduction
            });
            res.locals.locale = this.getLocale(validLang);
            res.locals.currentLang = validLang;
            res.setHeader('Content-Language', validLang);
            next();
        });
        this.app.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('Referrer-Policy', 'no-referrer');
            res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
            res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://code.jquery.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; font-src 'self' data: https://cdnjs.cloudflare.com; img-src 'self' data: blob: https:; connect-src 'self'");
            if (this.isProduction) {
                res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
            }
            next();
        });
        this.app.use(this.rateLimiter());
        this.app.use(this.csrfProtection());
        this.app.use((req, res, next) => {
            res.locals.user = req.session?.user || null;
            res.locals.isAuthenticated = this.isAuthenticated(req);
            res.locals.isOwner = req.session?.user ? this.isUserOwner(req.session.user) : false;
            next();
        });
        this.app.use((req, res, next) => {
            res.locals.ping = this.getPing();
            res.locals.uptime = this.getUptime();
            res.locals.path = req.path;
            res.locals.breadcrumbs = this.getBreadcrumbs(req.path);
            next();
        });
    }
routes() {
        this.app.get('/auth/login', async (req, res) => {
            const currentLang = req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            if (this.isAuthenticated(req)) {
                return res.redirect('/');
            }
            if (!this.oauth.clientId || !this.oauth.clientSecret) {
                return res.render('login', {
                    layout: 'layouts/auth',
                    title: 'Login',
                    error: 'Discord OAuth is not configured. Set dashboard.oauth.clientId/clientSecret in config to enable dashboard login.',
                    client: this.clientView(),
                    config: this.configView(),
                    currentLang,
                    locale,
                    path: '/auth/login'
                });
            }
            const state = crypto.randomBytes(16).toString('hex');
            req.session.authState = state;
            const params = new URLSearchParams({
                client_id: this.oauth.clientId,
                redirect_uri: config_1.default.dashboard.callbackUrl,
                response_type: 'code',
                scope: this.oauth.scopes.join(' '),
                state
            });
            return res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
        });
        this.app.get('/auth/callback', async (req, res) => {
            const currentLang = req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            try {
                const code = req.query.code;
                const state = req.query.state;
                if (!code || !state || !req.session.authState || state !== req.session.authState) {
                    return res.status(400).render('login', {
                        layout: 'layouts/auth',
                        title: 'Login',
                        error: 'Invalid OAuth state. Please try logging in again.',
                        client: this.clientView(),
                        config: this.configView(),
                        currentLang,
                        locale,
                        path: '/auth/callback'
                    });
                }
                req.session.authState = null;
                const tokenRes = await axios_1.default.post('https://discord.com/api/oauth2/token', new URLSearchParams({
                    client_id: this.oauth.clientId,
                    client_secret: this.oauth.clientSecret,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: config_1.default.dashboard.callbackUrl
                }), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                const accessToken = tokenRes.data.access_token;
                const [userRes, guildsRes] = await Promise.all([
                    axios_1.default.get('https://discord.com/api/users/@me', {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    }),
                    axios_1.default.get('https://discord.com/api/users/@me/guilds', {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    })
                ]);
                const guild = guildsRes.data.find((g) => g.id === config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(403).render('login', {
                        layout: 'layouts/auth',
                        title: 'Login',
                        error: 'You must be a member of the configured Discord server to access this dashboard.',
                        client: this.clientView(),
                        config: this.configView(),
                        currentLang,
                        locale,
                        path: '/auth/callback'
                    });
                }
                const user = userRes.data;
                const isOwner = this.isUserOwner(user);
                const isGuildAdmin = this.hasGuildPermission(guild.permissions, 8) ||
                    this.hasGuildPermission(guild.permissions, 32);
                req.session.user = {
                    id: user.id,
                    username: user.username,
                    globalName: user.global_name || user.username,
                    avatar: user.avatar
                        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
                        : null,
                    role: isOwner ? 'owner' : 'admin',
                    isGuildMember: true,
                    isGuildAdmin,
                    guildName: guild.name
                };
                return res.redirect('/');
            }
            catch (error) {
                console.error('Error in OAuth callback:', error);
                return res.status(500).render('login', {
                    layout: 'layouts/auth',
                    title: 'Login',
                    error: 'Failed to authenticate with Discord. Please try again.',
                    client: this.clientView(),
                    config: this.configView(),
                    currentLang,
                    locale,
                    path: '/auth/callback'
                });
            }
        });
        this.app.get('/auth/logout', (req, res) => {
            req.session.destroy(() => {
                res.redirect('/auth/login');
            });
        });
        this.app.get('/api/auth/me', (req, res) => {
            if (!this.isAuthenticated(req)) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }
            const role = this.isUserOwner(req.session.user) ? 'owner' : 'admin';
            return res.json({ success: true, user: { ...req.session.user, role } });
        });
        this.app.use((req, res, next) => {
            if (!this.isAuthenticated(req)) {
                if (req.path.startsWith('/api/')) {
                    if (req.path === '/api/logs/update') console.log(`[logs-update] middleware-authenticated=NO status=401`);
                    return res.status(401).json({ success: false, error: 'Unauthorized' });
                }
                if (req.path !== '/' && !req.path.startsWith('/auth/')) {
                    return res.redirect('/auth/login');
                }
            }
            next();
        });
        this.app.use((req, res, next) => {
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                Promise.resolve(this.requireGuildAdmin(req, res, next)).catch(next);
                return;
            }
            next();
        });
this.app.get('/', async (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            if (!this.isAuthenticated(_req)) {
                return res.render('landing', {
                    layout: 'layouts/landing',
                    title: currentLang === 'ar' ? 'Viora' : 'Viora',
                    currentLang,
                    locale,
                    path: '/'
                });
            }
            try {
const stats = await this.generateDashboardStats();
                const moduleStatus = this.getModuleStatus();
                const recentActivity = await this.getRecentActivity();
                const trends = this.buildTrends();
                return res.render('index', {
                    title: locale.dashboard.title,
                    stats,
                    trends,
                    moduleStatus,
                    recentActivity,
                    settings: this.client.settings,
                    client: this.clientView(),
                    config: this.configView(),
                    path: '/',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/')
                });
            }
            catch (error) {
                console.error('Error rendering index page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale
                });
            }
        });
        this.app.get('/docs', (_req, res) => {
            try {
                const currentLang = _req.cookies?.preferredLanguage || 'en';
                const locale = this.getLocale(currentLang);
                return res.render('docs', {
                    page: 'docs',
                    title: locale.docs.title || 'Documentation',
                    settings: this.client.settings,
                    client: this.clientView(),
                    config: this.configView(),
                    path: '/docs',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/docs')
                });
            }
            catch (error) {
                console.error('Error rendering documentation page:', error);
                return res.status(500).render('error', {
                    page: 'error',
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en'),
                    path: '/docs'
                });
            }
        });
        this.app.get('/settings', async (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            try {
                return res.render('settings', {
                    title: locale.dashboard.settings?.title || 'Bot Settings',
                    settings: this.client.settings,
                    client: this.clientView(),
                    config: this.configView(),
                    path: '/settings',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/settings')
                });
            }
            catch (error) {
                console.error('Error rendering settings page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale
                });
            }
        });
        this.app.get('/commands', (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            const categories = [
                {
                    id: 'general',
                    name: locale.dashboard.commands.general,
                    icon: 'users',
                    color: 'blue'
                },
                {
                    id: 'moderation',
                    name: locale.dashboard.commands.moderation,
                    icon: 'shield-alt',
                    color: 'purple'
                },
                {
                    id: 'utility',
                    name: locale.dashboard.commands.utility || 'Utility',
                    icon: 'tools',
                    color: 'green'
                }
            ];
            res.render('command-categories', {
                title: locale.dashboard.commands.title,
                categories,
                path: '/commands',
                currentLang,
                locale,
                breadcrumbs: this.getBreadcrumbs('/commands')
            });
        });
        this.app.get('/commands/general', (_req, res) => {
            const generalCommands = ['avatar', 'banner', 'ping', 'roles', 'server', 'user'].map(cmd => ({
                name: cmd,
                description: res.locals.locale.dashboard.commandDescriptions[cmd] || `${cmd} command`,
                enabled: this.client.settings.commands[cmd]?.enabled ?? false,
                aliases: this.client.settings.commands[cmd]?.aliases ?? [],
                cooldown: this.client.settings.commands[cmd]?.cooldown ?? 5
            }));
            res.render('commands', {
                title: res.locals.locale.dashboard.commands.general,
                page: 'general',
                commands: generalCommands,
                roles: this.client.guilds.cache.first()?.roles.cache.map(role => ({
                    id: role.id,
                    name: role.name
                })) ?? []
            });
        });
        this.app.get('/commands/moderation', (_req, res) => {
            const modCommands = ['ban', 'kick', 'mute', 'unmute', 'warn', 'unwarn', 'clear', 'lock', 'unlock', 'hide', 'unhide', 'move', 'timeout', 'rtimeout'].map(cmd => ({
                name: cmd,
                description: res.locals.locale.dashboard.commandDescriptions[cmd] || `${cmd} command`,
                enabled: this.client.settings.commands[cmd]?.enabled ?? false,
                aliases: this.client.settings.commands[cmd]?.aliases ?? [],
                cooldown: this.client.settings.commands[cmd]?.cooldown ?? 5
            }));
            res.render('commands', {
                title: res.locals.locale.dashboard.commands.moderation,
                page: 'moderation',
                commands: modCommands,
                roles: this.client.guilds.cache.first()?.roles.cache.map(role => ({
                    id: role.id,
                    name: role.name
                })) ?? []
            });
        });
        this.app.get('/commands/utility', (_req, res) => {
            const utilityCommands = ['setnick', 'role', 'rrole', 'warns', 'apply', 'ticket', 'unban'].map(cmd => ({
                name: cmd,
                description: res.locals.locale.dashboard.commandDescriptions[cmd] || `${cmd} command`,
                enabled: this.client.settings.commands[cmd]?.enabled ?? false,
                aliases: this.client.settings.commands[cmd]?.aliases ?? [],
                cooldown: this.client.settings.commands[cmd]?.cooldown ?? 5
            }));
            res.render('commands', {
                title: res.locals.locale.dashboard.commands.utility || 'Utility Commands',
                page: 'utility',
                commands: utilityCommands,
                roles: this.client.guilds.cache.first()?.roles.cache.map(role => ({
                    id: role.id,
                    name: role.name
                })) ?? []
            });
        });
        this.app.post('/api/commands/toggle', async (req, res) => {
            try {
                const { command, enabled } = req.body;
                console.log('Toggling command:', command, enabled);
                if (!command) {
                    return res.status(400).json({ error: 'Command name is required' });
                }
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                if (!currentSettings.commands[command]) {
                    currentSettings.commands[command] = {
                        enabled: enabled,
                        aliases: [],
                        cooldown: 5,
                        permissions: {
                            enabledRoleIds: [],
                            disabledRoleIds: []
                        }
                    };
                }
                else {
                    currentSettings.commands[command].enabled = enabled;
                }
                settingsManager_1.persist();
                currentSettings = settingsManager_1.getSettings();
                this.client.settings = currentSettings;
                const verifySettings = settingsManager_1.getSettings();
                console.log('Verified settings update:', {
                    command,
                    enabled: verifySettings.commands[command].enabled,
                    fileContent: verifySettings.commands[command]
                });
                return res.json({
                    success: true,
                    command,
                    enabled,
                    settings: verifySettings.commands[command]
                });
            }
            catch (error) {
                console.error('Error toggling command:', error);
                return res.status(500).json({ error: 'Failed to toggle command' });
            }
        });
        this.app.get('/api/commands/:command/permissions', (req, res) => {
            try {
                const command = req.params.command;
                if (!this.client.settings.commands[command]) {
                    return res.status(404).json({ error: 'Command not found' });
                }
                const permissions = this.client.settings.commands[command]?.permissions ?? {
                    enabledRoleIds: [],
                    disabledRoleIds: []
                };
                return res.json(permissions);
            }
            catch (error) {
                console.error('Error getting permissions:', error);
                return res.status(500).json({ error: 'Failed to get permissions' });
            }
        });
        this.app.post('/api/commands/:command/permissions', async (req, res) => {
            try {
                const { command } = req.params;
                const { enabledRoleIds, disabledRoleIds } = req.body;
                if (!this.client.settings.commands[command]) {
                    return res.status(404).json({ error: 'Command not found' });
                }
                this.client.settings.commands[command].permissions = {
                    enabledRoleIds,
                    disabledRoleIds
                };
                await this.saveSettings();
                return res.json({ success: true });
            }
            catch (error) {
                console.error('Error updating permissions:', error);
                return res.status(500).json({ error: 'Failed to update permissions' });
            }
        });
        this.app.post('/api/commands/:command/update', async (req, res) => {
            try {
                const { command } = req.params;
                const settings = req.body;
                if (!this.client.settings.commands[command]) {
                    return res.status(404).json({ error: 'Command not found' });
                }
                this.client.settings.commands[command] = {
                    ...this.client.settings.commands[command],
                    ...settings
                };
                await this.saveSettings();
                return res.json({ success: true });
            }
            catch (error) {
                console.error('Error updating command settings:', error);
                return res.status(500).json({ error: 'Failed to update command settings' });
            }
        });
        this.app.get('/api/roles', async (_req, res) => {
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }
                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.color,
                    position: role.position
                }));
                return res.json(roles);
            }
            catch (error) {
                console.error('Error fetching roles:', error);
                return res.status(500).json({ error: 'Failed to fetch roles' });
            }
        });
        this.app.get('/api/commands/:command/settings', async (req, res) => {
            try {
                const { command } = req.params;
                const settingsPath = settingsManager_1.getSettingsPath();
                const currentSettings = settingsManager_1.getSettings();
                if (!currentSettings.commands[command]) {
                    return res.status(404).json({ error: 'Command not found' });
                }
                return res.json(currentSettings.commands[command]);
            }
            catch (error) {
                console.error('Error fetching command settings:', error);
                return res.status(500).json({ error: 'Failed to fetch command settings' });
            }
        });
        this.app.post('/api/commands/:command/settings', async (req, res) => {
            try {
                const { command } = req.params;
                const { aliases, permissions } = req.body;
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                if (!currentSettings.commands[command]) {
                    return res.status(404).json({ error: 'Command not found' });
                }
                currentSettings.commands[command] = {
                    ...currentSettings.commands[command],
                    aliases: aliases || [],
                    permissions: {
                        enabledRoleIds: permissions?.enabledRoleIds || [],
                        disabledRoleIds: permissions?.disabledRoleIds || []
                    }
                };
                settingsManager_1.persist();
                currentSettings = settingsManager_1.getSettings();
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.commands[command]
                });
            }
            catch (error) {
                console.error('Error saving command settings:', error);
                return res.status(500).json({ error: 'Failed to save command settings' });
            }
        });
        this.app.get('/api/channels', async (_req, res) => {
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }
                const channels = guild.channels.cache
                    .filter(channel => channel.type === 0)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name,
                    type: channel.type
                }));
                return res.json(channels);
            }
            catch (error) {
                console.error('Error fetching channels:', error);
                return res.status(500).json({ error: 'Failed to fetch channels' });
            }
        });
        this.app.get('/logs', (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' },
                        currentLang,
                        locale,
                        path: '/logs'
                    });
                }
                const channels = guild.channels.cache
                    .filter(channel => channel.type === 0)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                return res.render('logs', {
                    title: locale.dashboard.logs.title,
                    settings: this.client.settings,
                    channels,
                    path: '/logs',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/logs')
                });
            }
            catch (error) {
                console.error('Error rendering logs page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale,
                    path: '/logs'
                });
            }
        });
this.app.post('/api/logs/update', async (req, res) => {
            const safeLogType = req.body && typeof req.body.logType === 'string' ? req.body.logType.slice(0, 40) : '';
            const safeChannelId = req.body && req.body.settings && typeof req.body.settings.channelId === 'string' ? req.body.settings.channelId.slice(0, 24) : '';
            try {
                const { logType, settings } = req.body;
                if (!logType || !settings || typeof settings !== 'object') {
                    console.log(`[logs-update] status=400 reason=missing-or-invalid-body validated=NO`);
                    return res.status(400).json({ error: 'Missing required parameters' });
                }
                if (settings.channelId !== undefined) {
                    const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                    const channelId = String(settings.channelId);
                    if (channelId !== '') {
                        const snowflakeOk = /^\d{6,20}$/.test(channelId);
                        const channel = guild ? guild.channels.cache.get(channelId) : null;
                        if (!snowflakeOk) {
                            console.log(`[logs-update] status=400 reason=invalid-snowflake validated=NO`);
                            return res.status(400).json({ error: 'Invalid channel ID format.' });
                        }
                        if (!channel || channel.type !== 0) {
                            console.log(`[logs-update] status=400 reason=channel-not-text-or-other-guild validated=NO`);
                            return res.status(400).json({ error: 'Channel must be a text channel in the configured server.' });
                        }
                    }
                }
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                if (!currentSettings.logs[logType]) {
                    console.log(`[logs-update] status=404 reason=log-type-not-found validated=NO logType=${safeLogType}`);
                    return res.status(404).json({ error: 'Log type not found' });
                }
                currentSettings.logs[logType] = {
                    ...currentSettings.logs[logType],
                    ...settings
                };
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                console.log(`[logs-update] status=200 validated=YES persisted=YES logType=${safeLogType} channelId-preview=${safeChannelId}`);
                return res.json({
                    success: true,
                    settings: currentSettings.logs[logType]
                });
            }
            catch (error) {
                const errName = error && error.name ? String(error.name) : 'UNKNOWN';
                const errCode = error && error.code !== undefined ? String(error.code) : 'n/a';
                console.log(`[logs-update] status=500 error=${errName} code=${errCode} validated=NO logType=${safeLogType}`);
                return res.status(500).json({ error: 'Failed to update log settings' });
            }
        });
        this.app.get('/protection', async (_req, res) => {
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' }
                    });
                }
                const channels = guild.channels.cache
                    .filter(channel => channel.type === 0)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.hexColor
                }));
                res.render('protection', {
                    title: res.locals.locale.dashboard.protection.title,
                    settings: this.client.settings,
                    channels: channels,
                    roles: roles,
                    path: '/protection'
                });
            }
            catch (error) {
                console.error('Error rendering protection page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });
        this.app.post('/api/protection/settings', async (req, res) => {
            try {
                const settings = req.body;
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                currentSettings.protection = {
                    ...currentSettings.protection,
                    ...settings
                };
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({ success: true });
            }
            catch (error) {
                console.error('Error saving protection settings:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save protection settings'
                });
            }
        });
        this.app.post('/api/protection/update', async (req, res) => {
            try {
                const { section, settings } = req.body;
                if (!section || !settings) {
                    return res.status(400).json({ error: 'Missing required parameters' });
                }
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                if (!currentSettings.protection) {
                    currentSettings.protection = {};
                }
                if (!currentSettings.protection[section]) {
                    currentSettings.protection[section] = {};
                }
                currentSettings.protection[section] = {
                    ...currentSettings.protection[section],
                    ...settings
                };
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.protection[section]
                });
            }
            catch (error) {
                console.error('Error updating protection settings:', error);
                return res.status(500).json({ error: 'Failed to update protection settings' });
            }
        });
        this.app.get('/tickets', async (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' },
                        currentLang,
                        locale,
                        path: '/tickets'
                    });
                }
                const channels = guild.channels.cache
                    .filter(channel => channel.type === discord_js_1.ChannelType.GuildText)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                const categories = guild.channels.cache
                    .filter(channel => channel.type === discord_js_1.ChannelType.GuildCategory)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.hexColor || '#ffffff'
                }));
                return res.render('tickets', {
                    title: locale.dashboard.tickets.title,
                    settings: this.client.settings,
                    channels,
                    categories,
                    roles,
                    path: '/tickets',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/tickets')
                });
            }
            catch (error) {
                console.error('Error rendering tickets page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale,
                    path: '/tickets'
                });
            }
        });
        this.app.post('/api/tickets/settings', async (req, res) => {
            try {
                const settings = req.body;
                if (settings.embed) {
                    if (settings.embed.thumbnail === '')
                        settings.embed.thumbnail = null;
                    if (settings.embed.footerIcon === '')
                        settings.embed.footerIcon = null;
                }
                if (settings.sections && Array.isArray(settings.sections)) {
                    settings.sections.forEach((section) => {
                        if (section.imageUrl === '')
                            section.imageUrl = null;
                    });
                }
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                currentSettings.ticket = {
                    ...currentSettings.ticket,
                    ...settings
                };
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.ticket
                });
            }
            catch (error) {
                console.error('Error saving ticket settings:', error);
                return res.status(500).json({ error: 'Failed to save ticket settings' });
            }
        });
        this.app.get('/api/tickets/:section/settings', async (req, res) => {
            try {
                const { section } = req.params;
                const settingsPath = settingsManager_1.getSettingsPath();
                const currentSettings = settingsManager_1.getSettings();
                if (!currentSettings.ticket.sections[section]) {
                    return res.status(404).json({ error: 'Section not found' });
                }
                return res.json(currentSettings.ticket.sections[section]);
            }
            catch (error) {
                console.error('Error fetching ticket section settings:', error);
                return res.status(500).json({ error: 'Failed to fetch section settings' });
            }
        });
        this.app.post('/api/tickets/:section/settings', async (req, res) => {
            try {
                const { section } = req.params;
                const settings = req.body;
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                if (!currentSettings.ticket.sections[section]) {
                    return res.status(404).json({ error: 'Section not found' });
                }
                currentSettings.ticket.sections[section] = {
                    ...currentSettings.ticket.sections[section],
                    ...settings
                };
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.ticket.sections[section]
                });
            }
            catch (error) {
                console.error('Error updating ticket section settings:', error);
                return res.status(500).json({ error: 'Failed to update section settings' });
            }
        });
        this.app.post('/api/tickets/sections/add', async (req, res) => {
            try {
                const newSection = req.body;
                if (newSection.imageUrl === '') {
                    newSection.imageUrl = null;
                }
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                currentSettings.ticket.sections.push(newSection);
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    section: newSection
                });
            }
            catch (error) {
                console.error('Error adding ticket section:', error);
                return res.status(500).json({ error: 'Failed to add ticket section' });
            }
        });
        this.app.delete('/api/tickets/sections/:index', async (req, res) => {
            try {
                const { index } = req.params;
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                if (!currentSettings.ticket.sections[index]) {
                    return res.status(404).json({ error: 'Section not found' });
                }
                currentSettings.ticket.sections.splice(parseInt(index), 1);
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({ success: true });
            }
            catch (error) {
                console.error('Error deleting ticket section:', error);
                return res.status(500).json({ error: 'Failed to delete ticket section' });
            }
        });
        this.app.get('/apply', async (_req, res) => {
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' }
                    });
                }
                const channels = guild.channels.cache
                    .filter(channel => channel.type === discord_js_1.ChannelType.GuildText)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.hexColor,
                    position: role.position
                }));
                res.render('apply', {
                    title: res.locals.locale.dashboard.apply.title,
                    settings: this.client.settings,
                    channels,
                    roles,
                    path: '/apply'
                });
            }
            catch (error) {
                console.error('Error rendering apply page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });
        this.app.get('/api/apply/settings', async (_req, res) => {
            try {
                const settingsPath = settingsManager_1.getSettingsPath();
                const currentSettings = settingsManager_1.getSettings();
                return res.json(currentSettings.apply || {
                    enabled: false,
                    embed: {
                        color: "#3498db",
                        thumbnail: "",
                        footer: "Powered by Wick System",
                        footerIcon: "",
                        timestamp: true
                    },
                    positions: []
                });
            }
            catch (error) {
                console.error('Error fetching apply settings:', error);
                return res.status(500).json({ error: 'Failed to fetch apply settings' });
            }
        });
        this.app.post('/api/apply/settings', async (req, res) => {
            try {
                const settings = req.body;
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                currentSettings.apply = {
                    ...currentSettings.apply,
                    ...settings
                };
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.apply
                });
            }
            catch (error) {
                console.error('Error saving apply settings:', error);
                return res.status(500).json({ error: 'Failed to save apply settings' });
            }
        });
        this.app.delete('/api/apply/positions/:index', async (req, res) => {
            try {
                const { index } = req.params;
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                if (!currentSettings.apply?.positions[index]) {
                    return res.status(404).json({ error: 'Position not found' });
                }
                currentSettings.apply.positions.splice(parseInt(index), 1);
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({ success: true });
            }
            catch (error) {
                console.error('Error deleting position:', error);
                return res.status(500).json({ error: 'Failed to delete position' });
            }
        });
        this.app.post('/api/apply/positions/add', async (req, res) => {
            try {
                const newPosition = req.body;
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                if (!currentSettings.apply) {
                    currentSettings.apply = {
                        enabled: false,
                        embed: {
                            color: "#3498db",
                            thumbnail: "",
                            footer: "Powered by Wick System",
                            footerIcon: "",
                            timestamp: true
                        },
                        positions: []
                    };
                }
                currentSettings.apply.positions.push(newPosition);
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    position: newPosition
                });
            }
            catch (error) {
                console.error('Error adding position:', error);
                return res.status(500).json({ error: 'Failed to add position' });
            }
        });
        this.app.get('/rules', async (_req, res) => {
            try {
                res.render('rules', {
                    title: res.locals.locale.dashboard.rules.title,
                    settings: this.client.settings,
                    path: '/rules',
                    script: `<script>
                        window.settings = ${JSON.stringify(this.client.settings)};
                        console.log('Settings loaded:', window.settings);
                    </script>`
                });
            }
            catch (error) {
                console.error('Error rendering rules page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });
        this.app.post('/api/rules/settings', async (req, res) => {
            try {
                const settings = req.body;
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                currentSettings.rules = {
                    ...currentSettings.rules,
                    ...settings
                };
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.rules
                });
            }
            catch (error) {
                console.error('Error saving rules settings:', error);
                return res.status(500).json({ error: 'Failed to save rules settings' });
            }
        });
        this.app.get('/giveaway', async (_req, res) => {
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' }
                    });
                }
                const channels = guild.channels.cache
                    .filter(channel => channel.type === discord_js_1.ChannelType.GuildText)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.hexColor
                }));
                res.render('giveaway', {
                    title: res.locals.locale.dashboard.giveaway.title,
                    settings: this.client.settings,
                    channels,
                    roles,
                    path: '/giveaway'
                });
            }
            catch (error) {
                console.error('Error rendering giveaway page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });
        this.app.post('/api/giveaway/settings', async (req, res) => {
            try {
                const settings = req.body;
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                currentSettings.giveaway = {
                    ...currentSettings.giveaway,
                    ...settings
                };
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.giveaway
                });
            }
            catch (error) {
                console.error('Error saving giveaway settings:', error);
                return res.status(500).json({ error: 'Failed to save giveaway settings' });
            }
        });
        this.app.get('/tempchannels', async (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' },
                        currentLang,
                        locale,
                        path: '/tempchannels'
                    });
                }
                const channels = guild.channels.cache
                    .filter(channel => channel.type === discord_js_1.ChannelType.GuildVoice)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                const categories = guild.channels.cache
                    .filter(channel => channel.type === discord_js_1.ChannelType.GuildCategory)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.hexColor || '#ffffff'
                }));
                return res.render('tempChannels', {
                    title: locale.dashboard.tempChannels.title,
                    settings: this.client.settings,
                    channels,
                    categories,
                    roles,
                    path: '/tempchannels',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/tempchannels')
                });
            }
            catch (error) {
                console.error('Error rendering temp channels page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale,
                    path: '/tempchannels'
                });
            }
        });
        this.app.post('/api/tempchannels/settings', async (req, res) => {
            try {
                const settings = req.body;
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                currentSettings.tempChannels = {
                    ...currentSettings.tempChannels,
                    ...settings
                };
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.tempChannels
                });
            }
            catch (error) {
                console.error('Error saving temp channels settings:', error);
                return res.status(500).json({ error: 'Failed to save temp channels settings' });
            }
        });
        this.app.get('/autoreply', async (_req, res) => {
            try {
                const settings = settingsManager_1.getSettings();
                res.render('autoReply', {
                    title: res.locals.locale.dashboard.autoReply.title,
                    settings,
                    path: '/autoreply',
                    locale: res.locals.locale,
                    currentLang: res.locals.currentLang || 'en',
                    script: `<script>window.settings = ${JSON.stringify(settings)};</script>`
                });
            }
            catch (error) {
                console.error('Error loading auto reply page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });
        this.app.post('/api/autoreply/settings', async (req, res) => {
            try {
                const settings = req.body;
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                currentSettings.autoReply = {
                    ...currentSettings.autoReply,
                    ...settings
                };
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.autoReply
                });
            }
            catch (error) {
                console.error('Error saving auto reply settings:', error);
                return res.status(500).json({ error: 'Failed to save settings' });
            }
        });
        this.app.get('/suggestions', async (_req, res) => {
            try {
                const settings = settingsManager_1.getSettings();
                res.render('suggestions', {
                    title: res.locals.locale.dashboard.suggestions.title,
                    settings,
                    path: '/suggestions',
                    locale: res.locals.locale,
                    currentLang: res.locals.currentLang
                });
            }
            catch (error) {
                console.error('Error loading suggestions page:', error);
                res.status(500).send('Error loading page');
            }
        });
        this.app.post('/api/settings/suggestions', async (req, res) => {
            try {
                const settings = req.body;
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                currentSettings.suggestions = {
                    ...currentSettings.suggestions,
                    ...settings
                };
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.suggestions
                });
            }
            catch (error) {
                console.error('Error saving suggestions settings:', error);
                return res.status(500).json({ error: 'Failed to save settings' });
            }
        });
this.app.get('/api/dashboard/stats', async (_req, res) => {
            try {
                const stats = await this.generateDashboardStats();
                return res.json({
                    success: true,
                    stats,
                    timestamp: new Date().toISOString()
                });
            }
            catch (error) {
                console.error('Error fetching dashboard stats:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch dashboard stats'
                });
            }
        });
        this.app.get('/api/moderation/warnings', async (req, res) => {
            try {
                const guildId = config_1.default.mainGuildId;
                const userId = (0, validation_1.isSnowflake)(req.query.userId) ? req.query.userId : null;
                const limit = (0, validation_1.clampInt)(req.query.limit, 50, 1, 100);
                const query = { guildId };
                if (userId) {
                    query.userId = userId;
                }
                const warnings = await Warning_1.Warning.find(query)
                    .sort({ timestamp: -1 })
                    .limit(limit)
                    .lean();
                return res.json({ success: true, warnings, guildId });
            }
            catch (error) {
                console.error('Error fetching warnings:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch warnings'
                });
            }
        });
        this.app.get('/api/moderation/history', async (req, res) => {
            try {
                const guildId = config_1.default.mainGuildId;
                const userId = (0, validation_1.isSnowflake)(req.query.userId) ? req.query.userId : null;
                const limit = (0, validation_1.clampInt)(req.query.limit, 50, 1, 100);
                const query = { guildId };
                if (userId) {
                    query.userId = userId;
                }
                const records = await ModerationRecord_1.ModerationRecord.find(query)
                    .sort({ timestamp: -1 })
                    .limit(limit)
                    .lean();
                return res.json({ success: true, records, guildId });
            }
            catch (error) {
                console.error('Error fetching moderation history:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch moderation history'
                });
            }
        });
        this.app.post('/api/settings/warnings', async (req, res) => {
            try {
                const settings = req.body;
                const validated = (0, validation_1.validateWarningsConfig)(settings);
                if (!validated.ok) {
                    return res.status(400).json({ success: false, error: validated.errors.join('; ') });
                }
                let currentSettings = settingsManager_1.getSettings();
                currentSettings.warnings = validated.value;
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({ success: true, settings: currentSettings.warnings });
            }
            catch (error) {
                console.error('Error saving warnings settings:', error);
                return res.status(500).json({ error: 'Failed to save warnings settings' });
            }
        });
        this.app.post('/api/settings/automod', async (req, res) => {
            try {
                const settings = req.body;
                let currentSettings = settingsManager_1.getSettings();
                const existing = currentSettings.automod || {};
                const rulesResult = (0, validation_1.validateAutomodRules)(settings.rules || existing.rules || {});
                const enabled = (0, validation_1.toBoolean)(settings.enabled ?? existing.enabled ?? false);
                const staffRoles = (0, validation_1.sanitizeIdList)(settings.staffRoles);
                const logChannelId = typeof settings.logChannelId === 'string' &&
                    (settings.logChannelId === '' || (0, validation_1.isSnowflake)(settings.logChannelId))
                    ? settings.logChannelId
                    : (existing.logChannelId || '');
                currentSettings.automod = {
                    enabled,
                    staffRoles: staffRoles.length > 0 ? staffRoles : (existing.staffRoles || []),
                    logChannelId,
                    rules: {
                        ...(existing.rules || {}),
                        ...(rulesResult.ok ? rulesResult.value : existing.rules || {})
                    }
                };
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.automod,
                    warnings: rulesResult.errors
                });
            }
            catch (error) {
                console.error('Error saving automod settings:', error);
                return res.status(500).json({ error: 'Failed to save automod settings' });
            }
        });
        this.app.post('/api/settings/antiraid', async (req, res) => {
            try {
                const settings = req.body;
                const validated = (0, validation_1.validateRaidConfig)(settings);
                if (!validated.ok) {
                    return res.status(400).json({ success: false, error: validated.errors.join('; ') });
                }
                let currentSettings = settingsManager_1.getSettings();
                if (!currentSettings.protection) {
                    currentSettings.protection = {};
                }
                currentSettings.protection.raid = validated.value;
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({ success: true, settings: currentSettings.protection.raid });
            }
            catch (error) {
                console.error('Error saving anti-raid settings:', error);
                return res.status(500).json({ error: 'Failed to save anti-raid settings' });
            }
        });
        this.app.post('/api/settings/language', async (req, res) => {
            try {
                const { defaultLanguage, supportedLanguages } = req.body;
                if (!defaultLanguage || !supportedLanguages || !Array.isArray(supportedLanguages)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid input parameters'
                    });
                }
                if (supportedLanguages.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'At least one language must be supported'
                    });
                }
                if (!supportedLanguages.includes(defaultLanguage)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Default language must be included in supported languages'
                    });
                }
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                currentSettings.defaultLanguage = defaultLanguage;
                currentSettings.supportedLanguages = supportedLanguages;
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: {
                        defaultLanguage,
                        supportedLanguages
                    }
                });
            }
            catch (error) {
                console.error('Error updating language settings:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update language settings'
                });
            }
        });
        this.app.post('/api/settings/autoRoles', async (req, res) => {
            try {
                const settings = req.body;
                if (!settings || typeof settings.enabled !== 'boolean' ||
                    !settings.members || !settings.bots ||
                    typeof settings.members.enabled !== 'boolean' ||
                    typeof settings.bots.enabled !== 'boolean' ||
                    !Array.isArray(settings.members.roleIds) ||
                    !Array.isArray(settings.bots.roleIds)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid input parameters'
                    });
                }
                const settingsPath = settingsManager_1.getSettingsPath();
                let currentSettings = settingsManager_1.getSettings();
                currentSettings.autoRoles = {
                    enabled: settings.enabled,
                    members: {
                        enabled: settings.members.enabled,
                        roleIds: settings.members.roleIds
                    },
                    bots: {
                        enabled: settings.bots.enabled,
                        roleIds: settings.bots.roleIds
                    }
                };
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.autoRoles
                });
            }
            catch (error) {
                console.error('Error updating auto roles settings:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update auto roles settings'
                });
            }
        });
        this.app.get('/api/dashboard/chart/:period', async (req, res) => {
            try {
                const period = req.params.period;
                let days = 30;
                switch (period) {
                    case 'day':
                        days = 1;
                        break;
                    case 'week':
                        days = 7;
                        break;
                    case 'month':
                    default:
                        days = 30;
                        break;
                }
const dates = Array.from({ length: days }, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - (days - 1) + i);
                    return date.toISOString().split('T')[0];
                });
                const buckets = this.client.dailyStats instanceof Map ? this.client.dailyStats : new Map();
                const commandsData = dates.map((date) => buckets.get(date)?.commands || 0);
                const pingData = dates.map(() => this.getPing());
                const usersData = dates.map((date) => buckets.get(date)?.users || 0);
                const formattedDates = dates.map(date => {
                    const d = new Date(date);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                });
                return res.json({
                    success: true,
                    data: {
                        labels: formattedDates,
                        datasets: {
                            ping: pingData,
                            commands: commandsData,
                            users: usersData
                        }
                    },
                    period,
                    timestamp: new Date().toISOString()
                });
            }
            catch (error) {
                console.error('Error generating chart data:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to generate chart data'
                });
            }
        });
this.app.get('/welcome', async (_req, res) => {
            try {
                const currentLang = _req.cookies?.preferredLanguage || 'en';
                const locale = this.getLocale(currentLang);
                const guild = this.mainGuild();
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' },
                        currentLang,
                        locale,
                        path: '/welcome'
                    });
                }
                await guild.channels.fetch().catch(() => {});
                console.log(`[welcome] channel fetch guild=${guild.id} count=${guild.channels.cache.size}`);
                const channels = await (0, channelList_1.fetchTextChannels)(guild);
                console.log(`[welcome] text channels=${channels.length}`);
                const supportedLanguages = Array.isArray(this.client.settings?.supportedLanguages) && this.client.settings.supportedLanguages.length > 0
                    ? this.client.settings.supportedLanguages
                    : ['en', 'ar'];
                const members = guild.members.cache
                    .filter(member => !member.user.bot)
                    .first(25)
                    .map(member => ({
                        id: member.id,
                        name: member.displayName || member.user.username
                    }));
                const settings = settingsManager_1.getSettings();
                const templates = (0, imageTemplates_1.listImageTemplates)();
                return res.render('welcome', {
                    title: locale.dashboard.welcomeGoodbye.title,
                    settings,
                    channels,
                    memberCount: guild.memberCount,
                    members,
                    supportedLanguages,
                    templates,
                    fonts: welcomeGoodbyeDefaults_1.ALLOWED_FONTS,
                    client: this.clientView(),
                    config: this.configView(),
                    path: '/welcome',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/welcome')
                });
            }
            catch (error) {
                console.error('Error rendering welcome & goodbye page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en'),
                    path: '/welcome'
                });
            }
        });
        this.app.get('/api/welcome', async (_req, res) => {
            try {
                const currentSettings = settingsManager_1.getSettings();
                const guild = this.mainGuild();
                const saved = currentSettings.welcomeGoodbye
                    ? (0, welcomeGoodbyeDefaults_1.normalizeWelcomeGoodbyeConfig)(currentSettings.welcomeGoodbye)
                    : (0, welcomeGoodbyeDefaults_1.migrateLegacyWelcome)(currentSettings.welcome);
                const channels = await (0, channelList_1.fetchTextChannels)(guild);
                return res.json({
                    success: true,
                    settings: saved,
                    templates: (0, imageTemplates_1.listImageTemplates)(),
                    guildId: guild ? guild.id : null,
                    channels
                });
            }
            catch (error) {
                console.error('Error fetching welcome & goodbye settings:', error);
                return res.status(500).json({ error: 'Failed to fetch welcome & goodbye settings' });
            }
        });
        this.app.get('/api/welcome/channels', async (_req, res) => {
            try {
                const guild = this.mainGuild();
                if (!guild) {
                    return res.status(404).json({ success: false, error: 'Guild not found', guildId: null, channels: [] });
                }
                const channels = await (0, channelList_1.fetchTextChannels)(guild);
                console.log(`[welcome] api channels guild=${guild.id} text_channels=${channels.length}`);
                return res.json({ success: true, guildId: guild.id, channels });
            }
            catch (error) {
                console.error('Error fetching welcome channels:', error);
                return res.status(500).json({ success: false, error: 'Failed to fetch channels', guildId: null, channels: [] });
            }
        });
        this.app.post('/api/welcome/settings', async (req, res) => {
            try {
                const result = (0, validation_1.validateWelcomeGoodbyeSettings)(req.body);
                if (!result.ok || !result.value) {
                    return res.status(400).json({ success: false, errors: result.errors });
                }
                let currentSettings = settingsManager_1.getSettings();
                currentSettings.welcomeGoodbye = result.value;
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({ success: true, settings: result.value, errors: result.errors });
            }
            catch (error) {
                console.error('Error saving welcome & goodbye settings:', error);
                return res.status(500).json({ error: 'Failed to save welcome & goodbye settings' });
            }
        });
        this.app.post('/api/goodbye/settings', async (req, res) => {
            try {
                let currentSettings = settingsManager_1.getSettings();
                const base = currentSettings.welcomeGoodbye
                    ? (0, welcomeGoodbyeDefaults_1.normalizeWelcomeGoodbyeConfig)(currentSettings.welcomeGoodbye)
                    : (0, welcomeGoodbyeDefaults_1.migrateLegacyWelcome)(currentSettings.welcome);
                const candidate = { ...base, goodbye: req.body || {} };
                const result = (0, validation_1.validateWelcomeGoodbyeSettings)(candidate);
                if (!result.ok || !result.value) {
                    return res.status(400).json({ success: false, errors: result.errors });
                }
                currentSettings.welcomeGoodbye = result.value;
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({ success: true, settings: result.value.goodbye, errors: result.errors });
            }
            catch (error) {
                console.error('Error saving goodbye settings:', error);
                return res.status(500).json({ error: 'Failed to save goodbye settings' });
            }
        });
        const makeBackgroundResolver = (guildId) => async (source) => {
            if (typeof source === 'string' && source.startsWith('upload:')) {
                const loaded = await (0, assetStore_1.loadUploaded)(source.slice('upload:'.length), guildId);
                return loaded ? loaded.buffer : null;
            }
            return null;
        };
        const sampleContext = () => ({
            user: '<@1234567890>',
            userName: 'Sample User',
            memberCount: '42',
            server: 'My Server',
            inviter: '<@9876543210>',
            inviterName: 'Wick Studio',
            invites: '3'
        });
        this.app.post('/api/welcome/preview', this.rateLimiter(60, 60000), async (req, res) => {
            try {
                const guild = this.mainGuild();
                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }
                const kind = req.body?.kind === 'goodbye' ? 'goodbye' : 'welcome';
                const config = req.body?.config || {};
                const normalized = (0, welcomeGoodbyeDefaults_1.normalizeImage)(config, kind === 'goodbye'
                    ? welcomeGoodbyeDefaults_1.WELCOME_GOODBYE_DEFAULTS.goodbye.image
                    : welcomeGoodbyeDefaults_1.WELCOME_GOODBYE_DEFAULTS.welcome.image);
                const result = await (0, imageRenderer_1.renderWelcomeImage)({
                    config: normalized,
                    context: sampleContext(),
                    avatarUrl: null,
                    resolveBackground: (0, makeBackgroundResolver)(guild.id)
                });
                res.set('Content-Type', 'image/png');
                res.set('Cache-Control', 'no-store');
                return res.send(result.buffer);
            }
            catch (error) {
                console.error('Error generating welcome preview:', error);
                return res.status(500).json({ error: 'Failed to generate preview' });
            }
        });
        this.app.post('/api/welcome/test', this.rateLimiter(20, 60000), async (req, res) => {
            try {
                const guild = this.mainGuild();
                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }
                const kind = req.body?.kind === 'goodbye' ? 'goodbye' : 'welcome';
                const currentSettings = settingsManager_1.getSettings();
                const cfg = (0, welcomeGoodbyeDefaults_1.normalizeWelcomeGoodbyeConfig)(currentSettings.welcomeGoodbye);
                const memberSection = kind === 'goodbye' ? cfg.goodbye : cfg.welcome;
                const effectiveImage = req.body?.image && typeof req.body.image === 'object'
                    ? (0, welcomeGoodbyeDefaults_1.normalizeImage)(req.body.image, kind === 'goodbye'
                        ? welcomeGoodbyeDefaults_1.WELCOME_GOODBYE_DEFAULTS.goodbye.image
                        : welcomeGoodbyeDefaults_1.WELCOME_GOODBYE_DEFAULTS.welcome.image)
                    : memberSection.image;
                let member = null;
                let usedMember = false;
                if (req.body?.memberId) {
                    member = await guild.members.fetch(String(req.body.memberId)).catch(() => null);
                }
                if (member) {
                    usedMember = true;
                }
                const inviteContext = usedMember
                    ? await (0, welcomeFormatter_1.resolveInviteContext)(this.client, guild)
                    : (0, welcomeFormatter_1.buildWelcomeContext)(null).inviter || null;
                const context = usedMember
                    ? (0, welcomeFormatter_1.buildWelcomeContext)(member, inviteContext)
                    : sampleContext();
                const locale = this.client.locales?.get('en')?.welcomeGoodbye || null;
                const defaultKey = kind === 'goodbye' ? 'goodbye' : 'welcome';
                const template = memberSection.message.content || locale?.messages?.default?.[defaultKey] || '';
                let text = '';
                if (template) {
                    text = (0, welcomeFormatter_1.formatWelcomeMessage)(template, member, { inviteContext });
                }
                let imageDataUrl = null;
                if (effectiveImage.enabled) {
                    try {
                        const avatarUrl = usedMember && typeof member?.user?.displayAvatarURL === 'function'
                            ? member.user.displayAvatarURL({ extension: 'png', size: 256 })
                            : null;
                        const rendered = await (0, imageRenderer_1.renderWelcomeImage)({
                            config: effectiveImage,
                            context,
                            avatarUrl,
                            resolveBackground: (0, makeBackgroundResolver)(guild.id)
                        });
                        imageDataUrl = `data:image/png;base64,${rendered.buffer.toString('base64')}`;
                    }
                    catch (_error) {
                        imageDataUrl = null;
                    }
                }
                let flow = null;
                if (req.body?.send === true && usedMember) {
                    flow = kind === 'goodbye'
                        ? await (0, welcomeGoodbyeManager_1.handleMemberLeave)(member)
                        : await (0, welcomeGoodbyeManager_1.handleMemberJoin)(member);
                }
                return res.json({ ok: true, kind, usedMember, text, image: imageDataUrl, flow });
            }
            catch (error) {
                console.error('Error running welcome test:', error);
                return res.status(500).json({ error: 'Failed to run welcome test' });
            }
        });
        const uploadMiddleware = multer({
            storage: multer.memoryStorage(),
            limits: { fileSize: uploadGuard_1.MAX_FILE_SIZE, files: 1 }
        });
        this.app.post('/api/welcome/upload', this.rateLimiter(15, 60000), uploadMiddleware.single('file'), async (req, res) => {
            try {
                const guild = this.mainGuild();
                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }
                if (!req.file) {
                    return res.status(400).json({ ok: false, code: 'NO_FILE', error: 'no file uploaded' });
                }
                const checked = await (0, uploadGuard_1.validateFile)({
                    buffer: req.file.buffer,
                    originalname: req.file.originalname || ''
                });
                if (!checked.ok) {
                    return res.status(400).json({ ok: false, code: checked.code, error: checked.error });
                }
                const stored = await (0, assetStore_1.storeUpload)({
                    buffer: checked.buffer,
                    ext: checked.ext,
                    width: checked.width,
                    height: checked.height,
                    guildId: guild.id,
                    kind: 'background'
                });
                return res.json({ ok: true, ...stored, width: checked.width, height: checked.height });
            }
            catch (error) {
                console.error('Error uploading welcome asset:', error);
                return res.status(500).json({ ok: false, error: 'Failed to store uploaded image' });
            }
        });
        this.app.get('/api/welcome/asset/:id', async (req, res) => {
            try {
                const guild = this.mainGuild();
                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }
                const loaded = await (0, assetStore_1.loadUploaded)(req.params.id, guild.id);
                if (!loaded) {
                    return res.status(404).json({ error: 'Asset not found' });
                }
                const ext = loaded.record.ext === 'jpg' ? 'jpeg' : loaded.record.ext;
                res.set('Content-Type', `image/${ext}`);
                res.set('Cache-Control', 'private, max-age=3600');
                return res.send(loaded.buffer);
            }
            catch (error) {
                console.error('Error serving welcome asset:', error);
                return res.status(500).json({ error: 'Failed to load asset' });
            }
        });
        this.app.post('/api/welcome/template', this.rateLimiter(30, 60000), async (req, res) => {
            try {
                const action = req.body?.action;
                const kind = req.body?.kind === 'goodbye' ? 'goodbye' : 'welcome';
                if (action === 'list') {
                    let currentSettings = settingsManager_1.getSettings();
                    const cfg = (0, welcomeGoodbyeDefaults_1.normalizeWelcomeGoodbyeConfig)(currentSettings.welcomeGoodbye);
                    const custom = cfg.customTemplates.filter(item => item.kind === kind);
                    return res.json({ ok: true, templates: [...(0, imageTemplates_1.listImageTemplates)(), ...custom.map(item => ({ id: item.id, name: item.name }))] });
                }
                if (action === 'apply') {
                    const mainTemplate = (0, imageTemplates_1.applyImageTemplate)(req.body?.templateId, req.body?.config || null, { fillEmptyText: req.body?.fillEmptyText === true });
                    if (!mainTemplate) {
                        let currentSettings = settingsManager_1.getSettings();
                        const cfg = (0, welcomeGoodbyeDefaults_1.normalizeWelcomeGoodbyeConfig)(currentSettings.welcomeGoodbye);
                        const custom = cfg.customTemplates.find(item => item.id === req.body?.templateId && item.kind === kind);
                        if (!custom) {
                            return res.status(404).json({ ok: false, error: 'Template not found' });
                        }
                        return res.json({ ok: true, config: custom.config });
                    }
                    return res.json({ ok: true, config: mainTemplate });
                }
                if (action === 'save') {
                    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
                    if (!name) {
                        return res.status(400).json({ ok: false, error: 'Template name is required' });
                    }
                    const validated = (0, validation_1.validateImageConfig)(req.body?.config);
                    if (!validated.ok || !validated.value) {
                        return res.status(400).json({ ok: false, errors: validated.errors });
                    }
                    let currentSettings = settingsManager_1.getSettings();
                    const cfg = (0, welcomeGoodbyeDefaults_1.normalizeWelcomeGoodbyeConfig)(currentSettings.welcomeGoodbye);
                    const id = crypto.randomUUID();
                    cfg.customTemplates = [...cfg.customTemplates.filter(item => item.kind !== kind).slice(-19), {
                        id,
                        name,
                        kind,
                        config: validated.value
                    }];
                    currentSettings.welcomeGoodbye = cfg;
                    settingsManager_1.persist();
                    this.client.settings = currentSettings;
                    return res.json({ ok: true, id, name });
                }
                return res.status(400).json({ ok: false, error: 'Unknown template action' });
            }
catch (error) {
                console.error('Error handling welcome template action:', error);
                return res.status(500).json({ ok: false, error: 'Failed to process template action' });
            }
        });
        this.app.post('/api/welcome/template-gallery', this.rateLimiter(40, 60000), async (req, res) => {
            try {
                const guild = this.mainGuild();
                if (!guild) {
                    return res.status(404).json({ ok: false, error: 'Guild not found' });
                }
                const kind = req.body?.kind === 'goodbye' ? 'goodbye' : 'welcome';
                const defaults = kind === 'goodbye'
                    ? welcomeGoodbyeDefaults_1.WELCOME_GOODBYE_DEFAULTS.goodbye.image
                    : welcomeGoodbyeDefaults_1.WELCOME_GOODBYE_DEFAULTS.welcome.image;
                const currentSettings = settingsManager_1.getSettings();
                const cfg = (0, welcomeGoodbyeDefaults_1.normalizeWelcomeGoodbyeConfig)(currentSettings.welcomeGoodbye);
                const builtins = (0, imageTemplates_1.listImageTemplates)();
                const customs = cfg.customTemplates.filter(item => item.kind === kind);
                const entries = [
                    ...customs.map(item => ({ id: item.id, name: item.name, custom: true, config: item.config })),
                    ...builtins.map(item => ({ id: item.id, name: item.name, custom: false }))
                ];
                const resolveBackground = (0, makeBackgroundResolver)(guild.id);
                const rendered = [];
                for (const entry of entries.slice(0, 24)) {
                    const config = entry.custom
                        ? (0, welcomeGoodbyeDefaults_1.normalizeImage)(entry.config, defaults)
                        : (0, imageTemplates_1.applyImageTemplate)(entry.id, null);
                    if (!config) {
                        continue;
                    }
                    try {
                        const result = await (0, imageRenderer_1.renderWelcomeImage)({
                            config,
                            context: (0, sampleContext)(),
                            avatarUrl: null,
                            resolveBackground,
                            silent: true
                        });
                        rendered.push({ id: entry.id, name: entry.name, custom: entry.custom, image: `data:image/png;base64,${result.buffer.toString('base64')}` });
                    }
                    catch (_error) {
                        rendered.push({ id: entry.id, name: entry.name, custom: entry.custom, image: null });
                    }
                }
                return res.json({ ok: true, templates: rendered });
            }
            catch (error) {
                console.error('Error building welcome template gallery:', error);
                return res.status(500).json({ ok: false, error: 'Failed to build template gallery' });
            }
        });
        this.app.get('/selectroles', (_req, res) => {
            try {
                const currentLang = _req.cookies?.preferredLanguage || 'en';
                const locale = this.getLocale(currentLang);
                return res.render('coming-soon', {
                    title: locale.comingSoon.features.selectRoles.title,
                    feature: 'selectRoles',
                    featureIcon: 'fas fa-id-badge',
                    settings: this.client.settings,
                    client: this.clientView(),
                    config: this.configView(),
                    path: '/selectroles',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/selectroles')
                });
            }
            catch (error) {
                console.error('Error rendering select roles page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });
        this.app.get('/games', (_req, res) => {
            try {
                const currentLang = _req.cookies?.preferredLanguage || 'en';
                const locale = this.getLocale(currentLang);
                return res.render('coming-soon', {
                    title: locale.comingSoon.features.games.title,
                    feature: 'games',
                    featureIcon: 'fas fa-gamepad',
                    settings: this.client.settings,
                    client: this.clientView(),
                    config: this.configView(),
                    path: '/games',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/games')
                });
            }
            catch (error) {
                console.error('Error rendering games page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });
this.app.get('/automod', async (_req, res) => {
            try {
                const currentLang = _req.cookies?.preferredLanguage || 'en';
                const locale = this.getLocale(currentLang);
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                const channels = guild
                    ? guild.channels.cache
                        .filter(channel => channel.type === 0)
                        .map(channel => ({ id: channel.id, name: channel.name }))
                    : [];
                const roles = guild
                    ? guild.roles.cache
                        .filter(role => role.id !== guild.id)
                        .sort((a, b) => b.position - a.position)
                        .map(role => ({ id: role.id, name: role.name, color: role.hexColor }))
                    : [];
                return res.render('automod', {
                    title: res.locals.locale.dashboard.automod?.title || 'AutoMod',
                    settings: this.client.settings,
                    channels,
                    roles,
                    path: '/automod',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/automod')
                });
            }
            catch (error) {
                console.error('Error rendering automod page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });
        this.app.get('/autolines', (_req, res) => {
            try {
                const currentLang = _req.cookies?.preferredLanguage || 'en';
                const locale = this.getLocale(currentLang);
                return res.render('coming-soon', {
                    title: locale.comingSoon.features.autoLines.title,
                    feature: 'autoLines',
                    featureIcon: 'fas fa-align-left',
                    settings: this.client.settings,
                    client: this.clientView(),
                    config: this.configView(),
                    path: '/autolines',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/autolines')
                });
            }
            catch (error) {
                console.error('Error rendering auto lines page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });
        this.app.get('/leveling', (_req, res) => {
            try {
                const currentLang = _req.cookies?.preferredLanguage || 'en';
                const locale = this.getLocale(currentLang);
                return res.render('coming-soon', {
                    title: locale.comingSoon.features.leveling.title,
                    feature: 'leveling',
                    featureIcon: 'fas fa-chart-line',
                    settings: this.client.settings,
                    client: this.clientView(),
                    config: this.configView(),
                    path: '/leveling',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/leveling')
                });
            }
            catch (error) {
                console.error('Error rendering leveling system page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });
        this.app.get('/api/commands/list', async (_req, res) => {
            try {
                const settingsPath = settingsManager_1.getSettingsPath();
                const currentSettings = settingsManager_1.getSettings();
                const allCommands = Object.entries(currentSettings.commands).map(([name, data]) => {
                    const commandData = data;
                    return {
                        name,
                        enabled: commandData.enabled || false,
                        aliases: commandData.aliases || [],
                        cooldown: commandData.cooldown || 5,
                        permissions: commandData.permissions || { enabledRoleIds: [], disabledRoleIds: [] }
                    };
                });
                const generalCommands = ['avatar', 'banner', 'ping', 'roles', 'server', 'user'];
                const moderationCommands = ['ban', 'kick', 'mute', 'unmute', 'warn', 'unwarn', 'clear', 'lock', 'unlock', 'hide', 'unhide', 'move', 'timeout', 'rtimeout'];
                const categories = {
                    general: allCommands.filter(cmd => generalCommands.includes(cmd.name)),
                    moderation: allCommands.filter(cmd => moderationCommands.includes(cmd.name)),
                    utility: allCommands.filter(cmd => !generalCommands.includes(cmd.name) && !moderationCommands.includes(cmd.name))
                };
                return res.json({
                    success: true,
                    categories,
                    allCommands
                });
            }
            catch (error) {
                console.error('Error fetching commands list:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch commands list'
                });
            }
});
        this.app.get('/dashboard', async (req, res) => {
            const currentLang = req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            try {
                const overview = await analytics_1.getOverview(this.mainGuild());
                return res.render('dashboard', {
                    title: locale.dashboard.overview?.title || 'Overview',
                    overview,
                    settings: this.client.settings,
                    client: this.clientView(),
                    config: this.configView(),
                    path: '/dashboard',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/dashboard')
                });
            }
            catch (error) {
                console.error('Error rendering dashboard overview page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale,
                    path: '/dashboard'
                });
            }
        });
        this.app.get('/api/dashboard/overview', async (_req, res) => {
            try {
                const overview = await analytics_1.getOverview(this.mainGuild());
                return res.json({ success: true, overview, timestamp: new Date().toISOString() });
            }
            catch (error) {
                console.error('Error fetching overview:', error);
                return res.status(500).json({ success: false, error: 'Failed to fetch overview' });
            }
        });
        this.app.get('/api/dashboard/activity', async (req, res) => {
            try {
                const since = typeof req.query.since === 'string' && !isNaN(Date.parse(req.query.since))
                    ? new Date(req.query.since)
                    : undefined;
                const activity = await analytics_1.getRecentActivity({ guildId: config_1.default.mainGuildId, since, limit: 15 });
                return res.json({ success: true, activity });
            }
            catch (error) {
                console.error('Error fetching recent activity:', error);
                return res.status(500).json({ success: false, error: 'Failed to fetch recent activity' });
            }
        });
        this.app.get('/api/dashboard/analytics/:period', async (req, res) => {
            try {
                const period = String(req.params.period || 'month');
                let days = 30;
                if (period === 'day') {
                    days = 1;
                }
                else if (period === 'week') {
                    days = 7;
                }
                else if (period === 'all') {
                    days = 30;
                }
                const data = await analytics_1.getAnalytics({ guildId: config_1.default.mainGuildId, period, days });
                return res.json({ success: true, data, timestamp: new Date().toISOString() });
            }
            catch (error) {
                console.error('Error generating analytics:', error);
                return res.status(500).json({ success: false, error: 'Failed to generate analytics' });
            }
        });
        this.app.get('/history', (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            try {
                return res.render('history', {
                    title: locale.dashboard.history?.title || 'Moderation History',
                    settings: this.client.settings,
                    client: this.clientView(),
                    config: this.configView(),
                    actions: [
                        'warn', 'timeout', 'kick', 'ban', 'unban',
                        'untimeout', 'purge', 'unwarn', 'automod', 'antiraid'
                    ],
                    path: '/history',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/history')
                });
            }
            catch (error) {
                console.error('Error rendering history page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale,
                    path: '/history'
                });
            }
        });
        this.app.get('/api/dashboard/history', async (req, res) => {
            try {
                const filters = {
                    guildId: config_1.default.mainGuildId,
                    userId: (0, validation_1.isSnowflake)(req.query.userId) ? req.query.userId : undefined,
                    moderatorId: (0, validation_1.isSnowflake)(req.query.moderatorId) ? req.query.moderatorId : undefined,
                    action: typeof req.query.action === 'string' ? req.query.action : undefined,
                    search: typeof req.query.search === 'string' ? req.query.search : undefined,
                    from: typeof req.query.from === 'string' ? req.query.from : undefined,
                    to: typeof req.query.to === 'string' ? req.query.to : undefined,
                    page: req.query.page,
                    limit: req.query.limit,
                    sort: typeof req.query.sort === 'string' ? req.query.sort : undefined
                };
                const result = await moderationHistory_1.queryPaged(filters);
                return res.json({ success: true, ...result });
            }
            catch (error) {
                console.error('Error querying moderation history:', error);
                return res.status(500).json({ success: false, error: 'Failed to fetch moderation history' });
            }
        });
        this.app.get('/warnings', (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            try {
                const guild = this.mainGuild();
                const channels = guild
                    ? guild.channels.cache
                        .filter(channel => channel.type === 0)
                        .map(channel => ({ id: channel.id, name: channel.name }))
                    : [];
                return res.render('warnings', {
                    title: locale.dashboard.warnings?.title || 'Warnings',
                    settings: this.client.settings,
                    channels,
                    path: '/warnings',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/warnings')
                });
            }
            catch (error) {
                console.error('Error rendering warnings page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale,
                    path: '/warnings'
                });
            }
        });
        this.app.get('/api/dashboard/warnings', async (req, res) => {
            try {
                const page = (0, validation_1.clampInt)(req.query.page, 1, 1, 100000);
                const limit = (0, validation_1.clampInt)(req.query.limit, 25, 1, 100);
                const query = { guildId: config_1.default.mainGuildId };
                if ((0, validation_1.isSnowflake)(req.query.userId)) {
                    query.userId = req.query.userId;
                }
                const active = req.query.active === 'active' ? 'active' : req.query.active === 'expired' ? 'expired' : 'all';
                const now = new Date();
                if (active === 'active') {
                    query.$or = [{ expiresAt: null }, { expiresAt: { $gte: now } }];
                }
                else if (active === 'expired') {
                    query.expiresAt = { $lt: now };
                }
                const total = await Warning_1.Warning.countDocuments(query);
                const warnings = await Warning_1.Warning.find(query)
                    .sort({ timestamp: -1 })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .lean();
                return res.json({
                    success: true,
                    warnings: warnings || [],
                    total,
                    page,
                    limit,
                    pages: Math.max(1, Math.ceil(total / limit))
                });
            }
            catch (error) {
                console.error('Error listing warnings:', error);
                return res.status(500).json({ success: false, error: 'Failed to list warnings' });
            }
        });
        this.app.post('/api/dashboard/warnings/add', async (req, res) => {
            try {
                const guild = this.mainGuild();
                if (!guild) {
                    return res.status(404).json({ success: false, error: 'Main guild not found' });
                }
                const userId = typeof req.body.userId === 'string' ? req.body.userId.trim() : '';
                if (!(0, validation_1.isSnowflake)(userId)) {
                    return res.status(400).json({ success: false, error: 'Invalid user id' });
                }
                const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '';
                if (reason.length === 0) {
                    return res.status(400).json({ success: false, error: 'A reason is required' });
                }
                const target = await guild.members.fetch(userId).catch(() => null);
                if (!target) {
                    return res.status(404).json({ success: false, error: 'User is not a member of this server' });
                }
                const me = await guild.members.fetch(req.session.user.id).catch(() => null);
                const member = me || { id: req.session.user.id, user: { tag: req.session.user.username }, guild };
                const result = await moderationService_1.warn({ client: this.client, guild, member, target }, { reason });
                if (!result.ok) {
                    return res.status(400).json({ success: false, error: result.code || 'actionFailed' });
                }
                return res.json({ success: true, result });
            }
            catch (error) {
                console.error('Error adding warning from dashboard:', error);
                return res.status(500).json({ success: false, error: 'Failed to add warning' });
            }
        });
        this.app.post('/api/dashboard/warnings/:id/remove', async (req, res) => {
            try {
                const guild = this.mainGuild();
                if (!guild) {
                    return res.status(404).json({ success: false, error: 'Main guild not found' });
                }
                const warningId = String(req.params.id || '').trim();
                const warning = await Warning_1.Warning.findOne({ _id: warningId, guildId: guild.id }).lean();
                if (!warning) {
                    return res.status(404).json({ success: false, error: 'Warning not found' });
                }
                const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '';
                const member = { id: req.session.user.id, user: { tag: req.session.user.username }, guild };
                const result = await moderationService_1.unwarn({
                    client: this.client,
                    guild,
                    member,
                    target: { id: warning.userId, username: warning.userId }
                }, { warningId, reason });
                if (!result.ok) {
                    return res.status(400).json({ success: false, error: result.code || 'actionFailed' });
                }
                return res.json({ success: true, result });
            }
            catch (error) {
                console.error('Error removing warning from dashboard:', error);
                return res.status(500).json({ success: false, error: 'Failed to remove warning' });
            }
        });
        this.app.get('/user/:userId', async (req, res) => {
            const currentLang = req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            const userId = String(req.params.userId || '');
            if (!(0, validation_1.isSnowflake)(userId)) {
                return res.status(400).render('error', {
                    title: 'Invalid User',
                    error: { code: 400, message: 'Invalid Discord user id.' },
                    currentLang,
                    locale,
                    path: '/user/' + userId
                });
            }
            try {
                return res.render('user', {
                    title: locale.dashboard.user?.title || 'User Profile',
                    userId,
                    settings: this.client.settings,
                    client: this.clientView(),
                    config: this.configView(),
                    path: '/user/' + userId,
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/user/' + userId)
                });
            }
            catch (error) {
                console.error('Error rendering user page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale,
                    path: '/user/' + userId
                });
            }
        });
        this.app.get('/api/dashboard/user/:userId', async (req, res) => {
            try {
                const userId = String(req.params.userId || '');
                if (!(0, validation_1.isSnowflake)(userId)) {
                    return res.status(400).json({ success: false, error: 'Invalid user id' });
                }
                const guildId = config_1.default.mainGuildId;
                const guild = this.mainGuild();
                const member = guild
                    ? await guild.members.fetch(userId).catch(() => null)
                    : null;
                const warnings = await warningManager_1.getWarnings(guildId, userId);
                const activeCount = await warningManager_1.getWarningCount(guildId, userId);
                const history = await moderationHistory_1.getUserHistory(guildId, userId, 100);
                const totals = {};
                history.forEach(record => {
                    const key = String(record.action || 'other').replace(/^(automod|antiraid):.*$/, '$1');
                    totals[key] = (totals[key] || 0) + 1;
                });
                return res.json({
                    success: true,
                    user: {
                        id: userId,
                        username: member?.user?.username || null,
                        tag: member?.user?.tag || null,
                        avatar: member?.user?.displayAvatarURL?.() || null,
                        isMember: !!member,
                        joinedAt: member?.joinedAt?.toISOString?.() || null,
                        accountCreatedAt: member?.user?.createdAt?.toISOString?.() || null,
                        communicationDisabledUntil: member?.communicationDisabledUntil?.toISOString?.() || null,
                        timeoutEndsAt: member?.communicationDisabledUntil || null,
                        roles: member ? [...member.roles.cache.keys()] : []
                    },
                    warnings: warnings || [],
                    activeWarnings: activeCount,
                    history: history || [],
                    totals,
                    lastAction: history && history.length > 0 ? history[0] : null
                });
            }
            catch (error) {
                console.error('Error fetching user profile:', error);
                return res.status(500).json({ success: false, error: 'Failed to fetch user profile' });
            }
        });
        this.app.get('/staff', (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            try {
                return res.render('staff', {
                    title: locale.dashboard.staff?.title || 'Staff',
                    settings: this.client.settings,
                    client: this.clientView(),
                    config: this.configView(),
                    path: '/staff',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/staff')
                });
            }
            catch (error) {
                console.error('Error rendering staff page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale,
                    path: '/staff'
                });
            }
        });
        this.app.get('/api/dashboard/staff', async (req, res) => {
            try {
                const guild = this.mainGuild();
                const since = typeof req.query.since === 'string' && !isNaN(Date.parse(req.query.since))
                    ? new Date(req.query.since)
                    : undefined;
                const stats = await analytics_1.getStaffStats({ guildId: config_1.default.mainGuildId, since, limit: 100 });
                let members = [];
                if (guild) {
                    members = guild.members.cache
                        .filter((m) => !m.user.bot && (m.permissions.has('Administrator') || this.isStaffMember(m, this.client.settings)))
                        .map((m) => ({
                        id: m.id,
                        username: m.user.username,
                        tag: m.user.tag,
                        avatar: m.user.displayAvatarURL(),
                        roles: m.roles.cache.map(r => ({ id: r.id, name: r.name }))
                    }))
                        .slice(0, 100);
                }
                return res.json({ success: true, stats, members });
            }
            catch (error) {
                console.error('Error fetching staff stats:', error);
                return res.status(500).json({ success: false, error: 'Failed to fetch staff stats' });
            }
        });
        this.app.get('/api/dashboard/tickets', async (req, res) => {
            try {
                const page = (0, validation_1.clampInt)(req.query.page, 1, 1, 100000);
                const limit = (0, validation_1.clampInt)(req.query.limit, 25, 1, 100);
                const status = ['open', 'claimed', 'closed'].includes(req.query.status) ? req.query.status : 'all';
                const query = { guildId: config_1.default.mainGuildId };
                if (status !== 'all') {
                    query.status = status;
                }
                if ((0, validation_1.isSnowflake)(req.query.userId)) {
                    query.userId = req.query.userId;
                }
                const total = await Ticket_1.Ticket.countDocuments(query);
                const tickets = await Ticket_1.Ticket.find(query)
                    .sort({ createdAt: -1 })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .lean();
                return res.json({
                    success: true,
                    tickets: tickets || [],
                    total,
                    page,
                    limit,
                    pages: Math.max(1, Math.ceil(total / limit))
                });
            }
            catch (error) {
                console.error('Error listing tickets:', error);
                return res.status(500).json({ success: false, error: 'Failed to list tickets' });
            }
        });
        this.app.post('/api/dashboard/tickets/:id/action', async (req, res) => {
            try {
                const guild = this.mainGuild();
                if (!guild) {
                    return res.status(404).json({ success: false, error: 'Main guild not found' });
                }
                const ticketId = String(req.params.id || '').trim();
                const action = String(req.body.action || '').trim();
                if (!['close', 'reopen', 'delete'].includes(action)) {
                    return res.status(400).json({ success: false, error: 'Invalid action' });
                }
                const ticket = await Ticket_1.Ticket.findOne({ _id: ticketId, guildId: guild.id });
                if (!ticket) {
                    return res.status(404).json({ success: false, error: 'Ticket not found' });
                }
                const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '';
                if (action === 'close' && reason.length === 0) {
                    return res.status(400).json({ success: false, error: 'A close reason is required' });
                }
                const actorMember = await guild.members.fetch(req.session.user.id).catch(() => null);
                const actorIsStaff = this.isStaffMember(actorMember, this.client.settings) || req.session.user.isGuildAdmin === true;
                const access = (0, validation_1.canAccessTicket)({ id: req.session.user.id }, ticket.toObject(), { actorIsStaff, action });
                if (!access.ok) {
                    return res.status(403).json({ success: false, error: access.code === 'staffOnly' ? 'Only staff can delete tickets.' : 'You do not have permission to perform this action.' });
                }
                const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
                const section = (this.client.settings.ticket?.sections || []).find((s) => s.name === ticket.section);
                const logChannelId = section?.logChannelId || this.client.settings.ticket?.logChannelId || '';
                let transcript = null;
                if (action === 'close' || action === 'delete') {
                    if (ticket.status === 'closed' && action === 'close') {
                        return res.status(400).json({ success: false, error: 'Ticket is already closed' });
                    }
                    if (channel) {
                        try {
                            transcript = await (0, transcriptGenerator_1.createTranscript)(channel);
                        }
                        catch (error) {
                            console.error('Error creating ticket transcript:', error);
                        }
                    }
                }
                if (action === 'close') {
                    ticket.status = 'closed';
                    ticket.closedBy = req.session.user.id;
                    ticket.closedAt = new Date();
                    ticket.closedReason = reason;
                    await ticket.save();
                    if (logChannelId) {
                        const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
                        if (logChannel && typeof logChannel.send === 'function') {
                            const files = transcript ? [transcript] : [];
                            await logChannel.send({
                                embeds: [{
                                        title: 'Ticket Closed',
                                        color: 0xED4245,
                                        fields: [
                                            { name: 'Ticket', value: `#${transcript ? ticket.channelId : (channel?.name || ticket.channelId)}`, inline: true },
                                            { name: 'User', value: `<@${ticket.userId}>`, inline: true },
                                            { name: 'Closed By', value: `<@${req.session.user.id}>`, inline: true },
                                            { name: 'Reason', value: reason, inline: false }
                                        ],
                                        timestamp: new Date().toISOString()
                                    }],
                                files
                            }).catch(() => null);
                        }
                    }
                    if (channel) {
                        setTimeout(() => {
                            channel.delete().catch(() => null);
                        }, 5000);
                    }
                }
                else if (action === 'reopen') {
                    if (ticket.status === 'open' || ticket.status === 'claimed') {
                        return res.status(400).json({ success: false, error: 'Ticket is already open' });
                    }
                    ticket.status = 'open';
                    ticket.closedBy = null;
                    ticket.closedAt = null;
                    ticket.closedReason = null;
                    ticket.claimedBy = null;
                    ticket.claimedAt = null;
                    await ticket.save();
                    if (channel) {
                        await channel.permissionOverwrites.edit(ticket.userId, {
                            ViewChannel: true,
                            SendMessages: true,
                            ReadMessageHistory: true
                        }).catch(() => null);
                        await channel.send({ content: `🔓 Ticket reopened by <@${req.session.user.id}>.` }).catch(() => null);
                    }
                }
                else if (action === 'delete') {
                    const wasClosed = ticket.status === 'closed';
                    ticket.status = 'closed';
                    ticket.deleted = true;
                    ticket.deletedAt = new Date();
                    ticket.closedBy = ticket.closedBy || req.session.user.id;
                    ticket.closedAt = ticket.closedAt || new Date();
                    ticket.closedReason = ticket.closedReason || reason || null;
                    await ticket.save();
                    if (channel) {
                        await channel.delete().catch(() => null);
                    }
                    if (logChannelId && !wasClosed) {
                        const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
                        if (logChannel && typeof logChannel.send === 'function') {
                            const files = transcript ? [transcript] : [];
                            await logChannel.send({
                                embeds: [{
                                        title: 'Ticket Deleted',
                                        color: 0x99AAB5,
                                        fields: [
                                            { name: 'Ticket', value: ticket.channelId, inline: true },
                                            { name: 'User', value: `<@${ticket.userId}>`, inline: true },
                                            { name: 'Deleted By', value: `<@${req.session.user.id}>`, inline: true }
                                        ],
                                        timestamp: new Date().toISOString()
                                    }],
                                files
                            }).catch(() => null);
                        }
                    }
                }
                return res.json({ success: true, ticket: ticket.toObject() });
            }
            catch (error) {
                console.error('Error performing ticket action:', error);
                return res.status(500).json({ success: false, error: 'Failed to perform ticket action' });
            }
        });
        this.app.get('/api/dashboard/suggestions', async (req, res) => {
            try {
                const page = (0, validation_1.clampInt)(req.query.page, 1, 1, 100000);
                const limit = (0, validation_1.clampInt)(req.query.limit, 25, 1, 100);
                const status = ['pending', 'accepted', 'rejected'].includes(req.query.status) ? req.query.status : 'all';
                const query = { guildId: config_1.default.mainGuildId };
                if (status !== 'all') {
                    query.status = status;
                }
                const total = await Suggestion_1.Suggestion.countDocuments(query);
                const suggestions = await Suggestion_1.Suggestion.find(query)
                    .sort({ createdAt: -1 })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .lean();
                return res.json({
                    success: true,
                    suggestions: suggestions || [],
                    total,
                    page,
                    limit,
                    pages: Math.max(1, Math.ceil(total / limit))
                });
            }
            catch (error) {
                console.error('Error listing suggestions:', error);
                return res.status(500).json({ success: false, error: 'Failed to list suggestions' });
            }
        });
        this.app.post('/api/dashboard/suggestions/:id/action', async (req, res) => {
            try {
                const suggestionId = String(req.params.id || '').trim();
                const status = String(req.body.status || '').trim();
                if (!['pending', 'accepted', 'rejected'].includes(status)) {
                    return res.status(400).json({ success: false, error: 'Invalid status' });
                }
                const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : '';
                if (status === 'rejected' && reason.length === 0) {
                    return res.status(400).json({ success: false, error: 'A rejection reason is required' });
                }
                const actor = {
                    id: req.session.user.id,
                    username: req.session.user.globalName || req.session.user.username
                };
                const result = await suggestionHandler_1.dashboardSuggestionDecision(this.client, config_1.default.mainGuildId, suggestionId, status, reason || null, actor);
                if (!result.ok) {
                    const message = result.error === 'INVALID_TRANSITION' ? 'This suggestion has already been decided.' :
                        result.error === 'SUGGESTION_NOT_FOUND' ? 'Suggestion not found.' : 'Failed to update suggestion.';
                    return res.status(400).json({ success: false, error: message });
                }
                return res.json({ success: true, result });
            }
            catch (error) {
                console.error('Error updating suggestion from dashboard:', error);
                return res.status(500).json({ success: false, error: 'Failed to update suggestion' });
            }
        });
        this.app.post('/api/settings/logging', async (req, res) => {
            try {
                const target = String(req.body.target || '').trim();
                const allowed = {
                    moderation: { get: (s) => s.logs?.moderation, set: (s, v) => { s.logs.moderation = v; } },
                    automod: { get: (s) => s.automod ? { enabled: s.automod.enabled, channelId: s.automod.logChannelId || '' } : null, set: (s, v) => { if (!s.automod) s.automod = {}; s.automod.logChannelId = v.channelId || ''; s.automod.enabled = v.enabled; } },
                    raid: { get: (s) => s.protection?.raid || null, set: (s, v) => { if (!s.protection) s.protection = {}; if (!s.protection.raid) s.protection.raid = {}; s.protection.raid.logChannelId = v.channelId || ''; if (typeof v.enabled === 'boolean') s.protection.raid.enabled = v.enabled; } },
                    tickets: { get: (s) => s.ticket || null, set: (s, v) => { if (!s.ticket) s.ticket = {}; s.ticket.logChannelId = v.channelId || ''; } },
                    suggestions: { get: (s) => s.suggestions || null, set: (s, v) => { if (!s.suggestions) s.suggestions = {}; s.suggestions.logChannelId = v.channelId || ''; } },
                    warnings: { get: (s) => s.warnings || null, set: (s, v) => { if (!s.warnings) s.warnings = {}; s.warnings.logChannelId = v.channelId || ''; } },
                    member: { get: (s) => s.logs?.memberJoin || null, set: (s, v) => { if (!s.logs) s.logs = {}; if (!s.logs.memberJoin) s.logs.memberJoin = {}; if (!s.logs.memberLeave) s.logs.memberLeave = {}; s.logs.memberJoin.channelId = v.channelId || ''; s.logs.memberLeave.channelId = v.channelId || ''; } }
                };
                if (!allowed[target]) {
                    return res.status(400).json({ success: false, error: 'Invalid logging target' });
                }
                const validated = (0, validation_1.validateLoggingSettings)(req.body, ['enabled', 'channelId', 'color', 'ignoreBots', 'ignoredChannels']);
                const guild = this.mainGuild();
                if (validated.value.channelId) {
                    const channel = guild ? guild.channels.cache.get(validated.value.channelId) : null;
                    if (!channel || channel.type !== 0) {
                        return res.status(400).json({ success: false, error: 'Selected channel must be a text channel in this server.' });
                    }
                }
                let currentSettings = settingsManager_1.getSettings();
                const targetDef = allowed[target];
                targetDef.set(currentSettings, validated.value);
                settingsManager_1.persist();
                this.client.settings = currentSettings;
                return res.json({ success: true, settings: targetDef.get(currentSettings) });
            }
            catch (error) {
                console.error('Error saving logging settings:', error);
                return res.status(500).json({ success: false, error: 'Failed to save logging settings' });
            }
        });
        this.app.get('/antiraid', async (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            try {
                const guild = this.mainGuild();
                const channels = guild
                    ? guild.channels.cache
                        .filter(channel => channel.type === 0)
                        .map(channel => ({ id: channel.id, name: channel.name }))
                    : [];
                const roles = guild
                    ? guild.roles.cache
                        .filter(role => role.id !== guild.id)
                        .sort((a, b) => b.position - a.position)
                        .map(role => ({ id: role.id, name: role.name, color: role.hexColor }))
                    : [];
                const events = await moderationHistory_1.queryPaged({
                    guildId: config_1.default.mainGuildId,
                    action: 'antiraid',
                    page: 1,
                    limit: 25
                });
                return res.render('antiraid', {
                    title: locale.dashboard.antiraid?.title || 'Anti-Raid',
                    settings: this.client.settings,
                    channels,
                    roles,
                    events: events.records || [],
                    path: '/antiraid',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/antiraid')
                });
            }
            catch (error) {
                console.error('Error rendering anti-raid page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale,
                    path: '/antiraid'
                });
            }
        });
        this.app.get('/api/dashboard/antiraid/events', async (req, res) => {
            try {
                const page = (0, validation_1.clampInt)(req.query.page, 1, 1, 100000);
                const limit = (0, validation_1.clampInt)(req.query.limit, 25, 1, 100);
                const events = await moderationHistory_1.queryPaged({
                    guildId: config_1.default.mainGuildId,
                    action: 'antiraid',
                    page,
                    limit
                });
                return res.json({ success: true, ...events });
            }
            catch (error) {
                console.error('Error fetching anti-raid events:', error);
                return res.status(500).json({ success: false, error: 'Failed to fetch anti-raid events' });
            }
        });
        this.app.use((_req, res) => {
            res.status(404).render('error', {
                title: '404 - ' + res.locals.locale.dashboard.error['404'].title,
                error: {
                    code: 404,
                    message: res.locals.locale.dashboard.error['404'].message
                }
            });
        });
    }
async saveSettings(settings) {
        try {
            if (settings) {
                settingsManager_1.setCache(settings);
                this.client.settings = settings;
            }
            settingsManager_1.persist();
            console.log('Settings saved successfully');
            const savedSettings = settingsManager_1.getSettings();
            console.log('Verified saved settings:', savedSettings.commands[Object.keys(savedSettings.commands)[0]]);
        }
        catch (error) {
            console.error('Error saving settings:', error);
            throw error;
        }
    }
async isPortAvailable(port) {
        const v4 = await this.canBindPort('127.0.0.1', port);
        const v6 = await this.canBindPort('::', port);
        return v4 && v6;
    }
    canBindPort(host, port) {
        return new Promise((resolve) => {
            const net = require('net');
            const probe = net.createServer();
            probe.once('error', () => resolve(false));
            probe.once('listening', () => probe.close(() => resolve(true)));
            probe.listen(port, host);
        });
    }
    getPortOwnerPid(port) {
        if (process.platform !== 'win32') {
            return Promise.resolve(null);
        }
        return new Promise((resolve) => {
            const { exec } = require('child_process');
            exec('netstat -ano -p tcp', { windowsHide: true }, (_err, stdout) => {
                const line = String(stdout || '').split(/\r?\n/).find((l) => l.includes(`:${port}`) && l.includes('LISTENING'));
                if (!line) {
                    return resolve(null);
                }
                const parts = line.trim().split(/\s+/);
                resolve(parts[parts.length - 1] || null);
            });
        });
    }
    async start() {
        const port = config_1.default.dashboard.port;
        const available = await this.isPortAvailable(port);
        console.log(`[dashboard] Dashboard port: ${port}`);
        console.log(`[dashboard] Port available: ${available ? 'YES' : 'NO'}`);
        if (!available) {
            const ownerPid = await this.getPortOwnerPid(port).catch(() => null);
            console.log(`[dashboard] Existing owner PID: ${ownerPid || 'UNKNOWN'}`);
            const error = new Error(`listen EADDRINUSE: address already in use :::${port}`);
            error.code = 'EADDRINUSE';
            throw error;
        }
        try {
            this.server = this.app.listen(port, () => {
                console.log(`Dashboard running at http://localhost:${port}`);
            });
            this.server.on('error', async (error) => {
                if (error && error.code === 'EADDRINUSE') {
                    const ownerPid = await this.getPortOwnerPid(port).catch(() => null);
                    console.log(`[dashboard] Dashboard port: ${port}`);
                    console.log(`[dashboard] Port available: NO`);
                    console.log(`[dashboard] Existing owner PID: ${ownerPid || 'UNKNOWN'}`);
                }
                console.error('Failed to start dashboard:', (error && error.message) || error);
                process.exit(1);
            });
        }
        catch (error) {
            console.error('Failed to start dashboard:', (error && error.message) || error);
            if (error && error.code === 'EADDRINUSE') {
                throw error;
            }
        }
    }
    async stop() {
        if (!this.server || !this.server.listening) {
            this.server = null;
            return;
        }
        await new Promise((resolve) => {
            this.server.close(() => resolve());
            const timer = setTimeout(resolve, 3000);
            if (timer.unref) {
                timer.unref();
            }
        });
        this.server = null;
    }
    async generateDashboardStats() {
        const serverCount = this.client.guilds.cache.size;
        const memberCount = this.client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
        const commandCount = this.client.commands.size;
        const totalChannels = this.client.guilds.cache.reduce((acc, guild) => acc + guild.channels.cache.size, 0);
        const memoryUsage = process.memoryUsage();
        const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
        let commandsUsed = 0;
        const commandStats = this.client.commandStats;
        if (commandStats && typeof commandStats === 'object') {
            commandsUsed = Object.values(commandStats).reduce((sum, count) => sum + count, 0);
        }
        const protection = this.client.settings.protection || {};
        const activeProtections = Object.keys(protection)
            .filter(k => k !== 'enabled' && protection[k]?.enabled)
            .length;
        const protectedRoles = protection.protectedRoles?.roles?.length || 0;
        const whitelistedBots = protection.antibot?.whitelistedBots?.length || 0;
        const logs = this.client.settings.logs || {};
        const logsArray = Object.values(logs);
        const activeLogs = logsArray.filter(log => log.enabled).length;
        const uptimeSeconds = process.uptime();
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const uptime = days > 0
            ? `${days}d ${hours}h ${minutes}m`
            : hours > 0
                ? `${hours}h ${minutes}m`
                : `${minutes}m`;
        return {
            servers: serverCount,
            users: memberCount,
            commands: commandCount,
            commandsUsed,
            channels: totalChannels,
            ping: this.getPing(),
            uptime,
            memoryUsage: memoryUsageMB,
            protection: {
                activeProtections,
                protectedRoles,
                whitelistedBots,
                activeLogs
            }
        };
    }
    getModuleStatus() {
        const settings = this.client.settings;
        return {
            protection: {
                enabled: settings.protection?.enabled || false,
                activeRules: Object.keys(settings.protection || {})
                    .filter(k => k !== 'enabled' && settings.protection[k]?.enabled)
                    .length
            },
            tickets: {
                enabled: settings.ticket?.enabled || false,
                sections: (settings.ticket?.sections || []).length
            },
            apply: {
                enabled: settings.apply?.enabled || false,
                positions: (settings.apply?.positions || [])
                    .filter((p) => p.enabled)
                    .length
            },
            rules: {
                enabled: settings.rules?.enabled || false,
                sections: (settings.rules?.sections || []).length
            },
            giveaway: {
                enabled: settings.giveaway?.enabled || false
            },
            logs: {
                enabled: Object.values(settings.logs || {}).some((log) => log.enabled),
                activeTypes: Object.values(settings.logs || {}).filter((log) => log.enabled).length
            },
            autoReply: {
                enabled: settings.autoReply?.enabled || false,
                triggers: (settings.autoReply?.triggers || []).length
            },
            tempChannels: {
                enabled: settings.tempChannels?.enabled || false
            },
suggestions: {
                enabled: settings.suggestions?.enabled || false
            },
            automod: {
                enabled: settings.automod?.enabled || false,
                activeRules: Object.values(settings.automod?.rules || {}).filter((rule) => rule?.enabled).length
            },
            warnings: {
                enabled: settings.warnings?.enabled || false,
                maxWarnings: settings.warnings?.maxWarnings || 0
            },
            antiRaid: {
                enabled: settings.protection?.raid?.enabled || false
            },
            moderation: {
                enabled: settings.logs?.moderation?.enabled || false
            }
        };
    }
async getRecentActivity() {
        return [
            {
                id: 'system-init',
                type: 'system',
                title: 'System Initialized',
                description: 'All systems are up and running',
                icon: 'check-circle',
                color: 'blue',
                timestamp: this.startTime,
                timeAgo: this.getRelativeTime(this.startTime)
            }
        ];
    }
    getRelativeTime(date) {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSec = Math.round(diffMs / 1000);
        const diffMin = Math.round(diffSec / 60);
        const diffHour = Math.round(diffMin / 60);
        const diffDay = Math.round(diffHour / 24);
        if (diffSec < 60)
            return 'Just now';
        if (diffMin < 60)
            return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
        if (diffHour < 24)
            return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
        return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    }
}
exports.Dashboard = Dashboard;
