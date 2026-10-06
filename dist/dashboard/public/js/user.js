document.addEventListener('DOMContentLoaded', () => {
    if (window.utils && window.utils.onPage) {
        utils.onPage(/^\/user\//, () => initUserPage());
    }
});

function U() { return ((window.PAGE_LOCALE || {}).dashboard || {}).user || {}; }
function actionLabel(a) {
    const map = ((window.PAGE_LOCALE || {}).dashboard || {}).actionTypes || {};
    const base = String(a || '').replace(/^(automod|antiraid):.*$/, '$1');
    return map[base] || (base ? base.charAt(0).toUpperCase() + base.slice(1) : '—');
}
function escapeHtml(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function initUserPage() {
    const userId = window.location.pathname.split('/').filter(Boolean).pop();
    if (!userId) return;
    try {
        const res = await fetch('/api/dashboard/user/' + encodeURIComponent(userId));
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load user');
        renderProfile(data);
    } catch (e) {
        $('#userProfileError').removeClass('hidden');
        $('#userProfileErrorText').text(e.message || U().loadError);
    } finally {
        $('#userLoader').addClass('hidden');
        $('#userContent').removeClass('hidden');
    }
}

function renderProfile(data) {
    const locale = U();
    const user = data.user || {};
    $('#userAvatar').attr('src', user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png');
    $('#userTag').text(user.tag || user.username || user.id);
    $('#userIdLabel').text('ID: ' + user.id);
    $('#userMemberBadge').text(user.isMember ? locale.profile : locale.notMember);
    $('#userJoined').text(user.joinedAt ? utils.formatDate(user.joinedAt) : '—');
    $('#userCreated').text(user.accountCreatedAt ? utils.formatDate(user.accountCreatedAt) : '—');
    $('#userTotalActions').text(data.totals ? Object.values(data.totals).reduce((a, b) => a + b, 0) : 0);
    $('#userTimeoutBadge').html(user.timeoutEndsAt
        ? '<span class="px-2 py-1 rounded text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300">' + escapeHtml(utils.formatDate(user.timeoutEndsAt)) + '</span>'
        : '<span class="px-2 py-1 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300">No</span>');

    const totals = data.totals || {};
    ['warn', 'timeout', 'kick', 'ban', 'automod', 'antiraid'].forEach(key => {
        const el = document.getElementById('buckets-' + key);
        if (el) el.textContent = totals[key] || 0;
    });

    const rolesEl = $('#userRoles');
    rolesEl.empty();
    if (user.roles && user.roles.length) {
        user.roles.forEach(id => rolesEl.append('<span class="px-3 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300">' + escapeHtml(id) + '</span>'));
    } else {
        rolesEl.append('<span class="text-sm text-gray-500 dark:text-gray-400 w-full text-center">—</span>');
    }

    $('#activeWarningCount').text('(' + (data.activeWarnings || 0) + ' ' + escapeHtml(locale.activeWarnings) + ')');
    const warningsBody = $('#userWarningsBody');
    warningsBody.empty();
    if (data.warnings && data.warnings.length) {
        data.warnings.forEach(warning => {
            const active = !warning.expiresAt || new Date(warning.expiresAt).getTime() > Date.now();
            warningsBody.append(
                '<tr><td class="py-2 px-4 text-gray-600 dark:text-gray-300">' + escapeHtml(warning.reason || '—') + '</td>' +
                '<td class="py-2 px-4 text-gray-600 dark:text-gray-300">' + escapeHtml(warning.moderatorId || '—') + '</td>' +
                '<td class="py-2 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">' + escapeHtml(utils.formatDate(warning.timestamp)) + '</td>' +
                '<td class="py-2 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">' + (active ? escapeHtml(locale.activeWarnings) : escapeHtml(locale.noWarnings)) + '</td></tr>'
            );
        });
    } else {
        $('#userNoWarnings').removeClass('hidden');
    }

    const historyBody = $('#userHistoryBody');
    historyBody.empty();
    if (data.history && data.history.length) {
        data.history.forEach(record => {
            historyBody.append(
                '<tr><td class="py-2 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">' + escapeHtml(utils.formatDate(record.timestamp)) + '</td>' +
                '<td class="py-2 px-4"><span class="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">' + escapeHtml(actionLabel(record.action)) + '</span></td>' +
                '<td class="py-2 px-4 text-gray-600 dark:text-gray-300 max-w-[200px] truncate">' + escapeHtml(record.reason || '—') + '</td></tr>'
            );
        });
    } else {
        $('#userNoHistory').removeClass('hidden');
    }
}