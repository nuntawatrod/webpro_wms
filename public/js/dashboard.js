// public/js/dashboard.js - Dashboard & Inventory Management

function initDashboard() {
    let inventoryData = [];
    let currentView = 'grid';
    let currentSearch = '';
    let currentCategory = 'all';
    let currentSort = 'expiry-asc';
    let currentPage = 1;
    let showExpiredMode = false;
    const PAGE_SIZE = 40;

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
                btnToggleExpired.className = 'bg-slate-800 hover:bg-slate-900 text-white w-44 justify-center py-2.5 rounded-xl text-sm font-bold shadow-md shadow-slate-800/20 transition-all flex items-center shrink-0 ml-1 sm:ml-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500';
                btnToggleExpired.innerHTML = `<svg class="w-5 h-5 mr-1.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>กลับสินค้าปกติ`;
            } else {
                btnToggleExpired.className = 'bg-rose-600 hover:bg-rose-700 text-white w-44 justify-center py-2.5 rounded-xl text-sm font-bold shadow-md shadow-rose-600/20 transition-all flex items-center shrink-0 ml-1 sm:ml-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500';
                btnToggleExpired.innerHTML = `<svg class="w-5 h-5 mr-1.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>ดูสินค้าหมดอายุ`;
            }
            renderData();
        });
    }

    fetchInventory();

    function precalculateExpiries() {
        if (!inventoryData) return;
        updateBkkTodayDate();
        inventoryData.forEach(p => {
            p.batches.forEach(b => {
                b.daysRemaining = getDaysRemaining(b.expiry_date);
            });
        });
    }

    async function fetchInventory() {
        loadingIndicator.classList.remove('hidden');
        gridView.classList.add('hidden');
        tableView.classList.add('hidden');
        emptyState.classList.add('hidden');

        try {
            const res = await fetch(`${API_BASE}/inventory`);
            if (!res.ok) throw new Error('Failed to load inventory');
            inventoryData = await res.json();
            precalculateExpiries();
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

    async function reloadInventorySilently() {
        try {
            const res = await fetch(`${API_BASE}/inventory`);
            if (res.ok) {
                inventoryData = await res.json();
                precalculateExpiries();
                updateExpiryBanner();
                renderData();
            }
        } catch (err) {
            console.error('Silent reload failed', err);
        }
    }

    // ---- Expiry Banner ----
    function updateExpiryBanner() {
        const banner = document.getElementById('expiryBanner');
        const bannerText = document.getElementById('expiryBannerText');
        if (!banner || !bannerText) return;
        const expiredToday = inventoryData.filter(p =>
            p.batches.some(b => {
                const d = b.daysRemaining;
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
            btn.className = `px-4 py-1.5 text-sm font-medium rounded-full transition-all focus:outline-none whitespace-nowrap ${isActive ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20' : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600'}`;
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

        const filtered = inventoryData.filter(p => {
            const matchCat = currentCategory === 'all' || (p.category_name || 'ทั่วไป') === currentCategory;
            const matchSearch = currentSearch === '' || p.product_name.toLowerCase().includes(currentSearch);
            if (!matchCat || !matchSearch) return false;
            const hasExpired = p.batches.some(b => b.daysRemaining !== null && b.daysRemaining < 0);
            const hasNormal = p.batches.some(b => b.daysRemaining !== null && b.daysRemaining >= 0);
            if (p.batches.length === 0) return !showExpiredMode;
            return showExpiredMode ? hasExpired : (hasNormal || p.total_quantity === 0);
        });

        const sortedData = [...filtered].sort((a, b) => {
            if (currentSort === 'qty-desc') {
                const qA = showExpiredMode ? (a.expired_quantity || 0) : a.total_quantity;
                const qB = showExpiredMode ? (b.expired_quantity || 0) : b.total_quantity;
                if (qA === qB) return a.product_name.localeCompare(b.product_name, 'th');
                return qB - qA;
            } else if (currentSort === 'expiry-asc') {
                const getNearest = (p) => {
                    let min = null;
                    p.batches.forEach(batch => {
                        const d = batch.daysRemaining;
                        if (d !== null) {
                            if (showExpiredMode && d >= 0) return;
                            if (!showExpiredMode && d < 0) return;
                            if (min === null || d < min) min = d;
                        }
                    });
                    return min;
                };
                const da = getNearest(a), db = getNearest(b);
                if (da === null && db === null) return a.product_name.localeCompare(b.product_name, 'th');
                if (da === null) return 1;
                if (db === null) return -1;
                if (da === db) return a.product_name.localeCompare(b.product_name, 'th');
                return da - db;
            } else {
                const qA = showExpiredMode ? (a.expired_quantity || 0) : a.total_quantity;
                const qB = showExpiredMode ? (b.expired_quantity || 0) : b.total_quantity;
                if (qA === qB) return a.product_name.localeCompare(b.product_name, 'th');
                return qA - qB;
            }
        });

        const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageData = sortedData.slice(start, start + PAGE_SIZE);
        renderPagination(sortedData.length, totalPages);

        if (pageData.length === 0) {
            gridView.classList.add('hidden');
            tableView.classList.add('hidden');
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
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

        // Delete expired batch button (header)
        const deleteContainer = document.getElementById('deleteExpiredContainer');
        const btnDelete = document.getElementById('btnDeleteExpired');
        const btnDeleteText = document.getElementById('btnDeleteExpiredText');

        if (deleteContainer && btnDelete && btnDeleteText && (!AUTH_USER || AUTH_USER.role !== 'staff')) {
            let expiredBatchesCount = 0;
            if (showExpiredMode) {
                sortedData.forEach(p => p.batches.forEach(b => {
                    if (b.daysRemaining !== null && b.daysRemaining < 0) expiredBatchesCount++;
                }));
            }
            if (showExpiredMode && expiredBatchesCount > 0) {
                deleteContainer.classList.remove('hidden');
                btnDeleteText.textContent = `ลบสินค้าหมดอายุ${currentCategory !== 'all' ? 'ในหมวดนี้' : 'ทั้งหมด'} (${expiredBatchesCount})`;
                const newBtnDelete = btnDelete.cloneNode(true);
                btnDelete.parentNode.replaceChild(newBtnDelete, btnDelete);
                newBtnDelete.addEventListener('click', async () => {
                    const batchesToDelete = [];
                    sortedData.forEach(p => p.batches.forEach(b => {
                        if (b.daysRemaining !== null && b.daysRemaining < 0)
                            batchesToDelete.push({ product_id: p.id, stock_id: b.stock_id });
                    }));
                    if (batchesToDelete.length === 0) { showToast('ไม่มีสินค้าหมดอายุให้ลบ', 'error'); return; }
                    showDeleteConfirmModal(`คุณแน่ใจหรือไม่ที่จะลบสินค้าที่หมดอายุ ${batchesToDelete.length} ล็อต?`, async () => {
                        try {
                            const res = await fetch(`${API_BASE}/stock/delete-expired`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ category: currentCategory, expired_batches: batchesToDelete })
                            });
                            const result = await res.json();
                            if (res.ok) { showToast('ลบรายการสำเร็จ', 'success'); reloadInventorySilently(); }
                            else alert(result.error || 'เกิดข้อผิดพลาดในการลบ');
                        } catch (err) { alert('เกิดข้อผิดพลาดในการเชื่อมต่อ'); }
                    });
                });
            } else {
                deleteContainer.classList.add('hidden');
            }
        }
    }

    // =============================================
    // RENDER GRID — UI แบบเก่า (รูปภาพ + แถบสี + ปุ่มดูรายละเอียด)
    // =============================================
    function renderGrid(pageData) {
        gridView.innerHTML = '';
        pageData.forEach(product => {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col group product-card';

            const activeQty = product.total_quantity;
            const expiredQty = product.expired_quantity || 0;

            // พื้นหลัง + สีตัวเลขตาม stock level
            let qtyClass = 'text-emerald-600';
            let qtyBgClass = 'bg-emerald-50';
            if (activeQty === 0) {
                qtyClass = 'text-slate-500'; qtyBgClass = 'bg-slate-50';
            } else if (activeQty < 50) {
                qtyClass = 'text-amber-600'; qtyBgClass = 'bg-amber-50';
            }

            // วันหมดอายุที่ใกล้ที่สุด (เฉพาะ batch ที่ยังไม่หมด)
            let nearestExpiry = null;
            let nearestDays = null;
            product.batches.forEach(b => {
                const days = b.daysRemaining;
                if (days !== null && days >= 0) {
                    if (nearestDays === null || days < nearestDays) {
                        nearestDays = days; nearestExpiry = b.expiry_date;
                    }
                }
            });

            // สีวันหมดอายุ
            let expiryColor = 'text-amber-600';
            if (nearestDays !== null && nearestDays === 0) expiryColor = 'text-rose-600';
            else if (nearestDays !== null && nearestDays <= 2) expiryColor = 'text-orange-500';

            card.innerHTML = `
                <img loading="lazy"
                     src="${product.image_url || '/images/placeholder.png'}"
                     alt="${product.product_name}"
                     class="w-full h-48 object-cover bg-slate-100">
                <div class="${qtyBgClass} px-4 py-2.5 border-b border-slate-100">
                    <div class="text-xs text-slate-600 uppercase tracking-widest font-semibold mb-0.5">${product.category_name || 'ทั่วไป'}</div>
                    <div class="flex items-end justify-between">
                        <div>
                            <div class="text-xs text-slate-500">สต็อกปัจจุบัน</div>
                            <div class="text-2xl font-bold ${qtyClass}">${activeQty}</div>
                        </div>
                        ${expiredQty > 0 ? `<div class="text-xs px-2 py-1 bg-rose-100 text-rose-700 rounded-full font-semibold">หมดอายุ: ${expiredQty}</div>` : ''}
                    </div>
                </div>
                <div class="px-4 py-3.5 flex-grow">
                    <h3 class="font-bold text-slate-800 line-clamp-2 group-hover:text-emerald-700 transition-colors">${product.product_name}</h3>
                    <p class="text-xs text-slate-500 mt-1">฿${product.price || '-'}</p>
                    ${nearestExpiry ? `
                        <div class="mt-2 pt-2 border-t border-slate-100 text-xs">
                            <div class="text-slate-500">ใกล้หมดอายุ:</div>
                            <div class="font-semibold ${expiryColor}">${formatDate(nearestExpiry)} (${nearestDays} วัน)</div>
                        </div>` : ''}
                </div>
                <button class="view-details-btn mx-3 mb-3 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors w-full focus:outline-none" data-id="${product.id}">
                    ดูรายละเอียด
                </button>
            `;

            gridView.appendChild(card);

            // ผูก event ผ่าน JS (ไม่ใช้ onclick inline)
            card.querySelector('.view-details-btn').addEventListener('click', () => {
                showLotDetailsModal(product.id, inventoryData, showExpiredMode);
            });
        });
    }

    // =============================================
    // RENDER TABLE — UI แบบเก่า (รูป + ชื่อ + จำนวน + สถานะ + ดูล็อต)
    // =============================================
    function renderTable(pageData) {
        tableBody.innerHTML = '';
        pageData.forEach(product => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition-colors group border-b border-slate-100/60';

            const activeQty = product.total_quantity;
            const expiredQty = product.expired_quantity || 0;

            let qtyClass = 'text-emerald-600 font-semibold';
            if (activeQty === 0 && expiredQty === 0) qtyClass = 'text-slate-400';
            else if (activeQty < 50 && activeQty > 0) qtyClass = 'text-amber-600 font-semibold';
            else if (activeQty > 0 && expiredQty > 0) qtyClass = 'text-orange-600 font-semibold';

            const imgHtml = product.image_url
                ? `<img src="${product.image_url}" class="h-10 w-10 object-contain rounded bg-white border border-slate-200 p-0.5">`
                : `<div class="h-10 w-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                       <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                   </div>`;

            let statusHtml = activeQty > 0
                ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">มีสินค้า</span>`
                : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">หมด</span>`;

            let expiredWarning = expiredQty > 0
                ? `<br><span class="text-xs text-rose-600 font-semibold">หมดอายุ: ${expiredQty}</span>` : '';

            tr.innerHTML = `
                <td class="px-6 py-4 w-16">${imgHtml}</td>
                <td class="px-6 py-4">
                    <div class="font-medium text-slate-800">${product.product_name}</div>
                    <div class="text-xs text-slate-500 mt-0.5">${product.category_name || 'ทั่วไป'}</div>
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="font-mono text-lg ${qtyClass}">${activeQty}</div>${expiredWarning}
                </td>
                <td class="px-6 py-4 text-center">${statusHtml}</td>
                <td class="px-6 py-4 text-right w-16">
                    <button class="btn-view-lot text-emerald-600 hover:text-emerald-700 font-medium text-sm focus:outline-none p-1 rounded hover:bg-emerald-50 transition-colors" data-id="${product.id}">ดูล็อต</button>
                </td>
            `;

            tableBody.appendChild(tr);

            // ผูก event ผ่าน JS — แก้ปัญหา inventoryData ไม่อยู่ใน scope ของ onclick inline
            tr.querySelector('.btn-view-lot').addEventListener('click', () => {
                showLotDetailsModal(product.id, inventoryData, showExpiredMode);
            });
        });
    }

    function renderPagination(total, pages) {
        const pg = document.getElementById('paginationContainer');
        if (!pg) return;
        if (pages <= 1) { pg.innerHTML = ''; return; }
        const fromItem = Math.min((currentPage - 1) * PAGE_SIZE + 1, total);
        const toItem = Math.min(currentPage * PAGE_SIZE, total);
        pg.innerHTML = `
            <div class="flex items-center justify-between flex-wrap gap-3">
                <p class="text-sm text-slate-500">แสดง ${fromItem}–${toItem} จาก ${total} รายการ</p>
                <div class="flex items-center gap-2">
                    <button id="dbPrevBtn" class="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" ${currentPage === 1 ? 'disabled' : ''}>← ก่อนหน้า</button>
                    <span class="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg">หน้า ${currentPage} / ${pages}</span>
                    <button id="dbNextBtn" class="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" ${currentPage === pages ? 'disabled' : ''}>ถัดไป →</button>
                </div>
            </div>`;
        document.getElementById('dbPrevBtn')?.addEventListener('click', () => { currentPage--; renderData(); window.scrollTo(0, 0); });
        document.getElementById('dbNextBtn')?.addEventListener('click', () => { currentPage++; renderData(); window.scrollTo(0, 0); });
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

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            currentSort = sortSelect.value;
            currentPage = 1;
            renderData();
        });
    }

    const searchBox = document.getElementById('productSearchBox');
    if (searchBox) {
        searchBox.addEventListener('input', debounce((e) => {
            currentSearch = e.target.value.toLowerCase().trim();
            currentPage = 1;
            renderData();
        }, 250));
    }
}