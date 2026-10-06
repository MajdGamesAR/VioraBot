"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCommandPermissions = void 0;
const discord_js_1 = require("discord.js");
const checkCommandPermissions = (member, commandSettings, requiredPermission) => {
    try {
        if (!commandSettings?.permissions) {
            return requiredPermission ? member.permissions.has(requiredPermission) : true;
        }
        const { enabledRoleIds, disabledRoleIds } = commandSettings.permissions;
        const userRoleIds = Array.from(member.roles.cache.keys());
        if (disabledRoleIds && disabledRoleIds.length > 0) {
            const hasDisabledRole = userRoleIds.some(roleId => disabledRoleIds.includes(roleId));
            if (hasDisabledRole) {
                return false;
            }
        }
        if (requiredPermission && !member.permissions.has(requiredPermission)) {
            return false;
        }
        if (member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator)) {
            return true;
        }
        if (enabledRoleIds && enabledRoleIds.length > 0) {
            return userRoleIds.some(roleId => enabledRoleIds.includes(roleId));
        }
        return true;
    }
    catch (error) {
        console.error('Error checking permissions:', error);
        return false;
    }
};
exports.checkCommandPermissions = checkCommandPermissions;
