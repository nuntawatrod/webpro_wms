const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const DB_PATH = path.join(__dirname, 'wms.db');
const CSV_PATH = path.join(__dirname, 'products.csv');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        process.exit(1);
    }
});

// Speed up SQLite inserts massively
db.run("PRAGMA synchronous = OFF");
db.run("PRAGMA journal_mode = MEMORY");

// Helper: Format date as YYYY-MM-DD
function formatDate(date) {
    const pad = n => ('0' + n).slice(-2);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Helper: Format datetime for SQLite
function formatDateTime(date) {
    const pad = n => ('0' + n).slice(-2);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function runSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function getSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedHistory() {
    try {
        console.log("Reading products.csv...");
        if (!fs.existsSync(CSV_PATH)) {
            console.error("products.csv not found.");
            return;
        }

        const products = [];
        await new Promise((resolve, reject) => {
            fs.createReadStream(CSV_PATH)
                .pipe(csv({
                    mapHeaders: ({ header }) => header.trim().replace(/^[\uFEFF\u200B]+/, '').replace(/^"/, '').replace(/"$/, '')
                }))
                .on('data', row => {
                    const shelf_life_days = parseInt(row.shelf_life_days) || 7;
                    products.push({
                        name: row.product_name,
                        price: parseFloat(row.price) || 0, // save price
                        image_url: row.image_url || '',    // save url
                        category: row.category_name || 'ทั่วไป', // save category
                        shelf_life_days: shelf_life_days
                    });
                })
                .on('end', resolve)
                .on('error', reject);
        });

        console.log(`Found ${products.length} products in CSV.`);

        // Start date: March 9, 2025
        // End date: March 9, 2026
        const startTimestamp = new Date('2025-03-09T08:00:00+07:00').getTime();
        const endTimestamp = new Date('2026-03-09T14:00:00+07:00').getTime();

        let transactionCount = 0;
        let stockCount = 0;

        for (const p of products) {
            if (!p.name) continue;

            let productRow = await getSQL("SELECT id, category_name FROM Products WHERE product_name = ?", [p.name]);
            if (!productRow) {
                // Insert missing product
                await runSQL(
                    `INSERT INTO Products (product_name, price, image_url, category_name, shelf_life_days, status) VALUES (?, ?, ?, ?, ?, 'normal')`,
                    [p.name, p.price, p.image_url, p.category, p.shelf_life_days]
                );
                productRow = await getSQL("SELECT id, category_name FROM Products WHERE product_name = ?", [p.name]);
                if (!productRow) {
                    console.log(`Still not found: "${p.name}"`);
                    continue;
                }
            } else if (productRow.category_name === 'ทั่วไป' && (p.category === 'ผัก' || p.category === 'ผลไม้')) {
                // If it was temporarily mapped to 'ทั่วไป' but we know it's vegetables/fruits from CSV, update back
                await runSQL("UPDATE Products SET category_name = ? WHERE id = ?", [p.category, productRow.id]);
            }

            const productId = productRow.id;

            // Delete existing stock and transactions for this product so we start fresh
            await runSQL("DELETE FROM Transactions_Log WHERE product_id = ?", [productId]);
            await runSQL("DELETE FROM Stock WHERE product_id = ?", [productId]);

            // Generate roughly 2-4 transactions per month for each product
            const numTransactions = randInt(24, 48);

            let currentStock = 0;

            for (let i = 0; i < numTransactions; i++) {
                // Random time within the year
                const randTime = randInt(startTimestamp, endTimestamp);
                const actionDate = new Date(randTime);
                const isAdd = currentStock < 20 ? true : (Math.random() > 0.5);
                const qty = isAdd ? randInt(20, 100) : randInt(5, Math.min(currentStock || 100, 50));

                if (isAdd) {
                    currentStock += qty;
                    // Log Add
                    await runSQL(
                        `INSERT INTO Transactions_Log (action_type, product_id, quantity, action_date, actor_name, extra_info) 
                         VALUES ('ADD', ?, ?, ?, 'System/Auto', 'Seeded Historical Stock')`,
                        [productId, qty, formatDateTime(actionDate)]
                    );

                    // Add Stock entry
                    const expiryDate = new Date(actionDate.getTime() + (p.shelf_life_days * 24 * 60 * 60 * 1000));
                    await runSQL(
                        `INSERT INTO Stock (product_id, receive_date, expiry_date, quantity, last_updated)
                         VALUES (?, ?, ?, ?, ?)`,
                        [productId, formatDate(actionDate), formatDate(expiryDate), qty, formatDateTime(actionDate)]
                    );
                    stockCount++;
                } else {
                    if (currentStock < qty) continue;

                    currentStock -= qty;
                    // Log Withdraw
                    await runSQL(
                        `INSERT INTO Transactions_Log (action_type, product_id, quantity, action_date, actor_name, extra_info) 
                         VALUES ('WITHDRAW', ?, ?, ?, 'System/Auto', 'Seeded Historical Withdraw')`,
                        [productId, qty, formatDateTime(actionDate)]
                    );

                    // Deduct from stock (FIFO style roughly for seeding, just update random alive stock or the one with most)
                    await runSQL(
                        `UPDATE Stock 
                         SET quantity = quantity - ?, last_updated = ? 
                         WHERE id = (SELECT id FROM Stock WHERE product_id = ? AND quantity >= ? ORDER BY expiry_date ASC LIMIT 1)`,
                        [qty, formatDateTime(actionDate), productId, qty]
                    );
                }
                transactionCount++;
            }
        }

        console.log(`Successfully seeded ${transactionCount} transactions and ${stockCount} stock entries.`);
    } catch (err) {
        console.error("Error seeding history:", err);
    } finally {
        db.close();
    }
}

seedHistory();
