/* ========================================
   Settings Page
   ======================================== */

let settingsState = {
    departments: [],
    stages: [],
    systemInfo: null
};

async function loadSettings() {
    const container = document.getElementById('page-container');

    container.innerHTML = `
        <div class="settings-container">
            <div class="page-header">
                <h1>設定</h1>
            </div>

            <div style="display: grid; grid-template-columns: 250px 1fr; gap: 2rem;">
                <!-- Settings Menu -->
                <div class="card" style="height: fit-content;">
                    <div class="card-body" style="padding: 0;">
                        <button class="settings-menu-item active" data-section="departments">
                            部門管理
                        </button>
                        <button class="settings-menu-item" data-section="stages">
                            選考ステージ
                        </button>
                        <button class="settings-menu-item" data-section="system">
                            システム情報
                        </button>
                    </div>
                </div>

                <!-- Settings Content -->
                <div id="settings-content">
                    <div class="card" id="departments-section">
                        <div class="card-header">
                            <h2>部門管理</h2>
                        </div>
                        <div class="card-body">
                            <div id="departments-list" style="margin-bottom: 1.5rem;"></div>
                            <button class="btn btn-primary" id="add-department-btn">
                                ➕ 新規部門を追加
                            </button>
                        </div>
                    </div>

                    <div class="card" id="stages-section" style="display: none;">
                        <div class="card-header">
                            <h2>選考ステージのカスタマイズ</h2>
                            <p>採用プロセスのステージを定義します</p>
                        </div>
                        <div class="card-body">
                            <div id="stages-list" style="margin-bottom: 1.5rem;"></div>
                            <button class="btn btn-primary" id="add-stage-btn">
                                ➕ ステージを追加
                            </button>
                        </div>
                    </div>

                    <div class="card" id="system-section" style="display: none;">
                        <div class="card-header">
                            <h2>システム情報</h2>
                        </div>
                        <div class="card-body" id="system-info">
                            読み込み中...
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Attach menu handlers
    document.querySelectorAll('.settings-menu-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.settings-menu-item').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            const section = e.target.dataset.section;
            document.querySelectorAll('[id$="-section"]').forEach(el => el.style.display = 'none');
            document.getElementById(`${section}-section`).style.display = 'block';
        });
    });

    // Load settings data
    try {
        const [deptRes, stagesRes, sysRes] = await Promise.all([
            app.api.get('/settings/departments'),
            app.api.get('/settings/stages'),
            app.api.get('/settings/system')
        ]);

        settingsState.departments = deptRes.data || [];
        settingsState.stages = stagesRes.data || [];
        settingsState.systemInfo = sysRes;

        renderDepartments();
        renderStages();
        renderSystemInfo();

        // Attach event handlers
        document.getElementById('add-department-btn').addEventListener('click', showAddDepartmentModal);
        document.getElementById('add-stage-btn').addEventListener('click', showAddStageModal);
    } catch (error) {
        console.error('Settings load error:', error);
        app.toast.error('設定の読み込みに失敗しました');
    }
}

function renderDepartments() {
    const container = document.getElementById('departments-list');

    if (settingsState.departments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-text">部門がありません</div>
            </div>
        `;
        return;
    }

    const html = settingsState.departments.map(dept => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border: 1px solid var(--gray-200); border-radius: 0.5rem; margin-bottom: 0.75rem;">
            <div>
                <div style="font-weight: 500; color: var(--gray-900);">${dept.name}</div>
                <div style="font-size: 0.875rem; color: var(--gray-500);">${dept.description || ''}</div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-outline" onclick="editDepartment('${dept.id}')">編集</button>
                <button class="btn btn-sm btn-outline" onclick="deleteDepartment('${dept.id}')" style="color: var(--danger);">削除</button>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function renderStages() {
    const container = document.getElementById('stages-list');

    if (settingsState.stages.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔄</div>
                <div class="empty-state-text">ステージがありません</div>
            </div>
        `;
        return;
    }

    const html = settingsState.stages.map((stage, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background-color: var(--gray-50); border-radius: 0.5rem; margin-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                <div style="font-weight: 600; color: var(--gray-500); min-width: 30px;">
                    ${idx + 1}
                </div>
                <div>
                    <div style="font-weight: 500; color: var(--gray-900);">${stage.name}</div>
                    <div style="font-size: 0.875rem; color: var(--gray-500);">
                        期間目安: ${stage.expectedDays || '不定'} 日
                    </div>
                </div>
            </div>
            <button class="btn btn-sm btn-outline" onclick="editStage('${stage.id}')">編集</button>
        </div>
    `).join('');

    container.innerHTML = html;
}

function renderSystemInfo() {
    const container = document.getElementById('system-info');
    const info = settingsState.systemInfo;

    if (!info) {
        container.innerHTML = '<div style="color: var(--gray-500);">システム情報を取得できません</div>';
        return;
    }

    const html = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <div>
                <div style="font-size: 0.875rem; color: var(--gray-500); margin-bottom: 0.5rem;">システム名</div>
                <div style="font-weight: 500; color: var(--gray-900);">採用管理システム (ATS)</div>
            </div>
            <div>
                <div style="font-size: 0.875rem; color: var(--gray-500); margin-bottom: 0.5rem;">バージョン</div>
                <div style="font-weight: 500; color: var(--gray-900);">1.0.0</div>
            </div>
            <div>
                <div style="font-size: 0.875rem; color: var(--gray-500); margin-bottom: 0.5rem;">登録部門数</div>
                <div style="font-weight: 500; color: var(--gray-900);">${settingsState.departments.length}個</div>
            </div>
            <div>
                <div style="font-size: 0.875rem; color: var(--gray-500); margin-bottom: 0.5rem;">選考ステージ数</div>
                <div style="font-weight: 500; color: var(--gray-900);">${settingsState.stages.length}段階</div>
            </div>
            <div>
                <div style="font-size: 0.875rem; color: var(--gray-500); margin-bottom: 0.5rem;">データベース</div>
                <div style="font-weight: 500; color: var(--gray-900);">SQLite</div>
            </div>
            <div>
                <div style="font-size: 0.875rem; color: var(--gray-500); margin-bottom: 0.5rem;">最終更新</div>
                <div style="font-weight: 500; color: var(--gray-900);">${new Date().toLocaleDateString('ja-JP')}</div>
            </div>
        </div>

        <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--gray-200);">
            <h3 style="margin-bottom: 1rem; font-size: 1rem;">API エンドポイント</h3>
            <div style="background-color: var(--gray-50); padding: 1rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.875rem; color: var(--gray-600); line-height: 1.8;">
                GET /api/jobs<br>
                POST /api/jobs<br>
                GET /api/candidates<br>
                POST /api/candidates<br>
                GET /api/applications<br>
                PUT /api/applications/:id<br>
                GET /api/interviews<br>
                POST /api/interviews<br>
                GET /api/evaluations<br>
                POST /api/evaluations<br>
                GET /api/reports/summary<br>
                GET /api/reports/funnel
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function showAddDepartmentModal() {
    const content = `
        <form id="department-form">
            <div class="form-group">
                <label>部門名 <span class="required">*</span></label>
                <input type="text" name="name" required placeholder="例：エンジニア、営業など">
            </div>
            <div class="form-group">
                <label>説明</label>
                <textarea name="description" placeholder="この部門の説明"></textarea>
            </div>
        </form>
    `;

    app.modal.create('新規部門を追加', content, {
        buttons: [
            { label: 'キャンセル', class: 'btn-secondary', action: 'close' },
            { label: '追加', class: 'btn-primary', action: 'submit' }
        ],
        onSubmit: async (modalElement) => {
            const form = modalElement.querySelector('#department-form');
            const errors = app.FormValidator.validate(form);

            if (Object.keys(errors).length > 0) {
                app.FormValidator.displayErrors(form, errors);
                return;
            }

            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            try {
                await app.api.post('/settings/departments', data);
                app.toast.success('部門を追加しました');
                app.modal.closeAll();
                loadSettings();
            } catch (error) {
                app.toast.error('部門の追加に失敗しました');
            }
        }
    });
}

function editDepartment(deptId) {
    const dept = settingsState.departments.find(d => d.id === deptId);
    if (!dept) return;

    const content = `
        <form id="department-form">
            <div class="form-group">
                <label>部門名</label>
                <input type="text" name="name" value="${app.escapeHtml(dept.name)}" required>
            </div>
            <div class="form-group">
                <label>説明</label>
                <textarea name="description">${app.escapeHtml(dept.description || '')}</textarea>
            </div>
        </form>
    `;

    app.modal.create('部門を編集', content, {
        buttons: [
            { label: 'キャンセル', class: 'btn-secondary', action: 'close' },
            { label: '保存', class: 'btn-primary', action: 'submit' }
        ],
        onSubmit: async (modalElement) => {
            const form = modalElement.querySelector('#department-form');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            try {
                await app.api.put(`/settings/departments/${deptId}`, data);
                app.toast.success('部門を更新しました');
                app.modal.closeAll();
                loadSettings();
            } catch (error) {
                app.toast.error('部門の更新に失敗しました');
            }
        }
    });
}

async function deleteDepartment(deptId) {
    if (!confirm('この部門を削除しますか?')) return;

    try {
        await app.api.delete(`/settings/departments/${deptId}`);
        app.toast.success('部門を削除しました');
        loadSettings();
    } catch (error) {
        app.toast.error('部門の削除に失敗しました');
    }
}

function showAddStageModal() {
    const content = `
        <form id="stage-form">
            <div class="form-group">
                <label>ステージ名 <span class="required">*</span></label>
                <input type="text" name="name" required placeholder="例：書類選考、面接など">
            </div>
            <div class="form-group">
                <label>期間目安 (日数)</label>
                <input type="number" name="expectedDays" placeholder="このステージにかかる目安日数">
            </div>
            <div class="form-group">
                <label>説明</label>
                <textarea name="description" placeholder="このステージで実施する内容"></textarea>
            </div>
        </form>
    `;

    app.modal.create('ステージを追加', content, {
        buttons: [
            { label: 'キャンセル', class: 'btn-secondary', action: 'close' },
            { label: '追加', class: 'btn-primary', action: 'submit' }
        ],
        onSubmit: async (modalElement) => {
            const form = modalElement.querySelector('#stage-form');
            const errors = app.FormValidator.validate(form);

            if (Object.keys(errors).length > 0) {
                app.FormValidator.displayErrors(form, errors);
                return;
            }

            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            try {
                await app.api.post('/settings/stages', data);
                app.toast.success('ステージを追加しました');
                app.modal.closeAll();
                loadSettings();
            } catch (error) {
                app.toast.error('ステージの追加に失敗しました');
            }
        }
    });
}

function editStage(stageId) {
    const stage = settingsState.stages.find(s => s.id === stageId);
    if (!stage) return;

    const content = `
        <form id="stage-form">
            <div class="form-group">
                <label>ステージ名</label>
                <input type="text" name="name" value="${app.escapeHtml(stage.name)}" required>
            </div>
            <div class="form-group">
                <label>期間目安 (日数)</label>
                <input type="number" name="expectedDays" value="${stage.expectedDays || ''}">
            </div>
        </form>
    `;

    app.modal.create('ステージを編集', content, {
        buttons: [
            { label: 'キャンセル', class: 'btn-secondary', action: 'close' },
            { label: '保存', class: 'btn-primary', action: 'submit' }
        ],
        onSubmit: async (modalElement) => {
            const form = modalElement.querySelector('#stage-form');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            try {
                await app.api.put(`/settings/stages/${stageId}`, data);
                app.toast.success('ステージを更新しました');
                app.modal.closeAll();
                loadSettings();
            } catch (error) {
                app.toast.error('ステージの更新に失敗しました');
            }
        }
    });
}

// Styling for settings menu
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
        .settings-menu-item {
            width: 100%;
            padding: 0.75rem;
            border: none;
            background: none;
            text-align: left;
            cursor: pointer;
            color: var(--gray-600);
            font-family: var(--font-family);
            font-size: 0.875rem;
            transition: all var(--transition-fast);
            border-left: 3px solid transparent;
        }
        .settings-menu-item:hover {
            background-color: var(--gray-50);
            color: var(--gray-900);
        }
        .settings-menu-item.active {
            background-color: var(--primary);
            color: white;
            border-left-color: var(--primary);
        }
    `;
    document.head.appendChild(style);
});

if (!app.escapeHtml) {
    app.escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
}

// Register route
app.router.register('settings', loadSettings);
