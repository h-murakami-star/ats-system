/* ========================================
   App Core - Router, API, Utilities
   ======================================== */

// API Configuration
const API_BASE = '/api';

// Toast Notification System
class ToastNotifier {
    constructor() {
        this.container = document.getElementById('toast-container');
    }

    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <button class="toast-close">&times;</button>
            <div class="toast-content">${this.escapeHtml(message)}</div>
        `;

        this.container.appendChild(toast);

        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });

        if (duration > 0) {
            setTimeout(() => {
                toast.remove();
            }, duration);
        }

        return toast;
    }

    success(message, duration = 3000) {
        this.show(message, 'success', duration);
    }

    error(message, duration = 5000) {
        this.show(message, 'error', duration);
    }

    warning(message, duration = 4000) {
        this.show(message, 'warning', duration);
    }

    info(message, duration = 3000) {
        this.show(message, 'info', duration);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const toast = new ToastNotifier();

// Modal Dialog System
class ModalManager {
    constructor() {
        this.container = document.getElementById('modals-container');
        this.activeModal = null;
    }

    create(title, content, options = {}) {
        const modal = document.createElement('div');
        const modalId = `modal-${Date.now()}`;
        modal.id = modalId;

        const footerButtons = options.buttons || [
            { label: 'キャンセル', class: 'btn-secondary', action: 'close' },
            { label: '保存', class: 'btn-primary', action: 'submit' }
        ];

        const footerHtml = footerButtons.map(btn =>
            `<button class="btn ${btn.class}" data-action="${btn.action}">${btn.label}</button>`
        ).join('');

        modal.innerHTML = `
            <div class="modal-overlay" id="${modalId}-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h2 class="modal-title">${this.escapeHtml(title)}</h2>
                        <button class="modal-close" data-action="close">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    <div class="modal-footer">
                        ${footerHtml}
                    </div>
                </div>
            </div>
        `;

        this.container.appendChild(modal);
        const overlay = modal.querySelector(`#${modalId}-overlay`);

        // Event handlers
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.close(modalId);
            }
        });

        const buttons = modal.querySelectorAll('[data-action]');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.getAttribute('data-action');
                if (action === 'close') {
                    this.close(modalId);
                } else if (action === 'submit' && options.onSubmit) {
                    options.onSubmit(modal);
                } else if (options.callbacks && options.callbacks[action]) {
                    options.callbacks[action](modal);
                }
            });
        });

        // Trigger animation
        setTimeout(() => {
            overlay.classList.add('active');
        }, 10);

        this.activeModal = modalId;
        return modal;
    }

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            const overlay = modal.querySelector('.modal-overlay');
            overlay.classList.remove('active');
            setTimeout(() => {
                modal.remove();
                if (this.activeModal === modalId) {
                    this.activeModal = null;
                }
            }, 300);
        }
    }

    closeAll() {
        const overlays = this.container.querySelectorAll('.modal-overlay');
        overlays.forEach(overlay => {
            overlay.classList.remove('active');
        });
        setTimeout(() => {
            this.container.innerHTML = '';
            this.activeModal = null;
        }, 300);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const modal = new ModalManager();

// API Wrapper with Error Handling
class API {
    static async fetch(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const config = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP Error: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    static async get(endpoint) {
        return this.fetch(endpoint, { method: 'GET' });
    }

    static async post(endpoint, body) {
        return this.fetch(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    static async put(endpoint, body) {
        return this.fetch(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    static async delete(endpoint) {
        return this.fetch(endpoint, { method: 'DELETE' });
    }
}

// Date Formatting Helper
class DateFormatter {
    static formatDate(date) {
        if (!date) return '';
        if (typeof date === 'string') date = new Date(date);

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}年${month}月${day}日`;
    }

    static formatDateTime(date) {
        if (!date) return '';
        if (typeof date === 'string') date = new Date(date);

        const dateStr = this.formatDate(date);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${dateStr} ${hours}:${minutes}`;
    }

    static formatTime(date) {
        if (!date) return '';
        if (typeof date === 'string') date = new Date(date);

        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${hours}:${minutes}`;
    }

    static getDaysInStage(startDate) {
        if (!startDate) return 0;
        if (typeof startDate === 'string') startDate = new Date(startDate);

        const now = new Date();
        const diffMs = now - startDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        return diffDays;
    }

    static getRelativeTime(date) {
        if (!date) return '';
        if (typeof date === 'string') date = new Date(date);

        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return '今';
        if (diffMins < 60) return `${diffMins}分前`;
        if (diffHours < 24) return `${diffHours}時間前`;
        if (diffDays < 7) return `${diffDays}日前`;

        return this.formatDate(date);
    }
}

// Pagination Helper
class Paginator {
    constructor(items, perPage = 20) {
        this.items = items;
        this.perPage = perPage;
        this.currentPage = 1;
        this.totalPages = Math.ceil(items.length / perPage);
    }

    getPage(pageNum) {
        if (pageNum < 1 || pageNum > this.totalPages) return [];
        this.currentPage = pageNum;
        const start = (pageNum - 1) * this.perPage;
        return this.items.slice(start, start + this.perPage);
    }

    next() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            return this.getPage(this.currentPage);
        }
        return [];
    }

    prev() {
        if (this.currentPage > 1) {
            this.currentPage--;
            return this.getPage(this.currentPage);
        }
        return [];
    }

    renderPagination(containerId, onPageChange) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const html = `
            <div class="pagination">
                <button class="pagination-item" id="prev-btn" ${this.currentPage === 1 ? 'disabled' : ''}>
                    &lt;
                </button>
                <span>${this.currentPage} / ${this.totalPages}</span>
                <button class="pagination-item" id="next-btn" ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                    &gt;
                </button>
            </div>
        `;

        container.innerHTML = html;

        document.getElementById('prev-btn')?.addEventListener('click', () => {
            const items = this.prev();
            onPageChange(items, this.currentPage);
        });

        document.getElementById('next-btn')?.addEventListener('click', () => {
            const items = this.next();
            onPageChange(items, this.currentPage);
        });
    }
}

// Form Validation Helper
class FormValidator {
    static validate(formElement) {
        const errors = {};
        const inputs = formElement.querySelectorAll('[required]');

        inputs.forEach(input => {
            const name = input.name;
            const value = input.value.trim();

            if (!value) {
                errors[name] = '必須項目です';
            } else if (input.type === 'email' && !this.isValidEmail(value)) {
                errors[name] = '有効なメールアドレスではありません';
            } else if (input.type === 'url' && !this.isValidUrl(value)) {
                errors[name] = '有効なURLではありません';
            }
        });

        return errors;
    }

    static isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    static displayErrors(formElement, errors) {
        // Clear previous errors
        formElement.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('error');
            const errorMsg = group.querySelector('.error-message');
            if (errorMsg) errorMsg.remove();
        });

        // Display new errors
        Object.entries(errors).forEach(([name, message]) => {
            const input = formElement.querySelector(`[name="${name}"]`);
            if (input) {
                const group = input.closest('.form-group');
                if (group) {
                    group.classList.add('error');
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'error-message';
                    errorMsg.textContent = message;
                    group.appendChild(errorMsg);
                }
            }
        });
    }

    static clearErrors(formElement) {
        formElement.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('error');
            const errorMsg = group.querySelector('.error-message');
            if (errorMsg) errorMsg.remove();
        });
    }
}

// Router - Hash-based SPA router
class Router {
    constructor() {
        this.routes = {};
        this.currentPage = null;
        this.pageContainer = document.getElementById('page-container');

        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute();
    }

    register(page, handler) {
        this.routes[page] = handler;
    }

    async handleRoute() {
        const hash = window.location.hash.slice(2) || 'dashboard';
        const [page, ...params] = hash.split('/');

        // Update active nav
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector(`[data-page="${page}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Load page
        if (this.routes[page]) {
            try {
                this.currentPage = page;
                modal.closeAll();
                this.pageContainer.innerHTML = '<div class="loading"></div>';
                await this.routes[page](params);
            } catch (error) {
                console.error('Page load error:', error);
                toast.error('ページの読み込みに失敗しました');
                this.pageContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">⚠️</div>
                        <div class="empty-state-text">エラーが発生しました</div>
                    </div>
                `;
            }
        } else {
            this.pageContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">404</div>
                    <div class="empty-state-text">ページが見つかりません</div>
                </div>
            `;
        }
    }

    navigate(page) {
        window.location.hash = `#/${page}`;
    }
}

const router = new Router();

// Sidebar Toggle
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const menuToggle = document.querySelector('.menu-toggle');

    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    menuToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Global search placeholder
    const searchInput = document.getElementById('globalSearch');
    searchInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                toast.info(`検索: "${query}"`);
            }
        }
    });
});

// Helper: Get status badge class
function getStatusBadge(status) {
    const statusMap = {
        'new': 'status-new',
        '新規': 'status-new',
        'screening': 'status-screening',
        '書類選考': 'status-screening',
        'interview': 'status-interview',
        '一次面接': 'status-interview',
        '二次面接': 'status-interview',
        '最終面接': 'status-interview',
        'offer': 'status-offer',
        '内定': 'status-offer',
        'hired': 'status-hired',
        '採用': 'status-hired',
        'rejected': 'status-rejected',
        '不採用': 'status-rejected'
    };
    return statusMap[status] || 'badge-gray';
}

// Helper: Get initials from name
function getInitials(name) {
    if (!name) return '?';
    return name.split('').filter((c, i) => c !== ' ' && (i === 0 || name[i-1] === ' ')).slice(0, 2).join('');
}

// Helper: Create avatar element
function createAvatar(name, size = 'md') {
    const initials = getInitials(name);
    const sizeBadgeClass = `avatar-${size}`;
    return `<div class="card-avatar">${initials}</div>`;
}

// Export global utilities
window.app = {
    router,
    api: API,
    toast,
    modal,
    DateFormatter,
    Paginator,
    FormValidator,
    getInitials,
    getStatusBadge,
    createAvatar
};
