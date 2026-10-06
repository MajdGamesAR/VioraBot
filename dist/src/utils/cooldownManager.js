"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CooldownManager = void 0;
class CooldownManager {
    constructor(cleanupIntervalMs = 60000) {
        this.cooldowns = new Map();
        const cleanup = setInterval(() => this.cleanup(), cleanupIntervalMs);
        if (cleanup.unref) {
            cleanup.unref();
        }
    }
    getRemaining(userId, commandName, cooldownSeconds) {
        if (!cooldownSeconds || cooldownSeconds <= 0) {
            return 0;
        }
        const key = `${userId}:${commandName}`;
        const now = Date.now();
        const endAt = this.cooldowns.get(key);
        if (!endAt) {
            this.cooldowns.set(key, now + cooldownSeconds * 1000);
            return 0;
        }
        const remaining = endAt - now;
        if (remaining <= 0) {
            this.cooldowns.set(key, now + cooldownSeconds * 1000);
            return 0;
        }
        return remaining;
    }
    clear(userId, commandName) {
        this.cooldowns.delete(`${userId}:${commandName}`);
    }
    cleanup() {
        const now = Date.now();
        for (const [key, endAt] of this.cooldowns) {
            if (endAt <= now) {
                this.cooldowns.delete(key);
            }
        }
    }
}
exports.CooldownManager = CooldownManager;