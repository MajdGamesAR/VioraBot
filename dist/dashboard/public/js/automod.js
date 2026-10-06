document.addEventListener('DOMContentLoaded', () => {
    if (window.utils && window.utils.onPage) {
        utils.onPage('/automod', () => initAutoMod());
    }
});

const AM_RULE_META = ['spam', 'duplicate', 'flood', 'mentions', 'caps', 'emojis', 'links', 'invites', 'badWords'];

async function initAutoMod() {
    $('#saveAutomodSettings').on('click', saveSettings);
}

function collectRules() {
    const rules = {};
    AM_RULE_META.forEach(key => {
        const root = $('.automod-rule[data-rule="' + key + '"]');
        if (!root.length) return;
        const words = root.find('.rule-words').length
            ? String(root.find('.rule-words').val() || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 500)
            : [];
        rules[key] = {
            enabled: root.find('.rule-enabled').is(':checked'),
            action: root.find('.rule-action').val(),
            threshold: Number(root.find('.rule-threshold').val()) || 1,
            timeWindow: Number(root.find('.rule-timeWindow').val()) || 0,
            duration: Number(root.find('.rule-duration').val()) || 0,
            reason: root.find('.rule-reason').val() || '',
            words
        };
    });
    return rules;
}

async function saveSettings() {
    const payload = {
        enabled: $('#automodEnabled').is(':checked'),
        logChannelId: $('#automodLogChannel').val(),
        staffRoles: $('#automodStaffRoles').val() || [],
        rules: collectRules()
    };
    try {
        const res = await fetch('/api/settings/automod', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.success) {
            utils.showToast('error', data.error || 'Failed to save AutoMod settings');
            return;
        }
        if (data.warnings && data.warnings.length) {
            utils.showToast('error', data.warnings.join('; '));
            return;
        }
        utils.showToast('success', 'AutoMod settings saved');
    } catch (e) {
        utils.showToast('error', e.message || 'Failed to save AutoMod settings');
    }
}