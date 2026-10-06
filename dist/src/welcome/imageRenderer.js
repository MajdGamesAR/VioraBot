"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeLayout = exports.renderWelcomeImage = exports.CANVAS_SIZE = void 0;
const welcomeGoodbyeDefaults_1 = require("./welcomeGoodbyeDefaults");
const welcomeFormatter_1 = require("../utils/welcomeFormatter");
const CANVAS_SIZE = { width: 1200, height: 600 };
exports.CANVAS_SIZE = CANVAS_SIZE;
const RENDER_VAR_RE = /\[(user|userName|memberCount|server|inviter|inviterName|invites)\]/g;
const replaceImageVariables = (template, context) => {
    return String(template || '').replace(RENDER_VAR_RE, (matched, name) => {
        switch (name) {
            case 'user':
                return context.userName || '';
            case 'userName':
                return context.userName || '';
            case 'memberCount':
                return String(context.memberCount ?? '');
            case 'server':
                return String(context.server || '');
            case 'inviter':
                return context.inviterName || '';
            case 'inviterName':
                return context.inviterName || '';
            case 'invites':
                return String(context.invites ?? '0');
            default:
                return matched;
        }
    });
};
const defaultAvatarLoader = async (url) => {
    try {
        const axios = require('axios');
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 8000,
            maxContentLength: 5 * 1024 * 1024
        });
        if (!response || !Buffer.isBuffer(response.data)) {
            return null;
        }
        return response.data;
    }
    catch (_error) {
        return null;
    }
};
const estimateTextWidth = (text, fontSize) => {
    const chars = String(text || '').length;
    return chars * fontSize * 0.52;
};
const fitRect = (imgW, imgH, canvasW, canvasH, scalePct, offsetX, offsetY, fit) => {
    const mode = fit === 'fill' ? 'fill' : fit === 'contain' ? 'contain' : 'cover';
    const baseScale = mode === 'cover'
        ? Math.max(canvasW / imgW, canvasH / imgH)
        : mode === 'contain'
            ? Math.min(canvasW / imgW, canvasH / imgH)
            : 1;
    const scale = baseScale * (scalePct || 1);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const x = (canvasW - drawW) / 2 + (offsetX || 0);
    const y = (canvasH - drawH) / 2 + (offsetY || 0);
    return { x, y, width: drawW, height: drawH };
};
const fitCoverRect = (imgW, imgH, canvasW, canvasH, scalePct, offsetX, offsetY) => fitRect(imgW, imgH, canvasW, canvasH, scalePct, offsetX, offsetY, 'cover');
const wrapText = (ctx, text, maxWidth) => {
    const paragraphs = String(text || '').split('\n');
    const lines = [];
    const font = ctx.font;
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
            }
            else {
                lines.push(current);
                current = word;
            }
        }
        if (current) {
            lines.push(current);
        }
    }
    return lines;
};
const drawTextBlock = (ctx, block, content, colorOverride) => {
    if (!block.enabled) {
        return { lines: [], baselineY: 0 };
    }
    const text = String(content || '').trim();
    if (!text) {
        return { lines: [], baselineY: 0 };
    }
    ctx.font = `${block.fontWeight} ${block.fontSize}px "${block.font}"`;
    const alignMap = block.align === 'left' ? 'left' : block.align === 'right' ? 'right' : 'center';
    const maxWidth = block.maxWidth || CANVAS_SIZE.width;
    let lines = [];
    if (block.wrap) {
        lines = wrapText(ctx, text, maxWidth);
    }
    else {
        lines = text.split('\n');
    }
    const lineHeight = block.fontSize * (block.lineSpacing || 1);
    const totalLines = lines.length;
    const startY = block.y - (totalLines > 1 ? ((totalLines - 1) * lineHeight) / 2 : 0);
    const advance = (block.letterSpacing || 0) + ctx.measureText(' ').width - ctx.measureText('').width;
    ctx.globalAlpha = Math.min(Math.max(block.opacity ?? 1, 0), 1);
    ctx.shadowColor = block.shadow ? (block.shadowColor || 'rgba(0,0,0,0.5)') : 'transparent';
    ctx.shadowBlur = block.shadow ? (block.shadowBlur || 0) : 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = block.stroke ? (block.strokeColor || '#000000') : 'transparent';
    ctx.lineWidth = block.stroke ? (block.strokeWidth || 1) : 0;
    ctx.textAlign = alignMap;
    ctx.textBaseline = 'alphabetic';
    lines.forEach((line, index) => {
        const baselineY = startY + index * lineHeight;
        if (block.letterSpacing) {
            ctx.textAlign = 'left';
            const lineWidth = ctx.measureText(line).width + block.letterSpacing * Math.max(line.length - 1, 0);
            const anchorX = alignMap === 'center'
                ? block.x - lineWidth / 2
                : alignMap === 'right'
                    ? block.x - lineWidth
                    : block.x;
            let cursor = anchorX;
            for (const char of line) {
                if (block.stroke && block.strokeWidth > 0 && block.strokeColor) {
                    ctx.strokeText(char, cursor + 1, baselineY + 1);
                }
                ctx.fillText(char, cursor + 1, baselineY + 1);
                cursor += ctx.measureText(char).width + block.letterSpacing;
            }
        }
        else {
            if (block.stroke && block.strokeWidth > 0 && block.strokeColor) {
                ctx.strokeText(line, block.x + 1, baselineY + 1);
            }
            ctx.fillText(line, block.x + 1, baselineY + 1);
        }
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'transparent';
    ctx.lineWidth = 0;
    return { lines, baselineY: startY };
};
const renderWelcomeImage = async (options) => {
    const { createCanvas, loadImage } = require('@napi-rs/canvas');
    const config = (0, welcomeGoodbyeDefaults_1.normalizeImage)(options.config || {}, welcomeGoodbyeDefaults_1.WELCOME_GOODBYE_DEFAULTS.welcome.image);
    const context = options.context || (0, welcomeFormatter_1.buildWelcomeContext)(options.member);
    const canvasSize = options.canvasSize || config.canvas || CANVAS_SIZE;
    const canvas = createCanvas(canvasSize.width, canvasSize.height);
    const ctx = canvas.getContext('2d');
    const metadata = {
        width: canvasSize.width,
        height: canvasSize.height,
        background: 'none',
        backgroundFailed: false,
        avatar: 'omitted',
        usernameDrawn: false,
        textDrawn: false
    };
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    const bg = config.background;
    if (bg.type === 'image') {
        let bgBuffer = null;
        if (typeof bg.source === 'string' && bg.source.startsWith('http')) {
            bgBuffer = options.loader ? await options.loader(bg.source) : await defaultAvatarLoader(bg.source);
        }
        else if (typeof bg.source === 'string' && bg.source) {
            bgBuffer = options.resolveBackground ? await options.resolveBackground(bg.source) : null;
        }
        if (bgBuffer && Buffer.isBuffer(bgBuffer)) {
            try {
                const image = await loadImage(bgBuffer);
                const rect = fitRect(image.width, image.height, canvasSize.width, canvasSize.height, bg.scale, bg.positionX, bg.positionY, bg.fit);
                ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
                metadata.background = 'image';
                if (!options.silent)
                    console.log(`[welcome-render] background type=IMAGE loaded=YES dimensions=${image.width}x${image.height}`);
            }
            catch (_error) {
                metadata.background = 'image';
                metadata.backgroundFailed = true;
            }
        }
        else {
            metadata.background = 'image';
            metadata.backgroundFailed = true;
        }
        if (metadata.backgroundFailed) {
            if (!options.silent)
                console.log('[welcome-render] background type=IMAGE loaded=NO');
            ctx.fillStyle = '#1e1e2e';
            ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
        }
    }
    else if (bg.type === 'color') {
        ctx.fillStyle = bg.color || '#1e1e2e';
        ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
        metadata.background = 'color';
        if (!options.silent)
            console.log('[welcome-render] background type=COLOR');
    }
    else if (bg.type === 'transparent') {
        metadata.background = 'transparent';
        if (!options.silent)
            console.log(`[welcome-render] background type=TRANSPARENT canvas=${canvasSize.width}x${canvasSize.height}`);
    }
    else {
        ctx.fillStyle = '#1e1e2e';
        ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
        metadata.background = 'none';
        if (!options.silent)
            console.log('[welcome-render] background type=NONE');
    }
    if (bg.overlay) {
        ctx.globalAlpha = Math.min(Math.max(bg.overlayOpacity ?? 0, 0), 1);
        ctx.fillStyle = bg.overlayColor || '#000000';
        ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
        ctx.globalAlpha = 1;
    }
    const avatar = config.avatar;
    const username = config.username;
    const text = config.text;

    const drawAvatar = async () => {
        if (!avatar.enabled) {
            return;
        }
        const effW = Math.max(avatar.width * avatar.scale, 1);
        const effH = Math.max(avatar.height * avatar.scale, 1);
        const boxX = avatar.x - effW / 2;
        const boxY = avatar.y - effH / 2;
        let avatarImage = null;
        let avatarFallback = false;
        if (options.avatarBuffer && Buffer.isBuffer(options.avatarBuffer)) {
            try {
                avatarImage = await loadImage(options.avatarBuffer);
            }
            catch (_error) {
                avatarImage = null;
            }
        }
        else if (options.avatarUrl) {
            const buffer = options.loader ? await options.loader(options.avatarUrl) : await defaultAvatarLoader(options.avatarUrl);
            if (buffer && Buffer.isBuffer(buffer)) {
                try {
                    avatarImage = await loadImage(buffer);
                }
                catch (_error) {
                    avatarImage = null;
                }
            }
        }
        if (!avatarImage) {
            avatarFallback = true;
        }
        ctx.save();
        const radius = Math.min(avatar.radius || 0, Math.min(effW, effH) / 2);
        const isCircle = avatar.circle === true || radius >= Math.min(effW, effH) / 2;
        ctx.beginPath();
        if (isCircle) {
            ctx.arc(avatar.x, avatar.y, Math.min(effW, effH) / 2, 0, Math.PI * 2);
        }
        else if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(boxX, boxY, effW, effH, radius);
        }
        else {
            ctx.rect(boxX, boxY, effW, effH);
        }
        ctx.clip();
        ctx.globalAlpha = Math.min(Math.max(avatar.opacity ?? 1, 0), 1);
        if (avatarImage) {
            ctx.shadowColor = avatar.shadow ? (avatar.shadowColor || 'rgba(0,0,0,0.5)') : 'transparent';
            ctx.shadowBlur = avatar.shadow ? (avatar.shadowBlur || 0) : 0;
            ctx.drawImage(avatarImage, boxX, boxY, effW, effH);
            metadata.avatar = avatarFallback ? 'fallback' : 'real';
        }
        else {
            ctx.shadowColor = avatar.shadow ? (avatar.shadowColor || 'rgba(0,0,0,0.5)') : 'transparent';
            ctx.shadowBlur = avatar.shadow ? (avatar.shadowBlur || 0) : 0;
            const hash = String(context.userName || 'A').split('').reduce((acc, ch) => acc + ch.codePointAt(0), 0);
            const hue = hash % 360;
            ctx.fillStyle = `hsl(${hue}, 45%, 45%)`;
            ctx.fill();
            const initial = (context.userName || 'A').trim().charAt(0).toUpperCase() || 'A';
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `700 ${Math.max(Math.round(Math.min(effW, effH) * 0.42), 12)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            ctx.fillText(initial, avatar.x, avatar.y + 2);
            metadata.avatar = 'fallback';
        }
        ctx.restore();
        if (avatar.borderWidth > 0 && (avatarImage || metadata.avatar === 'fallback')) {
            ctx.beginPath();
            if (isCircle) {
                ctx.arc(avatar.x, avatar.y, Math.min(effW, effH) / 2, 0, Math.PI * 2);
            }
            else if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(boxX, boxY, effW, effH, radius);
            }
            else {
                ctx.rect(boxX, boxY, effW, effH);
            }
            ctx.globalAlpha = Math.min(Math.max(avatar.opacity ?? 1, 0), 1);
            ctx.strokeStyle = avatar.borderColor || '#FFFFFF';
            ctx.lineWidth = avatar.borderWidth;
            if (avatar.borderStyle === 'dashed') {
                ctx.setLineDash([ctx.lineWidth * 2, ctx.lineWidth * 1.2]);
            }
            ctx.shadowColor = avatar.shadow ? (avatar.shadowColor || 'rgba(0,0,0,0.5)') : 'transparent';
            ctx.shadowBlur = avatar.shadow ? (avatar.shadowBlur || 0) : 0;
            ctx.stroke();
            ctx.setLineDash([]);
        }
    };

    const drawUsername = () => {
        const usernameContent = username.enabled
            ? replaceImageVariables(username.text || '', context)
            : '';
        if (usernameContent) {
            drawTextBlock(ctx, username, usernameContent);
            metadata.usernameDrawn = true;
        }
    };

    const drawText = () => {
        const textContent = text.enabled ? replaceImageVariables(text.content || '', context) : '';
        if (textContent) {
            drawTextBlock(ctx, text, textContent);
            metadata.textDrawn = true;
        }
    };

    const layers = [
        { layer: avatar.layer, draw: drawAvatar },
        { layer: username.layer, draw: drawUsername },
        { layer: text.layer, draw: drawText }
    ].sort((a, b) => a.layer - b.layer);
    for (const entry of layers) {
        await entry.draw();
    }
    const outputFormat = options.outputFormat === 'jpg' ? 'jpeg' : 'png';
    const buffer = outputFormat === 'jpeg'
        ? canvas.toBuffer('image/jpeg', { quality: 0.9 })
        : canvas.toBuffer('image/png');
    if (!options.silent) {
        console.log(`[welcome-render] final canvas=${canvasSize.width}x${canvasSize.height}`);
        console.log(`[welcome-render] background drawn=${metadata.background !== 'none' && !metadata.backgroundFailed ? 'YES' : 'NO'}`);
        console.log(`[welcome-render] avatar drawn=${metadata.avatar === 'real' || metadata.avatar === 'fallback' ? 'YES' : 'NO'}`);
        console.log(`[welcome-render] username drawn=${metadata.usernameDrawn ? 'YES' : 'NO'}`);
        console.log(`[welcome-render] text drawn=${metadata.textDrawn ? 'YES' : 'NO'}`);
        console.log(`[welcome-render] final buffer bytes=${buffer.length}`);
    }
    return { buffer, metadata };
};
exports.renderWelcomeImage = renderWelcomeImage;
const describeLayout = (rawConfig) => {
    const config = (0, welcomeGoodbyeDefaults_1.normalizeImage)(rawConfig || {}, welcomeGoodbyeDefaults_1.WELCOME_GOODBYE_DEFAULTS.welcome.image);
    const avatar = config.avatar;
    const effW = Math.max(avatar.width * avatar.scale, 1);
    const effH = Math.max(avatar.height * avatar.scale, 1);
    const canvasSize = config.canvas || CANVAS_SIZE;
    return {
        canvas: { width: canvasSize.width, height: canvasSize.height },
        layers: {
            avatar: config.avatar.layer,
            username: config.username.layer,
            text: config.text.layer
        },
        avatar: {
            centerX: avatar.x,
            centerY: avatar.y,
            effectiveWidth: effW,
            effectiveHeight: effH,
            left: avatar.x - effW / 2,
            top: avatar.y - effH / 2,
            circle: avatar.circle || avatar.radius >= Math.min(effW, effH) / 2,
            borderWidth: avatar.borderWidth
        },
        username: {
            enabled: config.username.enabled,
            anchorX: config.username.x,
            anchorY: config.username.y,
            fontSize: config.username.fontSize,
            font: config.username.font,
            isVerticalCentered: config.username.wrap === true
        },
        text: {
            enabled: config.text.enabled,
            anchorX: config.text.x,
            anchorY: config.text.y,
            fontSize: config.text.fontSize,
            font: config.text.font
        },
        background: {
            type: config.background.type,
            source: config.background.source,
            fit: config.background.fit,
            scale: config.background.scale,
            positionX: config.background.positionX,
            positionY: config.background.positionY
        }
    };
};
exports.describeLayout = describeLayout;
exports.replaceImageVariables = replaceImageVariables;
exports.estimateTextWidth = estimateTextWidth;
exports.fitCoverRect = fitCoverRect;
exports.fitRect = fitRect;