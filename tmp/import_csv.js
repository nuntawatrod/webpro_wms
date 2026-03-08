// /tmp/import_csv.js
const db = require('../public/js/db');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const CSV_PATH = path.join(__dirname, '../products.csv');

function importCSV() {
    if (!fs.existsSync(CSV_PATH)) {
        console.log('CSV file not found');
        process.exit(1);
    }

    const productsMap = new Map();
    const stockEntries = [];

    fs.createReadStream(CSV_PATH)
        .pipe(csv({
            mapHeaders: ({ header }) => header.trim().replace(/^[\uFEFF\u200B]+/, '').replace(/^"/, '').replace(/"$/, '')
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

            // Optional: Generate initial stock for each item if desired, 
            // but usually we just want the product catalog.
            // Let's stick with the seeding logic but only for new products.
        })
        .on('end', () => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                const stmtP = db.prepare(`INSERT OR IGNORE INTO Products (product_name, price, image_url, category_name, status, shelf_life_days) VALUES (?, ?, ?, ?, ?, ?)`);
                for (const [name, data] of productsMap.entries()) {
                    stmtP.run([name, data.price, data.image_url, data.category_name, data.status, data.shelf_life_days]);
                }
                stmtP.finalize();
                db.run('COMMIT', (err) => {
                    if (err) {
                        console.error('Import Error:', err);
                        process.exit(1);
                    }
                    console.log('Successfully imported products from CSV');
                    process.exit(0);
                });
            });
        });
}

importCSV();
