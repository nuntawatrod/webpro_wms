// public/js/users.js - User Management

function initAdminUsers() {
    const tableBody = document.getElementById('userTableBody');
    const currentUser = AUTH_USER.username;

    fetchUsers();

    async function fetchUsers() {
        try {
            const res = await fetch('/api/admin/users');
            const users = await res.json();
            renderUsers(users);
        } catch (e) {
            tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-rose-500">โหลดข้อมูลล้มเหลว</td></tr>`;
        }
    }

    function renderUsers(users) {
        tableBody.innerHTML = '';
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100';

            const isCurrentUser = user.username === currentUser;

            let roleBadge = 'bg-slate-100 text-slate-700';
            if (user.role === 'admin') roleBadge = 'bg-rose-100 text-rose-700';
            else if (user.role === 'manager') roleBadge = 'bg-indigo-100 text-indigo-700';
            else if (user.role === 'staff') roleBadge = 'bg-emerald-100 text-emerald-700';

            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-slate-800">${user.username}</td>
                <td class="px-6 py-4">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleBadge}">
                        ${user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Manager' : 'Staff'}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm text-slate-500">${user.created_at ? formatDate(user.created_at) : '-'}</td>
                <td class="px-6 py-4 text-right space-x-2">
                    ${!isCurrentUser ? `<button class="btn-edit-user text-indigo-600 hover:text-indigo-700 font-medium text-sm" data-id="${user.id}">แก้ไข</button>
                    <button class="btn-delete-user text-rose-600 hover:text-rose-700 font-medium text-sm" data-id="${user.id}">ลบ</button>` : '<span class="text-slate-500 text-sm">(ผู้ใช้ของคุณ)</span>'}
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Attach listeners
        document.querySelectorAll('.btn-edit-user').forEach(btn => {
            btn.addEventListener('click', () => editUser(btn.dataset.id, users));
        });

        document.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', () => deleteUser(btn.dataset.id, fetchUsers));
        });
    }

    async function editUser(userId, users) {
        const user = users.find(u => u.id == userId);
        if (!user) return;

        const newRole = prompt(`กำหนดบทบาทใหม่สำหรับ ${user.username}\nค่าปัจจุบัน: ${user.role}\n\nกรุณาระบุ: admin, manager, หรือ staff`);
        if (!newRole) return;

        if (!['admin', 'manager', 'staff'].includes(newRole)) {
            showToast('บทบาทไม่ถูกต้อง', 'error');
            return;
        }

        if (newRole === user.role) {
            showToast('บทบาทยังคงเดิม', 'error');
            return;
        }

        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole })
            });

            if (res.ok) {
                showToast('อัปเดตบทบาทสำเร็จ', 'success');
                fetchUsers();
            } else {
                const data = await res.json();
                showToast(data.error || 'ล้มเหลว', 'error');
            }
        } catch (e) {
            showToast('เชื่อมต่อล้มเหลว', 'error');
        }
    }

    async function deleteUser(userId, callback) {
        if (!confirm('คุณแน่ใจที่จะลบบัญชีผู้ใช้นี้?')) return;

        try {
            const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });

            if (res.ok) {
                showToast('ลบผู้ใช้สำเร็จ', 'success');
                callback();
            } else {
                const data = await res.json();
                showToast(data.error || 'ล้มเหลว', 'error');
            }
        } catch (e) {
            showToast('เชื่อมต่อล้มเหลว', 'error');
        }
    }
}
