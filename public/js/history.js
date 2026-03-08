document.addEventListener('DOMContentLoaded', () => {
    initHistoryPage();
});

function initHistoryPage() {
    const tableBody = document.getElementById('historyTableBody');
    const PAGE_SIZE = 100;
    let allHistory = [];
    let historyPage = 1;

    // Filter states
    let currentSearch = '';
    let currentTypeFilter = 'all'; // all, ADD, WITHDRAW, EXPIRED 
    let currentDateRange = 'all'; // 1M, 3M, 6M, 1Y, all

    const searchInput = document.getElementById('histSearchInput');
    const typeFiltersContainer = document.getElementById('histTypeFilters');
    const dateFiltersContainer = document.getElementById('histDateFilters');
    const btnExportCsv = document.getElementById('btnExportCsv');

    const TYPE_OPTIONS = [
        { id: 'all', label: 'ทั้งหมด' },
        { id: 'ADD', label: 'รับเข้า' },
        { id: 'WITHDRAW', label: 'เบิกออก' },
        { id: 'EXPIRED', label: 'หมดอายุ' }
    ];

    const DATE_OPTIONS = [
        { id: '1M', label: '1 เดือน' },
        { id: '3M', label: '3 เดือน' },
        { id: '6M', label: '6 เดือน' },
        { id: '1Y', label: '1 ปี' },
        { id: 'all', label: 'ทั้งหมด' }
    ];

    function renderFilterUI() {
        // Type filters
        if (typeFiltersContainer) {
            typeFiltersContainer.innerHTML = '';
            TYPE_OPTIONS.forEach(opt => {
                const btn = document.createElement('button');
                const isActive = currentTypeFilter === opt.id;
                btn.className = `px-4 py-1.5 text-sm font-medium rounded-full transition-all focus:outline-none whitespace-nowrap ${isActive ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20' : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600'}`;
                btn.textContent = opt.label;
                btn.addEventListener('click', () => {
                    currentTypeFilter = opt.id;
                    historyPage = 1;
                    renderFilterUI();
                    renderHistoryPage();
                });
                typeFiltersContainer.appendChild(btn);
            });
        }

        // Date filters
        if (dateFiltersContainer) {
            dateFiltersContainer.innerHTML = '';
            DATE_OPTIONS.forEach(opt => {
                const btn = document.createElement('button');
                const isActive = currentDateRange === opt.id;
                btn.className = `px-3 py-1 text-xs font-medium rounded-md transition-all focus:outline-none whitespace-nowrap ${isActive ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`;
                btn.textContent = opt.label;
                btn.addEventListener('click', () => {
                    currentDateRange = opt.id;
                    historyPage = 1;
                    renderFilterUI();
                    renderHistoryPage();
                });
                dateFiltersContainer.appendChild(btn);
            });
        }
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value.toLowerCase().trim();
            historyPage = 1;
            renderHistoryPage();
        });
    }

    if (btnExportCsv) {
        btnExportCsv.addEventListener('click', exportToCSV);
    }

    function getFilteredData() {
        const now = new Date();
        now.setHours(23, 59, 59, 999);

        let cutoffDate = null;
        if (currentDateRange !== 'all') {
            cutoffDate = new Date(now);
            if (currentDateRange === '1M') cutoffDate.setMonth(cutoffDate.getMonth() - 1);
            else if (currentDateRange === '3M') cutoffDate.setMonth(cutoffDate.getMonth() - 3);
            else if (currentDateRange === '6M') cutoffDate.setMonth(cutoffDate.getMonth() - 6);
            else if (currentDateRange === '1Y') cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
            cutoffDate.setHours(0, 0, 0, 0);
        }

        return allHistory.filter(log => {
            // 1. Search Filter
            let matchesSearch = true;
            if (currentSearch) {
                const pName = (log.product_name || '').toLowerCase();
                const aName = (log.actor_name || '').toLowerCase();
                const exInfo = (log.extra_info || '').toLowerCase();
                matchesSearch = pName.includes(currentSearch) || aName.includes(currentSearch) || exInfo.includes(currentSearch);
            }
            if (!matchesSearch) return false;

            // 2. Type Filter
            let matchesType = true;
            if (currentTypeFilter !== 'all') {
                if (currentTypeFilter === 'ADD' || currentTypeFilter === 'WITHDRAW') {
                    matchesType = log.action_type === currentTypeFilter;
                } else if (currentTypeFilter === 'EXPIRED') {
                    matchesType = log.action_type === 'EXPIRED';
                }
            }
            if (!matchesType) return false;

            // 3. Date Filter
            let matchesDate = true;
            if (cutoffDate) {
                const logDateStr = (log.action_date || '').replace(' ', 'T');
                // Use local time for comparison since action_date is already in Bangkok local time
                const logDate = new Date(logDateStr);
                if (!isNaN(logDate)) {
                    matchesDate = logDate >= cutoffDate;
                }
            }
            if (!matchesDate) return false;

            return true;
        });
    }

    function exportToCSV() {
        const dataToExport = getFilteredData();
        if (dataToExport.length === 0) {
            showToast('ไม่มีข้อมูลที่จะ Export', 'error');
            return;
        }

        const headers = ['วัน-เวลา', 'ประเภทรายการ', 'ชื่อสินค้า / รายละเอียด', 'จำนวน', 'ผู้ทำรายการ'];

        const rows = dataToExport.map(log => {
            const rawDate = (log.action_date || '');
            const d = new Date(rawDate.replace(' ', 'T') + '+07:00');
            const dateStr = isNaN(d.getTime()) ? rawDate : d.toLocaleString('th-TH', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' // Using Bangkok timezone
            });

            const type = log.action_type || '';
            let productStr = log.product_name || '';
            if (log.extra_info && type !== 'EXPIRED') productStr = log.extra_info;
            if (type === 'EXPIRED') {
                productStr = log.extra_info ? (log.product_name || log.extra_info.split(' | ')[0]) + ' (หมดอายุ)' : log.product_name;
            }

            const qty = log.quantity || '';
            const actor = log.actor_name || '';

            return [dateStr, type, productStr.replace(/"/g, '""'), qty, actor];
        });

        const csvContent = "\uFEFF" + [
            headers.join(','),
            ...rows.map(r => r.map(c => `"${c}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `wms_history_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function fetchHistory() {
        try {
            const res = await fetch(`${API_BASE}/history`);
            if (!res.ok) throw new Error();
            allHistory = await res.json();
            historyPage = 1;
            renderFilterUI();
            renderHistoryPage();
        } catch (e) {
            tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-rose-500">โหลดข้อมูลผิดพลาด โปรดลองใหม่</td></tr>`;
        }
    }

    function renderHistoryPage() {
        const filteredData = getFilteredData();
        const total = filteredData.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        if (historyPage > totalPages) historyPage = totalPages;
        const start = (historyPage - 1) * PAGE_SIZE;
        const pageData = filteredData.slice(start, start + PAGE_SIZE);

        if (total === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">ไม่พบประวัติการทำรายการตามเงื่อนไขที่เลือก</td></tr>`;
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
                } else if (actionType === 'EXPIRED') {
                    actionBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">สินค้าหมดอายุ</span>`;
                    productDisplay = log.extra_info ? `<span>${log.product_name || log.extra_info.split(' | ')[0]} <br><span class="text-xs text-slate-500">${log.extra_info}</span></span>` : (log.product_name || '-');
                    quantityHtml = `<span class="font-mono font-bold text-slate-600">-${log.quantity ?? ''}</span>`;
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
