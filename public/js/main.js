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
    let currentSort = 'category'; // default
    let currentView = 'grid'; // default

    const gridView = document.getElementById('gridView');
    const tableView = document.getElementById('tableView');
    const tableBody = document.getElementById('tableBody');
    const btnGridView = document.getElementById('btnGridView');
    const btnTableView = document.getElementById('btnTableView');
    const emptyState = document.getElementById('emptyState');
    const loadingIndicator = document.getElementById('loadingIndicator');

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
            renderData();
        } catch (err) {
            console.error(err);
            showToast('เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า', 'error');
            emptyState.classList.remove('hidden');
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    }

    function renderData() {
        if (inventoryData.length === 0) {
            gridView.classList.add('hidden');
            tableView.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        // Sorting Logic including category
        const sortedData = [...inventoryData].sort((a, b) => {
            if (currentSort === 'category') {
                const catA = a.category_name || '';
                const catB = b.category_name || '';
                if (catA === catB) return a.product_name.localeCompare(b.product_name);
                return catA.localeCompare(catB);
            }
            if (currentSort === 'az') return a.product_name.localeCompare(b.product_name);
            if (currentSort === 'newest') {
                const dateA = a.batches.length ? Math.max(...a.batches.map(b => new Date(b.receive_date).getTime())) : 0;
                const dateB = b.batches.length ? Math.max(...b.batches.map(b => new Date(b.receive_date).getTime())) : 0;
                return dateB - dateA;
            }
            if (currentSort === 'expiring') {
                const expA = a.batches.reduce((nearest, b) => {
                    if (!b.expiry_date) return nearest;
                    const d = new Date(b.expiry_date).getTime();
                    return nearest === null ? d : Math.min(nearest, d);
                }, null);

                const expB = b.batches.reduce((nearest, b) => {
                    if (!b.expiry_date) return nearest;
                    const d = new Date(b.expiry_date).getTime();
                    return nearest === null ? d : Math.min(nearest, d);
                }, null);

                if (expA === null && expB === null) return 0;
                if (expA === null) return 1;
                if (expB === null) return -1;
                return expA - expB;
            }
            return 0;
        });

        if (currentView === 'grid') {
            renderGrid(sortedData);
            gridView.classList.remove('hidden');
            tableView.classList.add('hidden');
        } else {
            renderTable(sortedData);
            tableView.classList.remove('hidden');
            gridView.classList.add('hidden');
        }
    }

    function renderGrid(data) {
        gridView.innerHTML = '';

        data.forEach(product => {
            let isExpiringSoon = false;
            let nearestExpiryDay = null;

            product.batches.forEach(b => {
                if (b.expiry_date) {
                    const days = getDaysRemaining(b.expiry_date);
                    if (days !== null) {
                        if (nearestExpiryDay === null || days < nearestExpiryDay) nearestExpiryDay = days;
                        if (days <= 2) isExpiringSoon = true;
                    }
                }
            });

            const card = document.createElement('div');
            card.className = `product-card bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col relative ${isExpiringSoon ? 'border-rose-300 ring-1 ring-rose-300' : 'border-slate-200'}`;

            const badgeHTML = isExpiringSoon ?
                `<div class="absolute top-3 right-3 bg-rose-100 text-rose-700 text-xs font-bold px-2 py-1 rounded shadow-sm z-10 flex items-center">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    ใกล้หมดอายุ (${nearestExpiryDay} วัน)
                 </div>` : '';

            card.innerHTML = `
                ${badgeHTML}
                <div class="absolute top-3 left-3 bg-white/90 backdrop-blur text-slate-700 text-xs font-semibold px-2 py-1 rounded shadow-sm z-10 border border-slate-100">
                    ${product.category_name || 'ทั่วไป'}
                </div>
                <div class="h-48 bg-slate-100 overflow-hidden flex items-center justify-center p-4">
                    ${product.image_url
                    ? `<img src="${product.image_url}" alt="${product.product_name}" class="object-contain h-full w-full mix-blend-multiply">`
                    : `<svg class="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`
                }
                </div>
                <div class="p-5 flex-grow flex flex-col">
                    <h3 class="font-semibold text-slate-800 text-base leading-snug mb-2 line-clamp-2" title="${product.product_name}">${product.product_name}</h3>
                    
                    <div class="mt-auto pt-4 border-t border-slate-100 flex justify-between items-end">
                        <div>
                            <p class="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">จำนวนคงเหลือ</p>
                            <p class="text-2xl font-bold ${product.total_quantity === 0 ? 'text-rose-500' : 'text-emerald-600'}">${product.total_quantity}</p>
                        </div>
                        <div class="text-right">
                            <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${product.total_quantity > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
                                ${product.total_quantity > 0 ? 'มีสินค้า' : 'สินค้าหมด'}
                            </span>
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
            const isExpiringSoonOverall = product.batches.some(b => {
                if (!b.expiry_date) return false;
                const d = getDaysRemaining(b.expiry_date);
                return d !== null && d <= 2;
            });

            // Master Row
            const tr = document.createElement('tr');
            tr.className = `hover:bg-slate-50 transition-colors group border-b border-slate-100 ${isExpiringSoonOverall ? 'bg-rose-50/30' : ''}`;

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

    const sortDropdownContainer = document.getElementById('sortDropdownContainer');
    const sortMenu = document.getElementById('sortMenu');
    const btnSort = document.getElementById('btnSort');
    const sortLabel = document.getElementById('sortLabel');

    btnSort.addEventListener('click', (e) => {
        e.stopPropagation();
        sortMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        sortMenu.classList.add('hidden');
    });

    sortMenu.querySelectorAll('[data-sort]').forEach(item => {
        item.addEventListener('click', (e) => {
            currentSort = e.target.dataset.sort;
            sortLabel.textContent = `เรียง: ${e.target.textContent}`;
            renderData();
        });
    });

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

        try {
            const res = await fetch(`${API_BASE}/products`);
            masterProducts = await res.json();
            renderProductSearchOptions(masterProducts);
        } catch (e) {
            console.error(e);
            showToast('พบข้อผิดพลาดขณะโหลดรายการสินค้า', 'error');
        }

        addModalOverlay.classList.remove('hidden');
        addModalContent.style.display = 'block';
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

    fetchHistory();

    async function fetchHistory() {
        try {
            const res = await fetch(`${API_BASE}/history`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            renderHistory(data);
        } catch (e) {
            tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-rose-500">ลดข้อมูลผิดพลาด โปรดลองใหม่</td></tr>`;
        }
    }

    function renderHistory(data) {
        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">ไม่พบประวัติการทำรายการ</td></tr>`;
            return;
        }

        tableBody.innerHTML = '';

        data.forEach(log => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100/60';

            const d = new Date(log.action_date);
            const formattedDate = d.toLocaleString('th-TH', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            const isAdd = log.action_type === 'ADD';
            const actionBadge = isAdd
                ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">รับเข้า (ADD)</span>`
                : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">เบิกออก (WITHDRAW)</span>`;

            tr.innerHTML = `
                <td class="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">${formattedDate}</td>
                <td class="px-6 py-4">${actionBadge}</td>
                <td class="px-6 py-4 font-medium text-slate-800">${log.product_name}</td>
                <td class="px-6 py-4 text-right font-mono font-bold ${isAdd ? 'text-emerald-600' : 'text-rose-600'}">
                    ${isAdd ? '+' : '-'}${log.quantity}
                </td>
                <td class="px-6 py-4 text-sm text-slate-600">${log.actor_name}</td>
            `;

            tableBody.appendChild(tr);
        });
    }

}

// ============================================
// ADMIN STUBS (Created in next steps)
// ============================================
function initAdminDashboard() { }
function initAdminUsers() { }
