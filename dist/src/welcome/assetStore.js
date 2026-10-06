"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssetUrl = exports.deleteAssetIfUnused = exports.loadUploaded = exports.storeUpload = exports.getUploadsDirectory = void 0;
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const getUploadsDirectory = () => path.join(process.cwd(), 'uploads', 'welcome');
exports.getUploadsDirectory = getUploadsDirectory;
const manifestPath = () => path.join((0, exports.getUploadsDirectory)(), '.manifest.json');
const manifest = () => {
    try {
        if (fs.existsSync((0, manifestPath)())) {
            return JSON.parse(fs.readFileSync((0, manifestPath)(), 'utf8'));
        }
    }
    catch (_error) {
        return {};
    }
    return {};
};
const writeManifest = (data) => {
    try {
        fs.mkdirSync((0, exports.getUploadsDirectory)(), { recursive: true });
        fs.writeFileSync((0, manifestPath)(), JSON.stringify(data, null, 4), 'utf8');
    }
    catch (_error) {
        throw new Error('Failed to persist image asset manifest');
    }
};
const storeUpload = async ({ buffer, ext, width, height, guildId, kind }) => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error('Invalid image buffer');
    }
    const id = crypto.randomUUID();
    const file = `${id}.${ext}`;
    const dir = path.join((0, exports.getUploadsDirectory)(), String(guildId));
    try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, file), buffer);
    }
    catch (error) {
        throw new Error('Failed to store image asset');
    }
    const manifestData = (0, manifest)();
    manifestData[id] = {
        guildId: String(guildId),
        kind: kind || 'background',
        file,
        ext,
        width: width || 0,
        height: height || 0,
        createdAt: Date.now()
    };
    (0, writeManifest)(manifestData);
    return { id, file, url: `/api/welcome/asset/${id}` };
};
exports.storeUpload = storeUpload;
const loadUploaded = async (id, guildId) => {
    if (typeof id !== 'string') {
        return null;
    }
    if (!/^[a-f0-9-]{36}$/.test(id.toLowerCase())) {
        return null;
    }
    const manifestData = (0, manifest)();
    const record = manifestData[id];
    if (!record || record.guildId !== String(guildId)) {
        return null;
    }
    const rel = path.normalize(record.file);
    if (rel.includes('..') || path.isAbsolute(rel)) {
        return null;
    }
    const filePath = path.join((0, exports.getUploadsDirectory)(), String(guildId), rel);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    return {
        buffer: fs.readFileSync(filePath),
        record
    };
};
exports.loadUploaded = loadUploaded;
const deleteAssetIfUnused = (id, guildId, config) => {
    try {
        if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id.toLowerCase())) {
            return false;
        }
        const manifestData = (0, manifest)();
        const record = manifestData[id];
        if (!record || record.guildId !== String(guildId)) {
            return false;
        }
        const isReferenced = (imageConfig) => imageConfig?.background?.type === 'image' && imageConfig.background.source === `upload:${id}`;
        const root = config;
        const referenced = (root?.welcome?.image && isReferenced(root.welcome.image)) ||
            (root?.goodbye?.image && isReferenced(root.goodbye.image)) ||
            false;
        if (referenced) {
            return false;
        }
        const rel = path.normalize(record.file);
        if (rel.includes('..') || path.isAbsolute(rel)) {
            return false;
        }
        const filePath = path.join((0, exports.getUploadsDirectory)(), String(guildId), rel);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        delete manifestData[id];
        (0, writeManifest)(manifestData);
        return true;
    }
    catch (_error) {
        return false;
    }
};
exports.deleteAssetIfUnused = deleteAssetIfUnused;
const getAssetUrl = (source) => {
    if (typeof source === 'string' && source.startsWith('upload:')) {
        const id = source.slice('upload:'.length);
        if (/^[a-f0-9-]{36}$/.test(id.toLowerCase())) {
            return `/api/welcome/asset/${id}`;
        }
    }
    return '';
};
exports.getAssetUrl = getAssetUrl;