const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');
const csv = require('csv-parser');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'wms.db');
const CSV_PATH = path.join(__dirname, 'products.csv');

// --- Middleware Setup ---
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true })); // For form submits
app.use(express.static('public')); // CSS/JS assets

// EJS Template Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Sessions
app.use(session({
    secret: 'wms_super_secret_key_123!@#',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// Make user available to all EJS templates
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// --- Auth Middleware ---
const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        // For API routes, return 401 JSON instead of redirect
        if (req.path.startsWith('/api')) {
            return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ (Unauthorized)' });
        }
        res.redirect('/login');
    }
};

const requireManager = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'manager') {
        next();
    } else {
        if (req.path.startsWith('/api')) {
            return res.status(403).json({ error: 'ไม่มีสิทธิ์ผู้ดูแลระบบ (Manager required)' });
        }
        res.status(403).send('Forbidden: Manager access required');
    }
};

// --- Database Initialization ---
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT,
            role TEXT DEFAULT 'staff',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Products Table (Added shelf_life_days)
        db.run(`CREATE TABLE IF NOT EXISTS Products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_name TEXT UNIQUE NOT NULL,
            price REAL,
            image_url TEXT,
            category_name TEXT,
            status TEXT,
            shelf_life_days INTEGER DEFAULT 0
        )`);

        // Stock Table
        db.run(`CREATE TABLE IF NOT EXISTS Stock (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            receive_date DATE,
            expiry_date DATE,
            quantity INTEGER,
            FOREIGN KEY (product_id) REFERENCES Products(id)
        )`);

        // Transactions_Log Table
        db.run(`CREATE TABLE IF NOT EXISTS Transactions_Log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action_type VARCHAR(10),
            product_id INTEGER,
            quantity INTEGER,
            action_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            actor_name VARCHAR(255),
            FOREIGN KEY (product_id) REFERENCES Products(id)
        )`);

        // Seed Admin User
        db.get("SELECT COUNT(*) AS count FROM Users WHERE username = 'admin'", (err, row) => {
            if (!err && row.count === 0) {
                const salt = bcrypt.genSaltSync(10);
                const hash = bcrypt.hashSync('1234', salt);
                db.run(`INSERT INTO Users (username, password, role) VALUES ('admin', ?, 'manager')`, [hash]);
                console.log("Seeded default Admin user (admin / 1234)");
            }
        });

        // Migration: add shelf_life_days if it doesn't exist in the Products table
        db.all("PRAGMA table_info(Products)", (err, cols) => {
            if (!err && cols && !cols.find(c => c.name === 'shelf_life_days')) {
                db.run("ALTER TABLE Products ADD COLUMN shelf_life_days INTEGER DEFAULT 7", (alterErr) => {
                    if (alterErr) console.error("Migration failed:", alterErr);
                    else console.log("Migration: Added shelf_life_days column to Products.");
                });
            }
        });

        // Migration: add extra_info column to Transactions_Log if missing
        db.all("PRAGMA table_info(Transactions_Log)", (err, cols) => {
            if (!err && cols && !cols.find(c => c.name === 'extra_info')) {
                db.run("ALTER TABLE Transactions_Log ADD COLUMN extra_info TEXT", (alterErr) => {
                    if (alterErr) console.error("Migration extra_info failed:", alterErr);
                    else console.log("Migration: Added extra_info column to Transactions_Log.");
                });
            }
        });

        // Migration: add full_name and created_at to Users if missing
        db.all("PRAGMA table_info(Users)", (err, cols) => {
            if (!err && cols && !cols.find(c => c.name === 'full_name')) {
                db.run("ALTER TABLE Users ADD COLUMN full_name TEXT", (alterErr) => {
                    if (alterErr) console.error("Migration full_name failed:", alterErr);
                    else console.log("Migration: Added full_name column to Users.");
                });
            }
            if (!err && cols && !cols.find(c => c.name === 'created_at')) {
                db.run("ALTER TABLE Users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", (alterErr) => {
                    if (alterErr) console.error("Migration created_at failed:", alterErr);
                    else console.log("Migration: Added created_at column to Users.");
                });
            }
        });

        // Migration: Update roles from admin/user to manager/staff
        db.run("UPDATE Users SET role = 'manager' WHERE role = 'admin'", (err) => {
            if (!err) console.log("Migration: Updated old admin roles to manager.");
        });
        db.run("UPDATE Users SET role = 'staff' WHERE role = 'user'", (err) => {
            if (!err) console.log("Migration: Updated old user roles to staff.");
        });

        // Seed Products if empty
        db.get("SELECT COUNT(*) AS count FROM Products", (err, row) => {
            if (err) {
                console.error("Error checking Products table:", err);
                return;
            }
            if (row.count === 0) {
                console.log("Database is empty. Seeding from CSV...");
                seedFromCSV();
            } else {
                console.log("Database already seeded.");
            }
        });
    });
}

// Returns current Bangkok time as 'YYYY-MM-DD HH:MM:SS' string
function getBangkokTimestamp() {
    return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace('T', ' ');
}

function calculateDaysBetween(startDate, endDate) {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start) || isNaN(end)) return null;
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

function seedFromCSV() {
    if (!fs.existsSync(CSV_PATH)) {
        console.warn(`CSV file not found at ${CSV_PATH}. Skipping seed.`);
        return;
    }

    const productsMap = new Map();
    const stockEntries = [];
    const todayStr = new Date().toISOString().split('T')[0];

    fs.createReadStream(CSV_PATH)
        .pipe(csv({
            mapHeaders: ({ header }) => header.trim().replace(/^[\uFEFF\u200B]+/, '')
        }))
        .on('data', (row) => {
            const { product_name, price, image_url, category_name, receive_date, expiry_date, status } = row;
            if (!product_name) return;

            // Calculate shelf life logic from CSV (if available)
            let shelf_life_days = 7; // Default 7 days if unknown
            const rDate = receive_date || todayStr;
            const expD = calculateDaysBetween(rDate, expiry_date);
            if (expD !== null && expD > 0) {
                shelf_life_days = expD;
            }

            if (!productsMap.has(product_name)) {
                productsMap.set(product_name, {
                    price: parseFloat(price) || 0,
                    image_url: image_url || '',
                    category_name: category_name || 'ทั่วไป',
                    status: status || 'normal',
                    shelf_life_days: shelf_life_days
                });
            }

            // USER REQUIREMENT: Randomly initialize the amount of products in stock in the beginning
            // Generate a random qty between 10 and 100
            const randomQty = Math.floor(Math.random() * (100 - 10 + 1)) + 10;

            // Randomly offset receiving date by -3 to 0 days to simulate existing stock
            const rOffset = Math.floor(Math.random() * 4);
            const d = new Date();
            d.setDate(d.getDate() - rOffset);
            const simulatedReceiveDate = d.toISOString().split('T')[0];

            // Expiry = simulated Receive + shelf_life
            const ed = new Date(d);
            ed.setDate(ed.getDate() + shelf_life_days);
            const simulatedExpiryDate = ed.toISOString().split('T')[0];

            stockEntries.push({
                product_name,
                receive_date: simulatedReceiveDate,
                expiry_date: simulatedExpiryDate,
                quantity: randomQty
            });
        })
        .on('end', () => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                const stmtProduct = db.prepare(`INSERT OR IGNORE INTO Products (product_name, price, image_url, category_name, status, shelf_life_days) VALUES (?, ?, ?, ?, ?, ?)`);

                for (const [name, data] of productsMap.entries()) {
                    stmtProduct.run([name, data.price, data.image_url, data.category_name, data.status, data.shelf_life_days]);
                }
                stmtProduct.finalize();

                const stmtStock = db.prepare(`
                    INSERT INTO Stock (product_id, receive_date, expiry_date, quantity) 
                    VALUES ((SELECT id FROM Products WHERE product_name = ?), ?, ?, ?)
                `);

                for (const stock of stockEntries) {
                    stmtStock.run([stock.product_name, stock.receive_date, stock.expiry_date, stock.quantity]);
                }
                stmtStock.finalize();

                // Add initial log entries
                const seedTs = getBangkokTimestamp();
                const stmtLog = db.prepare(`INSERT INTO Transactions_Log (action_type, product_id, quantity, actor_name, action_date) VALUES ('ADD', (SELECT id FROM Products WHERE product_name = ?), ?, 'System/Setup', ?)`);
                for (const stock of stockEntries) {
                    stmtLog.run([stock.product_name, stock.quantity, seedTs]);
                }
                stmtLog.finalize();

                db.run('COMMIT', (err) => {
                    if (err) console.error("Error seeding database:", err);
                    else console.log("Database seeding completed with randomized stock amounts.");
                });
            });
        });
}

// ==========================================
// ROUTES - FRONTEND PAGE VIEWS
// ==========================================

// Login Page
app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM Users WHERE username = ?', [username], (err, user) => {
        if (err || !user) {
            return res.render('login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (Invalid credentials)' });
        }

        if (bcrypt.compareSync(password, user.password)) {
            req.session.user = { id: user.id, username: user.username, role: user.role };
            res.redirect('/');
        } else {
            res.render('login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (Invalid credentials)' });
        }
    });
});

app.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Dashboard Main (Index)
app.get('/', requireAuth, (req, res) => {
    res.render('index', { activePage: 'dashboard' });
});

app.get('/withdraw', requireAuth, (req, res) => {
    res.render('withdraw', { activePage: 'withdraw' });
});

app.get('/add-stock', requireAuth, (req, res) => {
    res.render('add_stock', { activePage: 'add' });
});

app.get('/history', requireAuth, (req, res) => {
    res.render('history', { activePage: 'history' });
});

// ==========================================
// ROUTES - ADMIN VIEWS
// ==========================================
app.get('/admin', requireManager, (req, res) => {
    // Admin Dashboard Data
    res.render('admin_dashboard');
});

// Standalone Management Pages (Manager only)
app.get('/manage-products', requireManager, (req, res) => {
    res.render('manage_products', { activePage: 'manage_products', user: req.session.user });
});

app.get('/manage-users', requireManager, (req, res) => {
    res.render('manage_users', { activePage: 'manage_users', user: req.session.user });
});

app.get('/admin/users', requireManager, (req, res) => {
    res.render('admin_users');
});


// ==========================================
// API ENDPOINTS (JSON)
// ==========================================

app.get('/api/inventory', requireAuth, (req, res) => {
    const query = `
        SELECT 
            p.id as product_id, 
            p.product_name, 
            p.image_url, 
            p.category_name,
            s.id as stock_id,
            s.receive_date, 
            s.expiry_date, 
            s.quantity
        FROM Products p
        LEFT JOIN Stock s ON p.id = s.product_id AND s.quantity > 0
        ORDER BY p.product_name ASC, s.receive_date ASC
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const grouped = {};
        const todayStr = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).split(' ')[0];

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
                // Check if expired based on Bangkok time
                const isExpired = expiry_date < todayStr;

                if (isExpired) {
                    grouped[product_id].expired_quantity += quantity;
                } else {
                    grouped[product_id].total_quantity += quantity;
                }
                grouped[product_id].batches.push({ stock_id, receive_date, expiry_date, quantity, isExpired });
            }
        }
        res.json(Object.values(grouped).filter(p => p.total_quantity > 0 || p.expired_quantity > 0 || p.batches.length === 0));
    });
});

app.get('/api/products', requireAuth, (req, res) => {
    db.all("SELECT id, product_name, shelf_life_days FROM Products ORDER BY product_name ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/available-products', requireAuth, (req, res) => {
    const query = `
        SELECT DISTINCT p.id, p.product_name 
        FROM Products p
        JOIN Stock s ON p.id = s.product_id
        WHERE s.quantity > 0
        ORDER BY p.product_name ASC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Update POST /api/stock/add to use schema's shelf life
app.post('/api/stock/add', requireAuth, (req, res) => {
    const { product_id, receive_date, quantity } = req.body;

    if (!product_id || !receive_date || quantity <= 0) {
        return res.status(400).json({ error: "ข้อมูลไม่ถูกต้อง (Invalid parameters)" });
    }

    // Get shelf life for this product
    db.get('SELECT shelf_life_days FROM Products WHERE id = ?', [product_id], (err, product) => {
        if (err || !product) return res.status(404).json({ error: "ไม่พบสินค้า (Product not found)" });

        // Calculate auto expiry
        const rDate = new Date(receive_date);
        rDate.setDate(rDate.getDate() + product.shelf_life_days);
        const expiry_date = rDate.toISOString().split('T')[0];

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run(
                `INSERT INTO Stock (product_id, receive_date, expiry_date, quantity) VALUES (?, ?, ?, ?)`,
                [product_id, receive_date, expiry_date, quantity],
                function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: "Failed to add stock" });
                    }
                    db.run(
                        `INSERT INTO Transactions_Log (action_type, product_id, quantity, actor_name, action_date) VALUES ('ADD', ?, ?, ?, ?)`,
                        [product_id, quantity, req.session.user.username, getBangkokTimestamp()],
                        function (err2) {
                            if (err2) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: "Failed to log" });
                            }
                            db.run('COMMIT');
                            res.json({ message: "เพิ่มสต็อกสินค้าสำเร็จ", stock_id: this.lastID });
                        }
                    );
                }
            );
        });
    });
});

app.post('/api/stock/withdraw', requireAuth, (req, res) => {
    const { product_id, quantity, actor_name } = req.body;

    if (!product_id || !quantity || quantity <= 0 || !actor_name) {
        return res.status(400).json({ error: "ข้อมูลไม่ถูกต้อง (Invalid input)" });
    }
    const qtyToWithdraw = parseInt(quantity, 10);

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.all(`SELECT id, quantity FROM Stock WHERE product_id = ? AND quantity > 0 ORDER BY receive_date ASC, id ASC`, [product_id], (err, batches) => {
            if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: "Database error" }); }

            const totalAvailable = batches.reduce((sum, b) => sum + b.quantity, 0);
            if (qtyToWithdraw > totalAvailable) {
                db.run('ROLLBACK');
                return res.status(400).json({ error: "จำนวนสต็อกไม่เพียงพอ (Exceeds available stock)" });
            }

            let remainingToWithdraw = qtyToWithdraw;
            const queries = [];
            for (const batch of batches) {
                if (remainingToWithdraw <= 0) break;
                if (batch.quantity <= remainingToWithdraw) {
                    queries.push({ sql: `DELETE FROM Stock WHERE id = ?`, params: [batch.id] });
                    remainingToWithdraw -= batch.quantity;
                } else {
                    queries.push({ sql: `UPDATE Stock SET quantity = quantity - ? WHERE id = ?`, params: [remainingToWithdraw, batch.id] });
                    remainingToWithdraw = 0;
                }
            }

            const executeQueries = (index = 0) => {
                if (index >= queries.length) {
                    db.run(`INSERT INTO Transactions_Log (action_type, product_id, quantity, actor_name, action_date) VALUES ('WITHDRAW', ?, ?, ?, ?)`,
                        [product_id, qtyToWithdraw, actor_name, getBangkokTimestamp()],
                        (logErr) => {
                            if (logErr) { db.run('ROLLBACK'); return res.status(500).json({ error: "Failed to log transaction" }); }
                            db.run('COMMIT');
                            return res.json({ message: "ตัดสต็อกสำเร็จ" });
                        }
                    );
                    return;
                }
                const q = queries[index];
                db.run(q.sql, q.params, (err) => {
                    if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: "DB Error" }); }
                    executeQueries(index + 1);
                });
            };
            executeQueries();
        }
        );
    });
});


// ==========================================
// Delete Expired Products (All or by Category)
// ==========================================
app.post('/api/stock/delete-expired', requireAuth, (req, res) => {
    const { category, expired_batches } = req.body;

    if (!expired_batches || !Array.isArray(expired_batches) || expired_batches.length === 0) {
        return res.status(400).json({ error: "ไม่มีรายการสินค้าที่เลือก (No items selected)" });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const stmtDelete = db.prepare('DELETE FROM Stock WHERE id = ?');
        const stmtLog = db.prepare(`
            INSERT INTO Transactions_Log (action_type, product_id, quantity, actor_name, action_date, extra_info) 
            VALUES ('EXPIRED', ?, ?, ?, ?, ?)
        `);

        const timestamp = getBangkokTimestamp();
        let errorOccurred = false;

        expired_batches.forEach(batch => {
            // batch = { stock_id, product_id, quantity, expiry_date, product_name }
            stmtDelete.run([batch.stock_id], (err) => {
                if (err) errorOccurred = true;
            });

            // Log format requirement: "หมดวันไหน กี่จำนวน"
            const extraInfo = `${batch.product_name} | หมดอายุ: ${batch.expiry_date}`;
            stmtLog.run([batch.product_id, batch.quantity, req.session.user.username, timestamp, extraInfo], (err) => {
                if (err) errorOccurred = true;
            });
        });

        stmtDelete.finalize();
        stmtLog.finalize();

        db.run('COMMIT', (err) => {
            if (err || errorOccurred) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบสินค้า" });
            }
            res.json({ message: `ลบสินค้าหมดอายุ ${expired_batches.length} ล็อตสำเร็จ` });
        });
    });
});

app.get('/api/history', requireAuth, (req, res) => {
    const query = `
        SELECT t.id, t.action_date, t.action_type,
               COALESCE(p.product_name, '[สินค้าที่ถูกลบ]') AS product_name,
               t.quantity, t.actor_name, t.extra_info
        FROM Transactions_Log t
        LEFT JOIN Products p ON t.product_id = p.id
        ORDER BY t.action_date DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Admin APIs
app.get('/api/admin/dashboard-stats', requireAuth, (req, res) => {
    // 5 KPIs List:
    const qProducts = `SELECT COUNT(id) AS totalProducts FROM Products`;
    // Only count active stock towards total stock!
    const qStock = `SELECT SUM(quantity) AS totalStock FROM Stock WHERE quantity > 0 AND expiry_date >= date('now', 'localtime')`;
    // Only count active stock towards total value!
    const qValue = `SELECT SUM(s.quantity * p.price) AS totalValue 
                    FROM Stock s
                    JOIN Products p ON s.product_id = p.id
                    WHERE s.quantity > 0 AND s.expiry_date >= date('now', 'localtime')`;

    // Transactions
    const qReceiveTx = `SELECT COUNT(id) AS totalReceiveTx FROM Transactions_Log WHERE action_type = 'ADD'`;
    const qWithdrawTx = `SELECT COUNT(id) AS totalWithdrawTx FROM Transactions_Log WHERE action_type = 'WITHDRAW'`;

    // Active Stock List (Under 50)
    const qLowStock = `
        SELECT p.id, p.product_name, SUM(s.quantity) AS total_qty
        FROM Products p
        JOIN Stock s ON p.id = s.product_id
        WHERE s.quantity > 0 AND s.expiry_date >= date('now', 'localtime')
        GROUP BY p.id
        HAVING total_qty < 50
        ORDER BY total_qty ASC
        LIMIT 10
    `;

    // Frequent Receive (Top 10)
    const qFreqReceive = `
        SELECT p.id, p.product_name, COUNT(t.id) as freq, SUM(t.quantity) as total_qty
        FROM Transactions_Log t
        JOIN Products p ON t.product_id = p.id
        WHERE t.action_type = 'ADD'
        GROUP BY p.id
        ORDER BY freq DESC, total_qty DESC
        LIMIT 10
    `;

    // Frequent Withdraw (Top 10)
    const qFreqWithdraw = `
        SELECT p.id, p.product_name, COUNT(t.id) as freq, SUM(t.quantity) as total_qty
        FROM Transactions_Log t
        JOIN Products p ON t.product_id = p.id
        WHERE t.action_type = 'WITHDRAW'
        GROUP BY p.id
        ORDER BY freq DESC, total_qty DESC
        LIMIT 10
    `;

    db.get(qProducts, [], (err1, row1) => {
        db.get(qStock, [], (err2, row2) => {
            db.get(qValue, [], (err3, row3) => {
                db.get(qReceiveTx, [], (err4, row4) => {
                    db.get(qWithdrawTx, [], (err5, row5) => {
                        db.all(qLowStock, [], (err6, rows6) => {
                            db.all(qFreqReceive, [], (err7, rows7) => {
                                db.all(qFreqWithdraw, [], (err8, rows8) => {
                                    if (err1 || err2 || err3 || err4 || err5 || err6 || err7 || err8) {
                                        return res.status(500).json({ error: "Failed to load dashboard data" });
                                    }
                                    res.json({
                                        totalProducts: row1?.totalProducts || 0,
                                        totalStock: row2?.totalStock || 0,
                                        totalValue: row3?.totalValue || 0,
                                        totalReceiveTx: row4?.totalReceiveTx || 0,
                                        totalWithdrawTx: row5?.totalWithdrawTx || 0,
                                        lowStockList: rows6 || [],
                                        frequentReceiveList: rows7 || [],
                                        frequentWithdrawList: rows8 || []
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// Admin: Reseed all stock with random quantities
app.post('/api/admin/reseed-stock', requireManager, (req, res) => {
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('DELETE FROM Stock', (err) => {
            if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: 'ล้มเหลวในการลบสต็อก' }); }

            db.run('DELETE FROM Transactions_Log', (err2) => {
                if (err2) { db.run('ROLLBACK'); return res.status(500).json({ error: 'ล้มเหลวในการลบประวัติ' }); }

                db.all('SELECT id, shelf_life_days FROM Products', [], (err3, products) => {
                    if (err3 || !products.length) { db.run('ROLLBACK'); return res.status(500).json({ error: 'ไม่พบข้อมูลสินค้า' }); }

                    const stmtStock = db.prepare(`INSERT INTO Stock (product_id, receive_date, expiry_date, quantity) VALUES (?, ?, ?, ?)`);
                    const reseedTs = getBangkokTimestamp();
                    const stmtLog = db.prepare(`INSERT INTO Transactions_Log (action_type, product_id, quantity, actor_name, action_date) VALUES ('ADD', ?, ?, 'System/Reseed', ?)`);
                    const today = new Date();

                    products.forEach(p => {
                        const qty = Math.floor(Math.random() * 141) + 10; // 10-150
                        const offset = Math.floor(Math.random() * 5); // 0-4 days ago
                        const receiveDate = new Date(today);
                        receiveDate.setDate(receiveDate.getDate() - offset);
                        const expiryDate = new Date(receiveDate);
                        expiryDate.setDate(expiryDate.getDate() + (p.shelf_life_days || 7));

                        const rd = receiveDate.toISOString().split('T')[0];
                        const ed = expiryDate.toISOString().split('T')[0];
                        stmtStock.run([p.id, rd, ed, qty]);
                        stmtLog.run([p.id, qty, reseedTs]);
                    });

                    stmtStock.finalize();
                    stmtLog.finalize();

                    db.run('COMMIT', (commitErr) => {
                        if (commitErr) return res.status(500).json({ error: 'COMMIT ล้มเหลว' });
                        res.json({ message: `สุ่มสต็อกสินค้า ${products.length} รายการสำเร็จ` });
                    });
                });
            });
        });
    });
});

app.get('/api/admin/users', requireManager, (req, res) => {
    db.all("SELECT id, username, full_name, role, created_at FROM Users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/admin/users', requireManager, (req, res) => {
    const { username, password, full_name, role } = req.body;
    if (!username || !password || !full_name) return res.status(400).json({ error: "ใส่ข้อมูลให้ครบ (Missing fields)" });

    const uRole = role === 'manager' ? 'manager' : 'staff';
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    db.run("INSERT INTO Users (username, password, full_name, role) VALUES (?, ?, ?, ?)", [username, hash, full_name, uRole], function (err) {
        if (err) return res.status(500).json({ error: "ชื่อผู้ใช้นี้มีอยู่แล้ว หรือเกิดข้อผิดพลาด (Username exists or DB error)" });
        const newUserId = this.lastID;
        db.run(`INSERT INTO Transactions_Log (action_type, product_id, quantity, actor_name, action_date, extra_info) VALUES ('CREATE_USER', NULL, NULL, ?, ?, ?)`,
            [req.session.user.username, getBangkokTimestamp(), `${username} (${uRole})`]);
        res.json({ message: "สร้างบัญชีสำเร็จ (User created)" });
    });
});

app.delete('/api/admin/users/:id', requireManager, (req, res) => {
    const id = req.params.id;
    // Prevent deleting self here
    if (id == req.session.user.id) return res.status(400).json({ error: "ไม่สามารถลบบัญชีตัวเองได้" });
    db.get("SELECT username, role FROM Users WHERE id = ?", [id], (err, targetUser) => {
        if (err || !targetUser) return res.status(404).json({ error: "ไม่พบผู้ใช้" });
        db.run("DELETE FROM Users WHERE id = ?", [id], (err2) => {
            if (err2) return res.status(500).json({ error: "ลบไม่สำเร็จ" });
            db.run(`INSERT INTO Transactions_Log (action_type, product_id, quantity, actor_name, action_date, extra_info) VALUES ('DELETE_USER', NULL, NULL, ?, ?, ?)`,
                [req.session.user.username, getBangkokTimestamp(), `${targetUser.username} (${targetUser.role})`]);
            res.json({ message: "ลบบัญชีสำเร็จ" });
        });
    });
});

// Edit user role and/or password
app.put('/api/admin/users/:id', requireManager, (req, res) => {
    const id = req.params.id;
    const { role, password } = req.body;
    if (!role && !password) return res.status(400).json({ error: 'ไม่มีข้อมูลที่จะอัปเดต' });

    const updates = [];
    const params = [];

    if (role) {
        updates.push('role = ?');
        params.push(role === 'manager' ? 'manager' : 'staff');
    }
    if (password) {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);
        updates.push('password = ?');
        params.push(hash);
    }
    params.push(id);

    db.run(`UPDATE Users SET ${updates.join(', ')} WHERE id = ?`, params, function (err) {
        if (err) return res.status(500).json({ error: 'อัปเดตไม่สำเร็จ' });
        if (this.changes === 0) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
        res.json({ message: 'อัปเดตบัญชีสำเร็จ' });
    });
});

// ==========================================
// API ENDPOINTS - PRODUCT CRUD (Admin)
// ==========================================

// List all products (admin view with full details)
app.get('/api/admin/products', requireManager, (req, res) => {
    db.all(`SELECT id, product_name, price, image_url, category_name, shelf_life_days FROM Products ORDER BY category_name ASC, product_name ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create new product
app.post('/api/admin/products', requireManager, (req, res) => {
    const { product_name, price, image_url, category_name, shelf_life_days } = req.body;
    if (!product_name || !product_name.trim()) return res.status(400).json({ error: 'กรุณาใส่ชื่อสินค้า' });

    db.run(
        `INSERT INTO Products (product_name, price, image_url, category_name, status, shelf_life_days) VALUES (?, ?, ?, ?, 'normal', ?)`,
        [product_name.trim(), parseFloat(price) || 0, (image_url || '').trim(), (category_name || 'ทั่วไป').trim(), parseInt(shelf_life_days) || 7],
        function (err) {
            if (err) return res.status(500).json({ error: 'ชื่อสินค้านี้มีอยู่แล้ว หรือเกิดข้อผิดพลาด' });
            const newId = this.lastID;
            db.run(`INSERT INTO Transactions_Log (action_type, product_id, quantity, actor_name, action_date, extra_info) VALUES ('CREATE_PRODUCT', ?, NULL, ?, ?, ?)`,
                [newId, req.session.user.username, getBangkokTimestamp(), product_name.trim()]);
            res.json({ message: 'สร้างสินค้าสำเร็จ', id: newId });
        }
    );
});

// Edit product
app.put('/api/admin/products/:id', requireManager, (req, res) => {
    const id = req.params.id;
    const { product_name, price, image_url, category_name, shelf_life_days } = req.body;
    if (!product_name || !product_name.trim()) return res.status(400).json({ error: 'กรุณาใส่ชื่อสินค้า' });

    db.run(
        `UPDATE Products SET product_name = ?, price = ?, image_url = ?, category_name = ?, shelf_life_days = ? WHERE id = ?`,
        [product_name.trim(), parseFloat(price) || 0, (image_url || '').trim(), (category_name || 'ทั่วไป').trim(), parseInt(shelf_life_days) || 7, id],
        function (err) {
            if (err) return res.status(500).json({ error: 'อัปเดตสินค้าล้มเหลว: ' + err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'ไม่พบสินค้า' });
            res.json({ message: 'อัปเดตสินค้าสำเร็จ' });
        }
    );
});

// Delete product (cascade: delete its stock and transaction logs, but keep a DELETE_PRODUCT log)
app.delete('/api/admin/products/:id', requireManager, (req, res) => {
    const id = req.params.id;
    db.get('SELECT product_name FROM Products WHERE id = ?', [id], (err, prod) => {
        if (err || !prod) return res.status(404).json({ error: 'ไม่พบสินค้า' });
        const deletedName = prod.product_name;
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run('DELETE FROM Stock WHERE product_id = ?', [id], (err) => {
                if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: 'ลบสต็อกล้มเหลว' }); }
                // Nullify product_id in log so history remains, but remove link
                db.run('UPDATE Transactions_Log SET product_id = NULL WHERE product_id = ?', [id], (err2) => {
                    if (err2) { db.run('ROLLBACK'); return res.status(500).json({ error: 'อัปเดตประวัติล้มเหลว' }); }
                    db.run('DELETE FROM Products WHERE id = ?', [id], function (err3) {
                        if (err3) { db.run('ROLLBACK'); return res.status(500).json({ error: 'ลบสินค้าล้มเหลว' }); }
                        if (this.changes === 0) { db.run('ROLLBACK'); return res.status(404).json({ error: 'ไม่พบสินค้า' }); }
                        // Insert DELETE_PRODUCT log after commit
                        db.run('COMMIT', () => {
                            db.run(`INSERT INTO Transactions_Log (action_type, product_id, quantity, actor_name, action_date, extra_info) VALUES ('DELETE_PRODUCT', NULL, NULL, ?, ?, ?)`,
                                [req.session.user.username, getBangkokTimestamp(), deletedName]);
                            res.json({ message: 'ลบสินค้าสำเร็จ' });
                        });
                    });
                });
            });
        });
    });
});


// Start listening
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
