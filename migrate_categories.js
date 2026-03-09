const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'public', 'js', '../../wms.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    // 1. Temporarily disable PRAGMA foreign_keys & create new table
    db.run('PRAGMA foreign_keys=off;');

    // We can't just alter CHECK constraint, so we must recreate the table
    // Rename old table
    db.run(`ALTER TABLE Products RENAME TO Products_old;`);

    // Create new table with updated check constraint
    db.run(`CREATE TABLE IF NOT EXISTS Products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT UNIQUE NOT NULL,
        price REAL,
        image_url TEXT,
        category_name TEXT CHECK(category_name IN ('เนื้อสัตว์', 'ผัก', 'ผลไม้', 'อาหารทะเล', 'ของแห้ง', 'ทั่วไป')),
        status TEXT DEFAULT 'active',
        shelf_life_days INTEGER DEFAULT 7,
        created_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES Users(id) ON DELETE SET NULL
    )`);

    // Copy data over (temporarily map 'ผักผลไม้' to 'ทั่วไป' if it fails constraint)
    db.run(`INSERT INTO Products (id, product_name, price, image_url, category_name, status, shelf_life_days, created_by)
            SELECT id, product_name, price, image_url,
            CASE WHEN category_name = 'ผักผลไม้' THEN 'ทั่วไป' ELSE category_name END,
            status, shelf_life_days, created_by FROM Products_old;`);

    // Drop old table
    db.run(`DROP TABLE Products_old;`);

    console.log("Migration complete.");
});
