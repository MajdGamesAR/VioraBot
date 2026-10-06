document.addEventListener('DOMContentLoaded', () => {
    if (window.utils && window.utils.onPage) {
        utils.onPage('/antiraid', () => initAntiRaid());
    }
});

function AR() { return ((window.PAGE_LOCALE || {}).dashboard || {}).antiraid || {}; }

async function initAntiRaid() {
    $('#saveRaidSettings').on('click', saveSettings);
}

async function saveSettings() {
    const locale = AR();
    const botWhitelist = $('#raidBotWhitelist').val()
        .split(',')
        .map(s => s.trim())
        .filter(s => /^\d{15,21}$/.test(s));
    const payload = {
        enabled: $('#raidEnabled').is(':checked'),
        joinLimit: Number($('#raidJoinLimit').val()),
        timeWindow: Number($('#raidTimeWindow').val()),
        cooldown: Number($('#raidCooldown').val()),
        newAccountAgeDays: Number($('#raidNewAccountAge').val()),
        logChannelId: $('#raidLogChannel').val(),
        botWhitelist,
        action: {
            type: $('#raidAction').val(),
            reason: $('#raidReason').val()
        }
    };
    try {
        const res = await fetch('/api/settings/antiraid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.success) {
            utils.showToast('error', Array.isArray(data.error) ? data.error.join('; ') : (data.error || locale.saveError));
            return;
        }
        utils.showToast('success', locale.saved);
    } catch (e) {
        utils.showToast('error', e.message || locale.saveError);
    }
}