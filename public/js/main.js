// public/js/main.js - Hub Center for all page initialization & shared utilities

const API_BASE = '/api';

// --- Shared Utilities ---

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 text-sm font-medium animate-fade-in transform transition-all duration-300 translate-y-0 opacity-100 max-w-sm`;

    if (type === 'success') {
        toast.classList.add('bg-emerald-50', 'text-emerald-800', 'border', 'border-emerald-200');
        toast.innerHTML = `<svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>${message}</span>`;
    } else if (type === 'error') {
        toast.classList.add('bg-rose-50', 'text-rose-800', 'border', 'border-rose-200');
        toast.innerHTML = `<svg class="w-5 h-5 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span>${message}</span>`;
    }

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

let BKK_TODAY_DATE = null;

function updateBkkTodayDate() {
    const bkkTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const todayStr = bkkTime.getFullYear() + '-' + String(bkkTime.getMonth() + 1).padStart(2, '0') + '-' + String(bkkTime.getDate()).padStart(2, '0');
    BKK_TODAY_DATE = new Date(todayStr + "T00:00:00Z");
}
updateBkkTodayDate(); // Initialize once on script load

function getDaysRemaining(expiryDateStr) {
    if (!expiryDateStr) return null;
    if (!BKK_TODAY_DATE) updateBkkTodayDate();

    // Fast string mapping rather than deep timezone processing
    const expiry = new Date(expiryDateStr + "T00:00:00Z");
    const diffTime = expiry - BKK_TODAY_DATE;
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
}

// --- Shared Modal Helpers ---

function showDeleteConfirmModal(message, onConfirm) {
    const overlay = document.getElementById('deleteConfirmModalOverlay');
    const content = document.getElementById('deleteConfirmModalContent');
    const msgEl = document.getElementById('deleteConfirmMessage');
    const btnCancel = document.getElementById('btnCancelDelete');
    const btnConfirm = document.getElementById('btnConfirmDeleteAction');

    if (!overlay || !content) return;

    msgEl.textContent = message;

    // Remove old listeners by cloning
    const newBtnConfirm = btnConfirm.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);

    const newBtnCancel = btnCancel.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

    // Attempt to grab the close icon specifically
    const btnCloseIcon = document.getElementById('btnCloseDeleteIcon');
    let newBtnCloseIcon = null;
    if (btnCloseIcon) {
        newBtnCloseIcon = btnCloseIcon.cloneNode(true);
        btnCloseIcon.parentNode.replaceChild(newBtnCloseIcon, btnCloseIcon);
    }

    function closeModal() {
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            overlay.classList.add('hidden');
            content.style.display = 'none';
            content.classList.remove('scale-95', 'opacity-0');
        }, 150);
    }

    // Add new listeners
    newBtnCancel.addEventListener('click', closeModal);
    if (newBtnCloseIcon) {
        newBtnCloseIcon.addEventListener('click', closeModal);
    }
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    newBtnConfirm.addEventListener('click', async () => {
        // loading state
        newBtnConfirm.disabled = true;
        newBtnConfirm.innerHTML = `<svg class="animate-spin h-4 w-4 mr-1 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> กำลังลบ...`;

        await onConfirm();

        closeModal();

        // Reset button state slightly after modal closes
        setTimeout(() => {
            newBtnConfirm.disabled = false;
            newBtnConfirm.innerHTML = `ยืนยันการลบ`;
        }, 300);
    });

    // Show modal
    overlay.classList.remove('hidden');
    content.style.display = 'block';
}

function showLotDetailsModal(productId, inventoryData, showExpiredMode) {
    const product = inventoryData.find(p => p.id === productId || p.id === parseInt(productId));
    if (!product) return;

    let overlay = document.getElementById('lotDetailsModalOverlay');
    if (!overlay) return;

    // Clone to remove all previous event listeners
    const newOverlay = overlay.cloneNode(true);
    overlay.parentNode.replaceChild(newOverlay, overlay);
    overlay = newOverlay;

    const titleEl = document.getElementById('lotDetailsModalTitle');
    const subtitleEl = document.getElementById('lotDetailsModalSubtitle');
    const bodyEl = document.getElementById('lotDetailsModalBody');
    const content = document.getElementById('lotDetailsModalContent');

    if (!titleEl || !subtitleEl || !bodyEl || !content) return;

    titleEl.textContent = product.product_name;
    subtitleEl.textContent = `หมวดหมู่: ${product.category_name || 'ทั่วไป'}`;

    const filteredBatches = product.batches.filter(b => {
        const d = b.daysRemaining;
        if (d === null) return !showExpiredMode;
        if (showExpiredMode) return d < 0;
        return d >= 0;
    });

    if (filteredBatches.length === 0) {
        bodyEl.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">ไม่มีข้อมูลล็อตสินค้านี้</p>';
    } else {
        const sortedBatches = [...filteredBatches].sort((a, b) => new Date(a.receive_date) - new Date(b.receive_date));

        let html = '';
        sortedBatches.forEach(b => {
            const daysRemaining = b.daysRemaining;
            let daysText = '-';
            let rowClass = 'bg-white border-slate-200';
            let textClass = 'text-slate-600';

            if (daysRemaining !== null) {
                daysText = `${Math.abs(daysRemaining)} วัน`;
                if (daysRemaining < 0) {
                    daysText = `หมดอายุแล้ว (${Math.abs(daysRemaining)} วัน)`;
                    rowClass = 'bg-rose-50 border-rose-200';
                    textClass = 'text-rose-700 font-medium';
                } else if (daysRemaining === 0) {
                    daysText = `วันนี้`;
                    rowClass = 'bg-rose-50 border-rose-200';
                    textClass = 'text-rose-700 font-medium';
                } else if (daysRemaining <= 2) {
                    daysText = `ใกล้หมดอายุ (${daysRemaining} วัน)`;
                    rowClass = 'bg-amber-50 border-amber-200';
                    textClass = 'text-amber-700 font-medium';
                }
            }

            html += `
                <div class="p-3 rounded-lg border ${rowClass} flex justify-between items-center shadow-sm">
                    <div>
                        <div class="text-sm font-semibold text-slate-700 mb-0.5">รับเข้า: ${formatDate(b.receive_date)}</div>
                        <div class="text-xs text-slate-500">วันหมดอายุ: ${formatDate(b.expiry_date)}</div>
                        <div class="text-xs mt-1 ${textClass}">${daysText}</div>
                    </div>
                    <div class="text-right">
                        <div class="font-mono text-lg font-bold text-emerald-600">${b.quantity}</div>
                        <div class="text-xs text-slate-500">แพ็ค</div>
                    </div>
                </div>
            `;
        });
        bodyEl.innerHTML = html;
    }

    // Add close handlers
    const btnCloseTop = document.getElementById('btnCloseLotDetails');

    function closeLotModal() {
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            overlay.classList.add('hidden');
            content.style.display = 'none';
            content.classList.remove('scale-95', 'opacity-0');
        }, 150);
    }

    if (btnCloseTop) btnCloseTop.addEventListener('click', closeLotModal);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeLotModal();
    });

    overlay.classList.remove('hidden');
    content.style.display = 'flex';
}

// --- Page Routing & Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // Route to appropriate page initialization function
    if (path === '/') {
        if (typeof initDashboard === 'function') {
            initDashboard();
        }
    } else if (path === '/withdraw') {
        if (typeof initWithdrawPage === 'function') {
            initWithdrawPage();
        }
    } else if (path === '/add-stock') {
        if (typeof initAddStockPage === 'function') {
            initAddStockPage();
        }
    } else if (path === '/history') {
        if (typeof initHistoryPage === 'function') {
            initHistoryPage();
        }
    } else if (path === '/admin/users') {
        if (typeof initAdminUsers === 'function') {
            initAdminUsers();
        }
    } else if (path === '/manage-products') {
        if (typeof initProductManagement === 'function') {
            initProductManagement();
        }
    } else if (path === '/admin/permissions') {
        // Permissions management is already inline in admin_permissions.ejs
        console.log('Permissions page loaded');
    }
});
