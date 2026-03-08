// public/js/admin-permissions.js

function initAdminPermissionsPage() {
    fetchPermissions();

    async function fetchPermissions() {
        try {
            const res = await fetch('/api/admin/permissions');
            const data = await res.json();

            // Uncheck all first
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);

            // Check enabled ones
            data.forEach(p => {
                const cb = document.querySelector(`input[data-role="${p.role}"][data-key="${p.permission_key}"]`);
                if (cb) cb.checked = true;
            });
        } catch (e) {
            console.error('Failed to fetch permissions');
        }
    }

    const btnSave = document.getElementById('btnSavePermissions');
    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            const permissions = Array.from(checkboxes).map(cb => ({
                role: cb.dataset.role,
                key: cb.dataset.key,
                enabled: cb.checked
            }));

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'ยืนยันการบันทึก?',
                    text: 'สิทธิ์ใหม่จะมีผลกับผู้ใช้ทุกคนในระบบทันที',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#4f46e5',
                    cancelButtonText: 'ยกเลิก',
                    confirmButtonText: 'ตกลง, บันทึกสิทธิ์'
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        savePermissions(permissions);
                    }
                });
            } else {
                if (confirm('ยืนยันการบันทึกสิทธิ์?')) {
                    savePermissions(permissions);
                }
            }
        });
    }

    async function savePermissions(permissions) {
        try {
            const res = await fetch('/api/admin/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions })
            });
            if (res.ok) {
                if (typeof Swal !== 'undefined') Swal.fire('สำเร็จ!', 'อัปเดตสิทธิ์การเข้าถึงเรียบร้อยแล้ว', 'success');
                else showToast('อัปเดตสิทธิ์เรียบร้อยแล้ว');
            } else {
                if (typeof Swal !== 'undefined') Swal.fire('ล้มเหลว', 'ไม่สามารถบันทึกได้', 'error');
                else showToast('ล้มเหลวในการบันทึกสิทธิ์', 'error');
            }
        } catch (e) {
            if (typeof Swal !== 'undefined') Swal.fire('ข้อผิดพลาด', 'ระบบขัดข้อง', 'error');
            else showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/admin/permissions') initAdminPermissionsPage();
});
