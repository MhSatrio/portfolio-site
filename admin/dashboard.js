(function () {
    'use strict';
    const COLOR_BLUE = '#3987e5';
    const COLOR_ORANGE = '#d95926';
    const GRID_COLOR = '#2c2c2a';
    const TEXT_MUTED = '#898781';
    const TEXT_SECONDARY = '#c3c2b7';
    Chart.defaults.color = TEXT_SECONDARY;
    Chart.defaults.borderColor = GRID_COLOR;
    Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const loginScreen = document.getElementById('loginScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const passwordInput = document.getElementById('passwordInput');
    const refreshBtn = document.getElementById('refreshBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const lastUpdatedEl = document.getElementById('lastUpdated');
    const errorBanner = document.getElementById('errorBanner');
    const emptyState = document.getElementById('emptyState');
    const dashboardBody = document.getElementById('dashboardBody');
    const skeleton = document.getElementById('skeleton');
    const statsGrid = document.getElementById('statsGrid');
    const csvExportBtn = document.getElementById('csvExportBtn');
    const searchInput = document.getElementById('tableSearch');
    const countryFilter = document.getElementById('countryFilter');
    const browserFilter = document.getElementById('browserFilter');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const tableBody = document.getElementById('tableBody');
    const paginationEl = document.getElementById('pagination');
    const rowCountEl = document.getElementById('rowCount');
    let refreshTimer = null;
    let charts = {};
    let latestData = null;
    let sortCol = 'timestamp';
    let sortDir = 'desc';
    let page = 1;
    const PAGE_SIZE = 25;
    async function tryLogin(password) {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        return res.ok;
    }
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        loginError.textContent = '';
        const ok = await tryLogin(passwordInput.value);
        if (!ok) {
            loginError.textContent = 'Incorrect password.';
            return;
        }
        passwordInput.value = '';
        showDashboard();
        loadDashboard();
        startAutoRefresh();
    });
    logoutBtn.addEventListener('click', async function () {
        await fetch('/api/admin/logout', { method: 'POST' });
        stopAutoRefresh();
        showLogin();
    });
    function showLogin() {
        loginScreen.classList.remove('hidden');
        dashboardScreen.classList.add('hidden');
    }
    function showDashboard() {
        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
    }
    function startAutoRefresh() {
        stopAutoRefresh();
        refreshTimer = window.setInterval(loadDashboard, 30000);
    }
    function stopAutoRefresh() {
        if (refreshTimer !== null)
            window.clearInterval(refreshTimer);
        refreshTimer = null;
    }
    refreshBtn.addEventListener('click', function () {
        loadDashboard();
    });
    async function loadDashboard() {
        errorBanner.classList.add('hidden');
        try {
            const res = await fetch('/api/admin/data', { cache: 'no-store' });
            if (res.status === 401) {
                stopAutoRefresh();
                showLogin();
                return;
            }
            if (!res.ok)
                throw new Error('Request failed: ' + res.status);
            const json = await res.json();
            if (!json.ok)
                throw new Error(json.error || 'Unknown error');
            latestData = json.data;
            skeleton.classList.add('hidden');
            if (latestData.rows.length === 0) {
                emptyState.classList.remove('hidden');
                dashboardBody.classList.add('hidden');
            }
            else {
                emptyState.classList.add('hidden');
                dashboardBody.classList.remove('hidden');
                renderStats(latestData);
                renderCharts(latestData);
                populateFilterOptions(latestData.rows);
                page = 1;
                renderTable();
            }
            lastUpdatedEl.textContent = 'Last updated: ' + new Date(latestData.generatedAt).toLocaleTimeString();
        }
        catch (err) {
            skeleton.classList.add('hidden');
            errorBanner.classList.remove('hidden');
            errorBanner.textContent =
                'Could not load dashboard data. ' + (err instanceof Error ? err.message : 'Unknown error') + ' — retrying on next refresh.';
        }
    }
    function formatDuration(seconds) {
        if (seconds < 60)
            return seconds + 's';
        const m = Math.floor(seconds / 60);
        const s = Math.round(seconds % 60);
        return m + 'm ' + s + 's';
    }
    function renderStats(data) {
        const t = data.totals;
        const cards = [
            ['Total Events', t.totalEvents],
            ['Total Sessions', t.totalSessions],
            ['Unique Visitors', t.uniqueVisitors],
            ['Returning Visitors', t.returningVisitors],
            ['New Visitors', t.newVisitors],
            ['Visitors Today', t.visitorsToday],
            ['Visitors This Week', t.visitorsThisWeek],
            ['Visitors This Month', t.visitorsThisMonth],
            ['Resume Downloads', t.resumeDownloads],
            ['Marketing Portfolio Downloads', t.marketingPortfolioDownloads],
            ['Video Portfolio Downloads', t.videoPortfolioDownloads],
            ['GitHub Clicks', t.githubClicks],
            ['LinkedIn Clicks', t.linkedinClicks],
            ['Contact Clicks', t.contactClicks],
            ['Avg. Session Duration', formatDuration(t.avgSessionDurationSeconds)],
        ];
        statsGrid.innerHTML = cards
            .map(([label, value]) => '<div class="stat-card"><div class="stat-num">' +
            value +
            '</div><div class="stat-label">' +
            label +
            '</div></div>')
            .join('');
    }
    function destroyChart(id) {
        if (charts[id]) {
            charts[id].destroy();
            delete charts[id];
        }
    }
    function lineChart(id, labels, values, label) {
        destroyChart(id);
        const canvas = document.getElementById(id);
        if (!canvas)
            return;
        charts[id] = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label,
                        data: values,
                        borderColor: COLOR_BLUE,
                        backgroundColor: COLOR_BLUE + '33',
                        fill: true,
                        tension: 0.25,
                        pointRadius: labels.length > 20 ? 0 : 3,
                        borderWidth: 2,
                    },
                ],
            },
            options: baseOptions(false),
        });
    }
    function barChart(id, labels, values, label, horizontal = false) {
        destroyChart(id);
        const canvas = document.getElementById(id);
        if (!canvas)
            return;
        charts[id] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{ label, data: values, backgroundColor: COLOR_BLUE, borderRadius: 4, maxBarThickness: 36 }],
            },
            options: { ...baseOptions(false), indexAxis: horizontal ? 'y' : 'x' },
        });
    }
    function stackedBar(id, categories) {
        destroyChart(id);
        const canvas = document.getElementById(id);
        if (!canvas)
            return;
        const total = categories.reduce((s, [, v]) => s + v, 0) || 1;
        charts[id] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Visitors'],
                datasets: categories.map(([label, value], i) => ({
                    label,
                    data: [((value / total) * 100).toFixed(1)],
                    backgroundColor: i === 0 ? COLOR_ORANGE : COLOR_BLUE,
                    borderRadius: 4,
                })),
            },
            options: {
                ...baseOptions(true),
                indexAxis: 'y',
                scales: {
                    x: { stacked: true, max: 100, ticks: { callback: (v) => v + '%' }, grid: { color: GRID_COLOR } },
                    y: { stacked: true, grid: { display: false } },
                },
            },
        });
    }
    function baseOptions(showLegend) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: showLegend, labels: { color: TEXT_SECONDARY } },
                tooltip: { backgroundColor: '#1c1c20', borderColor: GRID_COLOR, borderWidth: 1 },
            },
            scales: {
                x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_MUTED } },
                y: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_MUTED }, beginAtZero: true },
            },
        };
    }
    function cumulative(values) {
        let sum = 0;
        return values.map((v) => (sum += v));
    }
    function renderCharts(data) {
        const c = data.charts;
        lineChart('chartDailyVisitors', c.dailyVisitors.map((d) => d.date), c.dailyVisitors.map((d) => d.count), 'Visitors');
        lineChart('chartWeeklyVisitors', c.weeklyVisitors.map((d) => d.week), c.weeklyVisitors.map((d) => d.count), 'Visitors');
        lineChart('chartMonthlyVisitors', c.monthlyVisitors.map((d) => d.month), c.monthlyVisitors.map((d) => d.count), 'Visitors');
        lineChart('chartVisitorGrowth', c.dailyVisitors.map((d) => d.date), cumulative(c.dailyVisitors.map((d) => d.count)), 'Cumulative visitors');
        lineChart('chartDownloadsOverTime', c.downloadsOverTime.map((d) => d.date), c.downloadsOverTime.map((d) => d.count), 'Downloads');
        stackedBar('chartReturningVsNew', [
            ['Returning', c.returningVsNew.returning],
            ['New', c.returningVsNew.newCount],
        ]);
        barChart('chartBrowsers', c.browserDistribution.map((d) => d.label), c.browserDistribution.map((d) => d.count), 'Sessions');
        barChart('chartOs', c.osDistribution.map((d) => d.label), c.osDistribution.map((d) => d.count), 'Sessions');
        barChart('chartDevice', c.deviceDistribution.map((d) => d.label), c.deviceDistribution.map((d) => d.count), 'Sessions');
        barChart('chartCountry', c.countryDistribution.map((d) => d.label), c.countryDistribution.map((d) => d.count), 'Visitors', true);
        barChart('chartReferrers', c.topReferrers.map((d) => d.label), c.topReferrers.map((d) => d.count), 'Visits', true);
        barChart('chartPages', c.topPages.map((d) => d.label), c.topPages.map((d) => d.count), 'Views', true);
        barChart('chartProjects', c.topProjects.map((d) => d.label), c.topProjects.map((d) => d.count), 'Opens', true);
        barChart('chartUtm', c.topUtmCampaigns.map((d) => d.label), c.topUtmCampaigns.map((d) => d.count), 'Visits', true);
        barChart('chartButtons', c.buttonClickFrequency.map((d) => d.label), c.buttonClickFrequency.map((d) => d.count), 'Clicks', true);
        barChart('chartSessionDuration', c.sessionDurationBuckets.map((d) => d.label), c.sessionDurationBuckets.map((d) => d.count), 'Sessions');
    }
    function populateFilterOptions(rows) {
        const countries = Array.from(new Set(rows.map((r) => r.country).filter(Boolean))).sort();
        const browsers = Array.from(new Set(rows.map((r) => r.browser).filter(Boolean))).sort();
        const currentCountry = countryFilter.value;
        const currentBrowser = browserFilter.value;
        countryFilter.innerHTML = '<option value="">All countries</option>' + countries.map((c) => `<option value="${c}">${c}</option>`).join('');
        browserFilter.innerHTML = '<option value="">All browsers</option>' + browsers.map((b) => `<option value="${b}">${b}</option>`).join('');
        countryFilter.value = currentCountry;
        browserFilter.value = currentBrowser;
    }
    function getFilteredRows() {
        if (!latestData)
            return [];
        const q = searchInput.value.trim().toLowerCase();
        const country = countryFilter.value;
        const browser = browserFilter.value;
        const from = dateFromInput.value ? new Date(dateFromInput.value) : null;
        const to = dateToInput.value ? new Date(dateToInput.value + 'T23:59:59') : null;
        return latestData.rows.filter((r) => {
            if (country && r.country !== country)
                return false;
            if (browser && r.browser !== browser)
                return false;
            const ts = new Date(r.timestamp);
            if (from && ts < from)
                return false;
            if (to && ts > to)
                return false;
            if (q) {
                const haystack = [r.visitorId, r.sessionId, r.page, r.country, r.city, r.browser, r.os, r.eventType, r.button, r.download]
                    .join(' ')
                    .toLowerCase();
                if (haystack.indexOf(q) === -1)
                    return false;
            }
            return true;
        });
    }
    function sortRows(rows) {
        const sorted = [...rows].sort((a, b) => {
            const av = a[sortCol];
            const bv = b[sortCol];
            if (av === bv)
                return 0;
            return av < bv ? -1 : 1;
        });
        if (sortDir === 'desc')
            sorted.reverse();
        return sorted;
    }
    function renderTable() {
        const filtered = sortRows(getFilteredRows());
        rowCountEl.textContent = filtered.length + ' rows';
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        page = Math.min(page, totalPages);
        const start = (page - 1) * PAGE_SIZE;
        const pageRows = filtered.slice(start, start + PAGE_SIZE);
        tableBody.innerHTML = pageRows
            .map((r) => `<tr>
        <td>${new Date(r.timestamp).toLocaleString()}</td>
        <td class="mono-cell">${r.visitorId.slice(0, 8)}</td>
        <td class="mono-cell">${r.sessionId.slice(0, 8)}</td>
        <td>${r.visitCount}</td>
        <td>${r.returningVisitor}</td>
        <td>${r.country || '—'}</td>
        <td>${r.region || '—'}</td>
        <td>${r.city || '—'}</td>
        <td>${r.browser}</td>
        <td>${r.os}</td>
        <td>${r.device}</td>
        <td>${r.language || '—'}</td>
        <td>${r.referrer ? '<span title="' + r.referrer.replace(/"/g, '&quot;') + '">link</span>' : 'Direct'}</td>
        <td>${r.page}</td>
        <td>${r.eventType}</td>
        <td>${r.button || '—'}</td>
        <td>${r.download || '—'}</td>
        <td>${r.duration}</td>
        <td>${r.emailStatus || '—'}</td>
      </tr>`)
            .join('');
        paginationEl.innerHTML =
            `<button ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">Prev</button>` +
                `<span>Page ${page} of ${totalPages}</span>` +
                `<button ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">Next</button>`;
    }
    paginationEl.addEventListener('click', function (e) {
        const btn = e.target.closest('button[data-page]');
        if (!btn || btn.disabled)
            return;
        page = parseInt(btn.getAttribute('data-page') || '1', 10);
        renderTable();
    });
    document.querySelectorAll('th[data-sort]').forEach((th) => {
        th.addEventListener('click', function () {
            const col = th.getAttribute('data-sort');
            if (sortCol === col) {
                sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            }
            else {
                sortCol = col;
                sortDir = 'desc';
            }
            page = 1;
            renderTable();
        });
    });
    [searchInput, countryFilter, browserFilter, dateFromInput, dateToInput].forEach((el) => {
        el.addEventListener('input', function () {
            page = 1;
            renderTable();
        });
    });
    csvExportBtn.addEventListener('click', function () {
        const rows = sortRows(getFilteredRows());
        const headers = [
            'Timestamp',
            'Visitor ID',
            'Session ID',
            'Visit Count',
            'Returning Visitor',
            'Country',
            'Region',
            'City',
            'Browser',
            'OS',
            'Device',
            'Language',
            'Referrer',
            'Page',
            'Event Type',
            'Button',
            'Download',
            'Duration',
            'Email Status',
        ];
        const csvRows = [headers.join(',')];
        for (const r of rows) {
            const values = [
                r.timestamp,
                r.visitorId,
                r.sessionId,
                r.visitCount,
                r.returningVisitor,
                r.country,
                r.region,
                r.city,
                r.browser,
                r.os,
                r.device,
                r.language,
                r.referrer,
                r.page,
                r.eventType,
                r.button,
                r.download,
                r.duration,
                r.emailStatus,
            ].map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"');
            csvRows.push(values.join(','));
        }
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'portfolio-visitor-analytics-' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
        URL.revokeObjectURL(url);
    });
    (async function boot() {
        const res = await fetch('/api/admin/data', { cache: 'no-store' });
        if (res.ok) {
            showDashboard();
            loadDashboard();
            startAutoRefresh();
        }
        else {
            showLogin();
        }
    })();
})();
