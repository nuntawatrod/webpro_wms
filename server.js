const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

// Import modular components
const db = require('./public/js/db');
const authRoutes = require('./public/js/auth_routes');
const pageRoutes = require('./public/js/pages_routes');
const adminApi = require('./public/js/admin_api');
const inventoryApi = require('./public/js/inventory_api');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware Setup ---
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

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

// --- Routes ---
app.use('/', authRoutes);
app.use('/', pageRoutes);
app.use('/api', inventoryApi);
app.use('/api/admin', adminApi);

// Handle errors
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (res.headersSent) return next(err);
    res.status(500).render('error', { message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์', user: (req.session && req.session.user) ? req.session.user : null });
});

// Start listening
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
