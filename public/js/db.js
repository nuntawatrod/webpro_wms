// public/js/db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');

// Since this file is now in public/js/, the database path needs to be adjusted
const DB_PATH = path.join(__dirname, '../../wms.db');
const CSV_PATH = path.join(__dirname, '../../products.csv');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function getBangkokTimestamp() {
    return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace('T', ' ');
}

function initializeDatabase() {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT,
            role TEXT DEFAULT 'staff' CHECK(role IN ('admin', 'manager', 'staff')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Products Table
        db.run(`CREATE TABLE IF NOT EXISTS Products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_name TEXT UNIQUE NOT NULL,
            price REAL,
            image_url TEXT,
            category_name TEXT CHECK(category_name IN ('เนื้อสัตว์', 'ผักผลไม้', 'อาหารทะเล', 'ของแห้ง', 'ทั่วไป')),
            status TEXT DEFAULT 'active',
            shelf_life_days INTEGER DEFAULT 7,
            created_by INTEGER,
            FOREIGN KEY (created_by) REFERENCES Users(id) ON DELETE SET NULL
        )`);

        // Role Permissions Table
        db.run(`CREATE TABLE IF NOT EXISTS Role_Permissions (
            role TEXT NOT NULL,
            permission_key TEXT NOT NULL,
            PRIMARY KEY (role, permission_key)
        )`);

        // Seed Default Permissions
        const defaultPermissions = [
            { role: 'admin', key: 'view_dashboard' },
            { role: 'admin', key: 'manage_users' },
            { role: 'admin', key: 'manage_products' },
            { role: 'admin', key: 'manage_stock' },
            { role: 'admin', key: 'delete_expired' },
            { role: 'manager', key: 'view_dashboard' },
            { role: 'manager', key: 'manage_products' },
            { role: 'manager', key: 'manage_stock' },
            { role: 'manager', key: 'delete_expired' },
            { role: 'staff', key: 'manage_stock' }
        ];

        db.get("SELECT COUNT(*) AS count FROM Role_Permissions", (err, row) => {
            if (!err && row.count === 0) {
                const stmt = db.prepare("INSERT INTO Role_Permissions (role, permission_key) VALUES (?, ?)");
                defaultPermissions.forEach(p => stmt.run(p.role, p.key));
                stmt.finalize();
                console.log("Seeded default role permissions");
            }
        });

        // Stock Table
        db.run(`CREATE TABLE IF NOT EXISTS Stock (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            receive_date DATE,
            expiry_date DATE,
            quantity INTEGER,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE CASCADE
        )`);

        // Transactions_Log Table
        db.run(`CREATE TABLE IF NOT EXISTS Transactions_Log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action_type VARCHAR(10) CHECK(action_type IN ('ADD', 'WITHDRAW', 'EXPIRED', 'EDIT', 'CREATE_USER', 'DELETE_USER', 'UPDATE_USER', 'CREATE_PRODUCT', 'DELETE_PRODUCT', 'UPDATE_PRODUCT')),
            product_id INTEGER,
            quantity INTEGER,
            action_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            actor_name VARCHAR(255),
            extra_info TEXT,
            FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE SET NULL
        )`);

        // Seed Admin User
        db.get("SELECT COUNT(*) AS count FROM Users WHERE username = 'admin'", (err, row) => {
            if (!err && row.count === 0) {
                const salt = bcrypt.genSaltSync(10);
                const hash = bcrypt.hashSync('1234', salt);
                db.run(`INSERT INTO Users (username, password, role, full_name) VALUES ('admin', ?, 'admin', 'System Administrator')`, [hash]);
                console.log("Seeded default Admin user (admin / 1234)");
            }
        });

        // Seed Products if empty
        db.get("SELECT COUNT(*) AS count FROM Products", (err, row) => {
            if (!err && row.count === 0) {
                seedFromCSV();
            }
        });
    });
}

function seedFromCSV() {
    if (!fs.existsSync(CSV_PATH)) return;

    const productsMap = new Map();
    const stockEntries = [];

    fs.createReadStream(CSV_PATH)
        .pipe(csv({
            mapHeaders: ({ header }) => header.trim().replace(/^[\uFEFF\u200B]+/, '')
        }))
        .on('data', (row) => {
            const { product_name, price, image_url, category_name, shelf_life_days, status } = row;
            if (!product_name) return;

            const shelfLife = parseInt(shelf_life_days) || 7;
            if (!productsMap.has(product_name)) {
                productsMap.set(product_name, {
                    price: parseFloat(price) || 0,
                    image_url: image_url || '',
                    category_name: category_name || 'ทั่วไป',
                    status: status || 'normal',
                    shelf_life_days: shelfLife
                });
            }

            const randomQty = Math.floor(Math.random() * 91) + 10;
            const rOffset = Math.floor(Math.random() * 4);
            const d = new Date();
            d.setDate(d.getDate() - rOffset);
            const rDate = d.toISOString().split('T')[0];

            const ed = new Date(d);
            ed.setDate(ed.getDate() + shelfLife);
            const eDate = ed.toISOString().split('T')[0];

            stockEntries.push({ product_name, receive_date: rDate, expiry_date: eDate, quantity: randomQty });
        })
        .on('end', () => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                const stmtP = db.prepare(`INSERT OR IGNORE INTO Products (product_name, price, image_url, category_name, status, shelf_life_days) VALUES (?, ?, ?, ?, ?, ?)`);
                for (const [name, data] of productsMap.entries()) {
                    stmtP.run([name, data.price, data.image_url, data.category_name, data.status, data.shelf_life_days]);
                }
                stmtP.finalize();

                const stmtS = db.prepare(`INSERT INTO Stock (product_id, receive_date, expiry_date, quantity) VALUES ((SELECT id FROM Products WHERE product_name = ?), ?, ?, ?)`);
                for (const s of stockEntries) {
                    stmtS.run([s.product_name, s.receive_date, s.expiry_date, s.quantity]);
                }
                stmtS.finalize();

                const ts = getBangkokTimestamp();
                const stmtL = db.prepare(`INSERT INTO Transactions_Log (action_type, product_id, quantity, actor_name, action_date) VALUES ('ADD', (SELECT id FROM Products WHERE product_name = ?), ?, 'System/Setup', ?)`);
                for (const s of stockEntries) {
                    stmtL.run([s.product_name, s.quantity, ts]);
                }
                stmtL.finalize();

                db.run('COMMIT');
            });
        });
}

module.exports = db;
