/* ========================================
   Interview Management Page
   ======================================== */

let interviewsState = {
    interviews: [],
    filteredInterviews: [],
    filters: {
        view: 'upcoming',
        search: ''
    }
};

async function loadInterviews() {
    const container = document.getElementById('page-container');

    container.innerHTML = `
        <div class="interviews-container">
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h1>面接管理</h1>
                <button class="btn btn-primary" id="new-interview-btn">
                    ➕ 新規面接予約
                </button>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2>面接予定一覧</h2>
                </div>

                <!-- View Filters -->
                <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--gray-200); background-color: var(--gray-50);">
                    <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                        <button class="btn btn-sm" id="view-upcoming" style="background-color: var(--primary); color: white;">
                            今後の面接
                        </button>
                        <button class="btn btn-sm btn-outline" id="view-past">
                            過去の面接
                        </button>
                        <button class="btn btn-sm btn-outline" id="view-all">
                            すべて表示
                        </button>
                    </div>
                    <input type="text" id="search-interviews" placeholder="候補者名や職務で検索..." class="form-control" style="width: 300px;">
                </div>

                <div class="card-body">
                    <div id="interviews-list" class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>候補者</th>
                                    <th>職務</th>
                                    <th>面接種別</th>
                                    <th>日時</th>
                                    <th>面接官</th>
                                    <th>場所</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody id="interviews-tbody">
                                <tr><td colspan="7" style="text-align: center; padding: 2rem;">読み込み中...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Weekly Calendar View -->
            <div class="card" style="margin-top: 2rem;">
                <div class="card-header">
                    <h2>週間スケジュール</h2>
                </div>
                <div class="card-body">
                    <div id="weekly-calendar" style="overflow-x: auto;"></div>
                </div>
            </div>
        </div>
    `;

    // Attach event listeners
    document.getElementById('new-interview-btn').addEventListener('click', showNewInterviewModal);
    document.getElementById('view-upcoming').addEventListener('click', () => setViewFilter('upcoming'));
    document.getElementById('view-past').addEventListener('click', () => setViewFilter('past'));
    document.getElementById('view-all').addEventListener('click', () => setViewFilter('all'));
    document.getElementById('search-interviews').addEventListener('input', (e) => {
        interviewsState.filters.search = e.target.value;
        filterAndRenderInterviews();
    });

    // Load interviews
    try {
        const response = await app.api.get('/interviews');
        interviewsState.interviews = response.data || [];
        filterAndRenderInterviews();
        renderWeeklyCalendar();
    } catch (error) {
        console.error('Interviews load error:', error);
        app.toast.error('面接データの読み込みに失敗しました');
        document.getElementById('interviews-tbody').innerHTML = `
            <tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--gray-500);">
                エラーが発生しました
            </td></tr>
        `;
    }
}

function setViewFilter(view) {
    interviewsState.filters.view = view;

    // Update button states
    document.getElementById('view-upcoming').style.backgroundColor = view === 'upcoming' ? 'var(--primary)' : '';
    document.getElementById('view-upcoming').style.color = view === 'upcoming' ? 'white' : '';
    document.getElementById('view-past').classList.toggle('btn-outline', view !== 'past');
    document.getElementById('view-all').classList.toggle('btn-outline', view !== 'all');

    filterAndRenderInterviews();
}

function filterAndRenderInterviews() {
    let filtered = interviewsState.interviews;
    const now = new Date();

    // Apply view filter
    if (interviewsState.filters.view === 'upcoming') {
        filtered = filtered.filter(i => new Date(i.scheduledAt) >= now);
    } else if (interviewsState.filters.view === 'past') {
        filtered = filtered.filter(i => new Date(i.scheduledAt) < now);
    }

    // Apply search filter
    if (interviewsState.filters.search) {
        const q = interviewsState.filters.search.toLowerCase();
        filtered = filtered.filter(i =>
            i.candidateName.toLowerCase().includes(q) ||
            i.jobTitle.toLowerCase().includes(q)
        );
    }

    // Sort by date
    filtered.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

    interviewsState.filteredInterviews = filtered;
    renderInterviewsTable(filtered);
}

function renderInterviewsTable(interviews) {
    const tbody = document.getElementById('interviews-tbody');

    if (interviews.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem;">
                    <div class="empty-state">
                        <div class="empty-state-icon">🗓️</div>
                        <div class="empty-state-text">面接予定がありません</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const html = interviews.map(interview => {
        const isUpcoming = new Date(interview.scheduledAt) >= new Date();
        return `
            <tr>
                <td><strong>${interview.candidateName}</strong></td>
                <td>${interview.jobTitle}</td>
                <td>${getInterviewTypeLabel(interview.type)}</td>
                <td>
                    <div>${app.DateFormatter.formatDate(interview.scheduledAt)}</div>
                    <div style="font-size: 0.875rem; color: var(--gray-500);">${app.DateFormatter.formatTime(interview.scheduledAt)}</div>
                </td>
                <td>${interview.interviewerName || '-'}</td>
                <td>${interview.location || 'リモート'}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="viewInterviewDetails('${interview.id}')">詳細</button>
                    <button class="btn btn-sm btn-outline" onclick="editInterview('${interview.id}')">編集</button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;
}

function getInterviewTypeLabel(type) {
    const map = {
        'screening': '書類選考',
        'first': '一次面接',
        'second': '二次面接',
        'final': '最終面接',
        'informal': 'カジュアル面談'
    };
    return map[type] || type;
}

function renderWeeklyCalendar() {
    const container = document.getElementById('weekly-calendar');
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    let html = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background-color: var(--gray-50);">
    `;

    // Header with days
    for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(date.getDate() + i);
        const dayName = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
        html += `<th style="padding: 1rem; border: 1px solid var(--gray-200); text-align: center;">
            <div style="font-weight: 600;">${dayName}</div>
            <div style="font-size: 0.875rem; color: var(--gray-500);">${date.getDate()}日</div>
        </th>`;
    }

    html += `
                </tr>
            </thead>
            <tbody>
                <tr style="height: 150px;">
    `;

    // Calendar cells
    for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        const dayInterviews = interviewsState.interviews.filter(iv => {
            const ivDate = new Date(iv.scheduledAt).toISOString().split('T')[0];
            return ivDate === dateStr;
        });

        html += `<td style="border: 1px solid var(--gray-200); padding: 0.5rem; vertical-align: top; background-color: var(--gray-50);">
            <div style="font-size: 0.875rem;">
                ${dayInterviews.map(iv => `
                    <div style="background-color: var(--primary); color: white; padding: 0.25rem 0.5rem; margin-bottom: 0.25rem; border-radius: 3px; cursor: pointer; font-size: 0.75rem;"
                         onclick="viewInterviewDetails('${iv.id}')">
                        ${iv.candidateName}
                    </div>
                `).join('')}
            </div>
        </td>`;
    }

    html += `
                </tr>
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

function showNewInterviewModal() {
    const content = `
        <form id="interview-form">
            <div class="form-group">
                <label>候補者 <span class="required">*</span></label>
                <input type="text" name="candidateName" required placeholder="候補者名">
            </div>
            <div class="form-group">
                <label>職務 <span class="required">*</span></label>
                <input type="text" name="jobTitle" required placeholder="職務名">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>面接種別 <span class="required">*</span></label>
                    <select name="type" required>
                        <option value="">選択してください</option>
                        <option value="screening">書類選考</option>
                        <option value="first">一次面接</option>
                        <option value="second">二次面接</option>
                        <option value="final">最終面接</option>
                        <option value="informal">カジュアル面談</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>面接官</label>
                    <input type="text" name="interviewerName" placeholder="面接官名">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>日時 <span class="required">*</span></label>
                    <input type="datetime-local" name="scheduledAt" required>
                </div>
                <div class="form-group">
                    <label>場所/URL</label>
                    <input type="text" name="location" placeholder="例：会議室A / https://zoom.us/...">
                </div>
            </div>
            <div class="form-group">
                <label>メモ</label>
                <textarea name="notes" placeholder="特記事項など"></textarea>
            </div>
        </form>
    `;

    app.modal.create('新規面接予約', content, {
        buttons: [
            { label: 'キャンセル', class: 'btn-secondary', action: 'close' },
            { label: '予約', class: 'btn-primary', action: 'submit' }
        ],
        onSubmit: async (modalElement) => {
            const form = modalElement.querySelector('#interview-form');
            const errors = app.FormValidator.validate(form);

            if (Object.keys(errors).length > 0) {
                app.FormValidator.displayErrors(form, errors);
                return;
            }

            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            try {
                await app.api.post('/interviews', data);
                app.toast.success('面接を予約しました');
                app.modal.closeAll();
                loadInterviews();
            } catch (error) {
                app.toast.error('面接の予約に失敗しました');
            }
        }
    });
}

function editInterview(interviewId) {
    const interview = interviewsState.interviews.find(i => i.id === interviewId);
    if (!interview) return;

    const content = `
        <form id="interview-form">
            <div class="form-group">
                <label>面接種別</label>
                <select name="type">
                    <option value="screening" ${interview.type === 'screening' ? 'selected' : ''}>書類選考</option>
                    <option value="first" ${interview.type === 'first' ? 'selected' : ''}>一次面接</option>
                    <option value="second" ${interview.type === 'second' ? 'selected' : ''}>二次面接</option>
                    <option value="final" ${interview.type === 'final' ? 'selected' : ''}>最終面接</option>
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>日時</label>
                    <input type="datetime-local" name="scheduledAt" value="${formatDatetimeLocal(interview.scheduledAt)}">
                </div>
                <div class="form-group">
                    <label>場所/URL</label>
                    <input type="text" name="location" value="${interview.location || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>メモ</label>
                <textarea name="notes">${interview.notes || ''}</textarea>
            </div>
        </form>
    `;

    app.modal.create('面接を編集', content, {
        buttons: [
            { label: 'キャンセル', class: 'btn-secondary', action: 'close' },
            { label: '保存', class: 'btn-primary', action: 'submit' }
        ],
        onSubmit: async (modalElement) => {
            const form = modalElement.querySelector('#interview-form');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            try {
                await app.api.put(`/interviews/${interviewId}`, data);
                app.toast.success('面接を更新しました');
                app.modal.closeAll();
                loadInterviews();
            } catch (error) {
                app.toast.error('面接の更新に失敗しました');
            }
        }
    });
}

function viewInterviewDetails(interviewId) {
    const interview = interviewsState.interviews.find(i => i.id === interviewId);
    if (!interview) return;

    const content = `
        <div style="margin-bottom: 1.5rem;">
            <h3 style="margin-bottom: 1rem;">${interview.candidateName}</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; font-size: 0.875rem; padding-bottom: 1rem; border-bottom: 1px solid var(--gray-200);">
                <div>
                    <div style="color: var(--gray-500);">職務</div>
                    <div style="font-weight: 500;">${interview.jobTitle}</div>
                </div>
                <div>
                    <div style="color: var(--gray-500);">種別</div>
                    <div style="font-weight: 500;">${getInterviewTypeLabel(interview.type)}</div>
                </div>
                <div>
                    <div style="color: var(--gray-500);">日時</div>
                    <div style="font-weight: 500;">${app.DateFormatter.formatDateTime(interview.scheduledAt)}</div>
                </div>
                <div>
                    <div style="color: var(--gray-500);">場所</div>
                    <div style="font-weight: 500;">${interview.location || 'リモート'}</div>
                </div>
                <div>
                    <div style="color: var(--gray-500);">面接官</div>
                    <div style="font-weight: 500;">${interview.interviewerName || '-'}</div>
                </div>
            </div>
            ${interview.notes ? `
                <div style="margin-top: 1rem;">
                    <h4 style="margin-bottom: 0.5rem;">メモ</h4>
                    <p style="color: var(--gray-600); font-size: 0.875rem; white-space: pre-wrap;">${app.escapeHtml(interview.notes)}</p>
                </div>
            ` : ''}
        </div>
    `;

    app.modal.create('面接詳細', content, {
        buttons: [
            { label: '編集', class: 'btn-primary', action: 'edit' },
            { label: '評価を記入', class: 'btn-secondary', action: 'evaluate' },
            { label: '閉じる', class: 'btn-outline', action: 'close' }
        ],
        callbacks: {
            edit: () => {
                app.modal.closeAll();
                editInterview(interviewId);
            },
            evaluate: () => {
                app.toast.info('評価シートページから記入してください');
            }
        }
    });
}

function formatDatetimeLocal(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

if (!app.escapeHtml) {
    app.escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
}

// Register route
app.router.register('interviews', loadInterviews);
