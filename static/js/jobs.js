/* ========================================
   Jobs Management Page
   ======================================== */

let jobsState = {
    jobs: [],
    filteredJobs: [],
    filters: {
        search: '',
        department: '',
        status: ''
    }
};

async function loadJobs() {
    const container = document.getElementById('page-container');

    container.innerHTML = `
        <div class="jobs-container">
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h1>求人管理</h1>
                <button class="btn btn-primary" id="new-job-btn">
                    ➕ 新規求人
                </button>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2>求人一覧</h2>
                </div>

                <!-- Filters -->
                <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--gray-200); background-color: var(--gray-50);">
                    <div class="form-row">
                        <input type="text" id="search-jobs" placeholder="求人名で検索..." class="form-control">
                        <select id="filter-department" class="form-control">
                            <option value="">全部門</option>
                            <option value="engineering">エンジニア</option>
                            <option value="sales">営業</option>
                            <option value="marketing">マーケティング</option>
                            <option value="operations">オペレーション</option>
                        </select>
                        <select id="filter-status" class="form-control">
                            <option value="">全ステータス</option>
                            <option value="open">募集中</option>
                            <option value="closed">募集終了</option>
                            <option value="draft">下書き</option>
                        </select>
                    </div>
                </div>

                <div class="card-body">
                    <div id="jobs-list" class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>求人名</th>
                                    <th>部門</th>
                                    <th>雇用形態</th>
                                    <th>給与</th>
                                    <th>応募数</th>
                                    <th>ステータス</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody id="jobs-tbody">
                                <tr><td colspan="7" style="text-align: center; padding: 2rem;">読み込み中...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Attach event listeners
    document.getElementById('new-job-btn').addEventListener('click', showNewJobModal);
    document.getElementById('search-jobs').addEventListener('input', (e) => {
        jobsState.filters.search = e.target.value;
        filterAndRenderJobs();
    });
    document.getElementById('filter-department').addEventListener('change', (e) => {
        jobsState.filters.department = e.target.value;
        filterAndRenderJobs();
    });
    document.getElementById('filter-status').addEventListener('change', (e) => {
        jobsState.filters.status = e.target.value;
        filterAndRenderJobs();
    });

    // Load jobs
    try {
        const response = await app.api.get('/jobs');
        jobsState.jobs = response.data || [];
        filterAndRenderJobs();
    } catch (error) {
        console.error('Jobs load error:', error);
        app.toast.error('求人の読み込みに失敗しました');
        document.getElementById('jobs-tbody').innerHTML = `
            <tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--gray-500);">
                エラーが発生しました
            </td></tr>
        `;
    }
}

function filterAndRenderJobs() {
    let filtered = jobsState.jobs;

    if (jobsState.filters.search) {
        filtered = filtered.filter(job =>
            job.title.toLowerCase().includes(jobsState.filters.search.toLowerCase()) ||
            job.description.toLowerCase().includes(jobsState.filters.search.toLowerCase())
        );
    }

    if (jobsState.filters.department) {
        filtered = filtered.filter(job => job.department === jobsState.filters.department);
    }

    if (jobsState.filters.status) {
        filtered = filtered.filter(job => job.status === jobsState.filters.status);
    }

    jobsState.filteredJobs = filtered;
    renderJobsTable(filtered);
}

function renderJobsTable(jobs) {
    const tbody = document.getElementById('jobs-tbody');

    if (jobs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem;">
                    <div class="empty-state">
                        <div class="empty-state-icon">📋</div>
                        <div class="empty-state-text">求人がありません</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const html = jobs.map(job => `
        <tr>
            <td>
                <strong>${app.escapeHtml(job.title)}</strong>
            </td>
            <td>${job.department}</td>
            <td>${job.type === 'full-time' ? '正社員' : job.type === 'part-time' ? 'パートタイム' : 'インターン'}</td>
            <td>${job.salaryMin ? `¥${job.salaryMin.toLocaleString()}〜` : '-'}</td>
            <td><strong>${job.applicationCount || 0}</strong></td>
            <td>
                <span class="badge ${getJobStatusBadge(job.status)}">
                    ${getJobStatusLabel(job.status)}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="editJob('${job.id}')">編集</button>
                <button class="btn btn-sm btn-outline" onclick="viewJobDetails('${job.id}')">詳細</button>
            </td>
        </tr>
    `).join('');

    tbody.innerHTML = html;
}

function getJobStatusLabel(status) {
    const map = {
        'open': '募集中',
        'closed': '募集終了',
        'draft': '下書き'
    };
    return map[status] || status;
}

function getJobStatusBadge(status) {
    const map = {
        'open': 'badge-green',
        'closed': 'badge-red',
        'draft': 'badge-gray'
    };
    return map[status] || 'badge-gray';
}

function showNewJobModal() {
    const content = `
        <form id="job-form">
            <div class="form-group">
                <label>求人名 <span class="required">*</span></label>
                <input type="text" name="title" required placeholder="例：シニアエンジニア">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>部門 <span class="required">*</span></label>
                    <select name="department" required>
                        <option value="">選択してください</option>
                        <option value="engineering">エンジニア</option>
                        <option value="sales">営業</option>
                        <option value="marketing">マーケティング</option>
                        <option value="operations">オペレーション</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>雇用形態 <span class="required">*</span></label>
                    <select name="type" required>
                        <option value="full-time">正社員</option>
                        <option value="part-time">パートタイム</option>
                        <option value="intern">インターン</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>最低給与</label>
                    <input type="number" name="salaryMin" placeholder="円">
                </div>
                <div class="form-group">
                    <label>最高給与</label>
                    <input type="number" name="salaryMax" placeholder="円">
                </div>
            </div>
            <div class="form-group">
                <label>勤務地</label>
                <input type="text" name="location" placeholder="例：東京都渋谷区">
            </div>
            <div class="form-group">
                <label>説明</label>
                <textarea name="description" placeholder="職務内容や採用背景など"></textarea>
            </div>
            <div class="form-group">
                <label>必須スキル・経験</label>
                <textarea name="requirements" placeholder="改行で区切ってください"></textarea>
            </div>
        </form>
    `;

    app.modal.create('新規求人を作成', content, {
        buttons: [
            { label: 'キャンセル', class: 'btn-secondary', action: 'close' },
            { label: '作成', class: 'btn-primary', action: 'submit' }
        ],
        onSubmit: async (modalElement) => {
            const form = modalElement.querySelector('#job-form');
            const errors = app.FormValidator.validate(form);

            if (Object.keys(errors).length > 0) {
                app.FormValidator.displayErrors(form, errors);
                return;
            }

            const formData = new FormData(form);
            const data = Object.fromEntries(formData);
            data.status = 'draft';

            try {
                await app.api.post('/jobs', data);
                app.toast.success('求人を作成しました');
                app.modal.closeAll();
                loadJobs();
            } catch (error) {
                app.toast.error('求人の作成に失敗しました');
            }
        }
    });
}

function editJob(jobId) {
    const job = jobsState.jobs.find(j => j.id === jobId);
    if (!job) return;

    const content = `
        <form id="job-form">
            <div class="form-group">
                <label>求人名</label>
                <input type="text" name="title" value="${app.escapeHtml(job.title)}" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>部門</label>
                    <select name="department">
                        <option value="engineering" ${job.department === 'engineering' ? 'selected' : ''}>エンジニア</option>
                        <option value="sales" ${job.department === 'sales' ? 'selected' : ''}>営業</option>
                        <option value="marketing" ${job.department === 'marketing' ? 'selected' : ''}>マーケティング</option>
                        <option value="operations" ${job.department === 'operations' ? 'selected' : ''}>オペレーション</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>ステータス</label>
                    <select name="status">
                        <option value="draft" ${job.status === 'draft' ? 'selected' : ''}>下書き</option>
                        <option value="open" ${job.status === 'open' ? 'selected' : ''}>募集中</option>
                        <option value="closed" ${job.status === 'closed' ? 'selected' : ''}>募集終了</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>説明</label>
                <textarea name="description">${app.escapeHtml(job.description)}</textarea>
            </div>
        </form>
    `;

    app.modal.create('求人を編集', content, {
        buttons: [
            { label: 'キャンセル', class: 'btn-secondary', action: 'close' },
            { label: '保存', class: 'btn-primary', action: 'submit' }
        ],
        onSubmit: async (modalElement) => {
            const form = modalElement.querySelector('#job-form');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            try {
                await app.api.put(`/jobs/${jobId}`, data);
                app.toast.success('求人を更新しました');
                app.modal.closeAll();
                loadJobs();
            } catch (error) {
                app.toast.error('求人の更新に失敗しました');
            }
        }
    });
}

function viewJobDetails(jobId) {
    const job = jobsState.jobs.find(j => j.id === jobId);
    if (!job) return;

    const content = `
        <div style="margin-bottom: 1.5rem;">
            <h3 style="margin-bottom: 0.5rem;">${app.escapeHtml(job.title)}</h3>
            <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                <span class="badge ${getJobStatusBadge(job.status)}">${getJobStatusLabel(job.status)}</span>
                <span style="color: var(--gray-500); font-size: 0.875rem;">応募数: ${job.applicationCount || 0}</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; font-size: 0.875rem;">
                <div>
                    <div style="color: var(--gray-500);">部門</div>
                    <div style="font-weight: 500;">${job.department}</div>
                </div>
                <div>
                    <div style="color: var(--gray-500);">雇用形態</div>
                    <div style="font-weight: 500;">${job.type === 'full-time' ? '正社員' : job.type === 'part-time' ? 'パートタイム' : 'インターン'}</div>
                </div>
                <div>
                    <div style="color: var(--gray-500);">給与</div>
                    <div style="font-weight: 500;">${job.salaryMin ? `¥${job.salaryMin.toLocaleString()}〜¥${job.salaryMax?.toLocaleString()}` : '-'}</div>
                </div>
                <div>
                    <div style="color: var(--gray-500);">勤務地</div>
                    <div style="font-weight: 500;">${job.location || '-'}</div>
                </div>
            </div>
            <div style="border-top: 1px solid var(--gray-200); padding-top: 1rem;">
                <h4 style="margin-bottom: 0.5rem;">職務内容</h4>
                <p style="color: var(--gray-600); font-size: 0.875rem; white-space: pre-wrap;">${app.escapeHtml(job.description)}</p>
            </div>
            <div style="margin-top: 1rem;">
                <h4 style="margin-bottom: 0.5rem;">必須スキル・経験</h4>
                <p style="color: var(--gray-600); font-size: 0.875rem; white-space: pre-wrap;">${app.escapeHtml(job.requirements)}</p>
            </div>
        </div>
    `;

    app.modal.create(job.title, content, {
        buttons: [
            { label: '編集', class: 'btn-primary', action: 'edit' },
            { label: '閉じる', class: 'btn-secondary', action: 'close' }
        ],
        callbacks: {
            edit: () => {
                app.modal.closeAll();
                editJob(jobId);
            }
        }
    });
}

// Helper: Escape HTML
if (!app.escapeHtml) {
    app.escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
}

// Register route
app.router.register('jobs', loadJobs);
