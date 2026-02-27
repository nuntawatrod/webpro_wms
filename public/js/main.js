// public/js/main.js

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

function getDaysRemaining(expiryDateStr) {
    if (!expiryDateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDateStr);
    const diffTime = expiry - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
}


// --- Page specific initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path === '/') {
        initDashboard();
    } else if (path === '/withdraw') {
        initWithdrawPage();
    } else if (path === '/history') {
        initHistoryPage();
    } else if (path === '/admin') {
        initAdminDashboard();
    } else if (path === '/admin/users') {
        initAdminUsers();
    }
});


// ============================================
// DASHBOARD (/)
// ============================================
function initDashboard() {
    let inventoryData = [];
    let currentView = 'grid'; // default
    let currentSearch = '';
    let currentCategory = 'all';
    let currentSort = 'name-asc';
    let currentPage = 1;
    let showExpiredMode = false;
    const PAGE_SIZE = 100;

    const gridView = document.getElementById('gridView');
    const tableView = document.getElementById('tableView');
    const tableBody = document.getElementById('tableBody');
    const btnGridView = document.getElementById('btnGridView');
    const btnTableView = document.getElementById('btnTableView');
    const emptyState = document.getElementById('emptyState');
    const loadingIndicator = document.getElementById('loadingIndicator');

    // Toggle expired view
    const btnToggleExpired = document.getElementById('btnToggleExpired');
    if (btnToggleExpired) {
        btnToggleExpired.addEventListener('click', () => {
            showExpiredMode = !showExpiredMode;
            currentPage = 1;
            if (showExpiredMode) {
                btnToggleExpired.className = 'border border-rose-400 text-rose-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-50 shadow-sm transition-all flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-400';
                btnToggleExpired.innerHTML = `<svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>กลับสินค้าปกติ`;
            } else {
                btnToggleExpired.className = 'border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 shadow-sm transition-all flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400';
                btnToggleExpired.innerHTML = `<svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>ดูสินค้าหมดอายุ`;
            }
            renderData();
        });
    }

    fetchInventory();

    async function fetchInventory() {
        loadingIndicator.classList.remove('hidden');
        gridView.classList.add('hidden');
        tableView.classList.add('hidden');
        emptyState.classList.add('hidden');

        try {
            const res = await fetch(`${API_BASE}/inventory`);
            if (!res.ok) throw new Error('Failed to load inventory');
            inventoryData = await res.json();
            buildCategoryTabs();
            updateExpiryBanner();
            renderData();
        } catch (err) {
            console.error(err);
            showToast('เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า', 'error');
            emptyState.classList.remove('hidden');
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    }


    // ---- Expiry Banner ----
    function updateExpiryBanner() {
        const banner = document.getElementById('expiryBanner');
        const bannerText = document.getElementById('expiryBannerText');
        if (!banner || !bannerText) return;
        const expiredToday = inventoryData.filter(p =>
            p.batches.some(b => {
                const d = getDaysRemaining(b.expiry_date);
                return d !== null && d <= 0;
            })
        );
        if (expiredToday.length > 0) {
            const names = expiredToday.slice(0, 3).map(p => p.product_name).join(', ');
            const more = expiredToday.length > 3 ? (' และอีก ' + (expiredToday.length - 3) + ' รายการ') : '';
            bannerText.innerHTML = '<strong>แจ้งเตือน:</strong> มีสินค้าหมดอายุหรือหมดอายุวันนี้ <strong>' + expiredToday.length + ' รายการ</strong> — ' + names + more;
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
        }
        const btnDismiss = document.getElementById('btnDismissExpiry');
        if (btnDismiss) {
            const newBtn = btnDismiss.cloneNode(true);
            btnDismiss.parentNode.replaceChild(newBtn, btnDismiss);
            newBtn.addEventListener('click', () => banner.classList.add('hidden'));
        }
    }

    // Build category filter tabs dynamically from data
    function buildCategoryTabs() {
        const tabContainer = document.getElementById('categoryTabs');
        if (!tabContainer) return;
        const uniqueCats = [...new Set(inventoryData.map(p => p.category_name || 'ทั่วไป'))].sort();
        const allCats = ['ทั้งหมด', ...uniqueCats];
        tabContainer.innerHTML = '';
        allCats.forEach(cat => {
            const id = cat === 'ทั้งหมด' ? 'all' : cat;
            const isActive = (currentCategory === 'all' && cat === 'ทั้งหมด') || currentCategory === cat;
            const btn = document.createElement('button');
            btn.className = `px-4 py-1.5 text-sm font-medium rounded-full transition-all focus:outline-none whitespace-nowrap ${isActive ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20' : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
                }`;
            btn.textContent = cat;
            btn.dataset.cat = id;
            btn.addEventListener('click', () => {
                currentCategory = id;
                currentPage = 1;
                buildCategoryTabs();
                renderData();
            });
            tabContainer.appendChild(btn);
        });
    }

    function renderData() {
        if (inventoryData.length === 0) {
            gridView.classList.add('hidden');
            tableView.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }
        emptyState.classList.add('hidden');

        // Filter: split expired vs active
        const isProductExpired = (p) => p.batches.every(b => {
            const d = getDaysRemaining(b.expiry_date);
            return d !== null && d < 0;
        });

        const filtered = inventoryData.filter(p => {
            const matchCat = currentCategory === 'all' || (p.category_name || 'ทั่วไป') === currentCategory;
            const matchSearch = currentSearch === '' || p.product_name.toLowerCase().includes(currentSearch);
            const expired = isProductExpired(p);
            return matchCat && matchSearch && (showExpiredMode ? expired : !expired);
        });

        // Sort
        const sortedData = [...filtered].sort((a, b) => {
            if (currentSort === 'name-desc') {
                return b.product_name.localeCompare(a.product_name, 'th');
            } else if (currentSort === 'expiry-asc') {
                const getNearest = (p) => {
                    let min = null;
                    p.batches.forEach(batch => {
                        const d = getDaysRemaining(batch.expiry_date);
                        if (d !== null && (min === null || d < min)) min = d;
                    });
                    return min;
                };
                const da = getNearest(a);
                const db2 = getNearest(b);
                if (da === null && db2 === null) return 0;
                if (da === null) return 1;
                if (db2 === null) return -1;
                return da - db2;
            } else {
                return a.product_name.localeCompare(b.product_name, 'th');
            }
        });

        // Paginate
        const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageData = sortedData.slice(start, start + PAGE_SIZE);
        renderPagination(sortedData.length, totalPages);

        if (pageData.length === 0) {
            gridView.classList.add('hidden');
            tableView.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        if (currentView === 'grid') {
            renderGrid(pageData);
            gridView.classList.remove('hidden');
            tableView.classList.add('hidden');
        } else {
            renderTable(pageData);
            tableView.classList.remove('hidden');
            gridView.classList.add('hidden');
        }
    }

    function renderPagination(totalItems, totalPages) {
        const container = document.getElementById('paginationContainer');
        if (!container) return;
        if (totalPages <= 1) { container.innerHTML = ''; return; }
        const fromItem = Math.min((currentPage - 1) * PAGE_SIZE + 1, totalItems);
        const toItem = Math.min(currentPage * PAGE_SIZE, totalItems);
        container.innerHTML = `
            <div class="flex items-center justify-between flex-wrap gap-3">
                <p class="text-sm text-slate-500">แสดง ${fromItem}–${toItem} จาก ${totalItems} รายการ</p>
                <div class="flex items-center gap-2">
                    <button id="btnPrevPage" class="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" ${currentPage === 1 ? 'disabled' : ''}>← ก่อนหน้า</button>
                    <span class="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg">หน้า ${currentPage} / ${totalPages}</span>
                    <button id="btnNextPage" class="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" ${currentPage === totalPages ? 'disabled' : ''}>ถัดไป →</button>
                </div>
            </div>
        `;
        document.getElementById('btnPrevPage')?.addEventListener('click', () => { currentPage--; renderData(); window.scrollTo(0, 0); });
        document.getElementById('btnNextPage')?.addEventListener('click', () => { currentPage++; renderData(); window.scrollTo(0, 0); });
    }

    function renderGrid(data) {
        gridView.innerHTML = '';

        // Expired mode header
        if (showExpiredMode) {
            const header = document.createElement('div');
            header.className = 'col-span-full mb-4 px-4 py-3 bg-slate-100 border border-slate-300 rounded-xl text-slate-500 text-sm font-medium flex items-center gap-2';
            header.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>แสดงสินค้าที่หมดอายุแล้วทั้งหมด ${data.length} รายการ`;
            gridView.appendChild(header);
        }

        data.forEach(product => {
            let nearestExpiryDay = null;
            let isExpired = false;

            product.batches.forEach(b => {
                if (b.expiry_date) {
                    const days = getDaysRemaining(b.expiry_date);
                    if (days !== null) {
                        if (nearestExpiryDay === null || days < nearestExpiryDay) nearestExpiryDay = days;
                    }
                }
            });

            isExpired = nearestExpiryDay !== null && nearestExpiryDay < 0;
            const isDanger = !isExpired && nearestExpiryDay !== null && nearestExpiryDay <= 1;   // 1 day → red
            const isWarning = !isExpired && nearestExpiryDay !== null && nearestExpiryDay <= 3 && nearestExpiryDay >= 2; // 2-3 days → yellow

            let cardBorderClass = 'border-slate-200';
            if (isExpired) cardBorderClass = 'border-slate-300 ring-1 ring-slate-300 opacity-70';
            else if (isDanger) cardBorderClass = 'border-rose-400 ring-1 ring-rose-400';
            else if (isWarning) cardBorderClass = 'border-amber-400 ring-1 ring-amber-400';

            let cardBgClass = isExpired ? 'bg-slate-100' : 'bg-white';

            const card = document.createElement('div');
            card.className = `product-card ${cardBgClass} rounded-xl shadow-sm border overflow-hidden flex flex-col relative ${cardBorderClass}`;

            // Badge
            let badgeHTML = '';
            if (isExpired) {
                badgeHTML = `<div class="absolute top-3 right-3 bg-slate-200 text-slate-500 text-xs font-bold px-2 py-1 rounded shadow-sm z-10 flex items-center">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                    หมดอายุ
                </div>`;
            } else if (isDanger) {
                badgeHTML = `<div class="absolute top-3 right-3 bg-rose-100 text-rose-700 text-xs font-bold px-2 py-1 rounded shadow-sm z-10 flex items-center">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    ใกล้หมดอายุ (${nearestExpiryDay} วัน)
                </div>`;
            } else if (isWarning) {
                badgeHTML = `<div class="absolute top-3 right-3 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded shadow-sm z-10 flex items-center">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    ใกล้หมดอายุ (${nearestExpiryDay} วัน)
                </div>`;
            }

            // Expiry display
            let expiryDisplay = '';
            if (nearestExpiryDay !== null) {
                if (nearestExpiryDay < 0) {
                    expiryDisplay = `<p class="text-xs text-slate-400 font-semibold mt-1">หมดอายุ</p>`;
                } else if (isDanger) {
                    expiryDisplay = `<p class="text-xs text-rose-500 font-semibold mt-1">เหลือ ${nearestExpiryDay} วัน</p>`;
                } else if (isWarning) {
                    expiryDisplay = `<p class="text-xs text-amber-600 font-semibold mt-1">เหลือ ${nearestExpiryDay} วัน</p>`;
                }
            }

            card.innerHTML = `
                ${badgeHTML}
                <div class="absolute top-3 left-3 bg-white/90 backdrop-blur text-slate-700 text-xs font-semibold px-2 py-1 rounded shadow-sm z-10 border border-slate-100">
                    ${product.category_name || 'ทั่วไป'}
                </div>
                <div class="h-48 ${isExpired ? 'bg-slate-200 grayscale' : 'bg-slate-100'} overflow-hidden flex items-center justify-center p-4">
                    ${product.image_url
                    ? `<img src="${product.image_url}" alt="${product.product_name}" class="object-contain h-full w-full mix-blend-multiply">`
                    : `<svg class="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`
                }
                </div>
                <div class="p-5 flex-grow flex flex-col">
                    <h3 class="font-semibold ${isExpired ? 'text-slate-400' : 'text-slate-800'} text-base leading-snug mb-1 line-clamp-2" title="${product.product_name}">${product.product_name}</h3>
                    ${expiryDisplay}
                    <div class="mt-auto pt-4 border-t border-slate-100 flex justify-between items-end">
                        <div>
                            <p class="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">จำนวนคงเหลือ</p>
                            <p class="text-2xl font-bold ${isExpired ? 'text-slate-400' : (product.total_quantity === 0 ? 'text-rose-500' : 'text-emerald-600')}">${product.total_quantity}</p>
                        </div>
                        <div class="text-right">
                            ${isExpired
                    ? `<span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-400">หมดอายุ</span>`
                    : `<span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${product.total_quantity > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">${product.total_quantity > 0 ? 'มีสินค้า' : 'สินค้าหมด'}</span>`
                }
                        </div>
                    </div>
                </div>
            `;
            gridView.appendChild(card);
        });
    }

    function renderTable(data) {
        tableBody.innerHTML = '';

        data.forEach(product => {
            const nearestDay = (() => {
                let min = null;
                product.batches.forEach(b => {
                    const d = getDaysRemaining(b.expiry_date);
                    if (d !== null && (min === null || d < min)) min = d;
                });
                return min;
            })();

            const isExpiredProduct = nearestDay !== null && nearestDay < 0;
            const isDanger = !isExpiredProduct && nearestDay !== null && nearestDay <= 1;
            const isWarning = !isExpiredProduct && nearestDay !== null && nearestDay <= 3 && nearestDay >= 2;

            const tr = document.createElement('tr');
            let rowBg = 'hover:bg-slate-50';
            if (isExpiredProduct) rowBg = 'bg-slate-100 text-slate-400 hover:bg-slate-200';
            else if (isDanger) rowBg = 'bg-rose-50 hover:bg-rose-100';
            else if (isWarning) rowBg = 'bg-amber-50 hover:bg-amber-100';
            tr.className = `transition-colors group border-b border-slate-100 ${rowBg}`;

            const imgCellHtml = product.image_url
                ? `<img src="${product.image_url}" class="h-10 w-10 object-contain rounded bg-white border border-slate-200 p-0.5">`
                : `<div class="h-10 w-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>`;

            tr.innerHTML = `
                <td class="px-6 py-4">${imgCellHtml}</td>
                <td class="px-6 py-4">
                    <div class="font-medium text-slate-800">${product.product_name}</div>
                    <div class="text-xs text-slate-500 mt-0.5"><span class="bg-slate-100 px-1.5 py-0.5 rounded mr-1">${product.category_name || 'ทั่วไป'}</span> ${product.batches.length} ล็อตการรับ</div>
                </td>
                <td class="px-6 py-4 text-right font-semibold ${product.total_quantity === 0 ? 'text-rose-500' : 'text-slate-800'}">${product.total_quantity}</td>
                <td class="px-6 py-4 text-center">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.total_quantity > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                        ${product.total_quantity > 0 ? 'มีสินค้า' : 'หมด'}
                    </span>
                </td>
                <td class="px-6 py-4 text-right">
                    ${product.batches.length > 0 ? `
                    <button class="btn-expand text-slate-400 hover:text-emerald-600 focus:outline-none p-2 rounded-full hover:bg-emerald-50 transition-colors" data-id="${product.id}">
                        <svg class="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>` : ''}
                </td>
            `;

            tableBody.appendChild(tr);

            if (product.batches.length > 0) {
                const sortedBatches = [...product.batches].sort((a, b) => new Date(a.receive_date) - new Date(b.receive_date));
                const subRowsContainer = document.createElement('tr');
                subRowsContainer.className = `hidden bg-slate-50/80 batch-rows-${product.id}`;

                let batchesHtml = `<td colspan="5" class="p-0 border-b border-slate-200">
                    <div class="px-8 py-3 bg-slate-50 border-l-4 border-emerald-500">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="text-slate-500 mb-2 border-b border-slate-200">
                                    <th class="py-2 font-medium text-left">รับเข้าเมื่อ</th>
                                    <th class="py-2 font-medium text-left">หมดอายุ</th>
                                    <th class="py-2 font-medium text-left">อายุขัย</th>
                                    <th class="py-2 font-medium text-right">จำนวนล็อต</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">`;

                sortedBatches.forEach(b => {
                    const daysRemaining = getDaysRemaining(b.expiry_date);
                    let daysText = '-';
                    let rowClass = '';

                    if (daysRemaining !== null) {
                        daysText = `${daysRemaining} วัน`;
                        if (daysRemaining < 0) {
                            daysText = `หมดอายุแล้ว (${Math.abs(daysRemaining)} วัน)`;
                            rowClass = 'bg-rose-100 text-rose-800 font-semibold';
                        } else if (daysRemaining <= 2) {
                            rowClass = 'bg-rose-100 text-rose-800 font-semibold';
                            daysText = `ใกล้หมดอายุ (${daysRemaining} วัน)`;
                        } else if (daysRemaining <= 7) {
                            rowClass = 'text-amber-600';
                        }
                    }

                    batchesHtml += `
                        <tr class="hover:bg-slate-100/50 ${rowClass}">
                            <td class="py-2.5">${formatDate(b.receive_date)}</td>
                            <td class="py-2.5">${formatDate(b.expiry_date)}</td>
                            <td class="py-2.5">${daysText}</td>
                            <td class="py-2.5 text-right font-mono">${b.quantity}</td>
                        </tr>
                    `;
                });

                batchesHtml += `</tbody></table></div></td>`;
                subRowsContainer.innerHTML = batchesHtml;
                tableBody.appendChild(subRowsContainer);
            }
        });

        document.querySelectorAll('.btn-expand').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const targetRow = document.querySelector(`.batch-rows-${id}`);
                const svg = e.currentTarget.querySelector('svg');

                if (targetRow.classList.contains('hidden')) {
                    targetRow.classList.remove('hidden');
                    svg.classList.add('rotate-180');
                } else {
                    targetRow.classList.add('hidden');
                    svg.classList.remove('rotate-180');
                }
            });
        });
    }

    btnGridView.addEventListener('click', () => {
        currentView = 'grid';
        btnGridView.className = 'px-3 py-1.5 rounded-md text-sm font-medium bg-white shadow-sm text-emerald-700 border border-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500';
        btnTableView.className = 'px-3 py-1.5 rounded-md text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors focus:outline-none';
        btnGridView.parentElement.classList.replace('bg-white', 'bg-slate-100');
        btnGridView.classList.replace('bg-slate-100', 'bg-white');
        renderData();
    });

    btnTableView.addEventListener('click', () => {
        currentView = 'table';
        btnTableView.className = 'px-3 py-1.5 rounded-md text-sm font-medium bg-white shadow-sm text-emerald-700 border border-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500';
        btnGridView.className = 'px-3 py-1.5 rounded-md text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors focus:outline-none';
        btnGridView.parentElement.classList.replace('bg-white', 'bg-slate-100');
        renderData();
    });

    // Sort select
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            currentSort = sortSelect.value;
            currentPage = 1;
            renderData();
        });
    }

    // Search box
    const searchBox = document.getElementById('productSearchBox');
    if (searchBox) {
        searchBox.addEventListener('input', (e) => {
            currentSearch = e.target.value.toLowerCase().trim();
            currentPage = 1;
            renderData();
        });
    }

    // Custom Add Product Modal Logic
    const btnAddProduct = document.getElementById('btnAddProduct');
    const addModalOverlay = document.getElementById('addModalOverlay');
    const addModalContent = document.getElementById('addModalContent');
    const btnCloseAddModal = document.getElementById('btnCloseAddModal');
    const btnCancelAdd = document.getElementById('btnCancelAdd');
    const btnConfirmAdd = document.getElementById('btnConfirmAdd');

    const productSearchInput = document.getElementById('productSearchInput');
    const productSearchResults = document.getElementById('productSearchResults');
    const selectedProductId = document.getElementById('selectedProductId');
    const inReceiveDate = document.getElementById('inReceiveDate');
    const inQuantity = document.getElementById('inQuantity');

    let masterProducts = [];

    btnAddProduct.addEventListener('click', async () => {
        productSearchInput.value = '';
        selectedProductId.value = '';
        inQuantity.value = '';
        inReceiveDate.value = new Date().toISOString().split('T')[0];
        btnConfirmAdd.disabled = true;

        // Show modal immediately, then load products
        addModalOverlay.classList.remove('hidden');
        addModalContent.style.display = 'block';

        try {
            const res = await fetch(`${API_BASE}/products`);
            masterProducts = await res.json();
            renderProductSearchOptions(masterProducts);
            // BUGFIX: show results immediately so user sees options right away
            if (masterProducts.length > 0) {
                productSearchResults.classList.remove('hidden');
            }
        } catch (e) {
            console.error(e);
            showToast('พบข้อผิดพลาดขณะโหลดรายการสินค้า', 'error');
        }
    });

    const closeModal = () => {
        addModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            addModalOverlay.classList.add('hidden');
            addModalContent.style.display = 'none';
            addModalContent.classList.remove('scale-95', 'opacity-0');
            productSearchResults.classList.add('hidden');
        }, 150);
    };

    btnCloseAddModal.addEventListener('click', closeModal);
    btnCancelAdd.addEventListener('click', closeModal);
    addModalOverlay.addEventListener('click', (e) => {
        if (e.target === addModalOverlay) closeModal();
    });

    function renderProductSearchOptions(products) {
        productSearchResults.innerHTML = '';
        if (products.length === 0) {
            productSearchResults.innerHTML = '<div class="px-4 py-3 text-sm text-slate-500">ไม่พบสินค้า</div>';
            return;
        }

        products.forEach(p => {
            const div = document.createElement('div');
            div.className = 'px-4 py-2.5 hover:bg-emerald-50 cursor-pointer text-sm text-slate-700 transition-colors border-b border-slate-50 last:border-0';
            div.textContent = `${p.product_name} (นำเข้าใหม่จะเก็บได้ ${p.shelf_life_days} วัน)`;
            div.addEventListener('click', () => {
                productSearchInput.value = p.product_name;
                selectedProductId.value = p.id;
                productSearchResults.classList.add('hidden');
                validateAddForm();
            });
            productSearchResults.appendChild(div);
        });
    }

    productSearchInput.addEventListener('focus', () => {
        if (masterProducts.length > 0) productSearchResults.classList.remove('hidden');
    });

    productSearchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        selectedProductId.value = '';
        validateAddForm();

        const filtered = masterProducts.filter(p => p.product_name.toLowerCase().includes(val));
        renderProductSearchOptions(filtered);
        productSearchResults.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#productSearchContainer')) {
            productSearchResults.classList.add('hidden');
        }
    });

    function validateAddForm() {
        const hasProduct = selectedProductId.value !== '';
        const hasQuantity = inQuantity.value && parseInt(inQuantity.value) > 0;
        btnConfirmAdd.disabled = !(hasProduct && hasQuantity);
    }

    inQuantity.addEventListener('input', validateAddForm);

    btnConfirmAdd.addEventListener('click', async () => {
        if (btnConfirmAdd.disabled) return;

        btnConfirmAdd.disabled = true;
        btnConfirmAdd.innerHTML = `<svg class="animate-spin h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

        const payload = {
            product_id: parseInt(selectedProductId.value),
            receive_date: inReceiveDate.value,
            quantity: parseInt(inQuantity.value)
            // expiry_date is handled in backend
        };

        try {
            const res = await fetch(`${API_BASE}/stock/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                showToast('เพิ่มสต็อกสำเร็จ ระบบตั้งวันหมดอายุให้แล้ว', 'success');
                closeModal();
                fetchInventory();
            } else {
                showToast(data.error || 'ล้มเหลวในการเพิ่มสต็อก', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('ระบบเครือข่ายขัดข้อง', 'error');
        } finally {
            btnConfirmAdd.innerHTML = 'ยืนยันเพิ่มสต็อก';
            validateAddForm();
        }
    });
}


// ============================================
// WITHDRAW (/withdraw)
// ============================================
function initWithdrawPage() {
    const wdProductInput = document.getElementById('wdProductInput');
    const wdProductList = document.getElementById('wdProductList');
    const wdSelectedProductId = document.getElementById('wdSelectedProductId');
    const wdDate = document.getElementById('wdDate');
    const wdQuantity = document.getElementById('wdQuantity');
    const wdActorName = document.getElementById('wdActorName');
    const btnWithdrawSubmit = document.getElementById('btnWithdrawSubmit');
    const btnWithdrawReset = document.getElementById('btnWithdrawReset');

    let availableProducts = [];

    wdDate.value = new Date().toISOString().split('T')[0];

    fetchAvailable();

    async function fetchAvailable() {
        try {
            const res = await fetch(`${API_BASE}/available-products`);
            availableProducts = await res.json();
            renderCustomDropdown(availableProducts);
        } catch (e) {
            showToast('ดึงข้อมูลสินค้าไม่สำเร็จ', 'error');
        }
    }

    function renderCustomDropdown(products) {
        wdProductList.innerHTML = '';
        if (products.length === 0) {
            wdProductList.innerHTML = '<div class="px-4 py-3 text-sm text-slate-500">ไม่มีสินค้าคงเหลือในสต็อก</div>';
            return;
        }

        products.forEach(p => {
            const div = document.createElement('div');
            div.className = 'px-4 py-3 hover:bg-emerald-50 cursor-pointer text-sm text-slate-700 transition-colors border-b border-slate-50 last:border-0 truncate';
            div.textContent = p.product_name;
            div.addEventListener('click', () => {
                wdProductInput.value = p.product_name;
                wdSelectedProductId.value = p.id;
                wdProductList.classList.add('hidden');
                validateForm();
            });
            wdProductList.appendChild(div);
        });
    }

    wdProductInput.addEventListener('focus', () => {
        if (availableProducts.length > 0) wdProductList.classList.remove('hidden');
    });

    wdProductInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        wdSelectedProductId.value = '';
        validateForm();

        const filtered = availableProducts.filter(p => p.product_name.toLowerCase().includes(val));
        renderCustomDropdown(filtered);
        wdProductList.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#wdProductContainer')) {
            wdProductList.classList.add('hidden');
        }
    });


    function validateForm() {
        const hasProduct = wdSelectedProductId.value !== '';
        const hasQty = wdQuantity.value && parseInt(wdQuantity.value) > 0;
        const hasActor = wdActorName.value.trim() !== '';

        btnWithdrawSubmit.disabled = !(hasProduct && hasQty && hasActor);
    }

    wdQuantity.addEventListener('input', validateForm);

    btnWithdrawReset.addEventListener('click', () => {
        wdProductInput.value = '';
        wdSelectedProductId.value = '';
        wdQuantity.value = '';
        validateForm();
    });

    btnWithdrawSubmit.addEventListener('click', async () => {
        if (btnWithdrawSubmit.disabled) return;

        btnWithdrawSubmit.disabled = true;
        btnWithdrawSubmit.textContent = 'กำลังดำเนินการ...';

        const payload = {
            product_id: parseInt(wdSelectedProductId.value),
            quantity: parseInt(wdQuantity.value),
            actor_name: wdActorName.value.trim()
        };

        try {
            const res = await fetch(`${API_BASE}/stock/withdraw`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                showToast('เบิกสินค้าสำเร็จ โดยระบบตัดยอดตามคิว FIFO แล้ว', 'success');
                btnWithdrawReset.click();
                fetchAvailable();
            } else {
                showToast(data.error || 'บันทึกการเบิกสินค้าล้มเหลว', 'error');
            }
        } catch (e) {
            showToast('เครือข่ายขัดข้อง', 'error');
        } finally {
            btnWithdrawSubmit.textContent = 'ยืนยันการเบิก';
            validateForm();
        }
    });

}

// ============================================
// HISTORY LOG (/history)
// ============================================
function initHistoryPage() {
    const tableBody = document.getElementById('historyTableBody');
    const PAGE_SIZE = 100;
    let allHistory = [];
    let historyPage = 1;

    async function fetchHistory() {
        try {
            const res = await fetch(`${API_BASE}/history`);
            if (!res.ok) throw new Error();
            allHistory = await res.json();
            historyPage = 1;
            renderHistoryPage();
        } catch (e) {
            tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-rose-500">โหลดข้อมูลผิดพลาด โปรดลองใหม่</td></tr>`;
        }
    }

    function renderHistoryPage() {
        const total = allHistory.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        if (historyPage > totalPages) historyPage = totalPages;
        const start = (historyPage - 1) * PAGE_SIZE;
        const pageData = allHistory.slice(start, start + PAGE_SIZE);

        if (total === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">ไม่พบประวัติการทำรายการ</td></tr>`;
        } else {
            tableBody.innerHTML = '';
            pageData.forEach(log => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100/60';

                // Parse Bangkok-stored datetime (stored as 'YYYY-MM-DD HH:MM:SS' Bangkok local)
                const rawDate = (log.action_date || '');
                const d = new Date(rawDate.replace(' ', 'T') + '+07:00');
                const formattedDate = isNaN(d.getTime()) ? rawDate : d.toLocaleString('th-TH', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok'
                });

                const actionType = log.action_type || '';
                let actionBadge = '';
                let quantityHtml = '-';
                let productDisplay = log.product_name || '-';

                if (actionType === 'ADD') {
                    actionBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">รับเข้า (ADD)</span>`;
                    quantityHtml = `<span class="font-mono font-bold text-emerald-600">+${log.quantity ?? ''}</span>`;
                } else if (actionType === 'WITHDRAW') {
                    actionBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">เบิกออก (WITHDRAW)</span>`;
                    quantityHtml = `<span class="font-mono font-bold text-rose-600">-${log.quantity ?? ''}</span>`;
                } else if (actionType === 'CREATE_USER') {
                    actionBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-700">สร้างผู้ใช้</span>`;
                    productDisplay = log.extra_info ? `<span class="text-sky-700">${log.extra_info}</span>` : '-';
                } else if (actionType === 'DELETE_USER') {
                    actionBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">ลบผู้ใช้</span>`;
                    productDisplay = log.extra_info ? `<span class="text-orange-700">${log.extra_info}</span>` : '-';
                } else if (actionType === 'CREATE_PRODUCT') {
                    actionBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">สร้างสินค้า</span>`;
                    productDisplay = log.extra_info || log.product_name || '-';
                } else if (actionType === 'DELETE_PRODUCT') {
                    actionBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">ลบสินค้ส</span>`;
                    productDisplay = log.extra_info ? `<span class="text-amber-700">${log.extra_info}</span>` : '-';
                } else {
                    actionBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">${actionType}</span>`;
                }

                tr.innerHTML = `
                    <td class="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">${formattedDate}</td>
                    <td class="px-6 py-4">${actionBadge}</td>
                    <td class="px-6 py-4 font-medium text-slate-800">${productDisplay}</td>
                    <td class="px-6 py-4 text-right">${quantityHtml}</td>
                    <td class="px-6 py-4 text-sm text-slate-600">${log.actor_name || '-'}</td>
                `;
                tableBody.appendChild(tr);
            });
        }

        // Pagination controls
        const pg = document.getElementById('historyPagination');
        if (!pg) return;
        if (totalPages <= 1) { pg.innerHTML = ''; return; }
        const prevDis = historyPage === 1 ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'hover:bg-slate-100';
        const nextDis = historyPage === totalPages ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'hover:bg-slate-100';
        pg.innerHTML = `
            <span>แสดง ${start + 1}–${Math.min(start + PAGE_SIZE, total)} จาก ${total} รายการ</span>
            <div class="flex items-center gap-1">
                <button id="histPrevBtn" class="px-3 py-1.5 rounded-lg border border-slate-200 text-sm ${prevDis}">ก่อนหน้า</button>
                <span class="px-3 py-1.5 text-sm font-semibold text-emerald-700">${historyPage} / ${totalPages}</span>
                <button id="histNextBtn" class="px-3 py-1.5 rounded-lg border border-slate-200 text-sm ${nextDis}">ถัดไป</button>
            </div>`;
        document.getElementById('histPrevBtn')?.addEventListener('click', () => { historyPage--; renderHistoryPage(); window.scrollTo(0, 0); });
        document.getElementById('histNextBtn')?.addEventListener('click', () => { historyPage++; renderHistoryPage(); window.scrollTo(0, 0); });
    }

    fetchHistory();
}

// ============================================
// ADMIN STUBS (Created in next steps)
// ============================================
function initAdminDashboard() { }
function initAdminUsers() { }
