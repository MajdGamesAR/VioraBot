/*
 * Welcome & Goodbye page controller.
 * Renders the image editors (Background / Avatar / Username / Text) for both
 * Welcome and Goodbye image cards, drives the live preview, handles uploads,
 * templates and the test modal, and saves configuration through the existing
 * dashboard API patterns.
 */
(function () {
    'use strict';

    const W = window.WELCOME_PAGE || {};
    const LOC = W.locale || {};
    const KINDS = ['welcome', 'goodbye'];
    const normalizeChannelList = (raw) =>
        (Array.isArray(raw) ? raw : [])
            .map((c) => ({ id: c && c.id, name: c && c.name }))
            .filter((c) => typeof c.id === 'string' && c.id && typeof c.name === 'string' && c.name);
    let CHANNELS = normalizeChannelList(W.channels);
    const MEMBERS = W.members || [];
    const FONTS = W.fonts || [];
    const TEMPLATES = W.templates || [];

    const L = (key, fallback) => {
        const parts = String(key).split('.');
        let o = LOC;
        for (let i = 0; i < parts.length && o != null; i++) o = o[parts[i]];
        if (typeof o === 'string' && o.length) return o;
        const glob = ((window.PAGE_LOCALE || {}).dashboard || {}).welcomeGoodbye;
        if (glob) {
            o = glob;
            for (let i = 0; i < parts.length && o != null; i++) o = o[parts[i]];
            if (typeof o === 'string' && o.length) return o;
        }
        return fallback != null ? fallback : '';
    };

    const FONT_WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900', 'normal', 'bold'];
    const ALIGNS = ['left', 'center', 'right'];
    const ALIGN_OPTIONS = ALIGNS.map((v) => ({ value: v, label: ({ left: L('align.left', 'Left'), center: L('align.center', 'Center'), right: L('align.right', 'Right') })[v] }));
    const BORDER_STYLES = [
        { value: 'solid', label: L('borderStyle.solid', 'Solid') },
        { value: 'dashed', label: L('borderStyle.dashed', 'Dashed') }
    ];
    const FIT_OPTIONS = [
        { value: 'cover', label: L('image.background.fitCover', 'Crop (cover)') },
        { value: 'contain', label: L('image.background.fitContain', 'Fit (contain)') },
        { value: 'fill', label: L('image.background.fitFill', 'Stretch (fill)') }
    ];
    const VARIABLES = [
        { token: '[user]', desc: L('variables.user', '') },
        { token: '[userName]', desc: L('variables.userName', '') },
        { token: '[memberCount]', desc: L('variables.memberCount', '') },
        { token: '[server]', desc: L('variables.server', '') },
        { token: '[inviter]', desc: L('variables.inviter', '') },
        { token: '[inviterName]', desc: L('variables.inviterName', '') },
        { token: '[invites]', desc: L('variables.invites', '') }
    ];
    function defaultsImage() {
        return {
            enabled: false,
            delivery: 'withMessage',
            channelId: '',
            canvas: { width: 1200, height: 600 },
            background: {
                type: 'none',
                source: '',
                color: '#1e1e2e',
                fit: 'cover',
                positionX: 0,
                positionY: 0,
                scale: 1,
                overlay: false,
                overlayColor: '#000000',
                overlayOpacity: 0.25
            },
            avatar: {
                enabled: true,
                x: 600,
                y: 210,
                width: 200,
                height: 200,
                scale: 1,
                radius: 0,
                circle: true,
                borderWidth: 0,
                borderStyle: 'solid',
                borderColor: '#FFFFFF',
                shadow: true,
                shadowColor: 'rgba(0,0,0,0.55)',
                shadowBlur: 24,
                opacity: 1
            },
            username: {
                enabled: true,
                text: '[userName]',
                x: 600,
                y: 430,
                font: 'Arial',
                fontSize: 48,
                fontWeight: '700',
                color: '#FFFFFF',
                align: 'center',
                maxWidth: 800,
                wrap: false,
                lineSpacing: 1.2,
                shadow: true,
                shadowColor: 'rgba(0,0,0,0.6)',
                shadowBlur: 8,
                stroke: false,
                strokeColor: '#000000',
                strokeWidth: 1,
                letterSpacing: 0,
                opacity: 1
            },
            text: {
                enabled: true,
                content: '',
                x: 600,
                y: 480,
                font: 'Arial',
                fontSize: 28,
                fontWeight: '500',
                color: '#FFFFFF',
                align: 'center',
                maxWidth: 800,
                wrap: true,
                lineSpacing: 1.3,
                shadow: true,
                shadowColor: 'rgba(0,0,0,0.6)',
                shadowBlur: 8,
                stroke: false,
                strokeColor: '#000000',
                strokeWidth: 1,
                letterSpacing: 0,
                opacity: 1
            }
        };
    }

    function defaultsConfig() {
        return {
            enabled: false,
            customTemplates: [],
            welcome: {
                message: { enabled: true, content: '', delivery: 'dm', channelId: '' },
                image: defaultsImage()
            },
            goodbye: {
                message: { enabled: false, content: '', channelId: '' },
                image: defaultsImage()
            }
        };
    }

    function deepMerge(base, extra) {
        const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
        if (extra && typeof extra === 'object') {
            Object.keys(extra).forEach((k) => {
                const v = extra[k];
                if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] !== null) {
                    out[k] = deepMerge(out[k], v);
                } else {
                    out[k] = typeof v === 'undefined' ? out[k] : v;
                }
            });
        }
        return out;
    }

    function isPlainObject(v) {
        return v && typeof v === 'object' && !Array.isArray(v);
    }

    function buildState() {
        const base = defaultsConfig();
        let cfg = isPlainObject(W.cfg) ? W.cfg : null;
        if (!cfg && isPlainObject(W.legacy) && typeof W.legacy.enabled !== 'undefined') {
            const channelId = typeof W.legacy.channelId === 'string' ? W.legacy.channelId : '';
            const fresh = defaultsConfig();
            fresh.welcome.message.enabled = !!W.legacy.enabled;
            fresh.welcome.message.content = typeof W.legacy.message === 'string' ? W.legacy.message : '';
            fresh.welcome.message.delivery = channelId ? 'channel' : 'dm';
            fresh.welcome.message.channelId = channelId || '';
            cfg = fresh;
        }
        if (cfg) {
            const merged = deepMerge(base, cfg);
            KINDS.forEach((kind) => {
                ['message', 'image'].forEach((part) => {
                    if (!isPlainObject(merged[kind][part])) merged[kind][part] = base[kind][part];
                });
                const msg = merged[kind].message;
                msg.enabled = !!msg.enabled;
                msg.content = typeof msg.content === 'string' ? msg.content : '';
                if (kind === 'welcome') {
                    msg.delivery = msg.delivery === 'channel' ? 'channel' : 'dm';
                }
                msg.channelId = typeof msg.channelId === 'string' ? msg.channelId : '';
                merged[kind].image.enabled = !!merged[kind].image.enabled;
            });
            base.enabled = !!merged.enabled;
            base.welcome = merged.welcome;
            base.goodbye = merged.goodbye;
            base.customTemplates = Array.isArray(merged.customTemplates) ? merged.customTemplates : [];
        }
        return base;
    }

    let state = null;

    document.addEventListener('DOMContentLoaded', () => {
        if (window.utils && window.utils.onPage) {
            utils.onPage('/welcome', initialize);
        } else if (window.location.pathname === '/welcome') {
            initialize();
        }
    });

    function initialize() {
        state = buildState();
        populateChannels();
        refreshChannelsFromApi();
        populateMembers();
        populateFonts();
        KINDS.forEach((kind) => {
            bindMessageCard(kind);
            bindImageCard(kind);
            bindImageDelivery(kind);
            buildEditor(kind);
            bindBackgroundControls(kind);
            bindPreviewRefresh(kind);
            bindTemplateControls(kind);
            bindTemplateGallery(kind);
            bindUpload(kind);
            bindCanvasEditor(kind);
        });
        bindGlobalToggle();
        bindVariables();
        bindSave();
        bindReset();
        bindTestModal();
        bindTemplateModal();
        KINDS.forEach((kind) => {
            if (editors[kind]) editors[kind].render();
        });
    }

    /* ------------------------------------------------------------------ */

    const CHANNEL_SELECT_META = [
        { elId: 'wg-welcome-message-channel', kind: 'welcome', section: 'message' },
        { elId: 'wg-goodbye-message-channel', kind: 'goodbye', section: 'message' },
        { elId: 'wg-welcome-image-channel', kind: 'welcome', section: 'image' },
        { elId: 'wg-goodbye-image-channel', kind: 'goodbye', section: 'image' }
    ];

    function channelSavedId(meta) {
        return meta.section === 'message' ? state[meta.kind].message.channelId : state[meta.kind].image.channelId;
    }

    function removeWarningAfter(sel) {
        const next = sel.nextElementSibling;
        if (next && next.classList && next.classList.contains('wg-channel-warning')) next.remove();
    }

    function addWarningAfter(sel, text) {
        removeWarningAfter(sel);
        const p = document.createElement('p');
        p.className = 'wg-channel-warning';
        p.textContent = text;
        sel.insertAdjacentElement('afterend', p);
    }

    function applyChannelOptions(sel, meta) {
        const previous = sel.value;
        const savedId = channelSavedId(meta);
        sel.innerHTML = `<option value="">${escapeHtml(L('image.selectChannel', 'Select a channel'))}</option>` +
            CHANNELS.map((c) => `<option value="${escapeAttr(c.id)}">#${escapeHtml(c.name)}</option>`).join('');
        removeWarningAfter(sel);
        const preferred = CHANNELS.some((c) => c.id === previous) ? previous
            : CHANNELS.some((c) => c.id === savedId) ? savedId
                : '';
        sel.value = preferred;
        if (savedId && !CHANNELS.some((c) => c.id === savedId)) {
            addWarningAfter(sel, L('channelDeleted', 'Configured channel no longer exists — select a new one.{id}').replace('{id}', savedId));
        }
        else if (!CHANNELS.length) {
            addWarningAfter(sel, L('noChannels', 'No text channels found — check the bot has access to text channels in this server.'));
        }
    }

    function populateChannels() {
        CHANNEL_SELECT_META.forEach((meta) => {
            const sel = document.getElementById(meta.elId);
            if (!sel) {
                console.error(`[welcome] MISSING channel selector #${meta.elId} (kind=${meta.kind} section=${meta.section})`);
                return;
            }
            applyChannelOptions(sel, meta);
            console.log(`[welcome] populated ${meta.elId} selector=${sel.options ? sel.options.length : 0}`);
        });
    }

    async function refreshChannelsFromApi() {
        console.log('[welcome] fetching channels');
        try {
            const resp = await fetch('/api/welcome/channels');
            console.log('[welcome] API status=' + resp.status);
            if (!resp.ok) {
                console.warn('[welcome] channels api status', resp.status);
                return;
            }
            const data = await resp.json();
            console.log('[welcome] API success=' + !!(data && data.success));
            console.log('[welcome] channels count=' + (data && Array.isArray(data.channels) ? data.channels.length : -1));
            if (data && data.success && Array.isArray(data.channels) && data.channels.length > 0) {
                CHANNELS = normalizeChannelList(data.channels);
                console.log('[welcome] channels from api =', CHANNELS.length, 'guild =', data.guildId || '?');
                populateChannels();
            }
            else {
                console.warn('[welcome] unexpected channels payload', data);
            }
        }
        catch (err) {
            console.error('[welcome] channels api request failed', err);
        }
    }

    function populateMembers() {
        const opts = MEMBERS.map((m) => `<option value="${escapeAttr(m.id)}">${escapeHtml(m.name)}</option>`).join('');
        const el = document.getElementById('wg-test-member');
        if (el) el.innerHTML = `<option value="">${escapeHtml(L('welcome.testMember', 'Use sample member'))}</option>${opts}`;
    }

    function populateFonts() {
        KINDS.forEach((kind) => {
            ['username', 'text'].forEach((sec) => {
                const sel = document.getElementById(`wg-${kind}-ed-${sec}-font`);
                if (sel && !sel.options.length) {
                    sel.innerHTML = (FONTS.length ? FONTS : ['Arial', 'Segoe UI', 'Tahoma', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New', 'Trebuchet MS', 'Impact'])
                        .map((f) => `<option value="${escapeAttr(f)}">${escapeHtml(f)}</option>`).join('');
                }
            });
        });
    }

    /* ------------------------------------------------------------------ */

    function bindMessageCard(kind) {
        const enable = document.getElementById(`wg-${kind}-message-enable`);
        const content = document.getElementById(`wg-${kind}-message-content`);
        const counter = document.getElementById(`wg-${kind}-message-counter`);
        const msg = state[kind].message;

        if (enable) {
            enable.checked = !!msg.enabled;
            enable.addEventListener('change', () => {
                state[kind].message.enabled = enable.checked;
                showSaveBar();
            });
        }
        if (content) {
            content.value = msg.content;
            const onInput = () => {
                state[kind].message.content = content.value;
                if (counter) counter.textContent = String(content.value.length);
                showSaveBar();
            };
            content.addEventListener('input', onInput);
            content.addEventListener('change', onInput);
            if (counter) counter.textContent = String(content.value.length);
        }

        if (kind === 'welcome') {
            const radios = document.querySelectorAll('input[name="wg-welcome-message-delivery"]');
            const channelWrap = document.querySelector('.wg-message-channel-wrap');
            const channelEl = document.getElementById('wg-welcome-message-channel');
            radios.forEach((radio) => {
                radio.checked = radio.value === msg.delivery;
                radio.addEventListener('change', () => {
                    if (!radio.checked) return;
                    state.welcome.message.delivery = radio.value;
                    const isChannel = radio.value === 'channel';
                    if (channelWrap) channelWrap.classList.toggle('hidden', !isChannel);
                    if (channelEl) channelEl.disabled = !isChannel;
                    showSaveBar();
                    refreshChannelValidity(kind, 'message');
                });
            });
            if (channelEl) {
                channelEl.value = msg.channelId;
                const isChannel = msg.delivery === 'channel';
                if (channelWrap) channelWrap.classList.toggle('hidden', !isChannel);
                channelEl.disabled = !isChannel;
                channelEl.addEventListener('change', () => {
                    state.welcome.message.channelId = channelEl.value;
                    showSaveBar();
                    refreshChannelValidity(kind, 'message');
                });
            }
        } else {
            const channelEl = document.getElementById('wg-goodbye-message-channel');
            if (channelEl) {
                channelEl.value = msg.channelId;
                channelEl.addEventListener('change', () => {
                    state.goodbye.message.channelId = channelEl.value;
                    showSaveBar();
                    refreshChannelValidity(kind, 'message');
                });
            }
        }
    }

    function bindImageCard(kind) {
        const enable = document.getElementById(`wg-${kind}-image-enable`);
        if (enable) {
            enable.checked = !!state[kind].image.enabled;
            enable.addEventListener('change', () => {
                state[kind].image.enabled = enable.checked;
                showSaveBar();
            });
        }
    }

    function bindImageDelivery(kind) {
        const radios = document.querySelectorAll(`input[name="wg-${kind}-image-delivery"]`);
        const channelEl = document.getElementById(`wg-${kind}-image-channel`);
        if (!radios.length || !channelEl) return;
        const image = state[kind].image;
        radios.forEach((radio) => {
            radio.checked = radio.value === image.delivery;
            radio.addEventListener('change', () => {
                if (!radio.checked) return;
                state[kind].image.delivery = radio.value;
                const isChannel = radio.value === 'channel';
                const wrap = channelEl.closest('.wg-image-channel-wrap');
                if (wrap) wrap.classList.toggle('hidden', !isChannel);
                channelEl.disabled = !isChannel;
                showSaveBar();
                refreshChannelValidity(kind, 'image');
            });
        });
        const isChannel = image.delivery === 'channel';
        const wrap = channelEl.closest('.wg-image-channel-wrap');
        if (wrap) wrap.classList.toggle('hidden', !isChannel);
        channelEl.disabled = !isChannel;
        channelEl.value = image.channelId;
        channelEl.addEventListener('change', () => {
            state[kind].image.channelId = channelEl.value;
            showSaveBar();
            refreshChannelValidity(kind, 'image');
        });
    }

    function refreshChannelValidity(kind, part) {
        /* No-op marker for the channel validation flow; server re-validates on save. */
    }

    /* ------------------------------------------------------------------ */
    /* Image editors                                                       */

    const FIELD_GROUPS = {
        background: [
            ['fit', 'select', 'background.fit', 0, 1, 1],
            ['overlay', 'checkbox', 'background.overlay', 0, 1, 1],
            ['overlayColor', 'color', 'background.overlayColor', 0, 1, 1],
            ['overlayOpacity', 'range', 'background.overlayOpacity', 0, 1, 0.05]
        ],
        avatar: [
            ['enabled', 'checkbox', 'avatar.enable', 0, 1, 1],
            ['radius', 'number', 'avatar.radius', 0, 512, 1],
            ['circle', 'checkbox', 'avatar.circle', 0, 1, 1],
            ['borderWidth', 'number', 'avatar.borderWidth', 0, 128, 1],
            ['borderStyle', 'select', 'avatar.borderStyle', 0, 1, 1],
            ['borderColor', 'color', 'avatar.borderColor', 0, 1, 1],
            ['shadow', 'checkbox', 'avatar.shadow', 0, 1, 1],
            ['shadowColor', 'color', 'avatar.shadowColor', 0, 1, 1],
            ['shadowBlur', 'number', 'avatar.shadowBlur', 0, 256, 1],
            ['opacity', 'range', 'avatar.opacity', 0, 1, 0.05]
        ],
        username: [
            ['enabled', 'checkbox', 'username.enable', 0, 1, 1],
            ['text', 'text', 'username.text', 0, 1, 1],
            ['font', 'font', 'username.font', 0, 1, 1],
            ['fontSize', 'number', 'username.fontSize', 1, 300, 1],
            ['fontWeight', 'weight', 'username.fontWeight', 0, 1, 1],
            ['color', 'color', 'username.color', 0, 1, 1],
            ['align', 'align', 'username.align', 0, 1, 1],
            ['maxWidth', 'number', 'username.maxWidth', 1, 2400, 1],
            ['wrap', 'checkbox', 'username.wrap', 0, 1, 1],
            ['lineSpacing', 'range', 'username.lineSpacing', 0.5, 3, 0.05],
            ['shadow', 'checkbox', 'username.shadow', 0, 1, 1],
            ['shadowColor', 'color', 'username.shadowColor', 0, 1, 1],
            ['shadowBlur', 'number', 'username.shadowBlur', 0, 256, 1],
            ['stroke', 'checkbox', 'username.stroke', 0, 1, 1],
            ['strokeColor', 'color', 'username.strokeColor', 0, 1, 1],
            ['strokeWidth', 'number', 'username.strokeWidth', 0, 64, 1],
            ['letterSpacing', 'number', 'username.letterSpacing', -10, 40, 1],
            ['opacity', 'range', 'username.opacity', 0, 1, 0.05]
        ],
        text: [
            ['enabled', 'checkbox', 'text.enable', 0, 1, 1],
            ['content', 'textarea', 'text.content', 0, 1, 1],
            ['font', 'font', 'text.font', 0, 1, 1],
            ['fontSize', 'number', 'text.fontSize', 1, 300, 1],
            ['fontWeight', 'weight', 'text.fontWeight', 0, 1, 1],
            ['color', 'color', 'text.color', 0, 1, 1],
            ['align', 'align', 'text.align', 0, 1, 1],
            ['maxWidth', 'number', 'text.maxWidth', 1, 2400, 1],
            ['wrap', 'checkbox', 'text.wrap', 0, 1, 1],
            ['lineSpacing', 'range', 'text.lineSpacing', 0.5, 3, 0.05],
            ['shadow', 'checkbox', 'text.shadow', 0, 1, 1],
            ['shadowColor', 'color', 'text.shadowColor', 0, 1, 1],
            ['shadowBlur', 'number', 'text.shadowBlur', 0, 256, 1],
            ['stroke', 'checkbox', 'text.stroke', 0, 1, 1],
            ['strokeColor', 'color', 'text.strokeColor', 0, 1, 1],
            ['strokeWidth', 'number', 'text.strokeWidth', 0, 64, 1],
            ['letterSpacing', 'number', 'text.letterSpacing', -10, 40, 1],
            ['opacity', 'range', 'text.opacity', 0, 1, 0.05]
        ]
    };
    const TAB_ORDER = ['background', 'avatar', 'username', 'text'];

    function escapedLocale(key, fallback) {
        return escapeHtml(L(key, fallback));
    }

    function buildEditor(kind) {
        const tabsEl = document.getElementById(`wg-editor-tabs-${kind}`);
        const panelsEl = document.getElementById(`wg-editor-panels-${kind}`);
        if (!tabsEl || !panelsEl) return;

        TAB_ORDER.forEach((section, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'editor-tab' + (idx === 0 ? ' active' : '');
            btn.textContent = L(`image.tabs.${section}`, section);
            btn.dataset.tab = section;
            btn.dataset.kind = kind;
            btn.addEventListener('click', () => {
                tabsEl.querySelectorAll('.editor-tab').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                panelsEl.querySelectorAll('.editor-panel').forEach((p) => p.classList.add('hidden'));
                const panel = panelsEl.querySelector(`.editor-panel[data-panel="${section}"]`);
                if (panel) panel.classList.remove('hidden');
            });
            tabsEl.appendChild(btn);

            const panel = document.createElement('div');
            panel.className = 'editor-panel' + (idx === 0 ? '' : ' hidden');
            panel.dataset.panel = section;
            if (section === 'background') {
                panel.appendChild(buildBackgroundPanel(kind));
            } else {
                panel.appendChild(schemaPanel(kind, section));
            }
            panelsEl.appendChild(panel);
        });
    }

    function schemaPanel(kind, section) {
        const wrap = document.createElement('div');
        wrap.className = 'field-grid';
        FIELD_GROUPS[section].forEach((def) => {
            const [key, type, labelKey, min, max, step] = def;
            const label = L(labelKey, key);
            buildControl(kind, section, key, type, labelKey, min, max, step).forEach((node) => wrap.appendChild(node));
        });
        if (section === 'username' || section === 'text') {
            const varKey = section === 'username' ? 'text' : 'content';
            wrap.appendChild(buildVarRow(`wg-${kind}-ed-${section}-${varKey}`));
        }
        return wrap;
    }

    function buildControl(kind, section, key, type, labelKey, min, max, step) {
        const nodes = [];
        const field = document.createElement('div');
        field.className = 'field';

        const label = document.createElement('label');
        label.htmlFor = `wg-${kind}-ed-${section}-${key}`;
        label.textContent = L(labelKey, key);

        let input;
        if (type === 'checkbox') {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'form-checkbox';
            input.id = `wg-${kind}-ed-${section}-${key}`;
            const value = state[kind].image[section] && typeof state[kind].image[section][key] !== 'undefined'
                ? state[kind].image[section][key] : defaultFor(section, key);
            input.checked = !!value;
            input.addEventListener('change', () => {
                state[kind].image[section][key] = input.checked;
                showSaveBar();
                debouncePreview(kind);
            });
            field.appendChild(label);
            field.appendChild(input);
        } else if (type === 'color') {
            input = document.createElement('input');
            input.type = 'color';
            input.className = 'color-input';
            input.id = `wg-${kind}-ed-${section}-${key}`;
            const value = state[kind].image[section] && typeof state[kind].image[section][key] !== 'undefined'
                ? state[kind].image[section][key] : defaultFor(section, key);
            input.value = normalizeColor(value);
            input.addEventListener('input', () => {
                state[kind].image[section][key] = input.value;
                showSaveBar();
                debouncePreview(kind);
            });
            field.appendChild(label);
            field.appendChild(input);
        } else if (type === 'select' || type === 'font' || type === 'weight' || type === 'align') {
            input = document.createElement('select');
            input.className = 'input-field';
            input.id = `wg-${kind}-ed-${section}-${key}`;

            const def = defaultFor(section, key);
            const cur = state[kind].image[section] && typeof state[kind].image[section][key] !== 'undefined'
                ? state[kind].image[section][key] : def;

            let options = [];
            if (type === 'select' && section === 'avatar' && key === 'borderStyle') {
                options = BORDER_STYLES;
            } else if (type === 'select' && section === 'background' && key === 'fit') {
                options = FIT_OPTIONS;
            } else if (type === 'align') {
                options = ALIGN_OPTIONS;
            } else if (type === 'weight') {
                options = FONT_WEIGHTS.map((w) => ({ value: w, label: w }));
            } else if (type === 'font') {
                options = (FONTS.length ? FONTS : ['Arial', 'Segoe UI', 'Tahoma', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New', 'Trebuchet MS', 'Impact'])
                    .map((f) => ({ value: f, label: f }));
            }
            options.forEach((opt) => {
                const o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.label;
                if (String(opt.value) === String(cur)) o.selected = true;
                input.appendChild(o);
            });

            input.addEventListener('change', () => {
                state[kind].image[section][key] = input.value;
                showSaveBar();
                debouncePreview(kind);
            });
            field.appendChild(label);
            field.appendChild(input);
        } else if (type === 'textarea') {
            input = document.createElement('textarea');
            input.className = 'input-field';
            input.rows = 3;
            input.maxLength = 1000;
            input.id = `wg-${kind}-ed-${section}-${key}`;
            const value = state[kind].image[section] && typeof state[kind].image[section][key] !== 'undefined'
                ? state[kind].image[section][key] : defaultFor(section, key);
            input.value = String(value || '');
            const commit = () => {
                state[kind].image[section][key] = input.value;
                showSaveBar();
                debouncePreview(kind);
            };
            input.addEventListener('input', commit);
            input.addEventListener('change', commit);
            field.appendChild(label);
            field.appendChild(input);
        } else {
            input = document.createElement('input');
            input.type = type === 'range' ? 'range' : 'number';
            input.className = type === 'range' ? 'range-input' : 'input-field';
            input.id = `wg-${kind}-ed-${section}-${key}`;
            const value = state[kind].image[section] && typeof state[kind].image[section][key] !== 'undefined'
                ? state[kind].image[section][key] : defaultFor(section, key);
            input.value = String(value);
            if (type === 'range') {
                input.min = String(min);
                input.max = String(max);
                input.step = String(step);
                input.addEventListener('input', () => {
                    const num = parseFloat(input.value);
                    state[kind].image[section][key] = isNaN(num) ? defaultFor(section, key) : num;
                    showSaveBar();
                    debouncePreview(kind);
                });
                const row = document.createElement('div');
                row.className = 'range-row';
                row.appendChild(input);
                row.insertAdjacentHTML('beforeend', `<span class="range-value" id="${input.id}-val">${input.value}</span>`);
                field.appendChild(label);
                field.appendChild(row);
            } else {
                input.min = String(min);
                input.max = String(max);
                input.step = String(step);
                input.addEventListener('input', () => {
                    const num = parseFloat(input.value);
                    state[kind].image[section][key] = isNaN(num) ? defaultFor(section, key) : num;
                    showSaveBar();
                    debouncePreview(kind);
                });
                field.appendChild(label);
                field.appendChild(input);
            }
        }
        nodes.push(field);
        return nodes;
    }

    function defaultFor(section, key) {
        const defaults = defaultsImage();
        if (defaults[section] && typeof defaults[section][key] !== 'undefined') return defaults[section][key];
        return '';
    }

    /* ------- Background panel ------- */

    function buildBackgroundPanel(kind) {
        const bg = state[kind].image.background;
        const wrap = document.createElement('div');
        wrap.className = 'space-y-4';

        const head = document.createElement('div');
        head.className = 'flex flex-wrap items-center gap-2';
        head.innerHTML = `
            <button type="button" class="reset-button wg-bg-upload-btn" data-kind="${kind}"><i class="fas fa-upload"></i> ${escapedLocale('image.background.uploadButton', 'Upload')}</button>
            <button type="button" class="reset-button wg-bg-replace-btn" data-kind="${kind}"><i class="fas fa-sync-alt"></i> ${escapedLocale('image.background.replace', 'Replace background')}</button>
            <button type="button" class="reset-button wg-bg-url-btn" data-kind="${kind}"><i class="fas fa-link"></i> ${escapedLocale('image.background.applyUrl', 'Apply URL')}</button>
            <button type="button" class="reset-button wg-bg-remove-btn" data-kind="${kind}"><i class="fas fa-trash"></i> ${escapedLocale('image.background.remove', 'Remove background')}</button>
            <input type="file" class="wg-bg-file-input hidden" data-kind="${kind}" accept="image/png,image/jpeg,image/webp">
        `;
        wrap.appendChild(head);

        const urlRow = document.createElement('div');
        urlRow.className = 'field bg-url-row hidden';
        urlRow.id = `wg-${kind}-bg-url-row`;
        urlRow.innerHTML = `
            <label for="wg-${kind}-bg-url">${escapedLocale('image.background.urlLabel', 'Image URL')}</label>
            <input type="text" id="wg-${kind}-bg-url" class="input-field" placeholder="https://example.com/bg.png" maxlength="2048">
        `;
        wrap.appendChild(urlRow);

        const typeRow = document.createElement('div');
        typeRow.className = 'field';
        const typeLabel = document.createElement('label');
        typeLabel.htmlFor = `wg-${kind}-bg-type`;
        typeLabel.textContent = L('image.background.typeLabel', 'Background type');
        const typeSel = document.createElement('select');
        typeSel.id = `wg-${kind}-bg-type`;
        typeSel.className = 'input-field';
        [['none', L('image.background.none', 'None')], ['color', L('image.background.color', 'Solid color')], ['image', L('image.background.image', 'Image')], ['transparent', L('image.transparent', 'Transparent')]].forEach(([v, lb]) => {
            const o = document.createElement('option');
            o.value = v;
            o.textContent = lb;
            typeSel.appendChild(o);
        });
        typeSel.value = ['none', 'color', 'image', 'transparent'].indexOf(bg.type) >= 0 ? bg.type : 'none';
        typeSel.addEventListener('change', () => {
            state[kind].image.background.type = typeSel.value;
            updateBackgroundVisibility(kind);
            showSaveBar();
            debouncePreview(kind);
        });
        typeRow.appendChild(typeLabel);
        typeRow.appendChild(typeSel);
        wrap.appendChild(typeRow);

        const canvasRow = document.createElement('div');
        canvasRow.className = 'field-grid bg-canvas-row hidden';
        canvasRow.id = `wg-${kind}-bg-canvas-row`;
        canvasRow.innerHTML = `
            <div class="field">
                <label for="wg-${kind}-bg-canvas-width">${escapedLocale('image.canvasWidth', 'Canvas width')}</label>
                <input type="number" min="64" max="4096" step="1" id="wg-${kind}-bg-canvas-width" class="input-field">
            </div>
            <div class="field">
                <label for="wg-${kind}-bg-canvas-height">${escapedLocale('image.canvasHeight', 'Canvas height')}</label>
                <input type="number" min="64" max="4096" step="1" id="wg-${kind}-bg-canvas-height" class="input-field">
            </div>
        `;
        wrap.appendChild(canvasRow);

        const colorRow = document.createElement('div');
        colorRow.className = 'field bg-color-row hidden';
        colorRow.id = `wg-${kind}-bg-color-row`;
        colorRow.innerHTML = `
            <label for="wg-${kind}-bg-color">${escapedLocale('image.background.color', 'Solid color')}</label>
            <input type="color" id="wg-${kind}-bg-color" class="color-input" value="${escapeAttr(normalizeColor(bg.color || '#1e1e2e'))}">
        `;
        wrap.appendChild(colorRow);

        const grid = document.createElement('div');
        grid.className = 'field-grid bg-fields';
        FIELD_GROUPS.background.forEach((def) => {
            const [key, type, labelKey, min, max, step] = def;
            buildControl(kind, 'background', key, type, labelKey, min, max, step).forEach((node) => grid.appendChild(node));
        });
        wrap.appendChild(grid);

        wrap.appendChild(buildVarRow(null));

        return wrap;
    }

    function updateBackgroundVisibility(kind) {
        const bg = state[kind].image.background;
        const typeSel = document.getElementById(`wg-${kind}-bg-type`);
        const colorRow = document.getElementById(`wg-${kind}-bg-color-row`);
        const colorInput = document.getElementById(`wg-${kind}-bg-color`);
        const urlRow = document.getElementById(`wg-${kind}-bg-url-row`);
        const replaceBtn = document.querySelector(`.wg-bg-replace-btn[data-kind="${kind}"]`);
        const canvasRow = document.getElementById(`wg-${kind}-bg-canvas-row`);
        const isColor = typeSel && typeSel.value === 'color';
        const isImage = typeSel && typeSel.value === 'image';
        const isTransparent = typeSel && typeSel.value === 'transparent';
        if (colorRow) colorRow.classList.toggle('hidden', !isColor);
        if (urlRow) urlRow.classList.toggle('hidden', !isImage);
        if (replaceBtn) replaceBtn.classList.toggle('hidden', !isImage);
        if (canvasRow) canvasRow.classList.toggle('hidden', !isTransparent);
        if (isImage && !bg.source && urlRow) urlRow.classList.remove('hidden');
        state[kind].image.background.color = colorInput ? colorInput.value : bg.color;
    }

    function bindBackgroundControls(kind) {
        const typeSel = document.getElementById(`wg-${kind}-bg-type`);
        const colorInput = document.getElementById(`wg-${kind}-bg-color`);
        const bg = state[kind].image.background;

        if (colorInput) {
            colorInput.addEventListener('input', () => {
                state[kind].image.background.color = colorInput.value;
                showSaveBar();
                debouncePreview(kind);
            });
        }

        if (!isPlainObject(state[kind].image.canvas)) state[kind].image.canvas = { width: 1200, height: 600 };
        const canvasWidthEl = document.getElementById(`wg-${kind}-bg-canvas-width`);
        const canvasHeightEl = document.getElementById(`wg-${kind}-bg-canvas-height`);
        if (canvasWidthEl) {
            canvasWidthEl.value = String(state[kind].image.canvas.width);
            canvasWidthEl.addEventListener('input', () => {
                const num = parseInt(canvasWidthEl.value, 10);
                if (!isNaN(num) && num >= 64 && num <= 4096) {
                    state[kind].image.canvas.width = num;
                    if (editors[kind]) editors[kind].render();
                    showSaveBar();
                    debouncePreview(kind);
                }
            });
        }
        if (canvasHeightEl) {
            canvasHeightEl.value = String(state[kind].image.canvas.height);
            canvasHeightEl.addEventListener('input', () => {
                const num = parseInt(canvasHeightEl.value, 10);
                if (!isNaN(num) && num >= 64 && num <= 4096) {
                    state[kind].image.canvas.height = num;
                    if (editors[kind]) editors[kind].render();
                    showSaveBar();
                    debouncePreview(kind);
                }
            });
        }

        const uploadBtn = document.querySelector(`.wg-bg-upload-btn[data-kind="${kind}"]`);
        const replaceBtn = document.querySelector(`.wg-bg-replace-btn[data-kind="${kind}"]`);
        const fileInput = document.querySelector(`.wg-bg-file-input[data-kind="${kind}"]`);
        const urlInput = document.getElementById(`wg-${kind}-bg-url`);
        const urlApply = document.querySelector(`.wg-bg-url-btn[data-kind="${kind}"]`);
        const removeBtn = document.querySelector(`.wg-bg-remove-btn[data-kind="${kind}"]`);

        if (fileInput) {
            fileInput.addEventListener('change', async () => {
                const file = fileInput.files && fileInput.files[0];
                if (!file) return;
                const okType = ['image/png', 'image/jpeg', 'image/webp'].indexOf(file.type) >= 0;
                if (!okType) {
                    showToast(L('uploadError', 'Invalid file type'), 'error');
                    fileInput.value = '';
                    return;
                }
                if (file.size > 10 * 1024 * 1024) {
                    showToast(L('uploadError', 'Invalid file type'), 'error');
                    fileInput.value = '';
                    return;
                }
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const resp = await fetch('/api/welcome/upload', { method: 'POST', body: formData });
                    const data = await resp.json();
                    if (!resp.ok || !data.ok) {
                        showToast(L('uploadError', 'Invalid file type'), 'error');
                        fileInput.value = '';
                        return;
                    }
                    state[kind].image.background.type = 'image';
                    state[kind].image.background.source = `upload:${data.id}`;
                    if (typeSel) typeSel.value = 'image';
                    updateBackgroundVisibility(kind);
                    showSaveBar();
                    if (editors[kind]) editors[kind].render();
                    await refreshImage(kind);
                    showToast(L('saved', 'Saved'), 'success');
                } catch (_error) {
                    showToast(L('uploadError', 'Invalid file type'), 'error');
                } finally {
                    fileInput.value = '';
                }
            });
            if (uploadBtn) {
                uploadBtn.addEventListener('click', () => fileInput.click());
            }
            if (replaceBtn) {
                replaceBtn.addEventListener('click', () => fileInput.click());
            }
        }

        if (urlApply && urlInput) {
            urlApply.addEventListener('click', () => {
                const url = urlInput.value.trim();
                if (!/^https?:\/\//i.test(url)) {
                    showToast(L('invalidUrlError', 'Invalid URL'), 'error');
                    return;
                }
                state[kind].image.background.type = 'image';
                state[kind].image.background.source = url;
                if (typeSel) typeSel.value = 'image';
                updateBackgroundVisibility(kind);
                showSaveBar();
                if (editors[kind]) editors[kind].render();
                refreshImage(kind);
            });
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                state[kind].image.background.type = 'none';
                state[kind].image.background.source = '';
                if (typeSel) typeSel.value = 'none';
                if (urlInput) urlInput.value = '';
                updateBackgroundVisibility(kind);
                showSaveBar();
                if (editors[kind]) editors[kind].render();
                debouncePreview(kind);
            });
        }
    }

    /* ------- Variables ------- */

    function buildVarRow(targetId) {
        const wrap = document.createElement('div');
        wrap.className = 'field';
        const title = document.createElement('span');
        title.className = 'text-xs text-gray-500 dark:text-gray-400';
        title.textContent = L('variables.title', 'Variables (click to copy)');
        wrap.appendChild(title);
        const chips = document.createElement('div');
        chips.className = 'flex flex-wrap gap-2';
        VARIABLES.forEach((v) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'var-chip';
            chip.title = v.desc;
            chip.textContent = v.token;
            chip.dataset.token = v.token;
            if (targetId) chip.dataset.target = targetId;
            chip.addEventListener('click', () => {
                if (chip.dataset.target) {
                    const target = document.getElementById(chip.dataset.target);
                    if (target) insertAtCursor(target, v.token);
                } else {
                    copyToken(v.token);
                }
            });
            chips.appendChild(chip);
        });
        wrap.appendChild(chips);
        return wrap;
    }

    function bindVariables() {
        document.querySelectorAll('.wg-var-row').forEach((row) => {
            const targetId = row.dataset.section === 'welcome'
                ? 'wg-welcome-message-content'
                : row.dataset.section === 'goodbye'
                    ? 'wg-goodbye-message-content'
                    : null;
            if (!targetId) return;
            const title = document.createElement('span');
            title.className = 'text-xs text-gray-500 dark:text-gray-400';
            title.textContent = row.dataset.varTitle || L('variables.title', 'Variables (click to copy)');
            row.appendChild(title);
            const chips = document.createElement('div');
            chips.className = 'flex flex-wrap gap-2';
            VARIABLES.forEach((v) => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'var-chip';
                chip.title = v.desc;
                chip.textContent = v.token;
                chip.dataset.token = v.token;
                chip.dataset.target = targetId;
                chip.addEventListener('click', () => insertAtCursor(document.getElementById(targetId), v.token));
                chips.appendChild(chip);
            });
            row.appendChild(chips);
        });
    }

    function insertAtCursor(input, text) {
        if (!input) return;
        const start = input.selectionStart != null ? input.selectionStart : input.value.length;
        const end = input.selectionEnd != null ? input.selectionEnd : start;
        input.value = input.value.slice(0, start) + text + input.value.slice(end);
        input.selectionStart = input.selectionEnd = start + text.length;
        input.focus();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function copyToken(token) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(token).then(() => showToast(L('variables.clickToCopy', 'Copied!'), 'success')).catch(() => {});
        }
    }

    /* ------- Canvas editor ------- */

    const editors = {};
    const CANVAS_DEFAULT = { width: 1200, height: 600 };
    const SAMPLE_CONTEXT = { userName: L('image.sampleName', 'Member'), memberCount: 0, server: L('image.sampleServer', 'Viora Server'), inviterName: '', inviter: '', invites: 0 };
    const RGX_VAR = /\[(user|userName|memberCount|server|inviter|inviterName|invites)\]/g;

    function replaceImageVariablesClient(template, context) {
        return String(template || '').replace(RGX_VAR, (matched, name) => {
            switch (name) {
                case 'user':
                case 'userName':
                    return context.userName || '';
                case 'memberCount':
                    return String(context.memberCount ?? '');
                case 'server':
                    return String(context.server || '');
                case 'inviter':
                case 'inviterName':
                    return context.inviterName || '';
                case 'invites':
                    return String(context.invites ?? '0');
                default:
                    return matched;
            }
        });
    }

    function fitRectCanvas(imgW, imgH, cw, chS, scalePct, offsetX, offsetY, fit) {
        const mode = fit === 'fill' ? 'fill' : fit === 'contain' ? 'contain' : 'cover';
        const baseScale = mode === 'cover'
            ? Math.max(cw / imgW, chS / imgH)
            : mode === 'contain'
                ? Math.min(cw / imgW, chS / imgH)
                : 1;
        const scale = baseScale * (scalePct || 1);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        return {
            x: (cw - drawW) / 2 + (offsetX || 0),
            y: (chS - drawH) / 2 + (offsetY || 0),
            width: drawW,
            height: drawH
        };
    }

    function wrapLinesCanvas(ctx, text, maxWidth) {
        const paragraphs = String(text || '').split('\n');
        const lines = [];
        for (const paragraph of paragraphs) {
            if (paragraph === '') {
                lines.push('');
                continue;
            }
            const words = paragraph.split(/\s+/);
            let current = '';
            for (const word of words) {
                const attempt = current ? `${current} ${word}` : word;
                if (ctx.measureText(attempt).width <= maxWidth || current === '') {
                    current = attempt;
                } else {
                    lines.push(current);
                    current = word;
                }
            }
            if (current) lines.push(current);
        }
        return lines;
    }

    class CanvasEditor {
        constructor(kind) {
            this.kind = kind;
            this.canvas = document.getElementById(`wg-${kind}-canvas`);
            this.stage = document.getElementById(`wg-${kind}-stage`);
            this.zoomEl = document.getElementById(`wg-${kind}-zoom`);
            this.zoomLabel = document.getElementById(`wg-${kind}-zoom-label`);
            this.emptyEl = document.getElementById(`wg-${kind}-empty`);
            if (!this.canvas || !this.stage) return;
            this.ctx = this.canvas.getContext('2d');
            this.state = state[kind].image;
            this.logicalW = CANVAS_DEFAULT.width;
            this.logicalH = CANVAS_DEFAULT.height;
            this.selected = null;
            this.dragging = null;
            this.zoom = 1;
            this.zoomMode = 'fit';
            this.bgSrc = null;
            this.bgImage = null;
            this.bgOk = false;
            this.bind();
        }

        /* ----- setup ----- */

        canvasSize() {
            const c = this.state.canvas;
            if (c && Number.isFinite(c.width) && Number.isFinite(c.height) && c.width >= 8 && c.height >= 8) {
                return { width: c.width, height: c.height };
            }
            return CANVAS_DEFAULT;
        }

        section(key) { return this.state[key] || {}; }

        layerOrder() {
            return ['avatar', 'username', 'text']
                .map((key) => ({ key, layer: Number(this.section(key).layer) || 0 }))
                .filter((e) => this.section(e.key).enabled)
                .sort((a, b) => a.layer - b.layer)
                .map((e) => e.key);
        }

        contentFor(key) {
            const s = this.section(key);
            if (key === 'username') return replaceImageVariablesClient(s.text, SAMPLE_CONTEXT);
            if (key === 'text') return replaceImageVariablesClient(s.content, SAMPLE_CONTEXT);
            return '';
        }

        boxFor(key) {
            const s = this.section(key);
            if (!s.enabled) return null;
            if (key === 'avatar') {
                const effW = Math.max((s.width || 0) * (s.scale || 1), 1);
                const effH = Math.max((s.height || 0) * (s.scale || 1), 1);
                return { left: s.x - effW / 2, top: s.y - effH / 2, width: effW, height: effH, x: s.x, y: s.y };
            }
            const content = this.contentFor(key);
            if (!String(content || '').trim()) return null;
            const ctx = this.ctx;
            ctx.font = `${s.fontWeight} ${s.fontSize}px "${s.font}"`;
            const maxWidth = s.maxWidth || this.logicalW;
            const lines = s.wrap ? wrapLinesCanvas(ctx, content, maxWidth) : String(content).split('\n');
            const lineHeight = s.fontSize * (s.lineSpacing || 1);
            const width = Math.max(1, ...lines.map((ln) => ctx.measureText(ln).width + (s.letterSpacing || 0) * Math.max(ln.length - 1, 0)));
            const height = lines.length * lineHeight;
            const startY = s.y - (lines.length > 1 ? ((lines.length - 1) * lineHeight) / 2 : 0);
            const top = startY - s.fontSize * 0.85;
            const left = s.align === 'left' ? s.x : s.align === 'right' ? s.x - width : s.x - width / 2;
            return { left, top, width, height, x: s.x, y: s.y };
        }

        hitTest(pt) {
            const order = this.layerOrder().slice().reverse();
            for (const key of order) {
                const box = this.boxFor(key);
                if (box && pt.x >= box.left && pt.x <= box.left + box.width && pt.y >= box.top && pt.y <= box.top + box.height) {
                    return key;
                }
            }
            return null;
        }

        handleAt(pt) {
            const box = this.boxFor(this.selected);
            if (!box) return null;
            const handles = this.handlePositions(box);
            const hit = handles.find((h) => Math.abs(h.p.x - pt.x) < 10 && Math.abs(h.p.y - pt.y) < 10);
            return hit ? hit.name : null;
        }

        handlePositions(box) {
            const half = 5 / this.zoom;
            const hw2 = box.width / 2;
            const hh2 = box.height / 2;
            return [
                { name: 'nw', p: { x: box.left, y: box.top } },
                { name: 'n', p: { x: box.left + hw2, y: box.top } },
                { name: 'ne', p: { x: box.left + box.width, y: box.top } },
                { name: 'e', p: { x: box.left + box.width, y: box.top + hh2 } },
                { name: 'se', p: { x: box.left + box.width, y: box.top + box.height } },
                { name: 's', p: { x: box.left + hw2, y: box.top + box.height } },
                { name: 'sw', p: { x: box.left, y: box.top + box.height } },
                { name: 'w', p: { x: box.left, y: box.top + hh2 } }
            ];
        }

        /* ----- rendering ----- */

        async render() {
            const ctx = this.ctx;
            const size = this.canvasSize();
            this.logicalW = size.width;
            this.logicalH = size.height;
            const z = this.zoom;
            const pxW = Math.max(1, Math.round(this.logicalW * z));
            const pxH = Math.max(1, Math.round(this.logicalH * z));
            if (this.canvas.width !== pxW) this.canvas.width = pxW;
            if (this.canvas.height !== pxH) this.canvas.height = pxH;
            this.canvas.style.width = `${pxW}px`;
            this.canvas.style.height = `${pxH}px`;
            ctx.setTransform(z, 0, 0, z, 0, 0);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.clearRect(0, 0, this.logicalW, this.logicalH);

            const bg = this.state.background || {};
            let bgFailed = false;
            if (bg.type === 'image') {
                const src = bg.source || '';
                if (src !== this.bgSrc) {
                    this.bgSrc = src;
                    this.bgImage = null;
                    this.bgOk = false;
                    if (src) {
                        const el = await this.loadBgImage(src);
                        if (el) { this.bgImage = el; this.bgOk = true; }
                    }
                }
                if (this.bgOk && this.bgImage) {
                    const rect = fitRectCanvas(this.bgImage.naturalWidth, this.bgImage.naturalHeight, this.logicalW, this.logicalH, bg.scale || 1, bg.positionX || 0, bg.positionY || 0, bg.fit || 'cover');
                    ctx.drawImage(this.bgImage, rect.x, rect.y, rect.width, rect.height);
                } else {
                    bgFailed = true;
                }
                if (bgFailed) {
                    ctx.fillStyle = '#1e1e2e';
                    ctx.fillRect(0, 0, this.logicalW, this.logicalH);
                }
            } else if (bg.type === 'color') {
                ctx.fillStyle = bg.color || '#1e1e2e';
                ctx.fillRect(0, 0, this.logicalW, this.logicalH);
            } else if (bg.type === 'transparent') {
                ctx.clearRect(0, 0, this.logicalW, this.logicalH);
            } else {
                ctx.fillStyle = '#1e1e2e';
                ctx.fillRect(0, 0, this.logicalW, this.logicalH);
            }
            if (bg.overlay) {
                ctx.globalAlpha = Math.min(Math.max(bg.overlayOpacity ?? 0, 0), 1);
                ctx.fillStyle = bg.overlayColor || '#000000';
                ctx.fillRect(0, 0, this.logicalW, this.logicalH);
                ctx.globalAlpha = 1;
            }

            for (const key of this.layerOrder()) {
                if (key === 'avatar') this.drawAvatar();
                else this.drawTextBlock(key);
            }

            this.drawSelection();

            if (this.emptyEl) {
                const showEmpty = bg.type === 'none' || (bg.type === 'image' && bgFailed);
                this.emptyEl.classList.toggle('hidden', !showEmpty);
            }
        }

        loadBgImage(src) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                if (src.indexOf('upload:') === 0) {
                    img.src = `/api/welcome/asset/${encodeURIComponent(src.slice(7))}`;
                } else {
                    img.src = src;
                }
            });
        }

        drawAvatar() {
            const a = this.section('avatar');
            if (!a.enabled) return;
            const ctx = this.ctx;
            const effW = Math.max(a.width * a.scale, 1);
            const effH = Math.max(a.height * a.scale, 1);
            const boxX = a.x - effW / 2;
            const boxY = a.y - effH / 2;
            const radius = Math.min(a.radius || 0, Math.min(effW, effH) / 2);
            const isCircle = a.circle === true || radius >= Math.min(effW, effH) / 2;
            ctx.save();
            ctx.beginPath();
            if (isCircle) {
                ctx.arc(a.x, a.y, Math.min(effW, effH) / 2, 0, Math.PI * 2);
            } else {
                roundRectPath(ctx, boxX, boxY, effW, effH, radius);
            }
            ctx.clip();
            ctx.globalAlpha = Math.min(Math.max(a.opacity ?? 1, 0), 1);
            ctx.shadowColor = a.shadow ? (a.shadowColor || 'rgba(0,0,0,0.5)') : 'transparent';
            ctx.shadowBlur = a.shadow ? (a.shadowBlur || 0) : 0;
            const hash = String(SAMPLE_CONTEXT.userName || 'A').split('').reduce((acc, ch) => acc + (ch.codePointAt(0) || 0), 0);
            ctx.fillStyle = `hsl(${hash % 360}, 45%, 45%)`;
            ctx.fill();
            const initial = (SAMPLE_CONTEXT.userName || 'A').trim().charAt(0).toUpperCase() || 'A';
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `700 ${Math.max(Math.round(Math.min(effW, effH) * 0.42), 12)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            ctx.fillText(initial, a.x, a.y + 2);
            ctx.restore();
            if (a.borderWidth > 0) {
                ctx.beginPath();
                if (isCircle) {
                    ctx.arc(a.x, a.y, Math.min(effW, effH) / 2, 0, Math.PI * 2);
                } else {
                    roundRectPath(ctx, boxX, boxY, effW, effH, radius);
                }
                ctx.globalAlpha = Math.min(Math.max(a.opacity ?? 1, 0), 1);
                ctx.strokeStyle = a.borderColor || '#FFFFFF';
                ctx.lineWidth = a.borderWidth;
                if (a.borderStyle === 'dashed') ctx.setLineDash([a.borderWidth * 2, a.borderWidth * 1.2]);
                ctx.shadowColor = a.shadow ? (a.shadowColor || 'rgba(0,0,0,0.5)') : 'transparent';
                ctx.shadowBlur = a.shadow ? (a.shadowBlur || 0) : 0;
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        drawTextBlock(key) {
            const s = this.section(key);
            const content = this.contentFor(key);
            if (!s.enabled || !String(content || '').trim()) return;
            const ctx = this.ctx;
            ctx.font = `${s.fontWeight} ${s.fontSize}px "${s.font}"`;
            const alignMap = s.align === 'left' ? 'left' : s.align === 'right' ? 'right' : 'center';
            const maxWidth = s.maxWidth || this.logicalW;
            const lines = s.wrap ? wrapLinesCanvas(ctx, content, maxWidth) : String(content).split('\n');
            const lineHeight = s.fontSize * (s.lineSpacing || 1);
            const total = lines.length;
            const startY = s.y - (total > 1 ? ((total - 1) * lineHeight) / 2 : 0);
            const ls = s.letterSpacing || 0;
            ctx.globalAlpha = Math.min(Math.max(s.opacity ?? 1, 0), 1);
            ctx.shadowColor = s.shadow ? (s.shadowColor || 'rgba(0,0,0,0.5)') : 'transparent';
            ctx.shadowBlur = s.shadow ? (s.shadowBlur || 0) : 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.strokeStyle = s.stroke ? (s.strokeColor || '#000000') : 'transparent';
            ctx.lineWidth = s.stroke ? (s.strokeWidth || 1) : 0;
            ctx.textAlign = alignMap;
            ctx.textBaseline = 'alphabetic';
            lines.forEach((line, index) => {
                const baselineY = startY + index * lineHeight;
                if (ls) {
                    ctx.textAlign = 'left';
                    const lineWidth = ctx.measureText(line).width + ls * Math.max(line.length - 1, 0);
                    const anchorX = alignMap === 'center' ? s.x - lineWidth / 2 : alignMap === 'right' ? s.x - lineWidth : s.x;
                    let cursor = anchorX;
                    for (const char of line) {
                        if (s.stroke && s.strokeWidth > 0 && s.strokeColor) ctx.strokeText(char, cursor + 1, baselineY + 1);
                        ctx.fillText(char, cursor + 1, baselineY + 1);
                        cursor += ctx.measureText(char).width + ls;
                    }
                } else {
                    if (s.stroke && s.strokeWidth > 0 && s.strokeColor) ctx.strokeText(line, s.x + 1, baselineY + 1);
                    ctx.fillText(line, s.x + 1, baselineY + 1);
                }
            });
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = 'transparent';
            ctx.lineWidth = 0;
        }

        drawSelection() {
            if (!this.selected) return;
            const box = this.boxFor(this.selected);
            if (!box) return;
            const ctx = this.ctx;
            const sw = 1.5 / this.zoom;
            ctx.save();
            ctx.setLineDash([5 / this.zoom, 3 / this.zoom]);
            ctx.strokeStyle = '#58a6ff';
            ctx.lineWidth = sw;
            ctx.strokeRect(box.left, box.top, box.width, box.height);
            ctx.setLineDash([]);
            const hs = 7 / this.zoom;
            this.handlePositions(box).forEach((h) => {
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#58a6ff';
                ctx.lineWidth = sw;
                ctx.fillRect(h.p.x - hs / 2, h.p.y - hs / 2, hs, hs);
                ctx.strokeRect(h.p.x - hs / 2, h.p.y - hs / 2, hs, hs);
            });
            ctx.restore();
        }

        /* ----- pointers ----- */

        toLogical(e) {
            const r = this.canvas.getBoundingClientRect();
            const ratioX = this.logicalW / r.width;
            const ratioY = this.logicalH / r.height;
            return { x: (e.clientX - r.left) * ratioX, y: (e.clientY - r.top) * ratioY };
        }

        bind() {
            const cw = this.canvas;
            cw.addEventListener('pointerdown', (e) => this.onPointerDown(e));
            cw.addEventListener('pointermove', (e) => this.onPointerMove(e));
            cw.addEventListener('pointerup', (e) => this.onPointerUp(e));
            cw.addEventListener('pointercancel', (e) => this.onPointerUp(e));
            cw.addEventListener('pointerleave', (e) => this.onPointerLeave(e));
            if (this.stage) {
                this.stage.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
            }

            const byId = (id) => document.getElementById(id);
            const btn = (id, fn) => {
                const el = byId(id);
                if (el) el.addEventListener('click', () => fn());
            };
            btn(`wg-${this.kind}-zoom-in`, () => this.zoomBy(1.25));
            btn(`wg-${this.kind}-zoom-out`, () => this.zoomBy(0.8));
            btn(`wg-${this.kind}-zoom-fit`, () => this.fitZoom());
            btn(`wg-${this.kind}-match-bg`, () => this.matchBackground());
            btn(`wg-${this.kind}-layer-up`, () => this.moveLayer(-1));
            btn(`wg-${this.kind}-layer-down`, () => this.moveLayer(1));
            btn(`wg-${this.kind}-verify-btn`, () => { refreshImage(this.kind, true); });
        }

        onPointerDown(e) {
            e.preventDefault();
            this.canvas.setPointerCapture(e.pointerId);
            const pt = this.toLogical(e);
            if (this.selected) {
                const handle = this.handleAt(pt);
                if (handle) {
                    this.dragging = { mode: 'resize', handle, start: pt, box: this.boxFor(this.selected) };
                    return;
                }
            }
            const hit = this.hitTest(pt);
            if (hit) {
                if (hit !== this.selected) this.selected = hit;
                this.dragging = { mode: 'move', key: hit, start: pt, ox: this.section(hit).x, oy: this.section(hit).y };
            } else {
                this.selected = null;
            }
            this.render();
        }

        onPointerMove(e) {
            if (!this.dragging) return;
            const pt = this.toLogical(e);
            if (this.dragging.mode === 'move') {
                const key = this.dragging.key;
                const sec = this.section(key);
                sec.x = Math.round(this.dragging.ox + (pt.x - this.dragging.start.x));
                sec.y = Math.round(this.dragging.oy + (pt.y - this.dragging.start.y));
                if (key !== 'avatar') this.selected = key;
                this.render();
                this.syncAdvanced();
                showSaveBar();
            } else if (this.dragging.mode === 'resize') {
                this.applyResize(this.dragging.handle, pt, this.dragging.box);
                this.render();
                this.syncAdvanced();
                showSaveBar();
            }
        }

        onPointerUp(e) {
            this.dragging = null;
        }

        onPointerLeave(e) {
            /* keep drag state so pointer capture still updates while leaving the element */
        }

        applyResize(handle, pt, box) {
            const key = this.selected;
            if (key === 'avatar') {
                const sec = this.section(key);
                const minSide = 8;
                const left = Math.min(handle.indexOf('w') >= 0 ? pt.x : box.left, box.left + box.width - minSide);
                const right = Math.max(handle.indexOf('e') >= 0 ? pt.x : box.left + box.width, left + minSide);
                const top = Math.min(handle.indexOf('n') >= 0 ? pt.y : box.top, box.top + box.height - minSide);
                const bottom = Math.max(handle.indexOf('s') >= 0 ? pt.y : box.top + box.height, top + minSide);
                sec.width = Math.max(1, Math.round(right - left));
                sec.height = Math.max(1, Math.round(bottom - top));
                sec.scale = 1;
                sec.x = Math.round((left + right) / 2);
                sec.y = Math.round((top + bottom) / 2);
            } else {
                const sec = this.section(key);
                const minSide = 6;
                let nH;
                if (handle.indexOf('n') >= 0) {
                    nH = Math.max(minSide, box.top + box.height - pt.y);
                } else {
                    nH = Math.max(minSide, pt.y - box.top);
                }
                const ratio = nH / box.height;
                sec.fontSize = Math.round(clamp(sec.fontSize * ratio, 6, 300));
                if (sec.wrap && sec.maxWidth) {
                    sec.maxWidth = Math.round(clamp(box.width * ratio, 40, 2400));
                }
            }
        }

        /* ----- zoom / layout ----- */

        fitZoom() {
            const rect = this.stage.getBoundingClientRect();
            const availW = Math.max(120, rect.width - 32);
            const availH = Math.max(90, rect.height - 32);
            const z = clamp(Math.min(availW / this.logicalW, availH / this.logicalH), 0.05, 2);
            this.setZoom(z, 'fit');
        }

        setZoom(z, mode) {
            this.zoom = clamp(z, 0.05, 4);
            this.zoomMode = mode;
            if (this.zoomLabel) this.zoomLabel.textContent = mode === 'fit' ? 'Fit' : `${Math.round(this.zoom * 100)}%`;
            this.render();
        }

        zoomBy(factor) {
            this.setZoom(this.zoom * factor, 'manual');
        }

        onWheel(e) {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            this.setZoom(this.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 'manual');
        }

        /* ----- layer order ----- */

        moveLayer(dir) {
            const order = this.layerOrder();
            if (order.length < 2) return;
            let from = order.indexOf(this.selected);
            if (from < 0) from = order.length - 1;
            let to = from + (dir === -1 ? -1 : 1);
            if (to < 0 || to >= order.length) return;
            const arr = order.slice();
            const [moved] = arr.splice(from, 1);
            arr.splice(to, 0, moved);
            arr.forEach((key, idx) => { this.section(key).layer = idx + 1; });
            this.selected = moved;
            this.render();
            showSaveBar();
        }

        /* ----- match background ----- */

        async matchBackground() {
            const bg = this.state.background || {};
            if (bg.type !== 'image' || !bg.source) return;
            const img = (this.bgSrc === bg.source && this.bgImage) ? this.bgImage : await this.loadBgImage(bg.source);
            if (!img) {
                showToast(L('image.background.loadFailed', 'Background could not be loaded'), 'error');
                return;
            }
            const oldW = this.logicalW;
            const oldH = this.logicalH;
            const fx = img.naturalWidth / oldW;
            const fy = img.naturalHeight / oldH;
            const f = (fx + fy) / 2;
            this.state.canvas = { width: img.naturalWidth, height: img.naturalHeight };
            const avatar = this.section('avatar');
            avatar.x = Math.round(avatar.x * fx);
            avatar.y = Math.round(avatar.y * fy);
            avatar.width = Math.max(1, Math.round(avatar.width * fx));
            avatar.height = Math.max(1, Math.round(avatar.height * fy));
            ['username', 'text'].forEach((key) => {
                const s = this.section(key);
                s.x = Math.round(s.x * fx);
                s.y = Math.round(s.y * fy);
                s.fontSize = Math.max(6, Math.round(s.fontSize * f));
                if (s.maxWidth) s.maxWidth = Math.round(s.maxWidth * fx);
            });
            this.bgSrc = bg.source;
            this.bgImage = img;
            this.bgOk = true;
            this.fitZoom();
            this.syncAdvanced();
            showSaveBar();
        }

        /* ----- advanced inputs ----- */

        bindAdvanced() {
            const details = document.getElementById(`wg-${this.kind}-adv`);
            const inputs = details ? details.querySelectorAll('input[data-section][data-key]') : [];
            inputs.forEach((input) => {
                input.addEventListener('input', () => {
                    const sec = this.section(input.dataset.section);
                    if (!sec) return;
                    const val = parseFloat(input.value);
                    if (isNaN(val)) return;
                    sec[input.dataset.key] = val;
                    this.render();
                    showSaveBar();
                });
            });
        }

        syncAdvanced() {
            const details = document.getElementById(`wg-${this.kind}-adv`);
            if (!details) return;
            const inputs = details.querySelectorAll('input[data-section][data-key]');
            inputs.forEach((input) => {
                const sec = this.section(input.dataset.section);
                if (sec && typeof sec[input.dataset.key] !== 'undefined') {
                    input.value = String(Math.round(sec[input.dataset.key] * 100) / 100);
                }
            });
        }

        syncFromState() {
            this.bgSrc = null;
            this.bgImage = null;
            this.bgOk = false;
            const order = this.layerOrder();
            if (order.indexOf(this.selected) < 0) this.selected = order[0] || null;
            this.syncAdvanced();
            this.render();
        }
    }

    function roundRectPath(ctx, x, y, w, h, r) {
        const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, w, h, rr);
            return;
        }
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function bindCanvasEditor(kind) {
        if (editors[kind]) return;
        const editor = new CanvasEditor(kind);
        if (!editor.canvas) return;
        editors[kind] = editor;
        editor.bindAdvanced();
        editor.fitZoom();
    }

    /* ------- Preview ------- */

    const previewTimers = {};

    function debouncePreview(kind) {
        if (editors[kind]) {
            clearTimeout(previewTimers[kind]);
            previewTimers[kind] = setTimeout(() => editors[kind].render(), 60);
            return;
        }
        clearTimeout(previewTimers[kind]);
    }

    async function refreshImage(kind, reveal) {
        const wrap = document.getElementById(`wg-${kind}-verify-wrap`);
        const img = document.getElementById(`wg-${kind}-verify-img`);
        if (!img) return;
        try {
            const resp = await fetch('/api/welcome/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind, config: state[kind].image })
            });
            if (!resp.ok || resp.headers.get('content-type') == null || resp.headers.get('content-type').indexOf('image') < 0) {
                if (wrap) wrap.classList.add('hidden');
                return;
            }
            const blob = await resp.blob();
            const dataUrl = await blobToDataUrl(blob);
            img.src = dataUrl;
            img.classList.remove('hidden');
            if (reveal && wrap) wrap.classList.remove('hidden');
        } catch (_error) {
            if (wrap) wrap.classList.add('hidden');
        }
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }

    function bindPreviewRefresh(kind) {
        const btn = document.getElementById(`wg-${kind}-refresh`);
        if (btn) btn.addEventListener('click', () => refreshImage(kind, true));
    }

    /* ------- Templates ------- */

    function bindTemplateControls(kind) {
        const select = document.getElementById(`wg-${kind}-template-select`);
        const useBtn = document.getElementById(`wg-${kind}-use-template`);
        const createBtn = document.getElementById(`wg-${kind}-create-template`);

        const all = TEMPLATES.concat(state.customTemplates.filter((t) => t.kind === kind));
        if (select) {
            all.forEach((t) => {
                const o = document.createElement('option');
                o.value = t.id;
                o.textContent = t.name;
                select.appendChild(o);
            });
            select.appendChild(createPromptOption(kind));
        }

        if (useBtn && select) {
            useBtn.addEventListener('click', async () => {
                const id = select.value;
                if (!id) return;
                const config = await resolveTemplateConfig(kind, id);
                if (!config) {
                    showToast(L('notSaved', 'Could not load template'), 'error');
                    return;
                }
                applyTemplateConfig(kind, config);
                showToast(L('image.templateSaved', 'Template saved'), 'success');
            });
        }

        if (createBtn) {
            createBtn.addEventListener('click', () => {
                const name = window.prompt(L('image.templateName', 'Template name'), L('image.templateDefaultName', 'My Template'));
                if (!name || !name.trim()) return;
                saveCustomTemplate(kind, name.trim().slice(0, 80));
            });
        }

        if (select) {
            const opt = select.querySelector('option[value="__custom__"]');
            if (opt) {
                opt.addEventListener('click', () => {
                    const name = window.prompt(L('image.templateName', 'Template name'), L('image.templateDefaultName', 'My Template'));
                    if (!name || !name.trim()) return;
                    saveCustomTemplate(kind, name.trim().slice(0, 80));
                });
            }
        }
    }

    function createPromptOption(kind) {
        const o = document.createElement('option');
        o.value = '__custom__';
        o.textContent = '＋ ' + L('image.createTemplate', 'Create Template');
        return o;
    }

    async function saveCustomTemplate(kind, name) {
        try {
            const resp = await fetch('/api/welcome/template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save', kind, name, config: state[kind].image })
            });
            const data = await resp.json();
            if (!resp.ok || !data.ok) {
                showToast(L('notSaved', 'Could not save'), 'error');
                return;
            }
            const template = { id: data.id, name: data.name, kind, config: JSON.parse(JSON.stringify(state[kind].image)) };
            state.customTemplates.push(template);
            const select = document.getElementById(`wg-${kind}-template-select`);
            if (select) {
                const o = document.createElement('option');
                o.value = template.id;
                o.textContent = template.name;
                select.insertBefore(o, select.querySelector('option[value="__custom__"]'));
                select.value = template.id;
            }
            showToast(L('image.templateSaved', 'Template saved'), 'success');
        } catch (_error) {
            showToast(L('notSaved', 'Could not save'), 'error');
        }
    }

    async function resolveTemplateConfig(kind, id) {
        const custom = state.customTemplates.find((t) => t.kind === kind && t.id === id);
        if (custom && custom.config) return custom.config;
        try {
            const resp = await fetch('/api/welcome/template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'apply', templateId: id, kind, config: state[kind].image, fillEmptyText: true })
            });
            const data = await resp.json();
            if (!resp.ok || !data.ok || !data.config) return null;
            return data.config;
        } catch (_error) {
            return null;
        }
    }

    function applyTemplateConfig(kind, config) {
        state[kind].image = deepMerge(defaultsImage(), config);
        rebindEditorValues(kind);
        if (editors[kind]) editors[kind].syncFromState();
        showSaveBar();
        refreshImage(kind);
    }

    /* ------- Template gallery ------- */

    const templateGalleryCache = {};
    let templateModalKind = 'welcome';

    function bindTemplateGallery(kind) {
        const btn = document.getElementById(`wg-${kind}-template-gallery-btn`);
        const modal = document.getElementById('wgTemplateModal');
        if (!btn || !modal) return;
        btn.addEventListener('click', () => openTemplateGallery(kind));
    }

    function bindTemplateModal() {
        const modal = document.getElementById('wgTemplateModal');
        if (!modal) return;
        const closeBtn = document.getElementById('wg-template-modal-close');
        const cancelBtn = document.getElementById('wg-template-modal-cancel');
        if (closeBtn) closeBtn.addEventListener('click', closeTemplateModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeTemplateModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeTemplateModal();
        });
    }

    function closeTemplateModal() {
        const modal = document.getElementById('wgTemplateModal');
        if (modal) modal.classList.add('hidden');
    }

    async function openTemplateGallery(kind) {
        const modal = document.getElementById('wgTemplateModal');
        if (!modal) return;
        templateModalKind = kind;
        const grid = document.getElementById('wg-template-grid');
        const loading = document.getElementById('wg-template-loading');
        if (grid) grid.innerHTML = '';
        if (loading) {
            loading.classList.remove('hidden');
            loading.textContent = L('image.templatesLoading', 'Loading templates...');
        }
        modal.classList.remove('hidden');
        if (templateGalleryCache[kind]) {
            renderTemplateGrid(kind, templateGalleryCache[kind]);
            return;
        }
        try {
            const resp = await fetch('/api/welcome/template-gallery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind })
            });
            const data = await resp.json();
            const templates = data && data.ok && Array.isArray(data.templates) ? data.templates : [];
            templateGalleryCache[kind] = templates;
            if (templates.length) {
                renderTemplateGrid(kind, templates);
            } else if (loading) {
                loading.textContent = L('image.templatesEmpty', 'No templates available.');
            }
        } catch (_error) {
            if (loading) {
                loading.textContent = L('fetchError', 'Request failed');
            }
        }
    }

    function renderTemplateGrid(kind, templates) {
        const grid = document.getElementById('wg-template-grid');
        const loading = document.getElementById('wg-template-loading');
        if (!grid) return;
        if (loading) loading.classList.add('hidden');
        grid.innerHTML = templates.map((tpl) => `
            <div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 flex flex-col">
                <div class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">${escapeHtml(tpl.name)}</div>
                <div class="p-3 flex-1 bg-gray-100 dark:bg-gray-900">
                    ${tpl.image ? `<img src="${escapeAttr(tpl.image)}" alt="${escapeAttr(tpl.name)}" class="w-full h-auto rounded border border-gray-200 dark:border-gray-700 bg-black">` : `<div class="h-32 flex items-center justify-center text-xs text-gray-400">${escapeHtml(L('image.background.loadFailed', 'Preview unavailable'))}</div>`}
                </div>
                <div class="p-3 border-t border-gray-200 dark:border-gray-700">
                    <button type="button" class="save-button w-full text-sm" data-template-id="${escapeAttr(tpl.id)}">${escapeHtml(L('image.useTemplate', 'Use Template'))}</button>
                </div>
            </div>`).join('');
        grid.querySelectorAll('button[data-template-id]').forEach((btn) => {
            btn.addEventListener('click', () => applyGalleryTemplate(templateModalKind, btn.dataset.templateId));
        });
    }

    async function applyGalleryTemplate(kind, id) {
        const config = await resolveTemplateConfig(kind, id);
        if (!config) {
            showToast(L('notSaved', 'Could not load template'), 'error');
            return;
        }
        applyTemplateConfig(kind, config);
        closeTemplateModal();
        showToast(L('image.templateSaved', 'Template saved'), 'success');
    }

    function rebindEditorValues(kind) {
        /* Re-sync dynamic controls after a template apply. */
        TAB_ORDER.forEach((section) => {
            FIELD_GROUPS[section].forEach((def) => {
                const [key, , , , , ] = def;
                const el = document.getElementById(`wg-${kind}-ed-${section}-${key}`);
                if (!el) return;
                const val = state[kind].image[section] ? state[kind].image[section][key] : undefined;
                if (typeof val === 'undefined' || val === null) return;
                if (el.type === 'checkbox') el.checked = !!val;
                else if (el.type === 'color') el.value = normalizeColor(val);
                else el.value = String(val);
            });
        });
        const typeSel = document.getElementById(`wg-${kind}-bg-type`);
        if (typeSel) typeSel.value = ['none', 'color', 'image', 'transparent'].indexOf(state[kind].image.background.type) >= 0 ? state[kind].image.background.type : 'none';
        const colorInput = document.getElementById(`wg-${kind}-bg-color`);
        if (colorInput) colorInput.value = normalizeColor(state[kind].image.background.color);
        if (!isPlainObject(state[kind].image.canvas)) state[kind].image.canvas = { width: 1200, height: 600 };
        const canvasWidthEl = document.getElementById(`wg-${kind}-bg-canvas-width`);
        const canvasHeightEl = document.getElementById(`wg-${kind}-bg-canvas-height`);
        if (canvasWidthEl) canvasWidthEl.value = String(state[kind].image.canvas.width);
        if (canvasHeightEl) canvasHeightEl.value = String(state[kind].image.canvas.height);
        updateBackgroundVisibility(kind);
    }

    /* ------- Upload helpers ------- */

    function bindUpload(kind) {
        const urlInput = document.getElementById(`wg-${kind}-bg-url`);
        if (urlInput) {
            urlInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const applyBtn = document.querySelector(`.wg-bg-url-btn[data-kind="${kind}"]`);
                    if (applyBtn) applyBtn.click();
                }
            });
        }
    }

    /* ------- Global ------- */

    function bindGlobalToggle() {
        const toggle = document.getElementById('wg-enabled');
        const status = document.getElementById('wg-system-status');
        if (!toggle) return;
        toggle.checked = !!state.enabled;
        toggle.addEventListener('change', () => {
            state.enabled = toggle.checked;
            if (status) status.textContent = toggle.checked ? L('on', 'Enabled') : L('off', 'Disabled');
            showSaveBar();
        });
    }

    function bindSave() {
        const btn = document.getElementById('wg-save');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            const missing = KINDS.map((kind) => {
                const msg = state[kind].message;
                const img = state[kind].image;
                const msgTarget = msg.delivery === 'channel' && !msg.channelId ? `${kind} message` : null;
                const imgTarget = img.enabled && img.delivery === 'channel' && !img.channelId ? `${kind} image` : null;
                return [msgTarget, imgTarget].filter(Boolean);
            }).flat();
            if (missing.length) {
                showToast(`${L('channelRequired', 'Select a channel for')}: ${missing.join(', ')}`, 'error');
                return;
            }
            btn.disabled = true;
            try {
                const payload = JSON.parse(JSON.stringify(state));
                const resp = await fetch('/api/welcome/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await resp.json();
                if (!resp.ok) {
                    showToast(L('notSaved', 'Could not save settings'), 'error');
                    return;
                }
                state = buildState();
                saveServerState(data.settings || payload);
                hideSaveBar();
                showToast(L('saved', 'Saved successfully'), 'success');
            } catch (_error) {
                showToast(L('fetchError', 'Request failed'), 'error');
            } finally {
                btn.disabled = false;
            }
        });
    }

    function saveServerState(serverState) {
        /* Rebuild editor values from the normalized server response. */
        state = deepMerge(defaultsConfig(), serverState);
        KINDS.forEach((kind) => {
            if (serverState[kind]) {
                const msg = document.getElementById(`wg-${kind}-message-content`);
                if (msg && serverState[kind].message) msg.value = serverState[kind].message.content || '';
                const enable = document.getElementById(`wg-${kind}-message-enable`);
                if (enable && serverState[kind].message) enable.checked = !!serverState[kind].message.enabled;
                const imgEn = document.getElementById(`wg-${kind}-image-enable`);
                if (imgEn && serverState[kind].image) imgEn.checked = !!serverState[kind].image.enabled;
                if (kind === 'welcome' && serverState[kind].message) {
                    const radios = document.querySelectorAll('input[name="wg-welcome-message-delivery"]');
                    radios.forEach((r) => { r.checked = r.value === serverState[kind].message.delivery; });
                }
                if (serverState[kind].message) {
                    const channel = document.getElementById(`${kind === 'welcome' ? 'wg-welcome-message-channel' : 'wg-goodbye-message-channel'}`);
                    if (channel) channel.value = serverState[kind].message.channelId || '';
                }
            }
            rebindEditorValues(kind);
            if (editors[kind]) editors[kind].syncFromState();
            refreshImage(kind);
        });
    }

    function bindReset() {
        const btn = document.getElementById('wg-reset');
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (window.confirm(L('unsavedChanges', 'You have unsaved changes'))) {
                window.location.reload();
            }
        });
    }

    /* ------- Test modal ------- */

    let activeTestKind = 'welcome';

    function bindTestModal() {
        const modal = document.getElementById('wgTestModal');
        const closeBtn = document.getElementById('wg-test-close');
        const runBtn = document.getElementById('wg-test-run');
        const memberSel = document.getElementById('wg-test-member');

        const welcomeBtn = document.getElementById('wg-welcome-test-btn');
        const goodbyeBtn = document.getElementById('wg-goodbye-test-btn');

        const open = (kind) => {
            activeTestKind = kind;
            populateMembers();
            if (modal) modal.classList.remove('hidden');
            runTest();
        };
        if (welcomeBtn) welcomeBtn.addEventListener('click', () => open('welcome'));
        if (goodbyeBtn) goodbyeBtn.addEventListener('click', () => open('goodbye'));

        if (closeBtn) closeBtn.addEventListener('click', () => {
            if (modal) modal.classList.add('hidden');
        });
        if (modal && runBtn) runBtn.addEventListener('click', runTest);
        if (memberSel) {
            memberSel.addEventListener('change', runTest);
        }
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        }
    }

    async function runTest() {
        const modal = document.getElementById('wgTestModal');
        const usedLabel = document.getElementById('wg-test-used-label');
        const textEl = document.getElementById('wg-test-text');
        const imageEl = document.getElementById('wg-test-image');
        const noImage = document.getElementById('wg-test-noimage');
        const memberSel = document.getElementById('wg-test-member');
        const runBtn = document.getElementById('wg-test-run');
        if (!modal || !textEl) return;

        const memberId = memberSel ? memberSel.value : '';
        if (runBtn) runBtn.disabled = true;
        try {
            const resp = await fetch('/api/welcome/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kind: activeTestKind,
                    memberId: memberId || null,
                    send: false,
                    image: state[activeTestKind].image
                })
            });
            const data = await resp.json();
            if (!resp.ok || !data.ok) {
                textEl.textContent = L('testResult.noImage', 'Image is disabled');
                if (usedLabel) usedLabel.textContent = '—';
                return;
            }
            if (usedLabel) {
                usedLabel.textContent = data.usedMember ? L('testResult.usedMember', 'Generated with this member') : L('testResult.usedSample', 'Generated with a sample member');
            }
            textEl.textContent = data.text || '';
            if (data.image) {
                imageEl.src = data.image;
                imageEl.classList.remove('hidden');
                if (noImage) noImage.classList.add('hidden');
            } else {
                imageEl.classList.add('hidden');
                imageEl.removeAttribute('src');
                if (noImage) noImage.classList.remove('hidden');
            }
        } catch (_error) {
            textEl.textContent = L('fetchError', 'Request failed');
        } finally {
            if (runBtn) runBtn.disabled = false;
        }
    }

    /* ------- Util ------- */

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(value) {
        return escapeHtml(value);
    }

    function normalizeColor(value) {
        const s = String(value || '').trim();
        if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) return s;
        return '#000000';
    }

    function showSaveBar() {
        const bar = document.getElementById('saveBar');
        if (bar) bar.classList.add('show');
    }

    function hideSaveBar() {
        const bar = document.getElementById('saveBar');
        if (bar) bar.classList.remove('show');
    }

    function showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white ${
            type === 'success' ? 'bg-green-500' :
            type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        } transition-all transform translate-y-0 opacity-100 z-50`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
})();