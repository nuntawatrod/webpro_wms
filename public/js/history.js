// public/js/history.js

function initHistoryPage() {
    const tableBody = document.getElementById('historyTableBody');
    const PAGE_SIZE = 40;
    let historyPage = 1;

    let currentSearch = '';
    let currentTypeFilter = 'all';
    let currentDateRange = 'all';

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
                    fetchHistory();
                });
                typeFiltersContainer.appendChild(btn);
            });
        }

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
                    fetchHistory();
                });
                dateFiltersContainer.appendChild(btn);
            });
        }
    }

    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                currentSearch = e.target.value.trim();
                historyPage = 1;
                fetchHistory();
            }, 300);
        });
    }

    if (btnExportCsv) {
        btnExportCsv.addEventListener('click', exportToCSV);
    }

    async function exportToCSV() {
        try {
            // Fetch up to 10,000 records for export with current filters
            const url = new URL(`${window.location.origin}${API_BASE}/history`);
            url.searchParams.append('page', 1);
            url.searchParams.append('limit', 10000); // large limit for export
            url.searchParams.append('search', currentSearch);
            url.searchParams.append('actionType', currentTypeFilter);
            url.searchParams.append('actionDateType', currentDateRange);

            const res = await fetch(url);
            if (!res.ok) throw new Error();
            const json = await res.json();
            const dataToExport = json.data;

            if (!dataToExport || dataToExport.length === 0) {
                showToast('ไม่มีข้อมูลที่จะ Export', 'error');
                return;
            }

            const headers = ['วัน-เวลา', 'ประเภทรายการ', 'ชื่อสินค้า / รายละเอียด', 'จำนวน', 'ผู้ทำรายการ'];
            const rows = dataToExport.map(log => {
                const rawDate = (log.action_date || '');
                const d = new Date(rawDate.replace(' ', 'T') + '+07:00');
                const dateStr = isNaN(d.getTime()) ? rawDate : d.toLocaleString('th-TH', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok'
                });

                const type = log.action_type || '';
                let productStr = log.product_name || '';
                if (log.extra_info && type !== 'EXPIRED') productStr = log.extra_info;
                if (type === 'EXPIRED') productStr = log.extra_info ? (log.product_name || log.extra_info.split(' | ')[0]) + ' (หมดอายุ)' : log.product_name;

                return [dateStr, type, productStr.replace(/"/g, '""'), log.quantity || '', log.actor_name || ''];
            });

            const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', blobUrl);
            link.setAttribute('download', `wms_history_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            showToast('ส่งออกข้อมูลผิดพลาด', 'error');
        }
    }

    async function fetchHistory() {
        try {
            const url = new URL(`${window.location.origin}${API_BASE}/history`);
            url.searchParams.append('page', historyPage);
            url.searchParams.append('limit', PAGE_SIZE);
            url.searchParams.append('search', currentSearch);
            url.searchParams.append('actionType', currentTypeFilter);
            url.searchParams.append('actionDateType', currentDateRange);

            if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">กำลังโหลด...</td></tr>`;

            const res = await fetch(url);
            if (!res.ok) throw new Error();
            const json = await res.json();

            renderHistoryPage(json.data, json.meta);
        } catch (e) {
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-rose-500">โหลดข้อมูลผิดพลาด โปรดลองใหม่</td></tr>`;
        }
    }

    function renderHistoryPage(pageData, meta) {
        if (!tableBody) return;
        const total = meta.total;
        const totalPages = meta.totalPages || 1;

        if (total === 0 || !pageData || pageData.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">ไม่พบประวัติการทำรายการตามเงื่อนไขที่เลือก</td></tr>`;
        } else {
            tableBody.innerHTML = '';
            pageData.forEach(log => {
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
                } else if (actionType === 'EXPIRED') {
                    actionBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">สินค้าหมดอายุ</span>`;
                    productDisplay = log.extra_info ? `<span>${log.product_name || log.extra_info.split(' | ')[0]} <br><span class="text-xs text-slate-500">${log.extra_info}</span></span>` : (log.product_name || '-');
                    quantityHtml = `<span class="font-mono font-bold text-slate-600">-${log.quantity ?? ''}</span>`;
                } else {
                    actionBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">${actionType}</span>`;
                }

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100/60';
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

        const pg = document.getElementById('historyPagination');
        if (!pg) return;
        if (totalPages <= 1) { pg.innerHTML = ''; return; }

        const startItem = (historyPage - 1) * PAGE_SIZE + 1;
        const endItem = Math.min(startItem + PAGE_SIZE - 1, total);

        pg.innerHTML = `
            <span>แสดง ${total > 0 ? startItem : 0}–${endItem} จาก ${total} รายการ</span>
            <div class="flex items-center gap-1">
                <button id="histPrevBtn" class="px-3 py-1.5 rounded-lg border border-slate-200 text-sm ${historyPage === 1 ? 'opacity-40 pointer-events-none' : 'hover:bg-slate-100'}">ก่อนหน้า</button>
                <span class="px-3 py-1.5 text-sm font-semibold text-emerald-700">${historyPage} / ${totalPages}</span>
                <button id="histNextBtn" class="px-3 py-1.5 rounded-lg border border-slate-200 text-sm ${historyPage === totalPages ? 'opacity-40 pointer-events-none' : 'hover:bg-slate-100'}">ถัดไป</button>
            </div>`;

        document.getElementById('histPrevBtn')?.addEventListener('click', () => {
            if (historyPage > 1) {
                historyPage--;
                fetchHistory();
                window.scrollTo(0, 0);
            }
        });
        document.getElementById('histNextBtn')?.addEventListener('click', () => {
            if (historyPage < totalPages) {
                historyPage++;
                fetchHistory();
                window.scrollTo(0, 0);
            }
        });
    }

    renderFilterUI();
    fetchHistory();
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/history') initHistoryPage();
});
