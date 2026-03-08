// public/js/add-stock.js

function initAddStockPage() {
    const productSearchInput = document.getElementById('productSearchInput');
    const productSearchResults = document.getElementById('productSearchResults');
    const selectedProductId = document.getElementById('selectedProductId');
    const inReceiveDate = document.getElementById('inReceiveDate');
    const inQuantity = document.getElementById('inQuantity');
    const btnConfirmAdd = document.getElementById('btnConfirmAdd');
    const btnCancelAdd = document.getElementById('btnCancelAdd');

    let masterProducts = [];

    async function initPage() {
        if (inReceiveDate) inReceiveDate.value = new Date().toISOString().split('T')[0];
        if (btnConfirmAdd) btnConfirmAdd.disabled = true;

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
        if (!productSearchResults) return;
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

    if (productSearchInput) {
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
    }

    document.addEventListener('click', (e) => {
        if (productSearchInput && !e.target.closest('#productSearchContainer')) {
            productSearchResults.classList.add('hidden');
        }
    });

    function validateAddForm() {
        if (!btnConfirmAdd) return;
        const hasProduct = selectedProductId.value !== '';
        const hasQuantity = inQuantity.value && parseInt(inQuantity.value) > 0;
        btnConfirmAdd.disabled = !(hasProduct && hasQuantity);
    }

    if (inQuantity) inQuantity.addEventListener('input', validateAddForm);

    if (btnCancelAdd) {
        btnCancelAdd.addEventListener('click', () => {
            productSearchInput.value = '';
            selectedProductId.value = '';
            inQuantity.value = '';
            validateAddForm();
        });
    }

    if (btnConfirmAdd) {
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
                    setTimeout(() => { window.location.href = '/'; }, 1500);
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
    }

    initPage();
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/add-stock') initAddStockPage();
});
