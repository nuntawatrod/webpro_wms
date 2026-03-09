// public/js/withdraw.js

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

    if (wdDate) wdDate.value = new Date().toISOString().split('T')[0];

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
        renderProductDropdown({
            container: document.getElementById('wdProductContainer'),
            list: wdProductList,
            products: products,
            onSelect: (p) => {
                wdProductInput.value = p.product_name;
                wdSelectedProductId.value = p.id;
                validateForm();
            }
        });
    }

    if (wdProductInput) {
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
    }

    document.addEventListener('click', (e) => {
        if (wdProductInput && !e.target.closest('#wdProductContainer')) {
            wdProductList.classList.add('hidden');
        }
    });

    function validateForm() {
        if (!btnWithdrawSubmit) return;
        const hasProduct = wdSelectedProductId && wdSelectedProductId.value !== '';
        const hasQty = wdQuantity && wdQuantity.value && parseInt(wdQuantity.value) > 0;
        const hasActor = wdActorName && wdActorName.value.trim() !== '';
        btnWithdrawSubmit.disabled = !(hasProduct && hasQty && hasActor);
    }

    if (wdQuantity) wdQuantity.addEventListener('input', validateForm);
    if (wdActorName) wdActorName.addEventListener('input', validateForm);

    if (btnWithdrawReset) {
        btnWithdrawReset.addEventListener('click', () => {
            wdProductInput.value = '';
            wdSelectedProductId.value = '';
            wdQuantity.value = '';
            validateForm();
        });
    }

    if (btnWithdrawSubmit) {
        btnWithdrawSubmit.addEventListener('click', async () => {
            if (btnWithdrawSubmit.disabled) return;

            setButtonLoading(btnWithdrawSubmit, true);

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
                setButtonLoading(btnWithdrawSubmit, false, 'ยืนยันการเบิก');
                validateForm();
            }
        });
    }

    fetchAvailable();
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/withdraw') initWithdrawPage();
});
