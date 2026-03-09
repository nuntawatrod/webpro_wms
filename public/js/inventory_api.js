// public/js/inventory_api.js
const express = require('express');
const router = express.Router();
const db = require('./db');
const { requireAuth, hasPermission } = require('./auth_middleware');
const { getBangkokTimestamp, autoLogExpiredProducts } = require('./helpers');

router.get('/inventory', requireAuth, (req, res) => {
    autoLogExpiredProducts();
    const query = `
        SELECT p.id as product_id, p.product_name, p.image_url, p.category_name,
               s.id as stock_id, s.receive_date, s.expiry_date, s.quantity
        FROM Products p
        LEFT JOIN Stock s ON p.id = s.product_id AND s.quantity > 0
        ORDER BY p.product_name ASC, s.receive_date ASC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error occurred while fetching inventory." });

        const grouped = {};
        const todayStr = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).split(' ')[0];
        const isStaff = req.session.user.role === 'staff';

        for (const row of rows) {
            const { product_id, product_name, image_url, category_name, stock_id, receive_date, expiry_date, quantity } = row;

            if (!grouped[product_id]) {
                grouped[product_id] = {
                    id: product_id,
                    product_name,
                    image_url,
                    category_name,
                    total_quantity: 0,
                    expired_quantity: 0,
                    batches: []
                };
            }

            if (stock_id) {
                const isExpired = expiry_date < todayStr;

                if (isStaff && isExpired) {
                    continue; // Skip expired batches for Staff completely
                }

                if (isExpired) {
                    grouped[product_id].expired_quantity += quantity;
                } else {
                    grouped[product_id].total_quantity += quantity;
                }

                grouped[product_id].batches.push({
                    stock_id,
                    receive_date,
                    expiry_date: expiry_date, // Expose expiry date so frontend can show countdown limit
                    quantity,
                    isExpired
                });
            }
        }

        // Final optimization: Filter out empty products if needed, or return all.
        res.json(Object.values(grouped));
    });
});

router.get('/products', requireAuth, (req, res) => {
    db.all("SELECT id, product_name, shelf_life_days FROM Products ORDER BY product_name ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch products" });
        res.json(rows);
    });
});

router.get('/available-products', requireAuth, (req, res) => {
    const query = `SELECT DISTINCT p.id, p.product_name FROM Products p JOIN Stock s ON p.id = s.product_id WHERE s.quantity > 0 ORDER BY p.product_name ASC`;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch available products" });
        res.json(rows);
    });
});

router.post('/stock/add', requireAuth, (req, res) => {
    const { product_id, receive_date, quantity } = req.body;
    db.get('SELECT shelf_life_days FROM Products WHERE id = ?', [product_id], (err, product) => {
        if (err || !product) return res.status(404).json({ error: "ไม่พบสินค้าที่ระบุ" });

        const rDate = new Date(receive_date);
        rDate.setDate(rDate.getDate() + (product.shelf_life_days || 7));
        const expiry_date = rDate.toISOString().split('T')[0];

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run(`INSERT INTO Stock (product_id, receive_date, expiry_date, quantity) VALUES (?, ?, ?, ?)`, [product_id, receive_date, expiry_date, quantity], function (err) {
                if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: "ไม่สามารถเพิ่มสต็อกได้" }); }

                db.run(`INSERT INTO Transactions_Log (action_type, product_id, quantity, actor_name, action_date) VALUES ('ADD', ?, ?, ?, ?)`,
                    [product_id, quantity, req.session.user.username, getBangkokTimestamp()], (err2) => {
                        if (err2) { db.run('ROLLBACK'); return res.status(500).json({ error: "บันทึกประวัติล้มเหลว" }); }
                        db.run('COMMIT');
                        res.json({ message: "เพิ่มสต็อกสินค้าสำเร็จ" });
                    });
            });
        });
    });
});

router.post('/stock/withdraw', requireAuth, (req, res) => {
    const { product_id, quantity, actor_name } = req.body;
    const qtyToWithdraw = parseInt(quantity, 10);

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.all(`SELECT id, quantity FROM Stock WHERE product_id = ? AND quantity > 0 ORDER BY receive_date ASC, id ASC`, [product_id], (err, batches) => {
            if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: "เกิดข้อผิดพลาดในการเข้าถึงคลังสินค้า" }); }

            const totalAvailable = batches.reduce((sum, b) => sum + b.quantity, 0);
            if (qtyToWithdraw > totalAvailable) { db.run('ROLLBACK'); return res.status(400).json({ error: "สต็อกไม่พอสำหรับการเบิก" }); }

            let remaining = qtyToWithdraw;
            for (const batch of batches) {
                if (remaining <= 0) break;
                if (batch.quantity <= remaining) {
                    db.run(`DELETE FROM Stock WHERE id = ?`, [batch.id]);
                    remaining -= batch.quantity;
                } else {
                    db.run(`UPDATE Stock SET quantity = quantity - ? WHERE id = ?`, [remaining, batch.id]);
                    remaining = 0;
                }
            }

            db.run(`INSERT INTO Transactions_Log (action_type, product_id, quantity, actor_name, action_date) VALUES ('WITHDRAW', ?, ?, ?, ?)`,
                [product_id, qtyToWithdraw, actor_name, getBangkokTimestamp()], () => {
                    db.run('COMMIT');
                    res.json({ message: "ตัดสต็อกสำเร็จ" });
                });
        });
    });
});

router.post('/stock/delete-expired', hasPermission('delete_expired'), (req, res) => {
    const { expired_batches } = req.body;
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        expired_batches.forEach(batch => db.run('DELETE FROM Stock WHERE id = ?', [batch.stock_id]));
        db.run('COMMIT', () => res.json({ message: "ลบสินค้าหมดอายุสำเร็จ" }));
    });
});

router.get('/history', requireAuth, (req, res) => {
    const query = `
        SELECT t.id, t.action_date, t.action_type,
               CASE WHEN p.product_name IS NOT NULL THEN p.product_name ELSE '[สินค้าที่ถูกลบ]' END AS product_name,
               t.quantity, t.actor_name, t.extra_info
        FROM Transactions_Log t
        LEFT JOIN Products p ON t.product_id = p.id
        WHERE t.action_type IN ('ADD', 'WITHDRAW', 'EXPIRED')
        ORDER BY t.action_date DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch history" });
        res.json(rows);
    });
});

module.exports = router;
