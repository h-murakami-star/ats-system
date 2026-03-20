/* ========================================
   Dashboard Page
   ======================================== */

async function loadDashboard() {
    const container = document.getElementById('page-container');

    // Initial render with skeleton
    container.innerHTML = `
        <div class="dashboard-container">
            <div class="page-header">
                <h1>ダッシュボード</h1>
            </div>

            <div class="summary-cards" id="summary-cards">
                <div class="summary-card blue">
                    <div class="summary-label">求人数</div>
                    <div class="summary-value">-</div>
                </div>
                <div class="summary-card green">
                    <div class="summary-label">候補者数</div>
                    <div class="summary-value">-</div>
                </div>
                <div class="summary-card orange">
                    <div class="summary-label">面接予定</div>
                    <div class="summary-value">-</div>
                </div>
                <div class="summary-card red">
                    <div class="summary-label">今月の採用数</div>
                    <div class="summary-value">-</div>
                </div>
            </div>

            <div class="dashboard-grid">
                <!-- Recent Activities -->
                <div class="card" id="activities-section">
                    <div class="card-header">
                        <h2>最近のアクティビティ</h2>
                    </div>
                    <div class="card-body" id="activities-list">
                        <div class="empty-state">
                            <div class="empty-state-icon">📭</div>
                            <div class="empty-state-text">アクティビティがありません</div>
                        </div>
                    </div>
                </div>

                <!-- Pipeline Summary -->
                <div class="card" id="pipeline-section">
                    <div class="card-header">
                        <h2>パイプラインサマリ</h2>
                    </div>
                    <div class="card-body">
                        <div id="pipeline-chart" class="bar-chart"></div>
                    </div>
                </div>

                <!-- Upcoming Interviews -->
                <div class="card" id="interviews-section">
                    <div class="card-header">
                        <h2>今週の面接予定</h2>
                    </div>
                    <div class="card-body" id="interviews-list">
                        <div class="empty-state">
                            <div class="empty-state-icon">🗓️</div>
                            <div class="empty-state-text">面接予定がありません</div>
                        </div>
                    </div>
                </div>

                <!-- Hiring Funnel -->
                <div class="card">
                    <div class="card-header">
                        <h2>採用ファネル (本月)</h2>
                    </div>
                    <div class="card-body">
                        <div id="funnel-chart" class="bar-chart"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Load data
    try {
        const [summary, activities, interviews, funnel] = await Promise.all([
            app.api.get('/reports/summary'),
            app.api.get('/activities?limit=5'),
            app.api.get('/interviews?filter=upcoming&limit=5'),
            app.api.get('/reports/funnel')
        ]);

        // Update summary cards
        const summaryCards = container.querySelector('#summary-cards');
        summaryCards.innerHTML = `
            <div class="summary-card blue">
                <div class="summary-label">求人数</div>
                <div class="summary-value">${summary.totalJobs || 0}</div>
                <div class="summary-change">有効な求人</div>
            </div>
            <div class="summary-card green">
                <div class="summary-label">候補者数</div>
                <div class="summary-value">${summary.totalCandidates || 0}</div>
                <div class="summary-change">登録済み</div>
            </div>
            <div class="summary-card orange">
                <div class="summary-label">面接予定</div>
                <div class="summary-value">${summary.upcomingInterviews || 0}</div>
                <div class="summary-change">今月予定</div>
            </div>
            <div class="summary-card red">
                <div class="summary-label">今月の採用数</div>
                <div class="summary-value">${summary.monthlyHires || 0}</div>
                <div class="summary-change">確定済み</div>
            </div>
        `;

        // Render activities
        renderActivities(activities, container);

        // Render pipeline chart
        renderPipelineChart(funnel, container);

        // Render upcoming interviews
        renderUpcomingInterviews(interviews, container);

        // Render funnel
        renderFunnelChart(funnel, container);

    } catch (error) {
        console.error('Dashboard load error:', error);
        app.toast.error('ダッシュボードのデータ取得に失敗しました');
    }
}

function renderActivities(activities, container) {
    const list = container.querySelector('#activities-list');

    if (!activities || activities.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <div class="empty-state-text">アクティビティがありません</div>
            </div>
        `;
        return;
    }

    const html = activities.map(activity => `
        <div class="activity-item">
            <div style="display: flex; justify-content: space-between; align-items: start; padding: 0.75rem 0; border-bottom: 1px solid var(--gray-100);">
                <div>
                    <div style="font-weight: 500; color: var(--gray-900); margin-bottom: 0.25rem;">
                        ${activity.title}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--gray-500);">
                        ${activity.description}
                    </div>
                </div>
                <div style="font-size: 0.875rem; color: var(--gray-500); white-space: nowrap;">
                    ${app.DateFormatter.getRelativeTime(activity.createdAt)}
                </div>
            </div>
        </div>
    `).join('');

    list.innerHTML = html;
}

function renderPipelineChart(funnel, container) {
    const chartContainer = container.querySelector('#pipeline-chart');

    if (!funnel || !funnel.pipeline) {
        chartContainer.innerHTML = '<div class="empty-state-text">データなし</div>';
        return;
    }

    const stages = Object.entries(funnel.pipeline).map(([stage, count]) => ({
        stage,
        count: parseInt(count) || 0
    }));

    const maxCount = Math.max(...stages.map(s => s.count), 1);

    const html = stages.map(item => `
        <div class="bar-item">
            <div class="bar" style="height: ${(item.count / maxCount) * 200}px;" title="${item.stage}: ${item.count}人">
            </div>
            <div class="bar-label">${item.stage}</div>
            <div class="bar-value">${item.count}</div>
        </div>
    `).join('');

    chartContainer.innerHTML = html;
}

function renderUpcomingInterviews(interviews, container) {
    const list = container.querySelector('#interviews-list');

    if (!interviews || interviews.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🗓️</div>
                <div class="empty-state-text">面接予定がありません</div>
            </div>
        `;
        return;
    }

    const html = interviews.map(interview => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--gray-100);">
            <div>
                <div style="font-weight: 500; color: var(--gray-900);">
                    ${interview.candidateName}
                </div>
                <div style="font-size: 0.875rem; color: var(--gray-500);">
                    ${interview.jobTitle} - ${interview.interviewType}
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: 500;">
                    ${app.DateFormatter.formatDate(interview.scheduledAt)}
                </div>
                <div style="font-size: 0.875rem; color: var(--gray-500);">
                    ${app.DateFormatter.formatTime(interview.scheduledAt)}
                </div>
            </div>
        </div>
    `).join('');

    list.innerHTML = html;
}

function renderFunnelChart(funnel, container) {
    const chartContainer = container.querySelector('#funnel-chart');

    if (!funnel || !funnel.thisMonth) {
        chartContainer.innerHTML = '<div class="empty-state-text">データなし</div>';
        return;
    }

    const data = [
        { label: '応募', value: funnel.thisMonth.applications || 0 },
        { label: '書類選考', value: funnel.thisMonth.screening || 0 },
        { label: '面接', value: funnel.thisMonth.interviews || 0 },
        { label: '内定', value: funnel.thisMonth.offers || 0 },
        { label: '採用', value: funnel.thisMonth.hired || 0 }
    ];

    const maxValue = Math.max(...data.map(d => d.value), 1);

    const html = data.map(item => `
        <div class="bar-item">
            <div class="bar" style="height: ${(item.value / maxValue) * 200}px;">
            </div>
            <div class="bar-label">${item.label}</div>
            <div class="bar-value">${item.value}</div>
        </div>
    `).join('');

    chartContainer.innerHTML = html;
}

// Register route
app.router.register('dashboard', loadDashboard);
