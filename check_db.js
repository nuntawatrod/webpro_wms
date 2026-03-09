const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'wms.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    db.get("SELECT COUNT(*) AS count FROM Products", (err, row) => {
        if (err) console.error(err);
        else console.log("Products count:", row.count);
    });
    db.all("SELECT id, product_name FROM Products LIMIT 5", (err, rows) => {
        if (err) console.error(err);
        else console.log("Sample products:", rows);
    });
});
