"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateLegacyWelcome = exports.normalizeWelcomeGoodbyeConfig = exports.WELCOME_GOODBYE_DEFAULTS = void 0;
const DEFAULT_CANVAS = { width: 1200, height: 600 };
exports.DEFAULT_CANVAS = DEFAULT_CANVAS;
const ALLOWED_FONTS = [
    'Arial',
    'Segoe UI',
    'Tahoma',
    'Verdana',
    'Georgia',
    'Times New Roman',
    'Courier New',
    'Trebuchet MS',
    'Impact'
];
const IMAGE_DEFAULTS = {
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
        opacity: 1,
        layer: 1
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
        opacity: 1,
        layer: 2
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
        opacity: 1,
        layer: 3
    }
};
const WELCOME_GOODBYE_DEFAULTS = {
    enabled: false,
    customTemplates: [],
    welcome: {
        message: {
            enabled: true,
            content: '',
            delivery: 'dm',
            channelId: ''
        },
        image: IMAGE_DEFAULTS
    },
    goodbye: {
        message: {
            enabled: false,
            content: '',
            channelId: ''
        },
        image: IMAGE_DEFAULTS
    }
};
exports.WELCOME_GOODBYE_DEFAULTS = WELCOME_GOODBYE_DEFAULTS;
const asBool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
const asStr = (value, fallback, max) => {
    if (typeof value !== 'string') {
        return fallback;
    }
    const trimmed = max !== undefined ? value.slice(0, max) : value;
    return trimmed;
};
const asNum = (value, fallback, min, max) => {
    const raw = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    let out = raw;
    if (min !== undefined) {
        out = Math.max(min, out);
    }
    if (max !== undefined) {
        out = Math.min(max, out);
    }
    return Math.round(out * 1000) / 1000;
};
const asPlainText = (value, fallback, max) => {
    if (typeof value !== 'string') {
        return fallback;
    }
    let out = value;
    out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
    out = out.replace(/[<>]/g, '');
    if (max !== undefined) {
        out = out.slice(0, max);
    }
    return out;
};
const normalizeBackground = (src, def) => {
    const allowed = ['none', 'color', 'image', 'transparent'];
    const fits = ['cover', 'contain', 'fill'];
    const type = allowed.includes(src.type) ? src.type : def.type;
    const clean = {
        type,
        source: asStr(src.source, def.source, 512),
        color: typeof src.color === 'string' ? src.color.slice(0, 32) : def.color,
        fit: fits.includes(src.fit) ? src.fit : def.fit,
        positionX: asNum(src.positionX, def.positionX, -4096, 4096),
        positionY: asNum(src.positionY, def.positionY, -4096, 4096),
        scale: asNum(src.scale, def.scale, 0.1, 4),
        overlay: asBool(src.overlay, def.overlay),
        overlayColor: typeof src.overlayColor === 'string' ? src.overlayColor.slice(0, 32) : def.overlayColor,
        overlayOpacity: asNum(src.overlayOpacity, def.overlayOpacity, 0, 1)
    };
    return clean;
};
const normalizeAvatar = (src, def) => ({
    enabled: asBool(src.enabled, def.enabled),
    x: asNum(src.x, def.x, -4096, 8192),
    y: asNum(src.y, def.y, -4096, 8192),
    width: asNum(src.width, def.width, 1, 1024),
    height: asNum(src.height, def.height, 1, 1024),
    scale: asNum(src.scale, def.scale, 0.1, 4),
    radius: asNum(src.radius, def.radius, 0, 512),
    circle: asBool(src.circle, def.circle),
    borderWidth: asNum(src.borderWidth, def.borderWidth, 0, 128),
    borderStyle: src.borderStyle === 'dashed' ? 'dashed' : 'solid',
    borderColor: typeof src.borderColor === 'string' ? src.borderColor.slice(0, 32) : def.borderColor,
    shadow: asBool(src.shadow, def.shadow),
    shadowColor: typeof src.shadowColor === 'string' ? src.shadowColor.slice(0, 32) : def.shadowColor,
    shadowBlur: asNum(src.shadowBlur, def.shadowBlur, 0, 256),
    opacity: asNum(src.opacity, def.opacity, 0, 1),
    layer: asNum(src.layer, def.layer, 0, 3)
});
const normalizeTextBlock = (src, def, contentType) => {
    const aligns = ['left', 'center', 'right'];
    const clean = {
        enabled: asBool(src.enabled, def.enabled),
        x: asNum(src.x, def.x, -4096, 8192),
        y: asNum(src.y, def.y, -4096, 8192),
        font: ALLOWED_FONTS.includes(src.font) ? src.font : def.font,
        fontSize: asNum(src.fontSize, def.fontSize, 1, 300),
        fontWeight: String(typeof src.fontWeight === 'string' && ['100', '200', '300', '400', '500', '600', '700', '800', '900', 'normal', 'bold'].includes(src.fontWeight) ? src.fontWeight : def.fontWeight),
        color: typeof src.color === 'string' ? src.color.slice(0, 32) : def.color,
        align: aligns.includes(src.align) ? src.align : def.align,
        maxWidth: asNum(src.maxWidth, def.maxWidth, 1, 2400),
        wrap: asBool(src.wrap, def.wrap),
        lineSpacing: asNum(src.lineSpacing, def.lineSpacing, 0.5, 3),
        shadow: asBool(src.shadow, def.shadow),
        shadowColor: typeof src.shadowColor === 'string' ? src.shadowColor.slice(0, 32) : def.shadowColor,
        shadowBlur: asNum(src.shadowBlur, def.shadowBlur, 0, 256),
        stroke: asBool(src.stroke, def.stroke),
        strokeColor: typeof src.strokeColor === 'string' ? src.strokeColor.slice(0, 32) : def.strokeColor,
        strokeWidth: asNum(src.strokeWidth, def.strokeWidth, 0, 64),
        letterSpacing: asNum(src.letterSpacing, def.letterSpacing, -10, 40),
        opacity: asNum(src.opacity, def.opacity, 0, 1),
        layer: asNum(src.layer, def.layer, 0, 3)
    };
    if (contentType === 'username') {
        clean.text = asPlainText(src.text, def.text, 200);
    }
    else {
        clean.content = asPlainText(src.content, def.content, 1000);
    }
    return clean;
};
const normalizeCanvas = (src, def) => ({
    width: asNum(src && src.width, def.width, 64, 4096),
    height: asNum(src && src.height, def.height, 64, 4096)
});
const normalizeImage = (src, def) => {
    const source = src || {};
    const deliveries = ['withMessage', 'beforeMessage', 'channel'];
    return {
        enabled: asBool(source.enabled, def.enabled),
        delivery: deliveries.includes(source.delivery) ? source.delivery : def.delivery,
        channelId: typeof source.channelId === 'string' ? source.channelId : def.channelId,
        canvas: normalizeCanvas(source.canvas, def.canvas),
        background: normalizeBackground(source.background || {}, def.background),
        avatar: normalizeAvatar(source.avatar || {}, def.avatar),
        username: normalizeTextBlock(source.username || {}, def.username, 'username'),
        text: normalizeTextBlock(source.text || {}, def.text, 'text')
    };
};
const normalizeMessage = (src, def, withDelivery) => {
    const source = src || {};
    const clean = {
        enabled: asBool(source.enabled, def.enabled),
        content: asStr(source.content, def.content, 2000)
    };
    if (withDelivery) {
        clean.delivery = source.delivery === 'channel' ? 'channel' : 'dm';
        clean.channelId = typeof source.channelId === 'string' ? source.channelId : def.channelId;
    }
    else {
        clean.channelId = typeof source.channelId === 'string' ? source.channelId : def.channelId;
    }
    return clean;
};
const normalizeWelcomeGoodbyeConfig = (input) => {
    const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const def = WELCOME_GOODBYE_DEFAULTS;
    const config = {
        enabled: asBool(src.enabled, def.enabled),
        welcome: {
            message: normalizeMessage(src.welcome?.message || {}, def.welcome.message, true),
            image: normalizeImage(src.welcome?.image || {}, def.welcome.image)
        },
        goodbye: {
            message: normalizeMessage(src.goodbye?.message || {}, def.goodbye.message, false),
            image: normalizeImage(src.goodbye?.image || {}, def.goodbye.image)
        }
    };
    config.customTemplates = Array.isArray(src.customTemplates)
        ? src.customTemplates
            .filter((item) => item && typeof item === 'object')
            .slice(0, 20)
            .map((item) => ({
                id: typeof item.id === 'string' ? item.id.slice(0, 64) : 'tpl',
                name: asPlainText(item.name, 'Template', 80),
                kind: item.kind === 'goodbye' ? 'goodbye' : 'welcome',
                config: normalizeImage(item.config || {}, def.welcome.image)
            }))
        : [];
    return config;
};
exports.normalizeWelcomeGoodbyeConfig = normalizeWelcomeGoodbyeConfig;
const migrateLegacyWelcome = (legacy) => {
    if (!legacy || typeof legacy !== 'object') {
        return normalizeWelcomeGoodbyeConfig(WELCOME_GOODBYE_DEFAULTS);
    }
    const enabled = legacy.enabled === true;
    const channelId = typeof legacy.channelId === 'string' ? legacy.channelId : '';
    return normalizeWelcomeGoodbyeConfig({
        enabled,
        welcome: {
            message: {
                enabled,
                content: typeof legacy.message === 'string' ? legacy.message : '',
                delivery: channelId ? 'channel' : 'dm',
                channelId
            },
            image: {
                enabled: false,
                delivery: 'withMessage',
                channelId
            }
        },
        goodbye: {
            message: { enabled: false, content: '', channelId: '' },
            image: { enabled: false, delivery: 'withMessage', channelId: '' }
        }
    });
};
exports.migrateLegacyWelcome = migrateLegacyWelcome;
exports.ALLOWED_FONTS = ALLOWED_FONTS;
exports.normalizeImage = normalizeImage;
exports.normalizeMessage = normalizeMessage;