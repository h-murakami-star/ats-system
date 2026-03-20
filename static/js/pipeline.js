/* ========================================
   Selection Pipeline - Kanban Board
   ======================================== */

let pipelineState = {
    applications: [],
    jobs: [],
    selectedJob: null
};

const pipelineStages = [
    { id: 'new', label: '応募', color: 'blue' },
    { id: 'screening', label: '書類選考', color: 'yellow' },
    { id: 'interview-1', label: '一次面接', color: 'purple' },
    { id: 'interview-2', label: '二次面接', color: 'purple' },
    { id: 'interview-final', label: '最終面接', color: 'purple' },
    { id: 'offer', label: '内定', color: 'green' },
    { id: 'hired', label: '採用', color: 'emerald' }
];

async function loadPipeline() {
    const container = document.getElementById('page-container');

    container.innerHTML = `
        <div class="pipeline-container">
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h1>選考パイプライン</h1>
                <div>
                    <select id="filter-job-pipeline" class="form-control" style="width: 250px; display: inline-block;">
                        <option value="">全求人を表示</option>
                    </select>
                </div>
            </div>

            <div id="pipeline-board" class="pipeline-board">
                <!-- Columns will be rendered here -->
            </div>
        </div>
    `;

    // Load data
    try {
        const [apps, jobs] = await Promise.all([
            app.api.get('/pipeline'),
            app.api.get('/jobs')
        ]);

        pipelineState.applications = apps.data || [];
        pipelineState.jobs = jobs.data || [];

        // Populate job filter
        const jobFilter = document.getElementById('filter-job-pipeline');
        pipelineState.jobs.forEach(job => {
            const option = document.createElement('option');
            option.value = job.id;
            option.textContent = job.title;
            jobFilter.appendChild(option);
        });

        jobFilter.addEventListener('change', (e) => {
            pipelineState.selectedJob = e.target.value || null;
            renderPipelineBoard();
        });

        renderPipelineBoard();
    } catch (error) {
        console.error('Pipeline load error:', error);
        app.toast.error('パイプラインの読み込みに失敗しました');
    }
}

function renderPipelineBoard() {
    const board = document.getElementById('pipeline-board');
    board.innerHTML = '';

    // Filter applications by selected job
    let applications = pipelineState.applications;
    if (pipelineState.selectedJob) {
        applications = applications.filter(a => a.jobId === pipelineState.selectedJob);
    }

    // Group applications by stage
    const grouped = {};
    pipelineStages.forEach(stage => {
        grouped[stage.id] = [];
    });

    applications.forEach(app => {
        if (grouped[app.status]) {
            grouped[app.status].push(app);
        }
    });

    // Render columns
    pipelineStages.forEach(stage => {
        const column = document.createElement('div');
        column.className = 'pipeline-column';
        column.id = `stage-${stage.id}`;

        const apps = grouped[stage.id] || [];

        column.innerHTML = `
            <div class="column-header">
                <div class="column-title">
                    <span>${stage.label}</span>
                </div>
                <div class="column-count">${apps.length}</div>
            </div>
            <div class="pipeline-cards" data-stage="${stage.id}">
                ${renderPipelineCards(apps)}
            </div>
        `;

        board.appendChild(column);

        // Attach drag and drop handlers
        const cardsContainer = column.querySelector('.pipeline-cards');
        cardsContainer.addEventListener('dragover', handleDragOver);
        cardsContainer.addEventListener('drop', (e) => handleDrop(e, stage.id));
    });
}

function renderPipelineCards(apps) {
    if (apps.length === 0) {
        return '<div style="text-align: center; padding: 2rem; color: var(--gray-400); font-size: 0.875rem;">候補者がいません</div>';
    }

    return apps.map(app => `
        <div class="candidate-card" draggable="true" data-app-id="${app.id}" data-status="${app.status}">
            <div class="card-avatar">${app.candidateInitials}</div>
            <div class="card-name">${app.candidateName}</div>
            <div class="card-position">${app.jobTitle}</div>
            <div class="card-meta">
                <span>
                    ${app.daysInStage || 0}日
                </span>
                <span onclick="event.stopPropagation(); editApplicationStatus('${app.id}');" style="color: var(--primary); cursor: pointer;">
                    ⋮
                </span>
            </div>
        </div>
    `).join('');
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.style.backgroundColor = 'rgba(79, 70, 229, 0.05)';
}

function handleDrop(e, targetStage) {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = '';

    const appId = e.dataTransfer.getData('application-id');
    if (!appId) return;

    updateApplicationStatus(appId, targetStage);
}

function setupCardDragListeners() {
    document.querySelectorAll('.candidate-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application-id', card.dataset.appId);
        });

        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('card-meta')) return;
            viewApplicationDetails(card.dataset.appId);
        });
    });
}

function editApplicationStatus(appId) {
    const app = pipelineState.applications.find(a => a.id === appId);
    if (!app) return;

    const content = `
        <form id="status-form">
            <div class="form-group">
                <label>ステータス</label>
                <select name="status" required>
                    ${pipelineStages.map(stage => `
                        <option value="${stage.id}" ${app.status === stage.id ? 'selected' : ''}>
                            ${stage.label}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>コメント</label>
                <textarea name="notes" placeholder="進捗についてのメモ"></textarea>
            </div>
        </form>
    `;

    app.modal.create('ステータスを更新', content, {
        buttons: [
            { label: 'キャンセル', class: 'btn-secondary', action: 'close' },
            { label: '更新', class: 'btn-primary', action: 'submit' }
        ],
        onSubmit: async (modalElement) => {
            const form = modalElement.querySelector('#status-form');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            try {
                await app.api.put(`/applications/${appId}`, data);
                app.toast.success('ステータスを更新しました');
                app.modal.closeAll();
                loadPipeline();
            } catch (error) {
                app.toast.error('ステータスの更新に失敗しました');
            }
        }
    });
}

async function updateApplicationStatus(appId, newStatus) {
    try {
        await app.api.put(`/applications/${appId}`, { status: newStatus });
        app.toast.success('ステータスを更新しました');
        loadPipeline();
    } catch (error) {
        app.toast.error('ステータスの更新に失敗しました');
    }
}

function viewApplicationDetails(appId) {
    const application = pipelineState.applications.find(a => a.id === appId);
    if (!application) return;

    const content = `
        <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card-avatar" style="width: 48px; height: 48px; font-size: 1.5rem;">
                    ${application.candidateInitials}
                </div>
                <div>
                    <h3 style="margin: 0 0 0.25rem 0;">${application.candidateName}</h3>
                    <div style="font-size: 0.875rem; color: var(--gray-500);">${application.jobTitle}</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; font-size: 0.875rem; padding-bottom: 1rem; border-bottom: 1px solid var(--gray-200);">
                <div>
                    <div style="color: var(--gray-500);">ステータス</div>
                    <div style="font-weight: 500;">
                        <span class="badge ${getStageColor(application.status)}">
                            ${getStageLabelFromId(application.status)}
                        </span>
                    </div>
                </div>
                <div>
                    <div style="color: var(--gray-500);">ステージ内の期間</div>
                    <div style="font-weight: 500;">${application.daysInStage || 0}日</div>
                </div>
                <div>
                    <div style="color: var(--gray-500);">応募日</div>
                    <div style="font-weight: 500;">${app.DateFormatter.formatDate(application.appliedAt)}</div>
                </div>
                <div>
                    <div style="color: var(--gray-500);">メール</div>
                    <div style="font-weight: 500;">
                        <a href="mailto:${application.candidateEmail}" style="color: var(--primary); text-decoration: none;">
                            ${application.candidateEmail}
                        </a>
                    </div>
                </div>
            </div>

            <div id="application-notes" style="margin-top: 1rem;">
                <h4 style="margin-bottom: 0.5rem;">コメント</h4>
                <p style="color: var(--gray-600); font-size: 0.875rem;">${application.notes || 'コメントなし'}</p>
            </div>
        </div>
    `;

    app.modal.create('応募詳細', content, {
        buttons: [
            { label: 'ステータス変更', class: 'btn-primary', action: 'edit' },
            { label: '閉じる', class: 'btn-secondary', action: 'close' }
        ],
        callbacks: {
            edit: () => {
                app.modal.closeAll();
                editApplicationStatus(appId);
            }
        }
    });
}

function getStageColor(status) {
    const stage = pipelineStages.find(s => s.id === status);
    if (stage) {
        return `status-${stage.color}` || 'badge-gray';
    }
    return 'badge-gray';
}

function getStageLabelFromId(statusId) {
    const stage = pipelineStages.find(s => s.id === statusId);
    return stage ? stage.label : statusId;
}

// Register route
app.router.register('pipeline', loadPipeline);
