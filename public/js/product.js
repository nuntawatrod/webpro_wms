// public/js/product.js - Product Management CRUD (Updated with SweetAlert UI)

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
        if (!viewAdd || !viewEdit || !viewDelete) return;
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
                if(typeof Swal !== 'undefined') {
                    Swal.fire('สำเร็จ', 'บันทึกข้อมูลสินค้าใหม่เรียบร้อยแล้ว', 'success');
                } else if(typeof showToast === 'function') {
                    showToast('บันทึกข้อมูลสินค้าใหม่เรียบร้อยแล้ว', 'success');
                }
                document.getElementById('createProductForm').reset();
                masterEditProducts = [];
                masterDeleteProducts = [];
            } else {
                if(typeof showToast === 'function') showToast(result.error || 'บันทึกล้มเหลว', 'error');
            }
        } catch (err) {
            if(typeof showToast === 'function') showToast('ระบบขัดข้อง กรุณาลองใหม่', 'error');
        }
    });

    // EDIT - fetch & render (โค้ดเดิมของคุณ)
    async function fetchProductsForEdit() {
        if (masterEditProducts.length > 0) return;
        try {
            const res = await fetch('/api/admin/products');
            masterEditProducts = await res.json();
            renderEditSearchOptions(masterEditProducts);
        } catch (e) { console.error(e); }
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
            div.addEventListener('click', () => {
                document.getElementById('editSearchInput').value = p.product_name;
                document.getElementById('editSearchResults').classList.add('hidden');
                document.getElementById('editProductId').value = p.id;
                document.getElementById('editProductName').value = p.product_name;
                document.getElementById('editProductCategory').value = p.category_name;
                document.getElementById('editProductPrice').value = p.price;
                document.getElementById('editProductShelfLife').value = p.shelf_life_days;
                document.getElementById('editProductImageUrl').value = p.image_url || '';
                document.getElementById('editProductForm').classList.remove('hidden');
            });
            el.appendChild(div);
        });
    }

    // Add event listener for Edit search input
    const editSearchInput = document.getElementById('editSearchInput');
    if (editSearchInput) {
        editSearchInput.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const filtered = masterEditProducts.filter(p => p.product_name.toLowerCase().includes(val));
            renderEditSearchOptions(filtered);
            document.getElementById('editSearchResults').classList.remove('hidden');
        });
    }

    // Add event listener to show edit results when input is focused
    if (editSearchInput) {
        editSearchInput.addEventListener('focus', () => {
            if (masterEditProducts.length > 0) {
                document.getElementById('editSearchResults').classList.remove('hidden');
            }
        });
    }

    // DELETE - fetch & render
    async function fetchProductsForDelete() {
        if (masterDeleteProducts.length > 0) return;
        try {
            const res = await fetch('/api/admin/products');
            masterDeleteProducts = await res.json();
            renderDeleteSearchOptions(masterDeleteProducts);
        } catch (e) { console.error(e); }
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
            div.addEventListener('click', () => {
                currentSelectedProduct = p;
                searchInput.value = p.product_name;
                searchResults.classList.add('hidden');
                document.getElementById('selName').textContent = p.product_name;
                document.getElementById('selCategory').textContent = p.category_name;
                document.getElementById('selPrice').textContent = `฿${(p.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                document.getElementById('selShelfLife').textContent = `อายุเก็บรักษา ${p.shelf_life_days} วัน`;
                productCard.classList.remove('hidden');
                document.getElementById('btnConfirmDelete').disabled = false;
            });
            searchResults.appendChild(div);
        });
    }

    // แก้ไขส่วนปุ่มลบ: ใช้ UI SweetAlert2 จากไฟล์เก่าของคุณ
    document.getElementById('btnConfirmDelete').addEventListener('click', () => {
        if (!currentSelectedProduct) return;

        Swal.fire({
            title: 'ยืนยันการลบ?',
            text: `คุณต้องการลบ "${currentSelectedProduct.product_name}" และสต็อกที่เกี่ยวข้องใช่หรือไม่?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'ลบข้อมูล',
            cancelButtonText: 'ยกเลิก',
            reverseButtons: true
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch(`/api/admin/products/${currentSelectedProduct.id}`, { method: 'DELETE' });
                    const data = await res.json();
                    
                    if (res.ok) {
                        Swal.fire('ลบสำเร็จ!', 'ลบสินค้าเรียบร้อยแล้ว', 'success');
                        productCard.classList.add('hidden');
                        searchInput.value = '';
                        document.getElementById('btnConfirmDelete').disabled = true;
                        masterDeleteProducts = masterDeleteProducts.filter(p => p.id !== currentSelectedProduct.id);
                        masterEditProducts = [];
                        currentSelectedProduct = null;
                    } else {
                        Swal.fire('ล้มเหลว', data.error || 'ไม่สามารถลบสินค้าได้', 'error');
                    }
                } catch (err) {
                    Swal.fire('ข้อผิดพลาด', 'ระบบขัดข้อง', 'error');
                }
            }
        });
    });

    // Event Listeners อื่นๆ
    document.getElementById('btnClearSelection')?.addEventListener('click', () => {
        currentSelectedProduct = null;
        searchInput.value = '';
        productCard.classList.add('hidden');
        document.getElementById('btnConfirmDelete').disabled = true;
    });

    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const filtered = masterDeleteProducts.filter(p => p.product_name.toLowerCase().includes(val));
        renderDeleteSearchOptions(filtered);
        searchResults.classList.remove('hidden');
    });

    // EDIT - submit event
    document.getElementById('editProductForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
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
                if (typeof Swal !== 'undefined') {
                    Swal.fire('สำเร็จ', 'บันทึกการแก้ไขสินค้าเรียบร้อยแล้ว', 'success');
                } else if (typeof showToast === 'function') {
                    showToast('บันทึกการแก้ไขสินค้าเรียบร้อยแล้ว', 'success');
                }
                document.getElementById('editSearchInput').value = '';
                document.getElementById('editProductForm').classList.add('hidden');
                masterEditProducts = [];
                masterDeleteProducts = [];
            } else {
                if (typeof showToast === 'function') showToast(result.error || 'บันทึกล้มเหลว', 'error');
            }
        } catch (err) {
            if (typeof showToast === 'function') showToast('ระบบขัดข้อง กรุณาลองใหม่', 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });

    // EDIT - cancel button
    document.getElementById('btnCancelEdit')?.addEventListener('click', () => {
        document.getElementById('editSearchInput').value = '';
        document.getElementById('editProductForm').classList.add('hidden');
        document.getElementById('editSearchResults').innerHTML = '';
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#editSearchContainer')) document.getElementById('editSearchResults')?.classList.add('hidden');
        if (!e.target.closest('#deleteSearchContainer')) searchResults?.classList.add('hidden');
    });

    initView();
}

document.addEventListener('DOMContentLoaded', initProductManagement);