// public/js/manege_user.js - Create New User Form

function initManageUsers() {
    document.getElementById('createUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('newUsername').value.trim();
        const full_name = document.getElementById('newFullName').value.trim();
        const password = document.getElementById('newPassword').value;
        const role = document.querySelector('input[name="newRole"]:checked').value;

        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, full_name, password, role })
            });
            const result = await res.json();

            if (res.ok) {
                showToast('สร้างบัญชีผู้ใช้ใหม่เรียบร้อยแล้ว', 'success');
                setTimeout(() => { window.location.href = '/admin/users'; }, 1500);
            } else {
                showToast(result.error || 'สร้างบัญชีล้มเหลว', 'error');
            }
        } catch (err) {
            showToast('ระบบขัดข้อง กรุณาลองใหม่', 'error');
        }
    });
}