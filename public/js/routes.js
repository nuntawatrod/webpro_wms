// public/js/routes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('./db');
const { requireAuth, hasPermission, requireAdmin, requireManager } = require('./auth_middleware');
const { UserService, ProductService, InventoryService, HistoryService } = require('./services');

// ==========================================
// 1. Authentication Routes
// ==========================================

// Login Page
router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('login', { error: null });
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM Users WHERE username = ?', [username], (err, user) => {
        if (err || !user) {
            return res.render('login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (Invalid credentials)' });
        }

        if (bcrypt.compareSync(password, user.password)) {
            req.session.user = { id: user.id, username: user.username, role: user.role };
            res.redirect('/');
        } else {
            res.render('login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (Invalid credentials)' });
        }
    });
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ==========================================
// 2. Page Rendering Routes
// ==========================================

// Dashboard Main (Index)
router.get('/', requireAuth, (req, res) => {
    res.render('index', { activePage: 'dashboard' });
});

router.get('/withdraw', requireAuth, (req, res) => {
    res.render('withdraw', { activePage: 'withdraw' });
});

router.get('/add-stock', requireAuth, (req, res) => {
    res.render('add_stock', { activePage: 'add' });
});

router.get('/history-view', requireAuth, (req, res) => {
    res.render('history', { activePage: 'history' });
});

// Admin Views
router.get('/admin', hasPermission('view_dashboard'), (req, res) => {
    res.render('admin_dashboard');
});

router.get('/manage-products', hasPermission('manage_products'), (req, res) => {
    let tab = req.query.tab || 'add';
    if (!['add', 'edit', 'delete'].includes(tab)) tab = 'add';
    res.render('manage_products', {
        activePage: `manage_products_${tab}`,
        user: req.session.user
    });
});

router.get('/manage-users', requireAdmin, (req, res) => {
    res.render('manage_users', { activePage: 'manage_users', user: req.session.user });
});

router.get('/admin/users', requireAdmin, (req, res) => {
    res.render('admin_users', { activePage: 'admin_users', user: req.session.user });
});

router.get('/admin/permissions', requireAdmin, (req, res) => {
    res.render('admin_permissions', { activePage: 'admin_permissions', user: req.session.user });
});

// ==========================================
// 3. Inventory & Stock API Routes (/api)
// ==========================================

router.get('/api/inventory', requireAuth, async (req, res) => {
    try {
        const isStaff = req.session.user.role === 'staff';
        const todayStr = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).split(' ')[0];
        const inventory = await InventoryService.getInventory(isStaff, todayStr);
        res.json(inventory);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch inventory" });
    }
});

router.get('/api/stats', hasPermission('view_dashboard'), async (req, res) => {
    try {
        const stats = await InventoryService.getDashboardStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

router.get('/api/products/names', requireAuth, async (req, res) => {
    try {
        const products = await ProductService.getProductNamesAndShelfLife();
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch product names" });
    }
});

router.get('/api/products/available', requireAuth, async (req, res) => {
    try {
        const products = await ProductService.getAvailableProducts();
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch available products" });
    }
});

router.post('/api/stock/add', requireAuth, async (req, res) => {
    try {
        const { product_id, receive_date, quantity } = req.body;
        const result = await InventoryService.addStock(product_id, receive_date, quantity, req.session.user.username);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/stock/withdraw', requireAuth, async (req, res) => {
    try {
        const { product_id, quantity } = req.body;
        const result = await InventoryService.withdrawStock(product_id, quantity, req.session.user.username);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/stock/delete-expired', requireManager, async (req, res) => {
    try {
        const { expired_batches } = req.body;
        const result = await InventoryService.deleteExpiredStock(expired_batches);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/history', requireAuth, async (req, res) => {
    try {
        const { page = 1, limit = 40, search = '', actionDateType = 'all', actionType = 'all' } = req.query;
        const history = await HistoryService.getHistory({ page, limit, search, actionDateType, actionType });
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

// ==========================================
// 4. Admin API Routes (/api/admin)
// ==========================================

router.get('/api/admin/permissions', requireAdmin, async (req, res) => {
    try {
        const perms = await UserService.getPermissions();
        res.json(perms);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch permissions" });
    }
});

router.post('/api/admin/permissions', requireAdmin, async (req, res) => {
    try {
        const result = await UserService.updatePermissions(req.body.permissions);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await UserService.getAllUsers();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

router.post('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const result = await UserService.createUser(req.body);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        const result = await UserService.deleteUser(req.params.id, req.session.user.id);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.patch('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
    try {
        const result = await UserService.updateUserRole(req.params.id, req.body.role);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/api/admin/products', hasPermission('manage_products'), async (req, res) => {
    try {
        const products = await ProductService.getAllProducts();
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch products" });
    }
});

router.post('/api/admin/products', hasPermission('manage_products'), async (req, res) => {
    try {
        const result = await ProductService.createProduct(req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/admin/products/:id', hasPermission('manage_products'), async (req, res) => {
    try {
        const result = await ProductService.updateProduct(req.params.id, req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/admin/products/:id', hasPermission('manage_products'), async (req, res) => {
    try {
        const result = await ProductService.deleteProduct(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/admin/products/import-csv', requireAdmin, async (req, res) => {
    try {
        const result = await ProductService.bulkImport();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/admin/logs', requireAdmin, async (req, res) => {
    try {
        const logs = await HistoryService.getSystemLogs();
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch logs" });
    }
});

module.exports = router;
