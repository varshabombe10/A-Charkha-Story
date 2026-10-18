const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

module.exports = function(db) {

  // POST /api/auth/register
  router.post('/register', (req, res) => {
    try {
      const { name, email, phone, password } = req.body;

      // Validation
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check if user exists
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      // Hash password and create user
      const passwordHash = bcrypt.hashSync(password, 10);
      const result = db.prepare(`
        INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)
      `).run(name, email, phone || null, passwordHash);

      // Auto-login after registration
      req.session.userId = result.lastInsertRowid;

      const user = db.prepare('SELECT id, name, email, phone, address, city, state, pincode FROM users WHERE id = ?')
        .get(result.lastInsertRowid);

      res.status(201).json({ message: 'Account created successfully', user });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // POST /api/auth/login
  router.post('/login', (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (!bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Set session
      req.session.userId = user.id;

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: user.address,
          city: user.city,
          state: user.state,
          pincode: user.pincode
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // POST /api/auth/logout
  router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });

  // GET /api/auth/me — Get current user
  router.get('/me', (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.json({ user: null });
    }

    const user = db.prepare('SELECT id, name, email, phone, address, city, state, pincode FROM users WHERE id = ?')
      .get(req.session.userId);

    if (!user) {
      return res.json({ user: null });
    }

    res.json({ user });
  });

  // PUT /api/auth/profile — Update profile
  router.put('/profile', (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Please log in' });
    }

    try {
      const { name, phone, address, city, state, pincode } = req.body;

      db.prepare(`
        UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone),
        address = COALESCE(?, address), city = COALESCE(?, city),
        state = COALESCE(?, state), pincode = COALESCE(?, pincode)
        WHERE id = ?
      `).run(name, phone, address, city, state, pincode, req.session.userId);

      const user = db.prepare('SELECT id, name, email, phone, address, city, state, pincode FROM users WHERE id = ?')
        .get(req.session.userId);

      res.json({ message: 'Profile updated', user });
    } catch (err) {
      console.error('Profile update error:', err);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  return router;
};
