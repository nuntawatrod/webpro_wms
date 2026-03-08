// public/js/pages_routes.js
const express = require('express');
const router = express.Router();
const { requireAuth, hasPermission, requireAdmin } = require('./auth_middleware');

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

router.get('/history', requireAuth, (req, res) => {
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

module.exports = router;
