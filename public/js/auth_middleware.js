// public/js/auth_middleware.js
const db = require('./db');

const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        if (req.path.startsWith('/api')) {
            return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ (Unauthorized)' });
        }
        res.redirect('/login');
    }
};

const hasPermission = (permissionKey) => {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.status(401).redirect('/login');
        }
        const role = req.session.user.role;
        db.get("SELECT 1 FROM Role_Permissions WHERE role = ? AND permission_key = ?", [role, permissionKey], (err, row) => {
            if (row) {
                next();
            } else {
                if (req.path.startsWith('/api')) {
                    return res.status(403).json({ error: `ไม่มีสิทธิ์เข้าถึง (Required: ${permissionKey})` });
                }
                res.status(403).render('error', { message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้', user: req.session.user });
            }
        });
    };
};

const requireAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        if (req.path.startsWith('/api')) return res.status(403).json({ error: 'Admin access required' });
        res.status(403).send('Forbidden: Admin access only');
    }
};

const requireManager = (req, res, next) => {
    if (req.session.user && (req.session.user.role === 'manager' || req.session.user.role === 'admin')) {
        next();
    } else {
        if (req.path.startsWith('/api')) return res.status(403).json({ error: 'Manager access required' });
        res.status(403).send('Forbidden: Manager access required');
    }
};

module.exports = { requireAuth, hasPermission, requireAdmin, requireManager };
