document.addEventListener('DOMContentLoaded', () => {
    if (window.utils && window.utils.onPage) {
        utils.onPage('/dashboard', () => {
            window.DASHBOARD_STATE = { period: 'month', charts: {}, ticketStatus: 'open', suggestionStatus: 'pending', page: 1 };
            initDashboard();
        });
    }
});

function P() { return window.PAGE_LOCALE || {}; }
function dashboardLocale() { return (P().dashboard || {}).overview || {}; }
function actionLabel(action) {
    const map = ((P().dashboard || {}).actionTypes) || {};
    const base = String(action || 'other').replace(/^(automod|antiraid):.*$/, '$1');
    if (map[base]) return map[base];
    return base.charAt(0).toUpperCase() + base.slice(1);
}
function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function initDashboard() {
    $('.period-btn').on('click', function () {
        const period = this.dataset.period;
        $('.period-btn').removeClass('active');
        $(this).addClass('active');
        window.DASHBOARD_STATE.period = period;
        loadAnalytics(period);
    });
    $('#userSearchBtn, #userSearchInput').on('click keydown', function (e) {
        if (e.type === 'click' || e.key === 'Enter') {
            const value = $('#userSearchInput').val().trim();
            if (/^\d{15,21}$/.test(value)) {
                window.location.href = '/user/' + value;
            } else {
                showError(dashboardLocale().searchUser);
            }
        }
    });
    $('#refreshOverview').on('click', () => {
        $('#refreshOverview').addClass('animate-spin');
        loadOverview(true).finally(() => $('#refreshOverview').removeClass('animate-spin'));
    });

    $('.ticket-filter').on('click', function () {
        $('.ticket-filter').removeClass('active');
        $(this).addClass('active');
        window.DASHBOARD_STATE.ticketStatus = this.dataset.status;
        loadTickets();
    });
    $('.suggestion-filter').on('click', function () {
        $('.suggestion-filter').removeClass('active');
        $(this).addClass('active');
        window.DASHBOARD_STATE.suggestionStatus = this.dataset.status;
        loadSuggestions();
    });

    $('#reasonModalCancel').on('click', () => hideReasonModal());
    $('#reasonModalConfirm').on('click', () => submitReasonAction());

    await Promise.all([loadOverview(), loadAnalytics('month'), loadTickets(), loadSuggestions()]);
}

async function loadOverview(bg) {
    try {
        const res = await fetch('/api/dashboard/overview');
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        const o = data.overview || {};
        $('#statToday').text(o.today ? o.today.total : 0);
        $('#statWarnings').text(o.totals ? o.totals.warnings : 0);
        $('#statTicketsOpen').text(o.tickets ? o.tickets.open : 0);
        $('#statSuggestions').text(o.suggestions ? o.suggestions.pending : 0);
        $('#statMembers').text(o.guild ? o.guild.memberCount : 0);
        $('#statOnline').text(o.guild && o.guild.onlineMembers != null ? o.guild.onlineMembers : '—');
        $('#statChannels').text(o.guild ? o.guild.channels : 0);
        $('#statRoles').text(o.guild ? o.guild.roles : 0);
        $('#lastUpdate').text((P().dashboard || {}).overview ? (P().dashboard.overview.liveData || '') : '');
        await loadActivity();
    } catch (e) {
        showError(e.message || 'Error');
    }
}

async function loadActivity() {
    try {
        const res = await fetch('/api/dashboard/activity?limit=15');
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        const locale = dashboardLocale();
        const list = $('#recentActivityList');
        if (!data.activity || data.activity.length === 0) {
            list.html('<p class="text-gray-400 text-sm text-center py-6">' + escapeHtml(locale.noActivity || '') + '</p>');
            return;
        }
        list.html(data.activity.map(item => {
            const time = item.timestamp ? utils.formatDate(item.timestamp) : '';
            return '<div class="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">' +
                '<div class="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs flex-shrink-0"><i class="fas fa-shield-alt"></i></div>' +
                '<div class="min-w-0 flex-1">' +
                '<p class="text-sm text-gray-800 dark:text-white truncate"><a href="/user/' + encodeURIComponent(item.userId) + '" class="hover:underline">' + escapeHtml(item.targetName) + '</a>' +
                ' <span class="px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">' + escapeHtml(actionLabel(item.action)) + '</span></p>' +
                '<p class="text-xs text-gray-500 dark:text-gray-400 truncate">' + escapeHtml(item.reason || '') + '</p>' +
                '<p class="text-xs text-gray-400">' + escapeHtml(time) + '</p>' +
                '</div></div>';
        }).join(''));
    } catch (e) {
        $('#recentActivityList').html('<p class="text-gray-400 text-sm">' + escapeHtml(e.message) + '</p>');
    }
}

async function loadAnalytics(period) {
    $('#chartLoader').removeClass('hidden');
    try {
        const res = await fetch('/api/dashboard/analytics/' + period);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        renderCharts(data.data);
    } catch (e) {
        showError(e.message || 'Error');
    } finally {
        $('#chartLoader').addClass('hidden');
    }
}

function renderCharts(analytics) {
    const labels = analytics.labels || [];
    const d = analytics.datasets || {};

    if (window.DASHBOARD_STATE.charts.line) window.DASHBOARD_STATE.charts.line.destroy();
    if (window.DASHBOARD_STATE.charts.breakdown) window.DASHBOARD_STATE.charts.breakdown.destroy();
    $('#breakdownChart').css('height', '288px');

    const line = $('#moderationChart')[0];
    if (line && window.Chart) {
        window.DASHBOARD_STATE.charts.line = new Chart(line, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: actionLabel('warn'), data: d.warn, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: true, tension: 0.3 },
                    { label: actionLabel('ban'), data: d.ban, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.3 },
                    { label: actionLabel('timeout'), data: d.timeout, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', fill: true, tension: 0.3 },
                    { label: actionLabel('automod'), data: d.automod, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3 },
                    { label: actionLabel('antiraid'), data: d.antiraid, borderColor: '#ec4899', backgroundColor: 'rgba(236,72,153,0.1)', fill: true, tension: 0.3 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { labels: { color: '#9ca3af' } } },
                scales: {
                    x: { ticks: { color: '#9ca3af', maxTicksLimit: 12 } },
                    y: { beginAtZero: true, ticks: { color: '#9ca3af', precision: 0 } }
                }
            }
        });
    }

    const breakdown = $('#breakdownChart')[0];
    if (breakdown && window.Chart) {
        const total = labels.map((_, i) =>
            (d.warn[i] || 0) + (d.kick[i] || 0) + (d.ban[i] || 0) + (d.timeout[i] || 0) + (d.automod[i] || 0) + (d.antiraid[i] || 0)
        );
        window.DASHBOARD_STATE.charts.breakdown = new Chart(breakdown, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: actionLabel('warn'), data: d.warn, backgroundColor: '#f59e0b' },
                    { label: actionLabel('kick'), data: d.kick, backgroundColor: '#10b981' },
                    { label: actionLabel('ban'), data: d.ban, backgroundColor: '#ef4444' },
                    { label: actionLabel('timeout'), data: d.timeout, backgroundColor: '#8b5cf6' },
                    { label: actionLabel('automod'), data: d.automod, backgroundColor: '#3b82f6' },
                    { label: actionLabel('antiraid'), data: d.antiraid, backgroundColor: '#ec4899' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { stacked: false, ticks: { color: '#9ca3af', maxTicksLimit: 8 } }, y: { beginAtZero: true, ticks: { color: '#9ca3af', precision: 0 } } },
                plugins: { legend: { labels: { color: '#9ca3af' } } }
            }
        });
    }
    renderTopStaff(analytics.staff || []);
}

function renderTopStaff(staff) {
    const locale = dashboardLocale();
    const list = $('#topStaffList');
    if (!staff || staff.length === 0) {
        list.html('<p class="text-gray-400 text-sm text-center py-6">' + escapeHtml((P().dashboard || {}).staff ? (P().dashboard.staff.noData || '') : '') + '</p>');
        return;
    }
    list.html(staff.map(member =>
        '<a href="/user/' + encodeURIComponent(member.id) + '" class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">' +
        '<div class="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">' + escapeHtml((member.name || '?').charAt(0).toUpperCase()) + '</div>' +
        '<div class="min-w-0 flex-1">' +
        '<p class="text-sm font-medium text-gray-800 dark:text-white truncate">' + escapeHtml(member.name) + '</p>' +
        '<p class="text-xs text-gray-500 dark:text-gray-400">' + escapeHtml(actionLabel('warn')) + ': ' + member.warns + ' • ' + escapeHtml(actionLabel('ban')) + ': ' + member.bans + '</p>' +
        '</div>' +
        '<span class="text-sm font-bold text-blue-500">' + member.total + '</span>' +
        '</a>'
    ).join(''));
}

async function loadTickets() {
    const locale = dashboardLocale();
    const status = window.DASHBOARD_STATE.ticketStatus;
    try {
        const res = await fetch('/api/dashboard/tickets?status=' + encodeURIComponent(status) + '&limit=8');
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        const list = $('#ticketList');
        if (!data.tickets || data.tickets.length === 0) {
            list.html('<p class="text-gray-400 text-sm text-center py-6">' + escapeHtml(locale.noTickets || '') + '</p>');
            return;
        }
        list.html(data.tickets.map(ticket => {
            const statusLabel = ticket.status === 'closed' ? locale.statusClosed : ticket.status === 'claimed' ? locale.statusClaimed : locale.statusOpen;
            const statusColor = ticket.status === 'closed' ? 'bg-gray-500' : ticket.status === 'claimed' ? 'bg-purple-500' : 'bg-green-500';
            const actions = ticket.status === 'closed'
                ? '<button class="ticket-action px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600" data-id="' + ticket._id + '" data-action="reopen">' + escapeHtml(locale.reopen || '') + '</button>' +
                  ' <button class="ticket-action px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600" data-id="' + ticket._id + '" data-action="delete">' + escapeHtml(locale.delete || '') + '</button>'
                : '<button class="ticket-action px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600" data-id="' + ticket._id + '" data-action="close">' + escapeHtml(locale.close || '') + '</button>' +
                  ' <button class="ticket-action px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600" data-id="' + ticket._id + '" data-action="delete">' + escapeHtml(locale.delete || '') + '</button>';
            return '<div class="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">' +
                '<div class="min-w-0">' +
                '<p class="text-sm font-medium text-gray-800 dark:text-white truncate">#' + escapeHtml(ticket.channelId) + '</p>' +
                '<p class="text-xs text-gray-500 dark:text-gray-400">' + escapeHtml(actionLabel('timeout')) + ': <a class="hover:underline" href="/user/' + encodeURIComponent(ticket.userId) + '">' + escapeHtml(ticket.userId) + '</a></p>' +
                '</div>' +
                '<div class="flex items-center gap-2 flex-shrink-0">' +
                '<span class="px-2 py-0.5 rounded text-xs text-white ' + statusColor + '">' + escapeHtml(statusLabel) + '</span>' +
                actions +
                '</div></div>';
        }).join(''));
        list.find('.ticket-action').on('click', function () {
            openReasonModal(this.dataset.action, this.dataset.id);
        });
    } catch (e) {
        $('#ticketList').html('<p class="text-gray-400 text-sm">' + escapeHtml(e.message) + '</p>');
    }
}

async function loadSuggestions() {
    const locale = dashboardLocale();
    const status = window.DASHBOARD_STATE.suggestionStatus;
    try {
        const res = await fetch('/api/dashboard/suggestions?status=' + encodeURIComponent(status) + '&limit=8');
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        const list = $('#suggestionList');
        if (!data.suggestions || data.suggestions.length === 0) {
            list.html('<p class="text-gray-400 text-sm text-center py-6">' + escapeHtml(locale.noSuggestions || '') + '</p>');
            return;
        }
        list.html(data.suggestions.map(suggestion => {
            const statusLabel = suggestion.status === 'accepted' ? locale.statusAccepted : suggestion.status === 'rejected' ? locale.statusRejected : locale.statusPending;
            const statusColor = suggestion.status === 'accepted' ? 'bg-green-500' : suggestion.status === 'rejected' ? 'bg-red-500' : 'bg-gray-500';
            let actions = '';
            if (suggestion.status === 'pending') {
                actions = '<button class="suggestion-action px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600" data-id="' + suggestion._id + '" data-status="accepted">' + escapeHtml(locale.accept || '') + '</button>' +
                    ' <button class="suggestion-action px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600" data-id="' + suggestion._id + '" data-status="rejected">' + escapeHtml(locale.reject || '') + '</button>';
            }
            return '<div class="flex items-start justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">' +
                '<div class="min-w-0 flex-1">' +
                '<p class="text-sm text-gray-800 dark:text-white line-clamp-2">' + escapeHtml(suggestion.content) + '</p>' +
                '<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">' + escapeHtml(suggestion.authorName || suggestion.authorId) + ' • ' + utils.formatDate(suggestion.createdAt) + '</p>' +
                '</div>' +
                '<div class="flex items-center gap-2 flex-shrink-0">' +
                '<span class="px-2 py-0.5 rounded text-xs text-white ' + statusColor + '">' + escapeHtml(statusLabel) + '</span>' +
                actions +
                '</div></div>';
        }).join(''));
        list.find('.suggestion-action').on('click', function () {
            const status = this.dataset.status;
            if (status === 'rejected') {
                openReasonModal(status, this.dataset.id);
            } else {
                performSuggestionAction(this.dataset.id, status, '');
            }
        });
    } catch (e) {
        $('#suggestionList').html('<p class="text-gray-400 text-sm">' + escapeHtml(e.message) + '</p>');
    }
}

let pendingModalAction = null;

function openReasonModal(action, id, hint) {
    const locale = dashboardLocale();
    pendingModalAction = { action, id };
    const isTicketDelete = action === 'delete';
    $('#reasonModalTitle').text(action === 'close' ? locale.confirmClose : isTicketDelete ? locale.confirmDelete : locale.reject);
    $('#reasonModalInput').val('');
    $('#reasonModalError').addClass('hidden');
    $('#reasonModalConfirm').text(action === 'close' ? locale.close : isTicketDelete ? locale.delete : action === 'rejected' ? locale.reject : action);
    $('#reasonModalHint').attr('data-hint', hint || '');
    $('#reasonModal').removeClass('hidden').addClass('flex').css('display', 'flex');
    $('#reasonModalInput').trigger('focus');
}

function hideReasonModal() {
    pendingModalAction = null;
    $('#reasonModal').addClass('hidden').removeClass('flex').css('display', 'none');
}

async function submitReasonAction() {
    if (!pendingModalAction) return;
    const reason = $('#reasonModalInput').val().trim();
    const locale = dashboardLocale();
    if (pendingModalAction.action === 'delete' && !reason) {
        await performTicketAction(pendingModalAction.id, 'delete', '');
        return;
    }
    if (!reason) {
        $('#reasonModalError').removeClass('hidden');
        return;
    }
    await performTicketAction(pendingModalAction.id, pendingModalAction.action, reason);
}

async function performTicketAction(id, action, reason) {
    const locale = dashboardLocale();
    try {
        const res = await fetch('/api/dashboard/tickets/' + encodeURIComponent(id) + '/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, reason })
        });
        const data = await res.json();
        if (!data.success) {
            utils.showToast('error', data.error || locale.actionFailed);
            if (res.status === 403) { hideReasonModal(); }
            return;
        }
        utils.showToast('success', locale.actionPerformed);
        hideReasonModal();
        loadTickets();
    } catch (e) {
        utils.showToast('error', e.message || locale.actionFailed);
    }
}

async function performSuggestionAction(id, status, reason) {
    const locale = dashboardLocale();
    try {
        const res = await fetch('/api/dashboard/suggestions/' + encodeURIComponent(id) + '/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, reason })
        });
        const data = await res.json();
        if (!data.success) {
            utils.showToast('error', data.error || locale.actionFailed);
            hideReasonModal();
            return;
        }
        utils.showToast('success', locale.actionPerformed);
        hideReasonModal();
        loadSuggestions();
    } catch (e) {
        utils.showToast('error', e.message || locale.actionFailed);
    }
}

function showError(message) {
    const el = $('#loadError');
    el.removeClass('hidden');
    $('#loadErrorText').text(message);
    setTimeout(() => el.addClass('hidden'), 4000);
}