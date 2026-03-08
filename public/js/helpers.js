// public/js/helpers.js
const db = require('./db');

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

function autoLogExpiredProducts(callback) {
    db.serialize(() => {
        const qFindExpired = `
            SELECT s.id as stock_id, s.product_id, s.quantity, s.expiry_date, p.product_name 
            FROM Stock s
            JOIN Products p ON s.product_id = p.id
            WHERE s.expiry_date < date('now', 'localtime') AND s.quantity > 0
        `;

        db.all(qFindExpired, [], (err, expiredRows) => {
            if (err || !expiredRows || expiredRows.length === 0) {
                if (callback) callback();
                return;
            }

            const qCheckLog = `SELECT extra_info FROM Transactions_Log WHERE action_type = 'EXPIRED' AND extra_info LIKE '%StockID:%'`;
            db.all(qCheckLog, [], (err2, logRows) => {
                const loggedStockIds = new Set();
                if (!err2 && logRows) {
                    logRows.forEach(row => {
                        const match = row.extra_info.match(/StockID:(\d+)/);
                        if (match) loggedStockIds.add(parseInt(match[1], 10));
                    });
                }

                const toLog = expiredRows.filter(row => !loggedStockIds.has(row.stock_id));
                if (toLog.length === 0) {
                    if (callback) callback();
                    return;
                }

                db.run('BEGIN TRANSACTION');
                const stmtLog = db.prepare(`
                    INSERT INTO Transactions_Log (action_type, product_id, quantity, actor_name, action_date, extra_info) 
                    VALUES ('EXPIRED', ?, ?, 'System/Auto', ?, ?)
                `);

                const timestamp = getBangkokTimestamp();
                toLog.forEach(batch => {
                    const extraInfo = `${batch.product_name} | หมดอายุ: ${batch.expiry_date} | StockID:${batch.stock_id}`;
                    stmtLog.run([batch.product_id, batch.quantity, timestamp, extraInfo]);
                });

                stmtLog.finalize();
                db.run('COMMIT', () => {
                    if (callback) callback();
                });
            });
        });
    });
}

module.exports = { getBangkokTimestamp, calculateDaysBetween, autoLogExpiredProducts };
