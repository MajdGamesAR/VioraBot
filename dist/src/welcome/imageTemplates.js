"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyImageTemplate = exports.getImageTemplates = exports.listImageTemplates = void 0;
const welcomeGoodbyeDefaults_1 = require("./welcomeGoodbyeDefaults");
const base = () => {
    return JSON.parse(JSON.stringify(welcomeGoodbyeDefaults_1.WELCOME_GOODBYE_DEFAULTS.welcome.image));
};
const withBackground = (template, patch) => {
    template.background = { ...template.background, ...patch };
    return template;
};
const withAvatar = (template, patch) => {
    template.avatar = { ...template.avatar, ...patch };
    return template;
};
const withUsername = (template, patch) => {
    template.username = { ...template.username, ...patch };
    return template;
};
const withText = (template, patch) => {
    template.text = { ...template.text, ...patch };
    return template;
};
const defineTemplates = () => {
    const t = base();
    t.background.type = 'color';
    t.background.color = '#5865F2';
    t.background.overlay = false;
    t.avatar.x = 600;
    t.avatar.y = 230;
    t.avatar.width = 210;
    t.avatar.height = 210;
    t.avatar.circle = true;
    t.avatar.borderWidth = 6;
    t.avatar.borderColor = '#FFFFFF';
    t.avatar.shadow = true;
    t.username.x = 600;
    t.username.y = 460;
    t.username.fontSize = 52;
    t.username.fontWeight = '700';
    t.username.color = '#FFFFFF';
    t.username.shadow = true;
    t.text.x = 600;
    t.text.y = 515;
    t.text.fontSize = 28;
    t.text.color = '#E0E4FF';
    const t1 = t;
    const t2 = withBackground(withAvatar(withUsername(withText(base(), {
        x: 560,
        y: 480,
        fontSize: 48,
        fontWeight: '700',
        color: '#FFFFFF',
        align: 'left',
        shadow: true,
        shadowColor: 'rgba(88,101,242,0.5)'
    }), {
        x: 250,
        y: 250,
        width: 220,
        height: 220,
        circle: true,
        borderWidth: 8,
        borderColor: '#FFFFFF'
    }), { type: 'color', color: '#131318', overlay: false }), {
        x: 560,
        y: 545,
        fontSize: 26,
        color: '#C9A3FF',
        align: 'left',
        wrap: true,
        maxWidth: 560
    });
    t2.background = { type: 'color', color: '#131318', overlay: false };
    const t3 = withBackground(withAvatar(withUsername(withText(base(), {
        text: '[userName]',
        x: 600,
        y: 430,
        fontSize: 50,
        fontWeight: '800',
        color: '#00E5FF',
        align: 'center',
        shadow: true,
        shadowColor: 'rgba(0,229,255,0.45)',
        shadowBlur: 16
    }), {
        x: 600,
        y: 200,
        width: 190,
        height: 190,
        circle: true,
        borderWidth: 5,
        borderColor: '#00E5FF'
    }), { type: 'color', color: '#0A0E1A', overlay: true, overlayColor: '#0A0E1A', overlayOpacity: 0.35 }), {
        x: 600,
        y: 490,
        fontSize: 30,
        fontWeight: '700',
        color: '#00E5FF',
        align: 'center',
        wrap: true
    });
    const t4 = withBackground(withAvatar(withUsername(withText(base(), {
        x: 600,
        y: 420,
        fontSize: 46,
        fontWeight: '500',
        color: '#111111',
        align: 'center',
        shadow: false
    }), {
        x: 600,
        y: 220,
        width: 180,
        height: 180,
        circle: true,
        borderWidth: 0,
        shadow: false
    }), { type: 'color', color: '#F5F5F5', overlay: false }), {
        x: 600,
        y: 480,
        fontSize: 26,
        fontWeight: '400',
        color: '#555555',
        align: 'center',
        wrap: true,
        shadow: false
    });
    const t5 = withBackground(withAvatar(withUsername(withText(base(), {
        x: 600,
        y: 440,
        fontSize: 54,
        fontWeight: '800',
        color: '#FF3DC8',
        align: 'center',
        shadow: true,
        shadowColor: 'rgba(255,61,200,0.55)',
        shadowBlur: 20
    }), {
        x: 600,
        y: 220,
        width: 200,
        height: 200,
        circle: true,
        borderWidth: 3,
        borderColor: '#FF3DC8',
        shadow: true,
        shadowColor: 'rgba(255,61,200,0.6)',
        shadowBlur: 26
    }), { type: 'color', color: '#05060F', overlay: true, overlayColor: '#0A0B18', overlayOpacity: 0.5 }), {
        x: 600,
        y: 495,
        fontSize: 28,
        fontWeight: '700',
        color: '#00D9FF',
        align: 'center',
        wrap: true,
        shadow: true,
        shadowColor: 'rgba(0,217,255,0.4)'
    });
    const t6 = withBackground(withAvatar(withUsername(withText(base(), {
        x: 600,
        y: 440,
        fontSize: 48,
        fontWeight: '700',
        color: '#FFFFFF',
        align: 'center',
        shadow: true,
        shadowColor: 'rgba(0,0,0,0.5)'
    }), {
        x: 600,
        y: 225,
        width: 210,
        height: 210,
        circle: true,
        borderWidth: 6,
        borderColor: '#57F287',
        shadow: true
    }), { type: 'color', color: '#1E2124', overlay: true, overlayColor: '#000000', overlayOpacity: 0.25 }), {
        x: 600,
        y: 500,
        fontSize: 27,
        fontWeight: '600',
        color: '#B5BAC1',
        align: 'center',
        wrap: true
    });
    return [
        { id: 'classic', name: 'Classic', config: t1 },
        { id: 'vioraPurple', name: 'Viora', config: t2 },
        { id: 'gaming', name: 'Gaming', config: t3 },
        { id: 'minimal', name: 'Minimal', config: t4 },
        { id: 'neon', name: 'Neon', config: t5 },
        { id: 'discordCommunity', name: 'Community', config: t6 }
    ];
};
const listImageTemplates = () => defineTemplates().map(({ id, name }) => ({ id, name }));
exports.listImageTemplates = listImageTemplates;
const getImageTemplates = () => defineTemplates();
exports.getImageTemplates = getImageTemplates;
const applyImageTemplate = (templateId, currentImageConfig, options) => {
    const template = defineTemplates().find((item) => item.id === templateId);
    if (!template) {
        return null;
    }
    const defaults = JSON.parse(JSON.stringify(welcomeGoodbyeDefaults_1.WELCOME_GOODBYE_DEFAULTS.welcome.image));
    const merged = {
        ...defaults,
        ...JSON.parse(JSON.stringify(template.config))
    };
    const current = currentImageConfig || {};
    if (options?.preserveFields !== false) {
        merged.enabled = current.enabled === true;
        merged.delivery = typeof current.delivery === 'string' ? current.delivery : merged.delivery;
        merged.channelId = typeof current.channelId === 'string' ? current.channelId : merged.channelId;
        if (current.background?.type === 'image' && current.background.source) {
            merged.background = {
                ...merged.background,
                type: 'image',
                source: current.background.source,
                positionX: current.background.positionX ?? merged.background.positionX,
                positionY: current.background.positionY ?? merged.background.positionY,
                scale: current.background.scale ?? merged.background.scale
            };
        }
        if (merged.text && current.text?.content) {
            merged.text.content = current.text.content;
        }
    }
    if (options?.fillEmptyText === true && current && (!current.text || !current.text.content)) {
        merged.text.content = '[userName], welcome to [server]!';
    }
    return merged;
};
exports.applyImageTemplate = applyImageTemplate;