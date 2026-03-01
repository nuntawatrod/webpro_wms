const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('wms.db');
db.serialize(() => {
  db.get('SELECT id, product_id FROM Stock LIMIT 1', (err, row) => {
    if (row) {
      db.run('UPDATE Stock SET quantity = 0 WHERE id = ?', [row.id], function(err) {
        console.log('updated', row.id, err || 'ok');
        db.get('SELECT p.product_name, SUM(s.quantity) as total FROM Products p LEFT JOIN Stock s ON p.id = s.product_id WHERE p.id = ? GROUP BY p.id', [row.product_id], (e, r) => {
          console.log('product summary', r);
          db.close();
        });
      });
    } else {
      console.log('no stock entries');
      db.close();
    }
  });
});
