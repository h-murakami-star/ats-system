/* ========================================
   Evaluation Sheets Page
   ======================================== */

let evaluationsState = {
    evaluations: [],
    candidates: [],
    selectedCandidate: null
};

const evaluationCriteria = [
    { id: 'technical', label: '技術力', description: 'スキルと専門知識' },
    { id: 'communication', label: 'コミュニケーション', description: '対話能力と表現力' },
    { id: 'culture', label: 'カルチャーフィット', description: '企業文化との適合度' },
    { id: 'motivation', label: 'モチベーション', description: '熱意と成長意欲' }
];

async function loadEvaluations() {
    const container = document.getElementById('page-container');

    container.innerHTML = `
        <div class="evaluations-container">
            <div class="page-header">
                <h1>評価シート</h1>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem;">
                <!-- Candidate List -->
                <div class="card">
                    <div class="card-header">
                        <h2>候補者一覧</h2>
                    </div>
                    <div class="card-body">
                        <div id="candidates-list" style="max-height: 600px; overflow-y: auto;">
                            <div style="text-align: center; color: var(--gray-500); padding: 1rem;">
                                読み込み中...
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Evaluation Form -->
                <div class="card">
                    <div class="card-header">
                        <h2 id="evaluation-title">評価シートを選択してください</h2>
                    </div>
                    <div class="card-body" id="evaluation-form-container">
                        <div class="empty-state">
                            <div class="empty-state-icon">⭐</div>
                            <div class="empty-state-text">左から候補者を選択してください</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Load data
    try {
        const [evals, cands] = await Promise.all([
            app.api.get('/evaluations'),
            app.api.get('/candidates')
        ]);

        evaluationsState.evaluations = evals.data || [];
        evaluationsState.candidates = cands.data || [];

        renderCandidatesList();
    } catch (error) {
        console.error('Evaluations load error:', error);
        app.toast.error('評価データの読み込みに失敗しました');
    }
}

function renderCandidatesList() {
    const container = document.getElementById('candidates-list');

    if (evaluationsState.candidates.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <div class="empty-state-text">候補者がありません</div>
            </div>
        `;
        return;
    }

    const html = evaluationsState.candidates.map(candidate => {
        const eval = evaluationsState.evaluations.find(e => e.candidateId === candidate.id);
        return `
            <div style="padding: 0.75rem; border-bottom: 1px solid var(--gray-100); cursor: pointer; border-radius: 0.5rem; transition: background-color 0.2s;"
                 onmouseover="this.style.backgroundColor='var(--gray-50)'" onmouseout="this.style.backgroundColor=''"
                 onclick="selectCandidateForEvaluation('${candidate.id}')">
                <div style="font-weight: 500; color: var(--gray-900);">${candidate.name}</div>
                <div style="font-size: 0.875rem; color: var(--gray-500);">${candidate.currentPosition || '-'}</div>
                ${eval ? `
                    <div style="font-size: 0.875rem; color: var(--primary); margin-top: 0.25rem;">
                        ⭐ 平均: ${eval.averageScore || '-'} / 5
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function selectCandidateForEvaluation(candidateId) {
    evaluationsState.selectedCandidate = candidateId;
    const candidate = evaluationsState.candidates.find(c => c.id === candidateId);
    const evaluation = evaluationsState.evaluations.find(e => e.candidateId === candidateId) || {};

    document.getElementById('evaluation-title').textContent = `${candidate.name} の評価`;
    renderEvaluationForm(candidate, evaluation);
}

function renderEvaluationForm(candidate, evaluation) {
    const container = document.getElementById('evaluation-form-container');

    let html = `
        <form id="evaluation-form">
            <div style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--gray-200);">
                <div style="font-size: 0.875rem; color: var(--gray-500);">候補者情報</div>
                <div style="font-weight: 500; margin: 0.25rem 0;">${candidate.name}</div>
                <div style="font-size: 0.875rem; color: var(--gray-500);">${candidate.currentPosition || '-'}</div>
            </div>
    `;

    // Evaluation criteria
    evaluationCriteria.forEach(criteria => {
        const score = evaluation.scores?.[criteria.id] || 0;
        html += `
            <div class="form-group">
                <label>
                    ${criteria.label}
                    <span style="font-size: 0.875rem; color: var(--gray-500); margin-left: 0.5rem;">
                        (${criteria.description})
                    </span>
                </label>
                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
                    ${[1, 2, 3, 4, 5].map(star => `
                        <button type="button" class="star-btn" data-criteria="${criteria.id}" data-score="${star}"
                                style="background: none; border: none; font-size: 2rem; cursor: pointer; opacity: ${star <= score ? '1' : '0.3'};"
                                onclick="setScore('${criteria.id}', ${star})">
                            ⭐
                        </button>
                    `).join('')}
                </div>
                <div style="font-size: 0.875rem; color: var(--gray-500); text-align: right;">
                    スコア: <strong id="score-${criteria.id}">${score}</strong>/5
                </div>
            </div>
        `;
    });

    // Strengths and Weaknesses
    html += `
        <div class="form-group">
            <label>強み・適性</label>
            <textarea name="strengths" placeholder="この候補者の優れた点を記入してください">${evaluation.strengths || ''}</textarea>
        </div>

        <div class="form-group">
            <label>改善点・懸念事項</label>
            <textarea name="weaknesses" placeholder="改善が必要な点や懸念事項を記入してください">${evaluation.weaknesses || ''}</textarea>
        </div>

        <div class="form-group">
            <label>総合評価</label>
            <select name="recommendation">
                <option value="">選択してください</option>
                <option value="strong_yes" ${evaluation.recommendation === 'strong_yes' ? 'selected' : ''}>強く推奨 - 採用希望</option>
                <option value="yes" ${evaluation.recommendation === 'yes' ? 'selected' : ''}>推奨 - 採用可能</option>
                <option value="maybe" ${evaluation.recommendation === 'maybe' ? 'selected' : ''}>検討要 - 追加検討必要</option>
                <option value="no" ${evaluation.recommendation === 'no' ? 'selected' : ''}>非推奨 - 採用困難</option>
            </select>
        </div>

        <div class="form-group">
            <label>追記</label>
            <textarea name="comments" placeholder="その他のコメント">${evaluation.comments || ''}</textarea>
        </div>

        <div class="form-footer" style="display: flex; gap: 1rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--gray-200);">
            <button type="submit" class="btn btn-primary" style="flex: 1;">
                保存
            </button>
            ${evaluation.id ? `
                <button type="button" class="btn btn-outline" onclick="viewEvaluationHistory('${candidate.id}')">
                    履歴を表示
                </button>
            ` : ''}
        </div>
    `;

    container.innerHTML = html;

    // Attach form handler
    document.getElementById('evaluation-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveEvaluation(candidate.id, evaluation.id);
    });

    // Update score displays
    if (evaluation.scores) {
        Object.entries(evaluation.scores).forEach(([criteria, score]) => {
            const scoreEl = document.getElementById(`score-${criteria}`);
            if (scoreEl) {
                scoreEl.textContent = score;
            }
        });
    }
}

window.setScore = function(criteriaId, score) {
    const scoreEl = document.getElementById(`score-${criteriaId}`);
    if (scoreEl) {
        scoreEl.textContent = score;
    }

    // Update star buttons
    document.querySelectorAll(`[data-criteria="${criteriaId}"]`).forEach(btn => {
        const btnScore = parseInt(btn.dataset.score);
        btn.style.opacity = btnScore <= score ? '1' : '0.3';
    });

    // Store score in form data
    const form = document.getElementById('evaluation-form');
    if (!form.dataset.scores) {
        form.dataset.scores = '{}';
    }
    const scores = JSON.parse(form.dataset.scores);
    scores[criteriaId] = score;
    form.dataset.scores = JSON.stringify(scores);
};

async function saveEvaluation(candidateId, evaluationId) {
    const form = document.getElementById('evaluation-form');
    const formData = new FormData(form);

    const scores = JSON.parse(form.dataset.scores || '{}');
    const data = Object.fromEntries(formData);
    data.scores = scores;
    data.candidateId = candidateId;

    // Calculate average score
    const scoreValues = Object.values(scores).map(Number).filter(v => v > 0);
    if (scoreValues.length > 0) {
        data.averageScore = (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1);
    }

    try {
        const endpoint = evaluationId ? `/evaluations/${evaluationId}` : '/evaluations';
        const method = evaluationId ? 'put' : 'post';

        await app.api[method](endpoint, data);
        app.toast.success('評価を保存しました');

        // Reload
        loadEvaluations();
    } catch (error) {
        app.toast.error('評価の保存に失敗しました');
    }
}

function viewEvaluationHistory(candidateId) {
    const candidate = evaluationsState.candidates.find(c => c.id === candidateId);
    const candidateEvals = evaluationsState.evaluations.filter(e => e.candidateId === candidateId);

    if (candidateEvals.length === 0) {
        app.toast.info('評価履歴がありません');
        return;
    }

    let html = `
        <div style="margin-bottom: 1rem;">
            <h3 style="margin-bottom: 1rem;">${candidate.name} の評価履歴</h3>
    `;

    candidateEvals.forEach((eval, idx) => {
        html += `
            <div style="padding: 1rem; background-color: var(--gray-50); border-radius: 0.5rem; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
                    <div style="font-weight: 500;">評価 ${idx + 1}</div>
                    <div style="font-size: 0.875rem; color: var(--gray-500);">
                        ${app.DateFormatter.formatDate(eval.createdAt)}
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem; font-size: 0.875rem;">
                    ${evaluationCriteria.map(criteria => {
                        const score = eval.scores?.[criteria.id] || 0;
                        return `
                            <div>
                                <div style="color: var(--gray-500);">${criteria.label}</div>
                                <div style="font-weight: 500;">
                                    ${'⭐'.repeat(score)}${'☆'.repeat(5-score)} (${score}/5)
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="font-size: 0.875rem; color: var(--gray-500);">
                    総合評価: ${getRecommendationLabel(eval.recommendation)}
                </div>
                ${eval.strengths ? `
                    <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--gray-200); font-size: 0.875rem;">
                        <div style="color: var(--gray-500);">強み</div>
                        <div>${app.escapeHtml(eval.strengths)}</div>
                    </div>
                ` : ''}
            </div>
        `;
    });

    html += '</div>';

    app.modal.create('評価履歴', html, {
        buttons: [
            { label: '閉じる', class: 'btn-secondary', action: 'close' }
        ]
    });
}

function getRecommendationLabel(value) {
    const map = {
        'strong_yes': '強く推奨',
        'yes': '推奨',
        'maybe': '検討要',
        'no': '非推奨'
    };
    return map[value] || '-';
}

if (!app.escapeHtml) {
    app.escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
}

// Register route
app.router.register('evaluations', loadEvaluations);
