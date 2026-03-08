// public/js/admin_api.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('./db');
const { requireAdmin, requireManager } = require('./auth_middleware');
const { getBangkokTimestamp } = require('./helpers');

// Permissions
router.get('/permissions', requireAdmin, (req, res) => {
    db.all("SELECT role, permission_key FROM Role_Permissions", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/permissions', requireAdmin, (req, res) => {
    const { permissions } = req.body;
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('DELETE FROM Role_Permissions', (err) => {
            if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: 'Failed to clear' }); }
            const stmt = db.prepare("INSERT INTO Role_Permissions (role, permission_key) VALUES (?, ?)");
            permissions.forEach(p => { if (p.enabled) stmt.run(p.role, p.key); });
            stmt.finalize();
            db.run('COMMIT', (e) => res.json({ message: 'Success' }));
        });
    });
});

// Dashboard Stats
router.get('/dashboard-stats', requireManager, (req, res) => {
    const qP = `SELECT COUNT(id) AS totalProducts FROM Products`;
    const qL = `SELECT COUNT(id) AS count FROM (SELECT p.id FROM Products p JOIN Stock s ON p.id = s.product_id WHERE s.quantity > 0 GROUP BY p.id HAVING SUM(s.quantity) < 50)`;
    const qV = `SELECT SUM(s.quantity * p.price) AS totalValue FROM Stock s JOIN Products p ON s.product_id = p.id WHERE s.quantity > 0`;

    db.get(qP, (err1, r1) => {
        db.get(qL, (err2, r2) => {
            db.get(qV, (err3, r3) => {
                res.json({ totalProducts: r1?.totalProducts || 0, lowStockCount: r2?.count || 0, totalValue: r3?.totalValue || 0 });
            });
        });
    });
});

// User Management
router.get('/users', requireAdmin, (req, res) => {
    db.all("SELECT id, username, full_name, role, created_at FROM Users", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/users', requireAdmin, (req, res) => {
    const { username, password, full_name, role } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    db.run("INSERT INTO Users (username, password, full_name, role) VALUES (?, ?, ?, ?)", [username, hash, full_name, role], function (err) {
        if (err) return res.status(500).json({ error: "Username exists" });
        res.json({ message: "User created" });
    });
});

router.delete('/users/:id', requireAdmin, (req, res) => {
    if (req.params.id == req.session.user.id) return res.status(400).json({ error: "Cannot delete self" });
    db.run("DELETE FROM Users WHERE id = ?", [req.params.id], (err) => res.json({ message: "Deleted" }));
});

// Product CRUD
router.get('/products', requireManager, (req, res) => {
    db.all("SELECT * FROM Products ORDER BY product_name ASC", (err, rows) => res.json(rows));
});

router.post('/products', requireManager, (req, res) => {
    const { product_name, price, image_url, category_name, shelf_life_days } = req.body;
    db.run("INSERT INTO Products (product_name, price, image_url, category_name, status, shelf_life_days) VALUES (?, ?, ?, ?, 'normal', ?)",
        [product_name, price, image_url, category_name, shelf_life_days], function (err) {
            res.json({ message: "Product created", id: this.lastID });
        });
});

router.put('/products/:id', requireManager, (req, res) => {
    const { product_name, price, image_url, category_name, shelf_life_days } = req.body;
    db.run("UPDATE Products SET product_name=?, price=?, image_url=?, category_name=?, shelf_life_days=? WHERE id=?",
        [product_name, price, image_url, category_name, shelf_life_days, req.params.id], () => res.json({ message: "Updated" }));
});

router.delete('/products/:id', requireManager, (req, res) => {
    db.run("DELETE FROM Products WHERE id = ?", [req.params.id], () => res.json({ message: "Deleted" }));
});

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// ... (existing routes)

router.post('/bulk-import', requireManager, (req, res) => {
    const CSV_PATH = path.join(__dirname, '../../products.csv');
    if (!fs.existsSync(CSV_PATH)) return res.status(404).json({ error: "ไม่พบไฟล์ products.csv" });

    const productsMap = new Map();
    fs.createReadStream(CSV_PATH)
        .pipe(csv({
            mapHeaders: ({ header }) => header.trim().replace(/^[\uFEFF\u200B]+/, '').replace(/^"/, '').replace(/"$/, '')
        }))
        .on('data', (row) => {
            const { product_name, price, image_url, category_name, shelf_life_days } = row;
            if (product_name) {
                productsMap.set(product_name, {
                    price: parseFloat(price) || 0,
                    image_url: image_url || '',
                    category_name: category_name || 'ทั่วไป',
                    shelf_life_days: parseInt(shelf_life_days) || 7
                });
            }
        })
        .on('end', () => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                const stmt = db.prepare(`INSERT OR IGNORE INTO Products (product_name, price, image_url, category_name, status, shelf_life_days) VALUES (?, ?, ?, ?, 'normal', ?)`);
                for (const [name, data] of productsMap.entries()) {
                    stmt.run([name, data.price, data.image_url, data.category_name, data.shelf_life_days]);
                }
                stmt.finalize();
                db.run('COMMIT', (err) => {
                    if (err) return res.status(500).json({ error: "Failed to import" });
                    res.json({ message: "นำเข้าสินค้าจาก CSV สำเร็จ" });
                });
            });
        });
});

module.exports = router;
