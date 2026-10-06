"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAuditCache = exports.getAuditExecutor = void 0;
const CACHE_TTL = 2500;
const MAX_ENTRIES = 100;
const cache = new Map();
const clearAuditCache = () => {
    cache.clear();
};
exports.clearAuditCache = clearAuditCache;
const getAuditExecutor = async (guild, type, options) => {
    const opts = options || {};
    const { targetId, windowMs = 5000, limit = 10 } = opts;
    const key = `${guild.id}:${type}:${targetId || ''}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.executor;
    }
    try {
        const audit = await guild.fetchAuditLogs({ type, limit });
        const entry = [...audit.entries.values()].find((auditEntry) => {
            if (targetId && auditEntry.targetId && auditEntry.targetId !== targetId) {
                return false;
            }
            if (windowMs && Date.now() - auditEntry.createdTimestamp > windowMs) {
                return false;
            }
            return true;
        });
        const executor = entry && entry.executor && entry.executor.id !== guild.client?.user?.id
            ? entry.executor
            : null;
        if (cache.size >= MAX_ENTRIES) {
            const oldestKey = cache.keys().next().value;
            if (oldestKey !== undefined) {
                cache.delete(oldestKey);
            }
        }
        cache.set(key, { executor, timestamp: Date.now() });
        return executor;
    }
    catch (error) {
        return null;
    }
};
exports.getAuditExecutor = getAuditExecutor;