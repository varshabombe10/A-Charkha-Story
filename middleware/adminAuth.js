/**
 * Admin Authentication Middleware
 * Checks for valid session with admin role
 */
function requireAdmin(db) {
  return function(req, res, next) {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.session.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.adminUser = user;
    next();
  };
}

module.exports = { requireAdmin };
