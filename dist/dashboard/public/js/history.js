document.addEventListener('DOMContentLoaded', () => {
    if (window.utils && window.utils.onPage) {
        utils.onPage('/history', () => initHistory());
    }
});

function H() { return ((window.PAGE_LOCALE || {}).dashboard || {}).history || {}; }
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

let historyState = { page: 1, limit: 25, total: 0 };

async function initHistory() {
    $('#historyApply').on('click', () => {
        historyState.page = 1;
        loadHistory();
    });
    $('#historySearch').on('keydown', e => { if (e.key === 'Enter') { historyState.page = 1; loadHistory(); } });
    $('#historyAction').on('change', () => { historyState.page = 1; loadHistory(); });
    $('#historyPrev').on('click', () => { if (historyState.page > 1) { historyState.page--; loadHistory(); } });
    $('#historyNext').on('click', () => { if (historyState.page < totalPages()) { historyState.page++; loadHistory(); } });
    loadHistory();
}

function totalPages() {
    return Math.max(1, Math.ceil(historyState.total / historyState.limit));
}

async function loadHistory() {
    const locale = H();
    $('#historyLoader').removeClass('hidden');
    $('#historyEmpty').addClass('hidden');
    const params = new URLSearchParams({
        page: historyState.page,
        limit: historyState.limit
    });
    const search = $('#historySearch').val().trim();
    const action = $('#historyAction').val();
    const from = $('#historyFrom').val();
    const to = $('#historyTo').val();
    if (search) params.set('search', search);
    if (action) params.set('action', action);
    if (from) params.set('from', from + 'T00:00:00.000Z');
    if (to) params.set('to', to + 'T23:59:59.999Z');
    try {
        const res = await fetch('/api/dashboard/history?' + params.toString());
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        historyState.total = data.total || 0;
        renderHistory(data.records || []);
        $('#historyTotal').text(data.total || 0);
        $('#historyPageInfo').text(locale.page + ' ' + data.page + ' ' + locale.of + ' ' + (data.pages || 1));
        $('#historyPrev').prop('disabled', data.page <= 1);
        $('#historyNext').prop('disabled', data.page >= (data.pages || 1));
    } catch (e) {
        $('#historyTableBody').html('<tr><td colspan="5" class="py-8 text-center text-red-400">' + escapeHtml(locale.loadError) + '</td></tr>');
    } finally {
        $('#historyLoader').addClass('hidden');
    }
}

function renderHistory(records) {
    const locale = H();
    const body = $('#historyTableBody');
    if (!records.length) {
        $('#historyEmpty').removeClass('hidden');
        body.html('');
        return;
    }
    body.html(records.map(record =>
        '<tr class="border-b border-gray-100 dark:border-gray-700">' +
        '<td class="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">' + escapeHtml(utils.formatDate(record.timestamp)) + '</td>' +
        '<td class="py-3 px-4"><span class="px-2 py-1 rounded-lg text-xs ' + badgeClass(record.action) + '">' + escapeHtml(actionLabel(record.action)) + '</span></td>' +
        '<td class="py-3 px-4"><a href="/user/' + encodeURIComponent(record.userId) + '" class="text-blue-500 hover:underline">' + escapeHtml(record.targetName || record.userId) + '</a></td>' +
        '<td class="py-3 px-4 text-gray-600 dark:text-gray-300">' + escapeHtml(record.moderatorName || record.moderatorId || '—') + '</td>' +
        '<td class="py-3 px-4 text-gray-600 dark:text-gray-300 max-w-xs truncate" title="' + escapeHtml(record.reason || '') + '">' + escapeHtml(record.reason || '—') + '</td>' +
        '</tr>'
    ).join(''));
}

function badgeClass(action) {
    const a = String(action || '');
    if (a.startsWith('automod:')) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300';
    if (a.startsWith('antiraid:')) return 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-300';
    if (a === 'ban') return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300';
    if (a === 'kick') return 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300';
    if (a === 'warn') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300';
    if (a === 'timeout') return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300';
    return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
}