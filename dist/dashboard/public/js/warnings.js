document.addEventListener('DOMContentLoaded', () => {
    if (window.utils && window.utils.onPage) {
        utils.onPage('/warnings', () => initWarnings());
    }
});

function W() { return ((window.PAGE_LOCALE || {}).dashboard || {}).warnings || {}; }
function escapeHtml(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let warningsState = { page: 1, limit: 25, status: 'all', removingId: null };

async function initWarnings() {
    $('#addWarningBtn').on('click', addWarning);
    $('#warningUserId, #warningReason').on('keydown', e => { if (e.key === 'Enter') addWarning(); });
    $('.warning-filter').on('click', function () {
        $('.warning-filter').removeClass('active');
        $(this).addClass('active');
        warningsState.status = this.dataset.status;
        warningsState.page = 1;
        loadWarnings();
    });
    $('#removeCancel').on('click', () => hideRemoveModal());
    $('#removeConfirm').on('click', removeWarning);
    loadWarnings();
}

async function addWarning() {
    const userId = $('#warningUserId').val().trim();
    const reason = $('#warningReason').val().trim();
    const locale = W();
    if (!/^\d{15,21}$/.test(userId)) {
        utils.showToast('error', locale.userId + ' ...');
        return;
    }
    if (!reason) {
        utils.showToast('error', locale.reason);
        return;
    }
    try {
        const res = await fetch('/api/dashboard/warnings/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, reason })
        });
        const data = await res.json();
        if (!data.success) {
            utils.showToast('error', data.error || 'Failed');
            return;
        }
        utils.showToast('success', locale.warningAdded);
        $('#warningUserId').val('');
        $('#warningReason').val('');
        loadWarnings();
    } catch (e) {
        utils.showToast('error', e.message || 'Failed');
    }
}

async function loadWarnings() {
    const locale = W();
    $('#warningsLoader').removeClass('hidden');
    $('#warningsEmpty').addClass('hidden');
    try {
        const res = await fetch('/api/dashboard/warnings?page=' + warningsState.page + '&limit=' + warningsState.limit + '&active=' + warningsState.status);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        renderWarnings(data.warnings || []);
    } catch (e) {
        $('#warningsTableBody').html('<tr><td colspan="7" class="py-8 text-center text-red-400">' + escapeHtml(locale.loadError) + '</td></tr>');
    } finally {
        $('#warningsLoader').addClass('hidden');
    }
}

function renderWarnings(warnings) {
    const locale = W();
    const body = $('#warningsTableBody');
    if (!warnings.length) {
        $('#warningsEmpty').removeClass('hidden');
        body.html('');
        return;
    }
    body.html(warnings.map(warning => {
        const active = !warning.expiresAt || new Date(warning.expiresAt).getTime() > Date.now();
        return '<tr class="border-b border-gray-100 dark:border-gray-700">' +
            '<td class="py-3 px-4"><a href="/user/' + encodeURIComponent(warning.userId) + '" class="text-blue-500 hover:underline">' + escapeHtml(warning.userId) + '</a></td>' +
            '<td class="py-3 px-4 text-gray-600 dark:text-gray-300">' + escapeHtml(warning.moderatorId || '—') + '</td>' +
            '<td class="py-3 px-4 text-gray-600 dark:text-gray-300 max-w-xs truncate">' + escapeHtml(warning.reason || '—') + '</td>' +
            '<td class="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">' + escapeHtml(utils.formatDate(warning.timestamp)) + '</td>' +
            '<td class="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">' + (warning.expiresAt ? escapeHtml(utils.formatDate(warning.expiresAt)) : '—') + '</td>' +
            '<td class="py-3 px-4"><span class="px-2 py-1 rounded-lg text-xs ' + (active ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400') + '">' + (active ? escapeHtml(locale.active) : escapeHtml(locale.expired)) + '</span></td>' +
            '<td class="py-3 px-4"><button class="remove-warning px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600" data-id="' + warning._id + '" data-user="' + escapeHtml(warning.userId) + '"><i class="fas fa-trash"></i></button></td>' +
            '</tr>';
    }).join(''));
    body.find('.remove-warning').on('click', function () {
        openRemoveModal(this.dataset.id, this.dataset.user);
    });
}

function openRemoveModal(id, userId) {
    warningsState.removingId = id;
    $('#removeWarningTarget').text('#' + userId);
    $('#removeWarningReason').val('');
    $('#removeConfirmModal').removeClass('hidden').addClass('flex').css('display', 'flex');
}

function hideRemoveModal() {
    warningsState.removingId = null;
    $('#removeConfirmModal').addClass('hidden').removeClass('flex').css('display', 'none');
}

async function removeWarning() {
    const locale = W();
    if (!warningsState.removingId) return;
    const reason = $('#removeWarningReason').val().trim();
    try {
        const res = await fetch('/api/dashboard/warnings/' + encodeURIComponent(warningsState.removingId) + '/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        const data = await res.json();
        if (!data.success) {
            utils.showToast('error', data.error || 'Failed');
            return;
        }
        utils.showToast('success', locale.warningRemoved);
        hideRemoveModal();
        loadWarnings();
    } catch (e) {
        utils.showToast('error', e.message || 'Failed');
    }
}