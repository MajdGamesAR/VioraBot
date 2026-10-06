"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDate = void 0;
const formatDate = (date) => {
    if (!date)
        return 'Unknown';
    return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
};
exports.formatDate = formatDate;
