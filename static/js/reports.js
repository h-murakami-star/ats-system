/* ========================================
   Reports & Analytics Page
   ======================================== */

let reportsState = {
    summary: null,
    funnel: null,
    sources: null,
    department: null,
    timeToHire: null
};

async function loadReports() {
    const container = document.getElementById('page-container');

    container.innerHTML = `
        <div class="reports-container">
            <div class="page-header">
                <h1>レポート & 分析</h1>
            </div>

            <!-- Key Metrics -->
            <div class="summary-cards" id="metrics-cards">
                <div class="summary-card blue"><div class="summary-label">読み込み中</div><div class="summary-value">-</div></div>
            </div>

            <!-- Charts Row 1 -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                <div class="card">
                    <div class="card-header">
                        <h2>採用ファネル</h2>
                    </div>
                    <div class="card-body">
                        <div id="funnel-chart" class="bar-chart"></div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h2>ソース別応募数</h2>
                    </div>
                    <div class="card-body">
                        <div id="sources-chart" class="bar-chart"></div>
                    </div>
                </div>
            </div>

            <!-- Charts Row 2 -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                <div class="card">
                    <div class="card-header">
                        <h2>部門別採用状況</h2>
                    </div>
                    <div class="card-body">
                        <div id="department-chart" class="bar-chart"></div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h2>平均採用期間</h2>
                    </div>
                    <div class="card-body">
                        <div id="time-to-hire-chart"></div>
                    </div>
                </div>
            </div>

            <!-- Details Table -->
            <div class="card">
                <div class="card-header">
                    <h2>月別トレンド</h2>
                </div>
                <div class="card-body">
                    <div id="trends-chart" class="bar-chart"></div>
                </div>
            </div>
        </div>
    `;

    // Load data
    try {
        const [summary, funnel, sources, department, timeToHire] = await Promise.all([
            app.api.get('/reports/summary'),
            app.api.get('/reports/funnel'),
            app.api.get('/reports/sources'),
            app.api.get('/reports/department'),
            app.api.get('/reports/time-to-hire')
        ]);

        reportsState.summary = summary;
        reportsState.funnel = funnel;
        reportsState.sources = sources;
        reportsState.department = department;
        reportsState.timeToHire = timeToHire;

        renderReports();
    } catch (error) {
        console.error('Reports load error:', error);
        app.toast.error('レポートの読み込みに失敗しました');
    }
}

function renderReports() {
    // Render key metrics
    renderMetricsCards();

    // Render funnels
    renderFunnelChart();
    renderSourcesChart();
    renderDepartmentChart();
    renderTimeToHireChart();
    renderTrendsChart();
}

function renderMetricsCards() {
    const container = document.getElementById('metrics-cards');
    const data = reportsState.summary;

    const html = `
        <div class="summary-card blue">
            <div class="summary-label">総応募数</div>
            <div class="summary-value">${data.totalApplications || 0}</div>
            <div class="summary-change">今月: ${data.monthlyApplications || 0}</div>
        </div>
        <div class="summary-card green">
            <div class="summary-label">採用数</div>
            <div class="summary-value">${data.totalHired || 0}</div>
            <div class="summary-change">採用率: ${((data.totalHired / data.totalApplications) * 100).toFixed(1)}%</div>
        </div>
        <div class="summary-card orange">
            <div class="summary-label">進行中</div>
            <div class="summary-value">${data.inProgress || 0}</div>
            <div class="summary-change">選考中</div>
        </div>
        <div class="summary-card red">
            <div class="summary-label">不採用</div>
            <div class="summary-value">${data.rejected || 0}</div>
            <div class="summary-change">脱落率: ${((data.rejected / data.totalApplications) * 100).toFixed(1)}%</div>
        </div>
    `;

    container.innerHTML = html;
}

function renderFunnelChart() {
    const container = document.getElementById('funnel-chart');
    const data = reportsState.funnel;

    if (!data || !data.stages) {
        container.innerHTML = '<div class="empty-state-text">データなし</div>';
        return;
    }

    const stages = data.stages;
    const maxCount = Math.max(...Object.values(stages), 1);

    const html = Object.entries(stages).map(([stage, count]) => `
        <div class="bar-item">
            <div class="bar" style="height: ${(count / maxCount) * 200}px;"></div>
            <div class="bar-label">${getStageNameForChart(stage)}</div>
            <div class="bar-value">${count}</div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function renderSourcesChart() {
    const container = document.getElementById('sources-chart');
    const data = reportsState.sources;

    if (!data || !data.sources) {
        container.innerHTML = '<div class="empty-state-text">データなし</div>';
        return;
    }

    const sources = data.sources;
    const maxCount = Math.max(...Object.values(sources), 1);

    const html = Object.entries(sources).map(([source, count]) => `
        <div class="bar-item">
            <div class="bar" style="height: ${(count / maxCount) * 200}px;"></div>
            <div class="bar-label">${getSourceNameForChart(source)}</div>
            <div class="bar-value">${count}</div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function renderDepartmentChart() {
    const container = document.getElementById('department-chart');
    const data = reportsState.department;

    if (!data || !data.departments) {
        container.innerHTML = '<div class="empty-state-text">データなし</div>';
        return;
    }

    const departments = data.departments;
    const maxCount = Math.max(...Object.values(departments).map(d => d.hired), 1);

    const html = Object.entries(departments).map(([dept, stats]) => `
        <div class="bar-item">
            <div class="bar" style="height: ${(stats.hired / maxCount) * 200}px;" title="${dept}: ${stats.hired}人採用"></div>
            <div class="bar-label">${dept}</div>
            <div class="bar-value">${stats.hired}</div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function renderTimeToHireChart() {
    const container = document.getElementById('time-to-hire-chart');
    const data = reportsState.timeToHire;

    if (!data) {
        container.innerHTML = '<div class="empty-state-text">データなし</div>';
        return;
    }

    const html = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div style="text-align: center; padding: 1.5rem; background-color: var(--gray-50); border-radius: 0.5rem;">
                <div style="font-size: 0.875rem; color: var(--gray-500); margin-bottom: 0.5rem;">平均採用期間</div>
                <div style="font-size: 2rem; font-weight: 700; color: var(--primary);">${data.average || 0}</div>
                <div style="font-size: 0.875rem; color: var(--gray-500);">日</div>
            </div>
            <div style="text-align: center; padding: 1.5rem; background-color: var(--gray-50); border-radius: 0.5rem;">
                <div style="font-size: 0.875rem; color: var(--gray-500); margin-bottom: 0.5rem;">最短期間</div>
                <div style="font-size: 2rem; font-weight: 700; color: var(--secondary);">${data.min || 0}</div>
                <div style="font-size: 0.875rem; color: var(--gray-500);">日</div>
            </div>
            <div style="text-align: center; padding: 1.5rem; background-color: var(--gray-50); border-radius: 0.5rem;">
                <div style="font-size: 0.875rem; color: var(--gray-500); margin-bottom: 0.5rem;">最長期間</div>
                <div style="font-size: 2rem; font-weight: 700; color: var(--warning);">${data.max || 0}</div>
                <div style="font-size: 0.875rem; color: var(--gray-500);">日</div>
            </div>
            <div style="text-align: center; padding: 1.5rem; background-color: var(--gray-50); border-radius: 0.5rem;">
                <div style="font-size: 0.875rem; color: var(--gray-500); margin-bottom: 0.5rem;">中央値</div>
                <div style="font-size: 2rem; font-weight: 700; color: var(--info);">${data.median || 0}</div>
                <div style="font-size: 0.875rem; color: var(--gray-500);">日</div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function renderTrendsChart() {
    const container = document.getElementById('trends-chart');

    // Generate sample monthly data
    const months = [];
    const applicationsData = [];
    const hiresData = [];

    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const monthName = ['1月', '2月', '3月', '4月', '5月', '6月'][date.getMonth()];
        months.push(monthName);
        applicationsData.push(Math.floor(Math.random() * 50) + 20);
        hiresData.push(Math.floor(Math.random() * 10) + 2);
    }

    const maxApps = Math.max(...applicationsData, 1);
    const maxHires = Math.max(...hiresData, 1);

    const html = `
        <div style="display: flex; gap: 3rem; align-items: flex-end; height: 250px;">
            ${months.map((month, idx) => `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                    <div style="display: flex; gap: 0.25rem; align-items: flex-end; height: 150px;">
                        <div style="width: 20px; background: var(--primary); border-radius: 0.25rem;"
                             style="height: ${(applicationsData[idx] / maxApps) * 150}px;"
                             title="応募: ${applicationsData[idx]}人"></div>
                        <div style="width: 20px; background: var(--secondary); border-radius: 0.25rem;"
                             style="height: ${(hiresData[idx] / maxHires) * 150}px;"
                             title="採用: ${hiresData[idx]}人"></div>
                    </div>
                    <div style="font-size: 0.875rem; font-weight: 500;">${month}</div>
                </div>
            `).join('')}
        </div>
        <div style="display: flex; gap: 2rem; margin-top: 1.5rem; justify-content: center; font-size: 0.875rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="width: 20px; height: 20px; background: var(--primary); border-radius: 0.25rem;"></div>
                <span>応募数</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="width: 20px; height: 20px; background: var(--secondary); border-radius: 0.25rem;"></div>
                <span>採用数</span>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function getStageNameForChart(stage) {
    const map = {
        'new': '応募',
        'screening': '書類選考',
        'interview': '面接',
        'offer': '内定',
        'hired': '採用',
        'rejected': '不採用'
    };
    return map[stage] || stage;
}

function getSourceNameForChart(source) {
    const map = {
        'direct': 'ダイレクト',
        'indeed': 'Indeed',
        'linkedin': 'LinkedIn',
        'referral': '紹介',
        'other': 'その他'
    };
    return map[source] || source;
}

// Register route
app.router.register('reports', loadReports);
