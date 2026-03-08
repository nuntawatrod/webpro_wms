const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const DB_PATH = path.join(__dirname, 'wms.db');
const CSV_PATH = path.join(__dirname, 'products.csv');

const db = new sqlite3.Database(DB_PATH);

function updateShelfLife() {
    console.log("Reading CSV to update database...");
    const productsMap = new Map();

    fs.createReadStream(CSV_PATH)
        .pipe(csv({
            mapHeaders: ({ header }) => header.trim().replace(/^[\uFEFF\u200B]+/, '')
        }))
        .on('data', (row) => {
            const { product_name, shelf_life_days } = row;
            if (product_name && shelf_life_days) {
                productsMap.set(product_name, parseInt(shelf_life_days) || 7);
            }
        })
        .on('end', () => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Update shelf_life_days in Products
                const updateProductStmt = db.prepare('UPDATE Products SET shelf_life_days = ? WHERE product_name = ?');
                for (const [name, life] of productsMap.entries()) {
                    updateProductStmt.run([life, name]);
                }
                updateProductStmt.finalize();

                console.log("Updated shelf_life_days in Products table.");

                // Update expiry_date in Stock table: receive_date + shelf_life_days
                // Use SQLite's date function to add days to receive_date
                db.run(`
                    UPDATE Stock 
                    SET expiry_date = date(receive_date, '+' || 
                        (SELECT shelf_life_days FROM Products WHERE id = Stock.product_id) 
                        || ' days')
                    WHERE EXISTS (SELECT 1 FROM Products WHERE id = Stock.product_id)
                `, function (err) {
                    if (err) {
                        console.error('Error updating Stock expiry dates:', err);
                    } else {
                        console.log(`Updated expiry_date for ${this.changes} stock records.`);
                    }
                });

                db.run('COMMIT', (err) => {
                    if (err) {
                        console.error("Transaction commit failed:", err);
                    } else {
                        console.log("Database update completed successfully.");
                    }
                    db.close();
                });
            });
        });
}

updateShelfLife();
