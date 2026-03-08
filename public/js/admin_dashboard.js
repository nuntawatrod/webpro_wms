// public/js/admin_dashboard.js - Admin Dashboard Stats & Charts

function initAdminDashboard() {
    let statsData = null;
    let currentFreqTab = 'receive';
    let donutChart = null;

    const CHART_COLORS = ['#34d399', '#f472b6', '#fb923c', '#a78bfa', '#60a5fa', '#94a3b8'];

    async function loadStats() {
        try {
            const [statsRes, sysLogsRes] = await Promise.all([
                fetch('/api/admin/dashboard-stats'),
                fetch('/api/admin/system-logs')
            ]);
            statsData = await statsRes.json();
            const mgmtLogs = await sysLogsRes.json();

            // Stat cards
            document.getElementById('statTotalProducts').textContent = (statsData.totalProducts ?? '—').toLocaleString();
            const low = statsData.lowStockCount ?? 0;
            document.getElementById('statLowStock').textContent = low.toLocaleString();
            document.getElementById('statLowStockNote').textContent = low === 0 ? 'ปริมาณสต็อกปกติ' : `ต้องตรวจสอบ ${low} รายการ`;
            document.getElementById('statLowStockNote').className = `text-xs font-medium mt-1 ${low === 0 ? 'text-emerald-500' : 'text-rose-500'}`;
            document.getElementById('statCategories').textContent = (statsData.categoriesCount ?? '—').toLocaleString();
            document.getElementById('statTotalValue').textContent = '฿' + (statsData.totalValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

            // Donut Chart
            renderDonutChart(statsData.categoryDistribution || []);

            // Low stock table
            const tbLow = document.getElementById('tbLowStock');
            if (!statsData.lowStockList || statsData.lowStockList.length === 0) {
                tbLow.innerHTML = '<tr><td colspan="3" class="px-5 py-6 text-center text-slate-400">ยังไม่มีรายการเตือน</td></tr>';
            } else {
                tbLow.innerHTML = statsData.lowStockList.map(item =>
                    `<tr class="hover:bg-slate-50">
                        <td class="px-5 py-3 text-[11px] font-mono text-slate-400">#${item.id}</td>
                        <td class="px-5 py-3 font-medium text-slate-700">${item.product_name}</td>
                        <td class="px-5 py-3 text-right text-rose-600 font-bold">${item.total_qty}</td>
                    </tr>`).join('');
            }

            // Frequent table
            renderFreqTable();

            // System logs
            const tb = document.getElementById('recentActivity');
            if (!mgmtLogs || mgmtLogs.length === 0) {
                tb.innerHTML = '<tr><td colspan="4" class="px-6 py-6 text-center text-slate-400">ยังไม่มีบันทึก</td></tr>';
            } else {
                tb.innerHTML = mgmtLogs.slice(0, 20).map(log => {
                    const d = new Date((log.action_date || '').replace(' ', 'T') + '+07:00');
                    const dateStr = isNaN(d) ? log.action_date : d.toLocaleString('th-TH', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok'
                    });
                    let badge = '', detail = log.extra_info || '-';
                    if (log.action_type === 'CREATE_PRODUCT') badge = '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">สร้างสินค้า</span>';
                    else if (log.action_type === 'DELETE_PRODUCT') badge = '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">ลบสินค้า</span>';
                    else if (log.action_type === 'CREATE_USER') badge = '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-700">สร้างผู้ใช้</span>';
                    else if (log.action_type === 'DELETE_USER') badge = '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700">ลบผู้ใช้</span>';
                    else badge = `<span class="text-xs text-slate-500">${log.action_type}</span>`;
                    return `<tr class="hover:bg-slate-50 transition-colors">
                        <td class="px-6 py-3 text-xs text-slate-500 whitespace-nowrap">${dateStr}</td>
                        <td class="px-6 py-3">${badge}</td>
                        <td class="px-6 py-3 text-sm text-slate-700">${detail}</td>
                        <td class="px-6 py-3 text-sm text-slate-500">${log.actor_name || '-'}</td>
                    </tr>`;
                }).join('');
            }
        } catch (e) {
            console.error(e);
        }
    }

    function renderDonutChart(data) {
        const canvas = document.getElementById('stockDonutChart');
        const legend = document.getElementById('chartLegend');
        const emptyMsg = document.getElementById('emptyChartMsg');

        if (!data || data.length === 0) {
            canvas.classList.add('hidden');
            legend.classList.add('hidden');
            emptyMsg.classList.remove('hidden');
            return;
        }

        const labels = data.map(d => d.category_name || 'อื่นๆ');
        const values = data.map(d => d.total);
        const totalQty = values.reduce((a, b) => a + b, 0);

        document.getElementById('donutTotalQty').textContent = totalQty.toLocaleString();

        if (donutChart) donutChart.destroy();
        donutChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: CHART_COLORS.slice(0, data.length),
                    borderWidth: 3,
                    borderColor: '#ffffff',
                    hoverOffset: 6
                }]
            },
            options: {
                cutout: '72%',
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed.toLocaleString()} (${((ctx.parsed / totalQty) * 100).toFixed(1)}%)` } }
                },
                animation: { animateScale: true, duration: 600 }
            }
        });

        legend.innerHTML = data.map((d, i) => {
            const pct = ((d.total / totalQty) * 100).toFixed(1);
            return `<div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full flex-shrink-0" style="background:${CHART_COLORS[i]}"></span>
                <span class="text-xs text-slate-600 flex-1 truncate">${d.category_name || 'อื่นๆ'}</span>
                <span class="text-xs font-semibold text-slate-700">${pct}%</span>
            </div>`;
        }).join('');
    }

    function renderFreqTable() {
        if (!statsData) return;
        const list = currentFreqTab === 'receive' ? statsData.frequentReceiveList : statsData.frequentWithdrawList;
        const tb = document.getElementById('tbFrequent');
        if (!list || list.length === 0) {
            tb.innerHTML = '<tr><td colspan="3" class="px-5 py-6 text-center text-slate-400">ยังไม่มีรายการ</td></tr>';
        } else {
            tb.innerHTML = list.map(item =>
                `<tr class="hover:bg-slate-50">
                    <td class="px-5 py-3 font-medium text-slate-700">${item.product_name}</td>
                    <td class="px-5 py-3 text-center text-slate-500">${item.freq} ครั้ง</td>
                    <td class="px-5 py-3 text-right font-mono font-bold text-slate-700">${item.total_qty}</td>
                </tr>`).join('');
        }
    }

    // expose toggleFreqTab globally (ถูกเรียกจาก onclick ใน EJS)
    window.toggleFreqTab = function(tab) {
        currentFreqTab = tab;
        const btnR = document.getElementById('btnFreqReceive');
        const btnW = document.getElementById('btnFreqWithdraw');
        if (tab === 'receive') {
            btnR.className = 'px-3 py-1.5 text-xs font-semibold rounded-md bg-white shadow-sm text-blue-700 transition duration-150';
            btnW.className = 'px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-700 transition duration-150';
        } else {
            btnW.className = 'px-3 py-1.5 text-xs font-semibold rounded-md bg-white shadow-sm text-rose-700 transition duration-150';
            btnR.className = 'px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-700 transition duration-150';
        }
        renderFreqTable();
    };

    loadStats();
}