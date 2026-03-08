// public/js/admin_permission.js - Permission Management

function initAdminPermissions() {
    fetchPermissions();

    async function fetchPermissions() {
        try {
            const res = await fetch('/api/admin/permissions');
            const data = await res.json();
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            data.forEach(p => {
                const cb = document.querySelector(`input[data-role="${p.role}"][data-key="${p.permission_key}"]`);
                if (cb) cb.checked = true;
            });
        } catch (e) {
            console.error('Failed to fetch permissions');
        }
    }

    document.getElementById('btnSavePermissions').addEventListener('click', async () => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        const permissions = Array.from(checkboxes).map(cb => ({
            role: cb.dataset.role,
            key: cb.dataset.key,
            enabled: cb.checked
        }));

        if (!confirm('ยืนยันการบันทึก? สิทธิ์ใหม่จะมีผลกับผู้ใช้ทุกคนทันที')) return;

        try {
            const res = await fetch('/api/admin/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions })
            });
            if (res.ok) {
                showToast('อัปเดตสิทธิ์การเข้าถึงเรียบร้อยแล้ว', 'success');
            } else {
                showToast('ไม่สามารถบันทึกได้', 'error');
            }
        } catch (e) {
            showToast('ระบบขัดข้อง', 'error');
        }
    });
}