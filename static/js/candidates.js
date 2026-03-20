/* ========================================
   Candidates Management Page
   ======================================== */

let candidatesState = {
    candidates: [],
    filteredCandidates: [],
    filters: {
        search: '',
        source: '',
        status: ''
    }
};

async function loadCandidates() {
    const container = document.getElementById('page-container');

    container.innerHTML = `
        <div class="candidates-container">
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h1>候補者管理</h1>
                <button class="btn btn-primary" id="new-candidate-btn">
                    ➕ 新規候補者
                </button>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2>候補者一覧</h2>
                </div>

                <!-- Filters -->
                <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--gray-200); background-color: var(--gray-50);">
                    <div class="form-row">
                        <input type="text" id="search-candidates" placeholder="名前またはメールで検索..." class="form-control">
                        <select id="filter-source" class="form-control">
                            <option value="">全ソース</option>
                            <option value="direct">ダイレクト</option>
                            <option value="indeed">Indeed</option>
                            <option value="linkedin">LinkedIn</option>
                            <option value="referral">紹介</option>
                        </select>
                        <select id="filter-status" class="form-control">
                            <option value="">全ステータス</option>
                            <option value="new">新規</option>
                            <option value="screening">書類選考</option>
                            <option value="interview">面接中</option>
                            <option value="offer">内定</option>
                            <option value="rejected">不採用</option>
                        </select>
                    </div>
                </div>

                <div class="card-body">
                    <div id="candidates-list" class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>候補者</th>
                                    <th>メール</th>
                                    <th>電話</th>
                                    <th>ソース</th>
                                    <th>ステータス</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody id="candidates-tbody">
                                <tr><td colspan="6" style="text-align: center; padding: 2rem;">読み込み中...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Attach event listeners
    document.getElementById('new-candidate-btn').addEventListener('click', showNewCandidateModal);
    document.getElementById('search-candidates').addEventListener('input', (e) => {
        candidatesState.filters.search = e.target.value;
        filterAndRenderCandidates();
    });
    document.getElementById('filter-source').addEventListener('change', (e) => {
        candidatesState.filters.source = e.target.value;
        filterAndRenderCandidates();
    });
    document.getElementById('filter-status').addEventListener('change', (e) => {
        candidatesState.filters.status = e.target.value;
        filterAndRenderCandidates();
    });

    // Load candidates
    try {
        const response = await app.api.get('/candidates');
        candidatesState.candidates = response.data || [];
        filterAndRenderCandidates();
    } catch (error) {
        console.error('Candidates load error:', error);
        app.toast.error('候補者の読み込みに失敗しました');
        document.getElementById('candidates-tbody').innerHTML = `
            <tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--gray-500);">
                エラーが発生しました
            </td></tr>
        `;
    }
}

function filterAndRenderCandidates() {
    let filtered = candidatesState.candidates;

    if (candidatesState.filters.search) {
        const q = candidatesState.filters.search.toLowerCase();
        filtered = filtered.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.email && c.email.toLowerCase().includes(q))
        );
    }

    if (candidatesState.filters.source) {
        filtered = filtered.filter(c => c.source === candidatesState.filters.source);
    }

    if (candidatesState.filters.status) {
        filtered = filtered.filter(c => c.status === candidatesState.filters.status);
    }

    candidatesState.filteredCandidates = filtered;
    renderCandidatesTable(filtered);
}

function renderCandidatesTable(candidates) {
    const tbody = document.getElementById('candidates-tbody');

    if (candidates.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem;">
                    <div class="empty-state">
                        <div class="empty-state-icon">👥</div>
                        <div class="empty-state-text">候補者がありません</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const html = candidates.map(candidate => `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div class="card-avatar" style="width: 32px; height: 32px; font-size: 0.875rem;">
                        ${app.getInitials(candidate.name)}
                    </div>
                    <strong>${app.escapeHtml(candidate.name)}</strong>
                </div>
            </td>
            <td>
                <a href="mailto:${candidate.email}" style="color: var(--primary); text-decoration: none;">
                    ${candidate.email}
                </a>
            </td>
            <td>${candidate.phone || '-'}</td>
            <td>${getCandidateSourceLabel(candidate.source)}</td>
            <td>
                <span class="badge ${app.getStatusBadge(candidate.status)}">
                    ${getCandidateStatusLabel(candidate.status)}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="editCandidate('${candidate.id}')">編集</button>
                <button class="btn btn-sm btn-outline" onclick="viewCandidateDetails('${candidate.id}')">詳細</button>
            </td>
        </tr>
    `).join('');

    tbody.innerHTML = html;
}

function getCandidateSourceLabel(source) {
    const map = {
        'direct': 'ダイレクト',
        'indeed': 'Indeed',
        'linkedin': 'LinkedIn',
        'referral': '紹介'
    };
    return map[source] || source;
}

function getCandidateStatusLabel(status) {
    const map = {
        'new': '新規',
        'screening': '書類選考',
        'interview': '面接中',
        'offer': '内定',
        'rejected': '不採用'
    };
    return map[status] || status;
}

function showNewCandidateModal() {
    const content = `
        <form id="candidate-form">
            <div class="form-row">
                <div class="form-group">
                    <label>名前 <span class="required">*</span></label>
                    <input type="text" name="name" required placeholder="例：田中太郎">
                </div>
                <div class="form-group">
                    <label>メール <span class="required">*</span></label>
                    <input type="email" name="email" required placeholder="例：tanaka@example.com">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>電話番号</label>
                    <input type="tel" name="phone" placeholder="例：090-1234-5678">
                </div>
                <div class="form-group">
                    <label>ソース <span class="required">*</span></label>
                    <select name="source" required>
                        <option value="">選択してください</option>
                        <option value="direct">ダイレクト</option>
                        <option value="indeed">Indeed</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="referral">紹介</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>現在の職務</label>
                <input type="text" name="currentPosition" placeholder="例：シニアエンジニア">
            </div>
            <div class="form-group">
                <label>プロフィール</label>
                <textarea name="profile" placeholder="スキル、経歴、志望動機など"></textarea>
            </div>
        </form>
    `;

    app.modal.create('新規候補者を追加', content, {
        buttons: [
            { label: 'キャンセル', class: 'btn-secondary', action: 'close' },
            { label: '追加', class: 'btn-primary', action: 'submit' }
        ],
        onSubmit: async (modalElement) => {
            const form = modalElement.querySelector('#candidate-form');
            const errors = app.FormValidator.validate(form);

            if (Object.keys(errors).length > 0) {
                app.FormValidator.displayErrors(form, errors);
                return;
            }

            const formData = new FormData(form);
            const data = Object.fromEntries(formData);
            data.status = 'new';

            try {
                await app.api.post('/candidates', data);
                app.toast.success('候補者を追加しました');
                app.modal.closeAll();
                loadCandidates();
            } catch (error) {
                app.toast.error('候補者の追加に失敗しました');
            }
        }
    });
}

function editCandidate(candidateId) {
    const candidate = candidatesState.candidates.find(c => c.id === candidateId);
    if (!candidate) return;

    const content = `
        <form id="candidate-form">
            <div class="form-row">
                <div class="form-group">
                    <label>名前</label>
                    <input type="text" name="name" value="${app.escapeHtml(candidate.name)}" required>
                </div>
                <div class="form-group">
                    <label>メール</label>
                    <input type="email" name="email" value="${app.escapeHtml(candidate.email)}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>電話番号</label>
                    <input type="tel" name="phone" value="${candidate.phone || ''}">
                </div>
                <div class="form-group">
                    <label>ステータス</label>
                    <select name="status">
                        <option value="new" ${candidate.status === 'new' ? 'selected' : ''}>新規</option>
                        <option value="screening" ${candidate.status === 'screening' ? 'selected' : ''}>書類選考</option>
                        <option value="interview" ${candidate.status === 'interview' ? 'selected' : ''}>面接中</option>
                        <option value="offer" ${candidate.status === 'offer' ? 'selected' : ''}>内定</option>
                        <option value="rejected" ${candidate.status === 'rejected' ? 'selected' : ''}>不採用</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>現在の職務</label>
                <input type="text" name="currentPosition" value="${app.escapeHtml(candidate.currentPosition || '')}">
            </div>
        </form>
    `;

    app.modal.create('候補者を編集', content, {
        buttons: [
            { label: 'キャンセル', class: 'btn-secondary', action: 'close' },
            { label: '保存', class: 'btn-primary', action: 'submit' }
        ],
        onSubmit: async (modalElement) => {
            const form = modalElement.querySelector('#candidate-form');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            try {
                await app.api.put(`/candidates/${candidateId}`, data);
                app.toast.success('候補者を更新しました');
                app.modal.closeAll();
                loadCandidates();
            } catch (error) {
                app.toast.error('候補者の更新に失敗しました');
            }
        }
    });
}

function viewCandidateDetails(candidateId) {
    const candidate = candidatesState.candidates.find(c => c.id === candidateId);
    if (!candidate) return;

    const content = `
        <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card-avatar" style="width: 48px; height: 48px; font-size: 1.5rem;">
                    ${app.getInitials(candidate.name)}
                </div>
                <div>
                    <h3 style="margin: 0 0 0.25rem 0;">${app.escapeHtml(candidate.name)}</h3>
                    <span class="badge ${app.getStatusBadge(candidate.status)}">
                        ${getCandidateStatusLabel(candidate.status)}
                    </span>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; font-size: 0.875rem;">
                <div>
                    <div style="color: var(--gray-500);">メール</div>
                    <div style="font-weight: 500;">
                        <a href="mailto:${candidate.email}" style="color: var(--primary); text-decoration: none;">
                            ${candidate.email}
                        </a>
                    </div>
                </div>
                <div>
                    <div style="color: var(--gray-500);">電話</div>
                    <div style="font-weight: 500;">${candidate.phone || '-'}</div>
                </div>
                <div>
                    <div style="color: var(--gray-500);">ソース</div>
                    <div style="font-weight: 500;">${getCandidateSourceLabel(candidate.source)}</div>
                </div>
                <div>
                    <div style="color: var(--gray-500);">職務</div>
                    <div style="font-weight: 500;">${candidate.currentPosition || '-'}</div>
                </div>
            </div>

            <div style="border-top: 1px solid var(--gray-200); padding-top: 1rem;">
                <h4 style="margin-bottom: 0.5rem;">プロフィール</h4>
                <p style="color: var(--gray-600); font-size: 0.875rem; white-space: pre-wrap;">
                    ${app.escapeHtml(candidate.profile || 'プロフィール情報なし')}
                </p>
            </div>

            <div style="margin-top: 1rem; border-top: 1px solid var(--gray-200); padding-top: 1rem;">
                <h4 style="margin-bottom: 1rem;">応募履歴</h4>
                <div id="applications-timeline" style="font-size: 0.875rem;">
                    <div style="color: var(--gray-500); text-align: center; padding: 1rem;">
                        読み込み中...
                    </div>
                </div>
            </div>
        </div>
    `;

    app.modal.create(candidate.name, content, {
        buttons: [
            { label: '編集', class: 'btn-primary', action: 'edit' },
            { label: '閉じる', class: 'btn-secondary', action: 'close' }
        ],
        callbacks: {
            edit: () => {
                app.modal.closeAll();
                editCandidate(candidateId);
            }
        }
    });

    // Load applications
    loadCandidateApplications(candidateId);
}

async function loadCandidateApplications(candidateId) {
    try {
        const response = await app.api.get(`/candidates/${candidateId}/applications`);
        const applications = response.data || [];
        const container = document.querySelector('#applications-timeline');

        if (applications.length === 0) {
            container.innerHTML = '<div style="color: var(--gray-500); text-align: center;">応募がありません</div>';
            return;
        }

        const html = applications.map(app => `
            <div style="padding: 0.75rem; border-left: 2px solid var(--primary); margin-bottom: 0.75rem; padding-left: 1rem;">
                <div style="font-weight: 500; color: var(--gray-900);">${app.jobTitle}</div>
                <div style="color: var(--gray-500);">${app.DateFormatter.formatDate(app.appliedAt)}</div>
                <div style="margin-top: 0.25rem;">
                    <span class="badge ${app.getStatusBadge(app.status)}" style="font-size: 0.75rem;">
                        ${getCandidateStatusLabel(app.status)}
                    </span>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    } catch (error) {
        console.error('Load applications error:', error);
    }
}

// Register route
app.router.register('candidates', loadCandidates);
