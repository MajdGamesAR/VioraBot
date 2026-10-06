"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateImageUrl = exports.validateFile = exports.ALLOWED_IMAGE_EXTENSIONS = exports.MAX_FILE_SIZE = void 0;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
const MAX_DIMENSION = 4096;
const ALLOWED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
exports.ALLOWED_IMAGE_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS;
const MAGIC_BY_PARSED_EXT = {
    png: { offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    jpg: { offset: 0, bytes: [0xff, 0xd8, 0xff] },
    jpeg: { offset: 0, bytes: [0xff, 0xd8, 0xff] },
    webp: { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46], second: [0x57, 0x45, 0x42, 0x50] }
};
const sniffMime = (buffer) => {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
        return null;
    }
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        return 'png';
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'jpg';
    }
    if (buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') {
        return 'webp';
    }
    return null;
};
const extensionFromName = (name) => {
    if (typeof name !== 'string') {
        return '';
    }
    const dot = name.lastIndexOf('.');
    if (dot === -1) {
        return '';
    }
    return name.slice(dot + 1).toLowerCase();
};
const extensionMatchesBytes = (buffer, ext) => {
    const magic = MAGIC_BY_PARSED_EXT[ext];
    if (!magic) {
        return false;
    }
    for (let i = 0; i < magic.bytes.length; i++) {
        if (buffer[i] !== magic.bytes[i]) {
            return false;
        }
    }
    if (ext === 'webp' && magic.second) {
        for (let i = 0; i < magic.second.length; i++) {
            if (buffer[8 + i] !== magic.second[i]) {
                return false;
            }
        }
    }
    return true;
};
const validateFile = async (file, options) => {
    const buffer = file && Buffer.isBuffer(file.buffer) ? file.buffer : null;
    const name = file?.originalname || '';
    if (!buffer || buffer.length === 0) {
        return { ok: false, code: 'EMPTY_FILE', error: 'empty file' };
    }
    const sizeLimit = options?.maxSize || MAX_FILE_SIZE;
    if (buffer.length > sizeLimit) {
        return { ok: false, code: 'TOO_LARGE', error: 'file exceeds maximum size', size: buffer.length, limit: sizeLimit };
    }
    const sniffed = sniffMime(buffer);
    if (!sniffed) {
        return { ok: false, code: 'BAD_MAGIC', error: 'file content is not a supported image' };
    }
    const ext = extensionFromName(name);
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
        return { ok: false, code: 'BAD_EXTENSION', error: 'file extension is not allowed', extension: ext || '(none)' };
    }
    const contentTypeFamily = sniffed === 'jpg' ? 'jpg' : sniffed;
    const extensionFamily = ext === 'jpeg' ? 'jpg' : ext;
    if (contentTypeFamily !== extensionFamily) {
        return {
            ok: false,
            code: 'EXTENSION_MISMATCH',
            error: 'file extension does not match its content',
            content: sniffed,
            extension: ext
        };
    }
    if (!extensionMatchesBytes(buffer, ext)) {
        return { ok: false, code: 'BAD_MAGIC', error: 'file content does not match its extension' };
    }
    let width = 0;
    let height = 0;
    if (options?.checkDimensions !== false) {
        try {
            const { loadImage } = require('@napi-rs/canvas');
            const image = await loadImage(buffer);
            width = image.width;
            height = image.height;
        }
        catch (_error) {
            return { ok: false, code: 'DECODE_FAILED', error: 'file could not be decoded as an image' };
        }
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            return { ok: false, code: 'BAD_DIMENSIONS', error: 'image dimensions exceed the maximum allowed', width, height };
        }
    }
    return { ok: true, buffer, ext, mime: `image/${ext === 'jpg' ? 'jpeg' : ext === 'jpeg' ? 'jpeg' : ext}`, width, height };
};
exports.validateFile = validateFile;
const validateImageUrl = (url) => {
    if (typeof url !== 'string') {
        return { ok: false, code: 'NOT_A_URL', error: 'source must be a URL string' };
    }
    const trimmed = url.trim();
    let parsed = null;
    try {
        parsed = new URL(trimmed);
    }
    catch (_error) {
        return { ok: false, code: 'INVALID_URL', error: 'URL is not valid' };
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { ok: false, code: 'BAD_SCHEME', error: 'URL must use http(s)' };
    }
    if (parsed.username || parsed.password) {
        return { ok: false, code: 'URL_CREDENTIALS', error: 'URL must not contain credentials' };
    }
    if (trimmed.length > 2048) {
        return { ok: false, code: 'URL_TOO_LONG', error: 'URL is too long' };
    }
    return { ok: true, url: trimmed };
};
exports.validateImageUrl = validateImageUrl;