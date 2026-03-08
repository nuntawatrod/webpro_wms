// public/js/stock.js - Stock In/Out Operations

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

function initAddStockPage() {
    const productSearchInput = document.getElementById('productSearchInput');
    const productSearchResults = document.getElementById('productSearchResults');
    const selectedProductId = document.getElementById('selectedProductId');
    const inReceiveDate = document.getElementById('inReceiveDate');
    const inQuantity = document.getElementById('inQuantity');
    const btnConfirmAdd = document.getElementById('btnConfirmAdd');
    const btnCancelAdd = document.getElementById('btnCancelAdd');

    let masterProducts = [];

    // Initialize Page
    async function initPage() {
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
    }

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

    btnCancelAdd.addEventListener('click', () => {
        productSearchInput.value = '';
        selectedProductId.value = '';
        inQuantity.value = '';
        validateAddForm();
    });

    // Handle Submit
    btnConfirmAdd.addEventListener('click', async () => {
        if (btnConfirmAdd.disabled) return;

        btnConfirmAdd.disabled = true;
        btnConfirmAdd.innerHTML = `<svg class="animate-spin h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

        const payload = {
            product_id: parseInt(selectedProductId.value),
            receive_date: inReceiveDate.value,
            quantity: parseInt(inQuantity.value)
        };

        try {
            const res = await fetch(`${API_BASE}/stock/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                showToast('เพิ่มสต็อกสำเร็จ กำลังกลับสู่หน้าหลัก...', 'success');
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
            } else {
                showToast(data.error || 'ล้มเหลวในการเพิ่มสต็อก', 'error');
                btnConfirmAdd.innerHTML = 'ยืนยันเพิ่มสต็อก';
                validateAddForm();
            }
        } catch (err) {
            console.error(err);
            showToast('ระบบเครือข่ายขัดข้อง', 'error');
            btnConfirmAdd.innerHTML = 'ยืนยันเพิ่มสต็อก';
            validateAddForm();
        }
    });

    initPage();
}
