'use strict';

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');

const logger = require('./logger');
const { ALLOWED_FONTS, LEVELING_DEFAULTS } = require('./levelingDefaults');

const DEFAULT_SETTINGS = LEVELING_DEFAULTS.rankCard || {};

function clamp01(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 1;
  return Math.min(1, Math.max(0, num));
}

function sanitizeFontFamily(font) {
  if (!font) return 'Arial';
  const candidate = String(font);
  if (Array.isArray(ALLOWED_FONTS) && ALLOWED_FONTS.indexOf(candidate) !== -1) return candidate;
  return 'Arial';
}

function buildFontString(fontCfg) {
  const cfg = fontCfg || {};
  const weight = String(cfg.fontWeight || 'normal');
  const size = Number(cfg.fontSize) || 16;
  const family = sanitizeFontFamily(cfg.font);
  return weight + ' ' + size + 'px ' + family;
}

function estimateTextWidth(text, fontSize) {
  return String(text || '').length * (Number(fontSize) || 16) * 0.52;
}

function fitRect(mode, content, container) {
  const cw = Number(content.width) || 0;
  const ch = Number(content.height) || 0;
  const cx = Number(container.x) || 0;
  const cy = Number(container.y) || 0;
  const tw = Number(container.width) || cw;
  const th = Number(container.height) || ch;
  if (cw <= 0 || ch <= 0) {
    return { x: cx, y: cy, width: tw, height: th };
  }
  if (mode === 'contain' || mode === 'cover') {
    const scale = mode === 'cover'
      ? Math.max(tw / cw, th / ch)
      : Math.min(tw / cw, th / ch);
    const w = cw * scale;
    const h = ch * scale;
    return { x: cx + (tw - w) / 2, y: cy + (th - h) / 2, width: w, height: h };
  }
  return { x: cx, y: cy, width: tw, height: th };
}

function fitCoverRect(content, container) {
  return fitRect('cover', content, container);
}

function registerFonts() {
  if (Array.isArray(ALLOWED_FONTS)) {
    for (const font of ALLOWED_FONTS) {
      if (typeof font === 'string' && !/^\s*$/.test(font)) {
        try {
          globalThis.GlobalFonts && globalThis.GlobalFonts.register(font);
        } catch (err) { /* ignore */ }
      }
    }
  }
}

function roundRectPath(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Number(radius) || 0);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth, fontCfg) {
  const lines = [];
  if (!text) return lines;
  ctx.save();
  ctx.font = buildFontString(fontCfg);
  const paragraphs = String(text).split('\n');
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = '';
    for (const word of words) {
      const candidate = current ? current + ' ' + word : word;
      if (current && ctx.measureText(candidate).width > (Number(maxWidth) || 0)) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  ctx.restore();
  return lines;
}

function drawTextBlock(ctx, cfg, lines) {
  const config = cfg || {};
  const fontSize = Number(config.fontSize) || 16;
  const lineSpacing = Number(config.lineSpacing) || 1;
  const maxWidth = Number(config.maxWidth) || 0;
  const align = ['left', 'center', 'right'].indexOf(String(config.align).toLowerCase()) !== -1
    ? String(config.align).toLowerCase()
    : 'left';
  const lineHeight = fontSize * lineSpacing;
  let cursorY = Number(config.y) || 0;

  ctx.save();
  ctx.font = buildFontString(config);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = align;
  ctx.globalAlpha = clamp01(config.opacity);
  if (Number(config.letterSpacing)) {
    try { ctx.letterSpacing = Number(config.letterSpacing); } catch (err) { /* ignore */ }
  }
  if (Number(config.shadowBlur) > 0) {
    ctx.shadowColor = config.shadowColor || 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = Number(config.shadowBlur) || 0;
  } else {
    ctx.shadowBlur = 0;
  }

  let baseX = Number(config.x) || 0;
  if (align === 'center') baseX = baseX + maxWidth / 2;
  else if (align === 'right') baseX = baseX + maxWidth;

  ctx.lineWidth = Math.max(Number(config.strokeWidth) || 0, 0);
  for (const line of lines) {
    const baseline = cursorY + fontSize;
    if (ctx.lineWidth > 0) {
      ctx.strokeStyle = config.strokeColor || '#000000';
      ctx.strokeText(line, baseX, baseline);
    }
    ctx.fillStyle = config.color || '#FFFFFF';
    ctx.fillText(line, baseX, baseline);
    cursorY += lineHeight;
  }
  ctx.restore();
  return { lines, baselineY: cursorY };
}

function fillBackgroundLayer(ctx, canvas, config) {
  const bg = config || {};
  const type = String(bg.type || 'color').toLowerCase();
  let draw = bg.area;
  if (!draw || typeof draw.width === 'undefined' || typeof draw.height === 'undefined') {
    draw = { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }
  if (type === 'image' && bg.url) {
    try {
      const img = loadImageSync(bg.url);
      if (img) {
        const rect = fitRect('cover', { width: img.width, height: img.height }, draw);
        ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);
      }
    } catch (err) { /* fall through to color */ }
  }
  if (bg.color) {
    ctx.fillStyle = bg.color;
    ctx.fillRect(draw.x, draw.y, draw.width, draw.height);
  }
  const overlayOpacity = Number(bg.overlayOpacity);
  if (bg.overlayColor && overlayOpacity > 0) {
    ctx.globalAlpha = Math.min(1, Math.max(0, overlayOpacity));
    ctx.fillStyle = bg.overlayColor || '#000000';
    ctx.fillRect(draw.x, draw.y, draw.width, draw.height);
    ctx.globalAlpha = 1;
  }
}

function loadImageSync(url) {
  const buffer = downloadAvatarSync(url);
  if (!buffer) return null;
  try {
    return loadImage(buffer);
  } catch (err) {
    return null;
  }
}

function downloadAvatarSync(url) {
  if (!url) return null;
  try {
    const response = axios.get(String(url), {
      responseType: 'arraybuffer',
      timeout: 8000,
      maxContentLength: 5 * 1024 * 1024,
    });
    if (response && Buffer.isBuffer(response.data) && response.data.length > 0) return response.data;
  } catch (err) { /* ignore */ }
  return null;
}

async function downloadAvatar(url) {
  if (!url) return null;
  try {
    const response = await axios.get(String(url), {
      responseType: 'arraybuffer',
      timeout: 8000,
      maxContentLength: 5 * 1024 * 1024,
    });
    if (response && Buffer.isBuffer(response.data) && response.data.length > 0) return response.data;
  } catch (err) { /* ignore */ }
  return null;
}

function pickAvatarUrl(user) {
  const u = user || {};
  if (u.avatarURL) return u.avatarURL;
  if (u.avatarUrl) return u.avatarUrl;
  if (u.avatar) return u.avatar;
  if (u.user && u.user.avatarURL) return u.user.avatarURL;
  return null;
}

function hashHue(value) {
  let hash = 0;
  for (const char of String(value || '')) {
    hash = (hash + char.charCodeAt(0)) & 0xffffff;
  }
  return (hash % 360 + 360) % 360;
}

function drawFallbackAvatar(ctx, rect, userName, config) {
  const name = String(userName || '?').trim();
  const initial = (name.charAt(0) || '?').toUpperCase();
  const hue = hashHue(name || 'A');
  const radius = Number(config.radius) || Math.min(rect.width, rect.height) / 2;

  ctx.save();
  ctx.globalAlpha = clamp01(config.opacity);
  roundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, radius);
  ctx.fillStyle = 'hsl(' + hue + ', 45%, 45%)';
  ctx.fill();

  const fontSize = Math.max(Math.round(Math.min(rect.width, rect.height) * 0.42), 12);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 ' + fontSize + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, rect.x + rect.width / 2, rect.y + rect.height / 2);
  ctx.restore();
}

function resolveText(template, values) {
  let output = template == null ? '' : String(template);
  if (values) {
    for (const key of Object.keys(values)) {
      output = output.split(key).join(values[key]);
    }
  }
  return output;
}

function mergeSection(base, override) {
  const source = override || {};
  const result = { ...(base || {}) };
  for (const key of Object.keys(source)) {
    if (source[key] !== undefined && source[key] !== null) result[key] = source[key];
  }
  return result;
}

async function renderRankCardImage(user, rank, settings) {
  try {
    registerFonts();

    const merged = mergeSection(DEFAULT_SETTINGS, settings);
    const background = mergeSection(DEFAULT_SETTINGS.background, settings && settings.background);
    const avatar = mergeSection(DEFAULT_SETTINGS.avatar, settings && settings.avatar);
    const usernameCfg = mergeSection(DEFAULT_SETTINGS.username, settings && settings.username);
    const textCfg = mergeSection(DEFAULT_SETTINGS.text, settings && settings.text);

    const userName = String((user && (user.username || user.name)) || usernameCfg.text || '???');
    const level = Number((user && user.level) || (rank && rank.level) || 1);
    const xp = Number((user && user.xp) || (rank && rank.xp) || 0);
    const xpNeeded = Number((rank && rank.xpNeeded) || (rank && rank.nextLevelXp) || (user && user.xpNeeded) || 0) || 0;
    const progressValue = Number((rank && (rank.progress !== undefined ? rank.progress : rank.progressPercent)) || 0);
    const progress = Math.min(100, Math.max(0, progressValue));
    const label = String((rank && (rank.label || rank.name)) || '');

    const values = {
      '[userName]': userName,
      '$userName': userName,
      '[rank]': label,
      '$rank': label,
      '[level]': String(level),
      '$level': String(level),
      '[xp]': String(xp),
      '$xp': String(xp),
      '[xpNeeded]': String(xpNeeded),
      '$xpNeeded': String(xpNeeded),
      '[progress]': Math.round(progress) + '%',
      '$progress': Math.round(progress) + '%',
    };

    const canvas = createCanvas(DEFAULT_CANVAS.width, DEFAULT_CANVAS.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let avatarDrawn = false;
    let usernameDrawn = false;
    let textDrawn = false;

    const layers = [
      {
        layer: 0,
        draw: async function () {
          fillBackgroundLayer(ctx, canvas, background);
        },
      },
      {
        layer: 1,
        draw: async function () {
          const rect = { x: Number(avatar.x) || 0, y: Number(avatar.y) || 0, width: 120, height: 120 };
          if (Number(avatar.width) > 0) rect.width = Number(avatar.width);
          rect.height = Number(avatar.height) > 0 ? Number(avatar.height) : rect.width;
          const radius = Number(avatar.radius) || Math.min(rect.width, rect.height) / 2;

          const avatarUrl = pickAvatarUrl(user);
          let buffer = settings && settings._avatarBuffer;
          if (!buffer) buffer = avatarUrl ? await downloadAvatar(avatarUrl) : null;

          ctx.save();
          ctx.globalAlpha = clamp01(avatar.opacity);
          roundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, radius);
          ctx.clip();

          if (buffer) {
            try {
              const img = await loadImage(buffer);
              const mode = String(avatar.mode || (avatar.cover ? 'cover' : 'fill')).toLowerCase();
              const drawRect = mode === 'contain' || mode === 'cover'
                ? fitRect(mode, { width: img.width, height: img.height }, rect)
                : rect;
              ctx.drawImage(img, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
              avatarDrawn = true;
            } catch (err) { /* fall through */ }
          }
          ctx.restore();

          if (!avatarDrawn) {
            drawFallbackAvatar(ctx, rect, userName, avatar);
            avatarDrawn = true;
          }

          const borderWidth = Number(avatar.borderWidth) || 0;
          if (borderWidth > 0) {
            ctx.save();
            ctx.globalAlpha = clamp01(avatar.opacity);
            roundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, radius);
            ctx.lineWidth = borderWidth;
            ctx.strokeStyle = avatar.borderColor || '#FFFFFF';
            if (Number(avatar.shadowBlur) > 0 || avatar.shadow) {
              ctx.shadowColor = avatar.shadowColor || 'rgba(0,0,0,0.5)';
              ctx.shadowBlur = Number(avatar.shadowBlur) || 0;
            }
            if (String(avatar.borderStyle || 'solid').toLowerCase() === 'dashed') {
              ctx.setLineDash([borderWidth * 2, borderWidth * 1.2]);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          }
        },
      },
      {
        layer: 2,
        draw: async function () {
          const template = usernameCfg.text != null ? String(usernameCfg.text) : userName;
          const content = resolveText(template, values);
          const lines = wrapText(ctx, content, usernameCfg.maxWidth, usernameCfg);
          if (lines.length === 0) return;
          drawTextBlock(ctx, usernameCfg, lines);
          usernameDrawn = true;
        },
      },
      {
        layer: 3,
        draw: async function () {
          const template = textCfg.content != null ? String(textCfg.content) : '';
          const content = resolveText(template, values);
          if (!content.trim()) return;
          const lines = wrapText(ctx, content, textCfg.maxWidth, textCfg);
          if (lines.length === 0) return;
          drawTextBlock(ctx, textCfg, lines);
          textDrawn = true;
        },
      },
    ];

    layers.sort(function (a, b) { return a.layer - b.layer; });
    for (const entry of layers) {
      await entry.draw();
    }

    logger.info('[leveling-render] avatar drawn=' + (avatarDrawn ? 'YES' : 'NO'));
    logger.info('[leveling-render] username drawn=' + (usernameDrawn ? 'YES' : 'NO'));
    logger.info('[leveling-render] text drawn=' + (textDrawn ? 'YES' : 'NO'));

    const outputFormat = String(merged.outputFormat || 'png').toLowerCase();
    const format = outputFormat === 'jpg' ? 'jpeg' : 'png';
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const buffer = format === 'jpeg'
      ? canvas.toBuffer(mime, { quality: 0.9 })
      : canvas.toBuffer(mime);

    logger.info('[leveling-render] final buffer bytes=' + buffer.length);

    const base = String(merged.filename || 'rank_card').replace(/\.[^.]+$/, '');
    const filename = base + '.' + (format === 'jpeg' ? 'jpg' : 'png');
    const filePath = path.join(os.tmpdir(), filename + '_' + Date.now() + '_' + Math.floor(Math.random() * 1e6));
    fs.writeFileSync(filePath, buffer);

    return { ok: true, path: filePath, filename: filename };
  } catch (err) {
    logger.error('[leveling-render] error', err && err.message ? err.message : String(err));
    return { ok: false, error: (err && err.message) || 'RENDER_FAILED' };
  }
}

module.exports = { renderRankCardImage };