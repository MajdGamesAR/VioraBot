document.addEventListener('DOMContentLoaded', () => {
    if (window.utils && window.utils.onPage) {
        utils.onPage('/staff', () => initStaff());
    }
});

function S() { return ((window.PAGE_LOCALE || {}).dashboard || {}).staff || {}; }
function escapeHtml(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function actionLabel(a) {
    const map = ((window.PAGE_LOCALE || {}).dashboard || {}).actionTypes || {};
    return map[a] || a;
}

async function initStaff() {
    try {
        const res = await fetch('/api/dashboard/staff');
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        renderLeaderboard(data.stats || []);
        renderMembers(data.members || []);
    } catch (e) {
        $('#leaderboardGrid').html('<p class="text-red-400 col-span-full text-center">' + escapeHtml(S().loadError) + '</p>');
        $('#staffMembersList').html('<p class="text-red-400 text-center">' + escapeHtml(S().loadError) + '</p>');
    } finally {
        $('#staffLoader').addClass('hidden');
    }
}

function renderLeaderboard(stats) {
    const locale = S();
    const grid = $('#leaderboardGrid');
    if (!stats.length) {
        grid.html('<p class="text-gray-400 col-span-full text-center py-8">' + escapeHtml(locale.noData) + '</p>');
        return;
    }
    stats.slice(0, 12).forEach(member => {
        const colors = ['from-blue-500 to-purple-500', 'from-emerald-500 to-green-600', 'from-amber-500 to-orange-600', 'from-pink-500 to-rose-600'];
        const grad = colors[(member.rank - 1) % colors.length];
        grid.append(
            '<div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-5 transform hover:scale-[1.02] transition-all">' +
            '<div class="flex items-center gap-3 mb-3">' +
            '<div class="w-11 h-11 rounded-full bg-gradient-to-r ' + grad + ' flex items-center justify-center text-white font-bold flex-shrink-0">' + escapeHtml((member.name || '?').charAt(0).toUpperCase()) + '</div>' +
            '<div class="min-w-0">' +
            '<a href="/user/' + encodeURIComponent(member.id) + '" class="font-semibold text-gray-800 dark:text-white truncate block hover:underline">' + escapeHtml(member.name) + '</a>' +
            '<span class="text-xs text-gray-500 dark:text-gray-400">#' + member.rank + '</span>' +
            '</div></div>' +
            '<div class="flex items-center justify-between">' +
            '<span class="text-sm text-gray-500 dark:text-gray-400">' + escapeHtml(locale.total) + '</span>' +
            '<span class="text-xl font-bold text-blue-500">' + member.total + '</span>' +
            '</div>' +
            '<div class="grid grid-cols-4 gap-2 mt-3 text-center">' +
            '<div><div class="text-sm font-semibold text-amber-500">' + member.warns + '</div><div class="text-xs text-gray-500 dark:text-gray-400">' + escapeHtml(actionLabel('warn')) + '</div></div>' +
            '<div><div class="text-sm font-semibold text-orange-500">' + member.kicks + '</div><div class="text-xs text-gray-500 dark:text-gray-400">' + escapeHtml(actionLabel('kick')) + '</div></div>' +
            '<div><div class="text-sm font-semibold text-red-500">' + member.bans + '</div><div class="text-xs text-gray-500 dark:text-gray-400">' + escapeHtml(actionLabel('ban')) + '</div></div>' +
            '<div><div class="text-sm font-semibold text-purple-500">' + member.timeouts + '</div><div class="text-xs text-gray-500 dark:text-gray-400">' + escapeHtml(actionLabel('timeout')) + '</div></div>' +
            '</div></div>'
        );
    });
}

function renderMembers(members) {
    const list = $('#staffMembersList');
    if (!members.length) {
        list.html('<p class="text-gray-400 text-center py-8">' + escapeHtml(S().noData) + '</p>');
        return;
    }
    list.html(members.map(member =>
        '<div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">' +
        '<div class="flex items-center gap-3 min-w-0">' +
        '<div class="h-9 w-9 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">' + escapeHtml((member.username || '?').charAt(0).toUpperCase()) + '</div>' +
        '<div class="min-w-0">' +
        '<a href="/user/' + encodeURIComponent(member.id) + '" class="text-sm font-medium text-gray-800 dark:text-white truncate block hover:underline">' + escapeHtml(member.tag || member.username) + '</a>' +
        '<p class="text-xs text-gray-500 dark:text-gray-400 truncate">' + member.roles.slice(0, 4).map(r => escapeHtml(r.name)).join(', ') + '</p>' +
        '</div></div>' +
        '<span class="px-2 py-1 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300 flex-shrink-0">' + escapeHtml(actionLabel('warn')) + '</span>' +
        '</div>'
    ).join(''));
}