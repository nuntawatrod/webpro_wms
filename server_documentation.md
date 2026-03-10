# รายละเอียดการทำงานของ `server.js` (Server-side Logic)

ไฟล์ `server.js` เป็นหัวใจหลักของระบบจัดการคลังสินค้า (WMS) ทำหน้าที่จัดการฐานข้อมูล, ให้บริการ API สำหรับ Frontend, และควบคุมความปลอดภัย (Authentication & Authorization)

---

## 1. ส่วนประกอบสำคัญและ Middleware
ส่วนที่ทำหน้าที่จัดการคำขอทั่วไปก่อนเข้าถึง Route ต่างๆ

| ส่วนประกอบ | หน้าที่ | ถูกใช้โดย | เชื่อมโยงไปหา |
| :--- | :--- | :--- | :--- |
| **`express-session`** | จัดการการเข้าสู่ระบบ (Session) เก็บข้อมูลผู้ใช้ที่ Login ไว้ใน Server ชั่วคราว (1 วัน) | ทุกคำขอ (Request) | Browser Cookie |
| **`requireAuth`** | ตรวจสอบว่าผู้ใช้ Login หรือยัง | หน้า Dashboard, Withdraw, Add Stock, และ API ส่วนใหญ่ | `/login` (ถ้ายังไม่ Login) |
| **`requireAdmin`** | ตรวจสอบว่าผู้ใช้มีบทบาทเป็น `admin` เท่านั้น | หน้าจัดการผู้ใช้ (User Management API) | `Users` Table |
| **`requireManager`** | ตรวจสอบว่าเป็น `manager` หรือ `admin` | หน้าจัดการสินค้า (Product Management API), ดูหน้า Admin | `Users` Table |

---

## 2. ฟังก์ชันหลัก (Core Functions)
ฟังก์ชันที่รันอยู่เบื้องหลังเพื่อสนับสนุนระบบ

### `initializeDatabase()`
*   **หน้าที่:** สร้าง Table ต่างๆ (`Users`, `Products`, `Stock`, `Transactions_Log`, `Expired_Alerts`) หากยังไม่มี และสร้างบัญชี Admin ตัวแรก (`admin/1234`)
*   **มีมาเพื่อ:** เตรียมความพร้อมของฐานข้อมูล SQLite ก่อนเริ่มรัน Server
*   **ความเชื่อมโยง:** เรียกใช้โดย `db` connection ทันทีที่รัน Server

### `getBangkokTimestamp()`
*   **หน้าที่:** คืนค่าวันเวลาปัจจุบันในรูปแบบ `YYYY-MM-DD HH:MM:SS` ของโซนเวลาเอเชีย/กรุงเทพฯ
*   **ถูกใช้โดย:** ทุกฟังก์ชันที่มีการบันทึก Log การกระทำ (Stock Add/Withdraw/Edit)
*   **มีมาเพื่อ:** ให้เวลาในระบบตรงกับเวลาจริงในประเทศไทย ไม่ว่า Server จะอยู่ที่ไหน

### `autoLogExpiredProducts()`
*   **หน้าที่:** ตรวจสอบสินค้าใน `Stock` ที่วันหมดอายุน้อยกว่าวันนี้ แล้วบันทึกลง `Transactions_Log` เป็นประเภท `EXPIRED` โดยอัตโนมัติ
*   **ถูกใช้โดย:** เรียกใช้ทุกครั้งที่มีคนเปิดหน้า Dashboard (`/api/inventory`)
*   **มีมาเพื่อ:** บันทึกการหมดอายุของสินค้าลงในประวัติโดยที่ผู้ใช้ไม่ต้องกดเอง

---

## 3. เส้นทาง API (API Endpoints)
ส่วนที่คุยกับ JavaScript ในหน้าเว็บ (Dashboard, Withdraw, Manage)

| API Path | Method | หน้าที่ | เชื่อมโยงกับ Table |
| :--- | :--- | :--- | :--- |
| `/api/inventory` | GET | ดึงรายการสินค้าทั้งหมด พร้อมแสดงจำนวนล็อตปกติและล็อตที่หมดอายุแยกกัน | `Products`, `Stock` |
| `/api/stock/add` | POST | เพิ่มสต็อกสินค้าใหม่ โดยจะคำนวณวันหมดอายุให้อัตโนมัติจาก `shelf_life_days` | `Stock`, `Transactions_Log` |
| `/api/stock/withdraw` | POST | ตัดสต็อกสินค้าแบบ **FIFO** (เข้าก่อน-ออกก่อน) คือจะตัดล็อตที่เก่าที่สุดก่อนเสมอ | `Stock`, `Transactions_Log` |
| `/api/stock/delete-expired` | POST | ลบล็อตสินค้าที่หมดอายุแล้วออกจากระบบแบบกลุ่ม (Bulk Delete) | `Stock`, `Transactions_Log` |
| `/api/admin/dashboard-stats`| GET | สรุปวิเคราะห์ข้อมูล (KPI) 5 อย่าง: รวมสินค้า, สต็อกต่ำ, จำนวนหมวดหมู่, มูลค่ารวม, และผู้ใช้งาน | ทุก Table |

---

## 4. ระบบบันทึกประวัติ (Transaction Logging)
ทุกการขยับเขยื้อนของสินค้าจะถูกบันทึกที่ `Transactions_Log` เพื่อความโปร่งใส

*   **ประเภท Log:**
    *   `ADD` / `WITHDRAW`: การนำเข้าและเบิกออกปกติ
    *   `EXPIRED`: บันทึกเมื่อสินค้าหมดอายุ (ทั้งระบบออโต้และผู้ใช้กดลบ)
    *   `CREATE_PRODUCT` / `UPDATE_PRODUCT` / `DELETE_PRODUCT`: บันทึกเมื่อมีการแก้ไขข้อมูลตัวสินค้า
    *   `CREATE_USER` / `DELETE_USER`: บันทึกการจัดการบัญชีผู้ใช้ (บันทึกเฉพาะ Admin)

---

## 5. ความปลอดภัยและการเข้าถึงข้อมูล
*   **รหัสผ่าน:** ใช้ `bcryptjs` เข้ารหัสก่อนเก็บลงฐานข้อมูลเสมอ (ไม่มีการเก็บรหัสผ่านตัวจริง)
*   **Role-based:**
    *   **Staff:** เพิ่ม/เบิกสต็อกได้, ดูประวัติได้ แต่แก้ไข/ลบสินค้าและผู้ใช้ไม่ได้
    *   **Manager:** ทำได้เหมือน Staff + แก้ไข/ลบสินค้า, ดู Dashboard สถิติได้
    *   **Admin:** ทำได้เหมือน Manager + จัดการบัญชีผู้ใช้ (เพิ่ม/ลบ/เปลี่ยนสิทธิ์)
