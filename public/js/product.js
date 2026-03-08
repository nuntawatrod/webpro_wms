// public/js/product.js - Product Management CRUD

function initProductManagement() {
    const viewAdd = document.getElementById('viewAdd');
    const viewEdit = document.getElementById('viewEdit');
    const viewDelete = document.getElementById('viewDelete');

    const activeTab = (window.ACTIVE_TAB || '').replace('manage_products_', '');

    let masterEditProducts = [];
    let masterDeleteProducts = [];
    let currentSelectedProduct = null;

    const searchInput = document.getElementById('deleteSearchInput');
    const searchResults = document.getElementById('deleteSearchResults');
    const productCard = document.getElementById('selectedProductCard');

    function initView() {
        viewAdd.classList.add('hidden');
        viewEdit.classList.add('hidden');
        viewDelete.classList.add('hidden');

        if (activeTab === 'edit') {
            viewEdit.classList.remove('hidden');
            fetchProductsForEdit();
        } else if (activeTab === 'delete') {
            viewDelete.classList.remove('hidden');
            fetchProductsForDelete();
        } else {
            viewAdd.classList.remove('hidden');
        }
    }

    // CREATE
    document.getElementById('createProductForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const product_name = document.getElementById('newProductName').value.trim();
        const category_name = document.getElementById('newProductCategory').value;
        const price = parseFloat(document.getElementById('newProductPrice').value);
        const shelf_life_days = parseInt(document.getElementById('newProductShelfLife').value, 10);
        const image_url = document.getElementById('newProductImageUrl').value.trim();
        try {
            const res = await fetch('/api/admin/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_name, category_name, price, shelf_life_days, image_url })
            });
            const result = await res.json();
            if (res.ok) {
                showToast('บันทึกข้อมูลสินค้าใหม่เรียบร้อยแล้ว', 'success');
                document.getElementById('createProductForm').reset();
                masterEditProducts = [];
                masterDeleteProducts = [];
            } else {
                showToast(result.error || 'บันทึกล้มเหลว', 'error');
            }
        } catch (err) {
            showToast('ระบบขัดข้อง กรุณาลองใหม่', 'error');
        }
    });

    // EDIT
    async function fetchProductsForEdit() {
        if (masterEditProducts.length > 0) return;
        try {
            const res = await fetch('/api/admin/products');
            masterEditProducts = await res.json();
            renderEditSearchOptions(masterEditProducts);
        } catch (e) {
            console.error('Failed to fetch products for edit list');
        }
    }

    function renderEditSearchOptions(products) {
        const el = document.getElementById('editSearchResults');
        el.innerHTML = '';
        if (products.length === 0) {
            el.innerHTML = '<div class="px-4 py-3 text-sm text-slate-500">ไม่พบสินค้า</div>';
            return;
        }
        products.forEach(p => {
            const div = document.createElement('div');
            div.className = 'px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between';
            div.innerHTML = `<span class="text-sm font-medium text-slate-700">${p.product_name}</span><span class="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">${p.category_name}</span>`;
            div.addEventListener('click', () => selectProductForEdit(p));
            el.appendChild(div);
        });
    }

    function selectProductForEdit(product) {
        document.getElementById('editSearchInput').value = product.product_name;
        document.getElementById('editSearchResults').classList.add('hidden');
        document.getElementById('editProductId').value = product.id;
        document.getElementById('editProductName').value = product.product_name;
        document.getElementById('editProductCategory').value = product.category_name;
        document.getElementById('editProductPrice').value = product.price;
        document.getElementById('editProductShelfLife').value = product.shelf_life_days;
        document.getElementById('editProductImageUrl').value = product.image_url || '';
        document.getElementById('editProductForm').classList.remove('hidden');
    }

    document.getElementById('editSearchInput').addEventListener('focus', () => {
        if (masterEditProducts.length > 0) {
            renderEditSearchOptions(masterEditProducts);
            document.getElementById('editSearchResults').classList.remove('hidden');
        }
    });
    document.getElementById('editSearchInput').addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        document.getElementById('editProductForm').classList.add('hidden');
        const filtered = masterEditProducts.filter(p => p.product_name.toLowerCase().includes(val));
        renderEditSearchOptions(filtered);
        document.getElementById('editSearchResults').classList.remove('hidden');
    });
    document.getElementById('btnCancelEdit').addEventListener('click', () => {
        document.getElementById('editSearchInput').value = '';
        document.getElementById('editProductForm').classList.add('hidden');
    });

    document.getElementById('editProductForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editProductId').value;
        const product_name = document.getElementById('editProductName').value.trim();
        const category_name = document.getElementById('editProductCategory').value;
        const price = parseFloat(document.getElementById('editProductPrice').value);
        const shelf_life_days = parseInt(document.getElementById('editProductShelfLife').value, 10);
        const image_url = document.getElementById('editProductImageUrl').value.trim();
        try {
            const res = await fetch(`/api/admin/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_name, category_name, price, shelf_life_days, image_url })
            });
            const result = await res.json();
            if (res.ok) {
                showToast('แก้ไขข้อมูลสินค้าเรียบร้อยแล้ว', 'success');
                masterEditProducts = [];
                masterDeleteProducts = [];
                document.getElementById('editSearchInput').value = '';
                document.getElementById('editProductForm').classList.add('hidden');
            } else {
                showToast(result.error || 'แก้ไขล้มเหลว', 'error');
            }
        } catch (err) {
            showToast('ระบบขัดข้อง กรุณาลองใหม่', 'error');
        }
    });

    // DELETE
    async function fetchProductsForDelete() {
        if (masterDeleteProducts.length > 0) return;
        try {
            const res = await fetch('/api/admin/products');
            masterDeleteProducts = await res.json();
            renderDeleteSearchOptions(masterDeleteProducts);
        } catch (e) {
            console.error('Failed to fetch products for delete list');
        }
    }

    function renderDeleteSearchOptions(products) {
        searchResults.innerHTML = '';
        if (products.length === 0) {
            searchResults.innerHTML = '<div class="px-4 py-3 text-sm text-slate-500">ไม่พบสินค้า</div>';
            return;
        }
        products.forEach(p => {
            const div = document.createElement('div');
            div.className = 'px-4 py-3 hover:bg-rose-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between';
            div.innerHTML = `<span class="text-sm font-medium text-slate-700">${p.product_name}</span><span class="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">${p.category_name}</span>`;
            div.addEventListener('click', () => selectProductForDelete(p));
            searchResults.appendChild(div);
        });
    }

    function selectProductForDelete(product) {
        currentSelectedProduct = product;
        searchInput.value = product.product_name;
        searchResults.classList.add('hidden');
        document.getElementById('selName').textContent = product.product_name;
        document.getElementById('selCategory').textContent = product.category_name;
        document.getElementById('selPrice').textContent = `฿${(product.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        document.getElementById('selShelfLife').textContent = `อายุเก็บรักษา ${product.shelf_life_days} วัน`;
        const imgNode = document.getElementById('selImgContainer');
        imgNode.innerHTML = product.image_url
            ? `<img src="${product.image_url}" alt="${product.product_name}" class="w-full h-full object-cover">`
            : `<svg class="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`;
        productCard.classList.remove('hidden');
        document.getElementById('btnConfirmDelete').disabled = false;
    }

    document.getElementById('btnClearSelection').addEventListener('click', () => {
        currentSelectedProduct = null;
        searchInput.value = '';
        productCard.classList.add('hidden');
        document.getElementById('btnConfirmDelete').disabled = true;
    });

    searchInput.addEventListener('focus', () => {
        if (masterDeleteProducts.length > 0) {
            renderDeleteSearchOptions(masterDeleteProducts);
            searchResults.classList.remove('hidden');
        }
    });
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        currentSelectedProduct = null;
        productCard.classList.add('hidden');
        document.getElementById('btnConfirmDelete').disabled = true;
        const filtered = masterDeleteProducts.filter(p => p.product_name.toLowerCase().includes(val));
        renderDeleteSearchOptions(filtered);
        searchResults.classList.remove('hidden');
    });

    document.getElementById('btnConfirmDelete').addEventListener('click', () => {
        if (!currentSelectedProduct) return;
        showDeleteConfirmModal(
            `ลบ "${currentSelectedProduct.product_name}" และสต็อกทั้งหมดที่เกี่ยวข้อง? ไม่สามารถกู้คืนได้`,
            async () => {
                const res = await fetch(`/api/admin/products/${currentSelectedProduct.id}`, { method: 'DELETE' });
                const data = await res.json();
                if (res.ok) {
                    showToast('ลบสินค้าเรียบร้อยแล้ว', 'success');
                    productCard.classList.add('hidden');
                    searchInput.value = '';
                    document.getElementById('btnConfirmDelete').disabled = true;
                    masterDeleteProducts = masterDeleteProducts.filter(p => p.id !== currentSelectedProduct.id);
                    masterEditProducts = [];
                    currentSelectedProduct = null;
                } else {
                    showToast(data.error || 'ไม่สามารถลบสินค้าได้', 'error');
                }
            }
        );
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#editSearchContainer')) document.getElementById('editSearchResults').classList.add('hidden');
        if (!e.target.closest('#deleteSearchContainer')) searchResults.classList.add('hidden');
    });

    initView();
}