/**
 * Authentication middleware
 * Checks for valid session with user ID
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Please log in to continue' });
  }
  next();
}

/**
 * Optional auth — attaches user info if logged in, but doesn't block
 */
function optionalAuth(req, res, next) {
  // Just passes through — session info is available if present
  next();
}

module.exports = { requireAuth, optionalAuth };
