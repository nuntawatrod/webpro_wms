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
router.get('/dashboard-stats', requireManager, async (req, res) => {
    try {
        const getOne = (query) => new Promise((resolve, reject) => db.get(query, [], (err, row) => err ? reject(err) : resolve(row)));
        const getAll = (query) => new Promise((resolve, reject) => db.all(query, [], (err, rows) => err ? reject(err) : resolve(rows)));

        const totalProductsParams = await getOne(`SELECT COUNT(id) AS totalProducts FROM Products`);
        const lowStockParams = await getOne(`SELECT COUNT(id) AS count FROM (SELECT p.id FROM Products p JOIN Stock s ON p.id = s.product_id WHERE s.quantity > 0 GROUP BY p.id HAVING SUM(s.quantity) < 50)`);
        const totalValueParams = await getOne(`SELECT SUM(s.quantity * p.price) AS totalValue FROM Stock s JOIN Products p ON s.product_id = p.id WHERE s.quantity > 0`);
        const categoriesCountParams = await getOne(`SELECT COUNT(DISTINCT category_name) AS count FROM Products`);

        const categoryDistribution = await getAll(`
            SELECT p.category_name, SUM(s.quantity) AS total 
            FROM Products p JOIN Stock s ON p.id = s.product_id 
            WHERE s.quantity > 0 
            GROUP BY p.category_name 
            ORDER BY total DESC LIMIT 5
        `);

        const lowStockList = await getAll(`
            SELECT p.id, p.product_name, SUM(s.quantity) AS total_qty 
            FROM Products p JOIN Stock s ON p.id = s.product_id 
            WHERE s.quantity > 0 
            GROUP BY p.id 
            HAVING total_qty < 50 
            ORDER BY total_qty ASC
        `);

        const frequentReceiveList = await getAll(`
            SELECT p.product_name, COUNT(*) AS freq, SUM(t.quantity) AS total_qty 
            FROM Transactions_Log t JOIN Products p ON t.product_id = p.id 
            WHERE t.action_type = 'ADD' 
            GROUP BY p.id 
            ORDER BY freq DESC LIMIT 5
        `);

        const frequentWithdrawList = await getAll(`
            SELECT p.product_name, COUNT(*) AS freq, SUM(t.quantity) AS total_qty 
            FROM Transactions_Log t JOIN Products p ON t.product_id = p.id 
            WHERE t.action_type = 'WITHDRAW' 
            GROUP BY p.id 
            ORDER BY freq DESC LIMIT 5
        `);

        res.json({
            totalProducts: totalProductsParams?.totalProducts || 0,
            lowStockCount: lowStockParams?.count || 0,
            totalValue: totalValueParams?.totalValue || 0,
            categoriesCount: categoriesCountParams?.count || 0,
            categoryDistribution: categoryDistribution || [],
            lowStockList: lowStockList || [],
            frequentReceiveList: frequentReceiveList || [],
            frequentWithdrawList: frequentWithdrawList || []
        });
    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/system-logs', requireManager, (req, res) => {
    const query = `
        SELECT action_date, action_type, extra_info, actor_name 
        FROM Transactions_Log 
        WHERE action_type IN ('CREATE_PRODUCT', 'DELETE_PRODUCT', 'CREATE_USER', 'DELETE_USER', 'UPDATE_PRODUCT', 'UPDATE_USER')
        ORDER BY action_date DESC 
        LIMIT 20
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
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
    if (role === 'admin') {
        return res.status(403).json({ error: "Cannot create 'admin' accounts. Only one admin allowed." });
    }
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

router.put('/users/:id', requireAdmin, (req, res) => {
    const { role } = req.body;
    if (role === 'admin') return res.status(403).json({ error: "Cannot assign 'admin' role." });

    db.get("SELECT role FROM Users WHERE id = ?", [req.params.id], (err, user) => {
        if (err || !user) return res.status(404).json({ error: "User not found" });
        if (user.role === 'admin') return res.status(403).json({ error: "Cannot change the role of an admin." });

        db.run("UPDATE Users SET role = ? WHERE id = ?", [role, req.params.id], (err) => {
            if (err) return res.status(500).json({ error: "Update failed" });
            res.json({ message: "Role updated" });
        });
    });
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
