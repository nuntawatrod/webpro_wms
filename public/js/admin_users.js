document.addEventListener('DOMContentLoaded', () => {

    const tableBody = document.getElementById('userTableBody');
    const currentUser = AUTH_USER.username;

    fetchUsers();

    async function fetchUsers() {

        try {

            const res = await fetch('/api/admin/users');
            const users = await res.json();

            renderUsers(users);

        } catch {

            tableBody.innerHTML =
                `<tr>
        <td colspan="4" class="px-6 py-4 text-center text-rose-500">
        โหลดข้อมูลล้มเหลว
        </td>
        </tr>`;

        }

    }

    function renderUsers(users) {

        tableBody.innerHTML = '';

        users.forEach(u => {

            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition-colors";

            let roleBadge = '';

            if (u.role === 'admin') {
                roleBadge = `<span class="px-2.5 py-1 rounded bg-rose-100 text-rose-800 text-xs font-semibold">แอดมิน</span>`;
            }
            else if (u.role === 'manager') {
                roleBadge = `<span class="px-2.5 py-1 rounded bg-indigo-100 text-indigo-800 text-xs font-semibold">ผู้จัดการ</span>`;
            }
            else {
                roleBadge = `<span class="px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-semibold">พนักงาน</span>`;
            }

            const isSelf = u.username === currentUser;

            const actions = isSelf
                ? `<span class="text-xs text-slate-400">บัญชีนี้ (ตัวคุณ)</span>`
                : `
        <div class="flex items-center justify-center gap-2">

        <button onclick="managePermissions(${u.id}, '${u.username}', '${u.role}')" 
        class="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors"
        title="จัดการสิทธิ์">

        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
        </svg>

        </button>

        <button onclick="deleteUser(${u.id}, '${u.username}')"
        class="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"
        title="ลบผู้ใช้">

        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
        </svg>

        </button>

        </div>`;

            tr.innerHTML = `
        <td class="px-6 py-4 text-sm text-slate-500 font-mono">${u.id}</td>

        <td class="px-6 py-4">
        <div class="font-medium text-slate-800">${u.username}</div>
        <div class="text-xs text-slate-500">${u.full_name || '-'}</div>
        </td>

        <td class="px-6 py-4">${roleBadge}</td>

        <td class="px-6 py-4 text-center">${actions}</td>
        `;

            tableBody.appendChild(tr);

        });

    }

    window.managePermissions = async (id, username, currentRole) => {

        const { value: role } = await Swal.fire({
            title: 'หน้าจัดการสิทธิ์',
            text: `ปรับเปลี่ยนบทบาทของ "${username}"`,
            input: 'select',
            inputOptions: {
                staff: 'พนักงาน (Staff)',
                manager: 'ผู้จัดการ (Manager)',
                admin: 'แอดมิน (Admin)'
            },
            inputValue: currentRole,
            showCancelButton: true,
            confirmButtonText: 'บันทึก',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#4f46e5'
        });

        if (!role) return;

        try {

            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role })
            });

            if (res.ok) {

                fetchUsers();

                Swal.fire(
                    'สำเร็จ!',
                    `อัปเดตสิทธิ์ของ "${username}" เรียบร้อย`,
                    'success'
                );

            } else {

                const data = await res.json();
                Swal.fire('ล้มเหลว', data.error, 'error');

            }

        } catch {

            Swal.fire('ข้อผิดพลาด', 'ระบบขัดข้อง', 'error');

        }

    };

    window.deleteUser = async (id, username) => {

        const conf = await Swal.fire({
            title: 'ยืนยันการลบผู้ใช้?',
            text: `ต้องการลบผู้ใช้ "${username}" ใช่หรือไม่`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'ยืนยันลบ',
            cancelButtonText: 'ยกเลิก',
            reverseButtons: true
        });

        if (!conf.isConfirmed) return;

        try {

            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {

                fetchUsers();

                Swal.fire(
                    'ลบสำเร็จ!',
                    `ผู้ใช้ "${username}" ถูกลบแล้ว`,
                    'success'
                );

            } else {

                const data = await res.json();
                Swal.fire('ลบล้มเหลว', data.error, 'error');

            }

        } catch {

            Swal.fire('ข้อผิดพลาด', 'ระบบขัดข้อง', 'error');

        }

    };

});