const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'wms.db'));

db.get("SELECT COUNT(*) as count FROM Products", (err, row) => {
    if (err) console.error("Error:", err);
    else console.log("Success. Count:", row.count);
});
