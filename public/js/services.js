const db = require('./db');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const { getBangkokTimestamp, autoLogExpiredProducts } = require('./helpers');

class UserService {
    static getPermissions() {
        return new Promise((resolve, reject) => {
            db.all("SELECT role, permission_key FROM Role_Permissions", [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    static updatePermissions(permissions) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.run('DELETE FROM Role_Permissions', (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(new Error('Failed to clear permissions'));
                    }
                    const stmt = db.prepare("INSERT INTO Role_Permissions (role, permission_key) VALUES (?, ?)");
                    permissions.forEach(p => {
                        if (p.enabled) stmt.run(p.role, p.key);
                    });
                    stmt.finalize();
                    db.run('COMMIT', (e) => resolve({ message: 'Success' }));
                });
            });
        });
    }

    static getAllUsers() {
        return new Promise((resolve, reject) => {
            db.all("SELECT id, username, full_name, role, created_at FROM Users", (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    static createUser({ username, password, full_name, role }) {
        return new Promise((resolve, reject) => {
            if (role === 'admin') {
                return reject(new Error("Cannot create 'admin' accounts. Only one admin allowed."));
            }
            const hash = bcrypt.hashSync(password, 10);
            db.run("INSERT INTO Users (username, password, full_name, role) VALUES (?, ?, ?, ?)",
                [username, hash, full_name, role],
                function (err) {
                    if (err) return reject(new Error("Username exists"));
                    resolve({ message: "User created", id: this.lastID });
                });
        });
    }

    static deleteUser(userId, currentUserId) {
        return new Promise((resolve, reject) => {
            if (userId == currentUserId) return reject(new Error("Cannot delete self"));
            db.run("DELETE FROM Users WHERE id = ?", [userId], (err) => {
                if (err) return reject(err);
                resolve({ message: "Deleted" });
            });
        });
    }

    static updateUserRole(userId, newRole) {
        return new Promise((resolve, reject) => {
            if (newRole === 'admin') return reject(new Error("Cannot assign 'admin' role."));

            db.get("SELECT role FROM Users WHERE id = ?", [userId], (err, user) => {
                if (err || !user) return reject(new Error("User not found"));
                if (user.role === 'admin') return reject(new Error("Cannot change the role of an admin."));

                db.run("UPDATE Users SET role = ? WHERE id = ?", [newRole, userId], (err) => {
                    if (err) return reject(new Error("Update failed"));
                    resolve({ message: "Role updated" });
                });
            });
        });
    }
}

class ProductService {
    static getAllProducts() {
        return new Promise((resolve, reject) => {
            db.all("SELECT * FROM Products ORDER BY product_name ASC", (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    static getAvailableProducts() {
        return new Promise((resolve, reject) => {
            const query = `SELECT DISTINCT p.id, p.product_name FROM Products p JOIN Stock s ON p.id = s.product_id WHERE s.quantity > 0 ORDER BY p.product_name ASC`;
            db.all(query, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    static getProductNamesAndShelfLife() {
        return new Promise((resolve, reject) => {
            db.all("SELECT id, product_name, shelf_life_days FROM Products ORDER BY product_name ASC", [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    static createProduct({ product_name, price, image_url, category_name, shelf_life_days }) {
        return new Promise((resolve, reject) => {
            db.run("INSERT INTO Products (product_name, price, image_url, category_name, status, shelf_life_days) VALUES (?, ?, ?, ?, 'normal', ?)",
                [product_name, price, image_url, category_name, shelf_life_days], function (err) {
                    if (err) return reject(err);
                    resolve({ message: "Product created", id: this.lastID });
                });
        });
    }

    static updateProduct(id, { product_name, price, image_url, category_name, shelf_life_days }) {
        return new Promise((resolve, reject) => {
            db.run("UPDATE Products SET product_name=?, price=?, image_url=?, category_name=?, shelf_life_days=? WHERE id=?",
                [product_name, price, image_url, category_name, shelf_life_days, id], (err) => {
                    if (err) return reject(err);
                    resolve({ message: "Updated" });
                });
        });
    }

    static deleteProduct(id) {
        return new Promise((resolve, reject) => {
            db.run("DELETE FROM Products WHERE id = ?", [id], (err) => {
                if (err) return reject(err);
                resolve({ message: "Deleted" });
            });
        });
    }

    static bulkImport() {
        return new Promise((resolve, reject) => {
            const CSV_PATH = path.join(__dirname, '../../products.csv');
            if (!fs.existsSync(CSV_PATH)) return reject(new Error("ไม่พบไฟล์ products.csv"));

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
                            if (err) return reject(new Error("Failed to import"));
                            resolve({ message: "นำเข้าสินค้าจาก CSV สำเร็จ" });
                        });
                    });
                })
                .on('error', (err) => reject(err));
        });
    }
}

class InventoryService {
    static getDashboardStats() {
        return new Promise(async (resolve, reject) => {
            try {
                const getOne = (query) => new Promise((res, rej) => db.get(query, [], (err, row) => err ? rej(err) : res(row)));
                const getAll = (query) => new Promise((res, rej) => db.all(query, [], (err, rows) => err ? rej(err) : res(rows)));

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

                resolve({
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
                reject(error);
            }
        });
    }

    static getInventory(isStaff, todayStr) {
        return new Promise((resolve, reject) => {
            autoLogExpiredProducts();
            const query = `
                SELECT p.id as product_id, p.product_name, p.image_url, p.category_name,
                       s.id as stock_id, s.receive_date, s.expiry_date, s.quantity
                FROM Products p
                LEFT JOIN Stock s ON p.id = s.product_id AND s.quantity > 0
                ORDER BY p.product_name ASC, s.receive_date ASC
            `;
            db.all(query, [], (err, rows) => {
                if (err) return reject(new Error("Database error occurred while fetching inventory."));

                const grouped = {};
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
                            expiry_date: expiry_date,
                            quantity,
                            isExpired
                        });
                    }
                }
                resolve(Object.values(grouped));
            });
        });
    }

    static addStock(product_id, receive_date, quantity, username) {
        return new Promise((resolve, reject) => {
            db.get('SELECT shelf_life_days FROM Products WHERE id = ?', [product_id], (err, product) => {
                if (err || !product) return reject(new Error("ไม่พบสินค้าที่ระบุ"));

                const rDate = new Date(receive_date);
                rDate.setDate(rDate.getDate() + (product.shelf_life_days || 7));
                const expiry_date = rDate.toISOString().split('T')[0];

                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    db.run(`INSERT INTO Stock (product_id, receive_date, expiry_date, quantity) VALUES (?, ?, ?, ?)`, [product_id, receive_date, expiry_date, quantity], function (err) {
                        if (err) { db.run('ROLLBACK'); return reject(new Error("ไม่สามารถเพิ่มสต็อกได้")); }

                        db.run(`INSERT INTO Transactions_Log (action_type, product_id, quantity, actor_name, action_date) VALUES ('ADD', ?, ?, ?, ?)`,
                            [product_id, quantity, username, getBangkokTimestamp()], (err2) => {
                                if (err2) { db.run('ROLLBACK'); return reject(new Error("บันทึกประวัติล้มเหลว")); }
                                db.run('COMMIT');
                                resolve({ message: "เพิ่มสต็อกสินค้าสำเร็จ" });
                            });
                    });
                });
            });
        });
    }

    static withdrawStock(product_id, quantity, actor_name) {
        return new Promise((resolve, reject) => {
            const qtyToWithdraw = parseInt(quantity, 10);
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.all(`SELECT id, quantity FROM Stock WHERE product_id = ? AND quantity > 0 ORDER BY receive_date ASC, id ASC`, [product_id], (err, batches) => {
                    if (err) { db.run('ROLLBACK'); return reject(new Error("เกิดข้อผิดพลาดในการเข้าถึงคลังสินค้า")); }

                    const totalAvailable = batches.reduce((sum, b) => sum + b.quantity, 0);
                    if (qtyToWithdraw > totalAvailable) { db.run('ROLLBACK'); return reject(new Error("สต็อกไม่พอสำหรับการเบิก")); }

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
                            resolve({ message: "ตัดสต็อกสำเร็จ" });
                        });
                });
            });
        });
    }

    static deleteExpiredStock(expired_batches) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                let errOccurred = false;
                expired_batches.forEach(batch => {
                    db.run('DELETE FROM Stock WHERE id = ?', [batch.stock_id], (err) => {
                        if (err) errOccurred = true;
                    });
                });
                if (errOccurred) {
                    db.run('ROLLBACK');
                    return reject(new Error('Failed to delete expired stock'));
                }
                db.run('COMMIT', () => resolve({ message: "ลบสินค้าหมดอายุสำเร็จ" }));
            });
        });
    }
}

class HistoryService {
    static getSystemLogs() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT action_date, action_type, extra_info, actor_name 
                FROM Transactions_Log 
                WHERE action_type IN ('CREATE_PRODUCT', 'DELETE_PRODUCT', 'CREATE_USER', 'DELETE_USER', 'UPDATE_PRODUCT', 'UPDATE_USER')
                ORDER BY action_date DESC 
                LIMIT 20
            `;
            db.all(query, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    static async getHistory({ page = 1, limit = 40, search = '', actionDateType = 'all', actionType = 'all' }) {
        return new Promise((resolve, reject) => {
            const offset = (page - 1) * limit;

            let whereClauses = ["t.action_type IN ('ADD', 'WITHDRAW', 'EXPIRED')"];
            let queryParams = [];

            if (search) {
                whereClauses.push("(p.product_name LIKE ? OR t.actor_name LIKE ?)");
                queryParams.push(`%${search}%`, `%${search}%`);
            }

            if (actionDateType && actionDateType !== 'all') {
                if (actionDateType === '1M') {
                    whereClauses.push("t.action_date >= date('now', '-1 month', 'localtime')");
                } else if (actionDateType === '3M') {
                    whereClauses.push("t.action_date >= date('now', '-3 months', 'localtime')");
                } else if (actionDateType === '6M') {
                    whereClauses.push("t.action_date >= date('now', '-6 months', 'localtime')");
                } else if (actionDateType === '1Y') {
                    whereClauses.push("t.action_date >= date('now', '-1 year', 'localtime')");
                }
            }

            if (actionType && actionType !== 'all') {
                whereClauses.push("t.action_type = ?");
                queryParams.push(actionType);
            }

            const whereString = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

            const countQuery = `
                SELECT COUNT(t.id) as total 
                FROM Transactions_Log t
                LEFT JOIN Products p ON t.product_id = p.id
                ${whereString}
            `;

            const dataQuery = `
                SELECT t.id, t.action_date, t.action_type,
                       CASE WHEN p.product_name IS NOT NULL THEN p.product_name ELSE '[สินค้าที่ถูกลบ]' END AS product_name,
                       t.quantity, t.actor_name, t.extra_info
                FROM Transactions_Log t
                LEFT JOIN Products p ON t.product_id = p.id
                ${whereString}
                ORDER BY t.action_date DESC
                LIMIT ? OFFSET ?
            `;

            db.get(countQuery, queryParams, (err, countRow) => {
                if (err) return reject(err);

                const total = countRow ? countRow.total : 0;
                const totalPages = Math.ceil(total / limit);

                const dataParams = [...queryParams, parseInt(limit), parseInt(offset)];

                db.all(dataQuery, dataParams, (err, rows) => {
                    if (err) return reject(err);

                    resolve({
                        data: rows,
                        meta: {
                            total,
                            page: parseInt(page),
                            limit: parseInt(limit),
                            totalPages
                        }
                    });
                });
            });
        });
    }
}

module.exports = {
    UserService,
    ProductService,
    InventoryService,
    HistoryService
};
