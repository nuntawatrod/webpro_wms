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
        renderProductDropdown({
            container: productSearchContainer,
            list: productSearchResults,
            products: products,
            displayFn: (p) => `${p.product_name} (นำเข้าใหม่จะเก็บได้ ${p.shelf_life_days} วัน)`,
            onSelect: (p) => {
                productSearchInput.value = p.product_name;
                selectedProductId.value = p.id;
                validateAddForm();
            }
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

            setButtonLoading(btnConfirmAdd, true);

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
                    setButtonLoading(btnConfirmAdd, false, 'ยืนยันเพิ่มสต็อก');
                    validateAddForm();
                }
            } catch (err) {
                console.error(err);
                showToast('ระบบเครือข่ายขัดข้อง', 'error');
                setButtonLoading(btnConfirmAdd, false, 'ยืนยันเพิ่มสต็อก');
                validateAddForm();
            }
        });
    }

    initPage();
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/add-stock') initAddStockPage();
});
