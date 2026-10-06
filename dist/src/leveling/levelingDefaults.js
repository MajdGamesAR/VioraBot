'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.migrateLegacyLeveling =
  exports.normalizeLevelingConfig =
  exports.LEVELING_DEFAULTS =
    void 0;
const DEFAULT_CANVAS = { width: 600, height: 160 };
exports.DEFAULT_CANVAS = DEFAULT_CANVAS;
const ALLOWED_FONTS = [
  'Arial',
  'Arial Black',
  'Bahnschrift',
  'Calibri',
  'Cambria',
  'Cambria Math',
  'Candara',
  'Comic Sans MS',
  'Consolas',
  'Constantia',
  'Corbel',
  'Courier New',
  'Ebrima',
  'Franklin Gothic Medium',
  'Gabriola',
  'Georgia',
  'Impact',
  'Ink Free',
  'Javanese Text',
  'Leelawadee UI',
  'Lucida Console',
  'Lucida Sans Unicode',
  'Malgun Gothic',
  'Marlett',
  'Microsoft Himalaya',
  'Microsoft JhengHei',
  'Microsoft New Tai Lue',
  'Microsoft PhagsPa',
  'Microsoft Sans Serif',
  'Microsoft Tai Le',
  'Microsoft YaHei',
  'Microsoft Yi Baiti',
  'MingLiU-ExtB',
  'Mongolian Baiti',
  'MS Gothic',
  'MV Boli',
  'Myanmar Text',
  'Nirmala UI',
  'Palatino Linotype',
  'Segoe MDL2 Assets',
  'Segoe Print',
  'Segoe Script',
  'Segoe UI',
  'Segoe UI Emoji',
  'Segoe UI Historic',
  'Segoe UI Semibold',
  'Segoe UI Symbol',
  'SimSun',
  'Sitka',
  'Sylfaen',
  'Symbol',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Webdings',
  'Wingdings',
  'Yu Gothic',
];
const IMAGE_DEFAULTS = {
  canvas: DEFAULT_CANVAS,
  background: {
    type: 'color',
    color: '#36393F',
    overlayColor: '#000000',
    overlayOpacity: 0.4,
  },
  avatar: {
    x: 20,
    y: 20,
    width: 120,
    height: 120,
    radius: 60,
    borderStyle: 'solid',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowBlur: 0,
    layer: 1,
    opacity: 1,
  },
  username: {
    text: '[userName]',
    font: 'Arial',
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    align: 'left',
    x: 160,
    y: 20,
    maxWidth: 400,
    lineSpacing: 1,
    shadowBlur: 0,
    shadowColor: '#000000',
    strokeWidth: 0,
    strokeColor: '#000000',
    letterSpacing: 0,
    opacity: 1,
    layer: 1,
  },
  text: {
    content: '',
    font: 'Arial',
    fontSize: 16,
    fontWeight: 'normal',
    color: '#B9BBBE',
    align: 'left',
    x: 160,
    y: 70,
    maxWidth: 400,
    lineSpacing: 1,
    shadowBlur: 0,
    shadowColor: '#000000',
    strokeWidth: 0,
    strokeColor: '#000000',
    letterSpacing: 0,
    opacity: 1,
    layer: 1,
  },
};
const LEVELING_DEFAULTS = {
  enabled: false,
  xp: {
    enabled: true,
    cooldownSeconds: 60,
    minXp: 15,
    maxXp: 25,
  },
  levels: {
    baseXp: 100,
    xpMultiplier: 1.25,
    roleRewards: [],
  },
  levelUp: {
    enabled: true,
    message: {
      content: '',
      channelId: '',
    },
  },
  rankCard: IMAGE_DEFAULTS,
};
exports.LEVELING_DEFAULTS = LEVELING_DEFAULTS;
function asBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return fallback;
  return String(value).toLowerCase() === 'true';
}
function asStr(value, fallback, max) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().slice(0, max);
  return trimmed === '' ? fallback : trimmed;
}
function asNum(value, fallback, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  let result = Math.round(value * 1000) / 1000;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}
function asPlainText(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .slice(0, max);
}
function normalizeBackground(src, def) {
  if (!src || typeof src !== 'object') {
    const base = {
      type: def.type || 'color',
      color: def.color || '#36393F',
      overlayColor: def.overlayColor || '#000000',
      overlayOpacity: def.overlayOpacity === undefined ? 0.4 : def.overlayOpacity,
    };
    if (def.type === 'image' || def.type === 'none' || def.type === 'transparent') base.type = def.type;
    if (def.source !== undefined) base.source = def.source;
    if (def.fit !== undefined) base.fit = def.fit;
    return base;
  }
  const clean = {};
  const type = asStr(src.type, 'color', 32).toLowerCase();
  clean.type = ['none', 'color', 'image', 'transparent'].includes(type) ? type : 'color';
  if (clean.type === 'image') {
    clean.source = asStr(src.source, def.source || '', 512);
    clean.fit = ['cover', 'contain', 'fill'].includes(asStr(src.fit, 'cover', 16).toLowerCase())
      ? asStr(src.fit, 'cover', 16).toLowerCase()
      : 'cover';
  }
  clean.color = asStr(src.color, def.color || '#36393F', 32);
  clean.overlayColor = asStr(src.overlayColor, def.overlayColor || '#000000', 32);
  clean.overlayOpacity = asNum(src.overlayOpacity, def.overlayOpacity === undefined ? 0.4 : def.overlayOpacity, 0, 1);
  return clean;
}
function normalizeAvatar(src, def) {
  if (!src || typeof src !== 'object') return Object.assign({}, def);
  const clean = {};
  const borderStyle = asStr(src.borderStyle, 'solid', 16).toLowerCase();
  clean.borderStyle = ['dashed', 'solid'].includes(borderStyle) ? borderStyle : 'solid';
  clean.borderColor = asStr(src.borderColor, '#FFFFFF', 32);
  clean.x = asNum(src.x, 20, -4096, 8192);
  clean.y = asNum(src.y, 20, -4096, 8192);
  clean.width = asNum(src.width, 120, 1, 1024);
  clean.height = asNum(src.height, 120, 1, 1024);
  clean.radius = asNum(src.radius, 60, 0, 512);
  clean.borderWidth = asNum(src.borderWidth, 4, 0, 128);
  clean.shadowBlur = asNum(src.shadowBlur, 0, 0, 256);
  clean.layer = asNum(src.layer, 1, 0, 3);
  clean.opacity = asNum(src.opacity, 1, 0, 1);
  return clean;
}
function normalizeTextBlock(src, def, isUsername) {
  if (!src || typeof src !== 'object') return Object.assign({}, def);
  const clean = {};
  const align = asStr(src.align, 'left', 16).toLowerCase();
  clean.align = ['left', 'center', 'right'].includes(align) ? align : 'left';
  const font = asStr(src.font, 'Arial', 128);
  clean.font = ALLOWED_FONTS.includes(font) ? font : 'Arial';
  const fontWeight = asStr(src.fontWeight, isUsername ? 'bold' : 'normal', 16).toLowerCase();
  clean.fontWeight = ['100', '200', '300', '400', '500', '600', '700', '800', '900', 'normal', 'bold'].includes(fontWeight)
    ? fontWeight
    : isUsername
      ? 'bold'
      : 'normal';
  if (isUsername) {
    clean.text = asPlainText(src.text === undefined ? def.text : src.text, 200);
  } else {
    clean.content = asPlainText(src.content === undefined ? def.content : src.content, 1000);
  }
  clean.fontSize = asNum(src.fontSize, isUsername ? 36 : 16, 1, 300);
  clean.color = asStr(src.color, isUsername ? '#FFFFFF' : '#B9BBBE', 32);
  clean.x = asNum(src.x, isUsername ? 160 : 160, -4096, 8192);
  clean.y = asNum(src.y, isUsername ? 20 : 70, -4096, 8192);
  clean.maxWidth = asNum(src.maxWidth, 400, 1, 2400);
  clean.lineSpacing = asNum(src.lineSpacing, 1, 0.5, 3);
  clean.shadowBlur = asNum(src.shadowBlur, 0, 0, 256);
  clean.shadowColor = asStr(src.shadowColor, '#000000', 32);
  clean.strokeWidth = asNum(src.strokeWidth, 0, 0, 64);
  clean.strokeColor = asStr(src.strokeColor, '#000000', 32);
  clean.letterSpacing = asNum(src.letterSpacing, 0, -10, 40);
  clean.opacity = asNum(src.opacity, 1, 0, 1);
  clean.layer = asNum(src.layer, 1, 0, 3);
  return clean;
}
function normalizeCanvas(src) {
  if (!src || typeof src !== 'object') return { width: DEFAULT_CANVAS.width, height: DEFAULT_CANVAS.height };
  return {
    width: asNum(src.width, DEFAULT_CANVAS.width, 64, 4096),
    height: asNum(src.height, DEFAULT_CANVAS.height, 64, 4096),
  };
}
function normalizeImage(src, def) {
  const clean = {};
  const delivery = asStr(src && src.delivery, 'withMessage', 32).toLowerCase();
  clean.delivery = ['withMessage', 'beforeMessage', 'channel'].includes(delivery) ? delivery : 'withMessage';
  clean.enabled =
    src && typeof src === 'object' && src.enabled !== undefined
      ? asBool(src.enabled, def.enabled === undefined ? true : def.enabled)
      : def.enabled === undefined
        ? true
        : def.enabled;
  clean.channelId = asStr(src && src.channelId, def.channelId || '', 128);
  clean.canvas = normalizeCanvas(src && src.canvas);
  clean.background = normalizeBackground(src && src.background, def.background || IMAGE_DEFAULTS.background);
  clean.avatar = normalizeAvatar(src && src.avatar, def.avatar || IMAGE_DEFAULTS.avatar);
  clean.username = normalizeTextBlock(src && src.username, def.username || IMAGE_DEFAULTS.username, true);
  clean.text = normalizeTextBlock(src && src.text, def.text || IMAGE_DEFAULTS.text, false);
  return clean;
}
function normalizeMessage(src, def, withDelivery = false) {
  const clean = {};
  clean.content = asStr(src && src.content, def.content || '', 2000);
  clean.channelId = asStr(src && src.channelId, def.channelId || '', 128);
  if (withDelivery) {
    const delivery = asStr(src && src.delivery, 'channel', 16).toLowerCase();
    clean.delivery = ['channel', 'dm'].includes(delivery) ? delivery : 'channel';
  }
  return clean;
}
function normalizeLevelingConfig(src) {
  const fallbackSrc = {};
  const def = LEVELING_DEFAULTS;
  const clean = {};
  clean.enabled = asBool(src && src.enabled, def.enabled);
  const xpSrc = (src && src.xp) || fallbackSrc;
  clean.xp = {
    enabled: asBool(xpSrc.enabled, def.xp.enabled),
    cooldownSeconds: asNum(xpSrc.cooldownSeconds, def.xp.cooldownSeconds, 1, 3600),
    minXp: asNum(xpSrc.minXp, def.xp.minXp, 1, 1000),
    maxXp: asNum(xpSrc.maxXp, def.xp.maxXp, 1, 1000),
  };
  if (clean.xp.maxXp < clean.xp.minXp) clean.xp.maxXp = clean.xp.minXp;
  const levelsSrc = (src && src.levels) || fallbackSrc;
  clean.levels = {
    baseXp: asNum(levelsSrc.baseXp, def.levels.baseXp, 1, 1000000),
    xpMultiplier: asNum(levelsSrc.xpMultiplier, def.levels.xpMultiplier, 1, 10),
  };
  clean.levels.roleRewards = [];
  if (Array.isArray(levelsSrc.roleRewards)) {
    for (const reward of levelsSrc.roleRewards) {
      if (!reward || typeof reward !== 'object') continue;
      const level = asNum(reward.level, 1, 1, 1000000);
      const roleId = asStr(reward.roleId, '', 128);
      if (level > 0 && roleId !== '') clean.levels.roleRewards.push({ level, roleId });
    }
  }
  const levelUpSrc = (src && src.levelUp) || fallbackSrc;
  clean.levelUp = {
    enabled: asBool(levelUpSrc.enabled, def.levelUp.enabled),
    message: normalizeMessage(levelUpSrc.message, def.levelUp.message, false),
  };
  clean.rankCard = normalizeImage((src && src.rankCard) || fallbackSrc, def.rankCard);
  return clean;
}
exports.normalizeLevelingConfig = normalizeLevelingConfig;
function migrateLegacyLeveling(legacy) {
  const leveling = normalizeLevelingConfig(undefined);
  if (!legacy || typeof legacy !== 'object') return leveling;
  if (legacy.enabled === true) leveling.enabled = true;
  if (typeof legacy.channelId === 'string' && legacy.channelId.trim() !== '') {
    leveling.levelUp.message.channelId = legacy.channelId.trim();
  }
  return leveling;
}
exports.migrateLegacyLeveling = migrateLegacyLeveling;
exports.ALLOWED_FONTS = ALLOWED_FONTS;
exports.normalizeImage = normalizeImage;
exports.normalizeMessage = normalizeMessage;