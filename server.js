const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const { initializeDatabase, createDbHelper } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ IMPORTANT for Render (fixes sessions behind proxy)
app.set('trust proxy', 1);

// ──────────── Middleware ────────────
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Session config (production safe)
app.use(session({
  secret: 'charkha-story-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // ✅ HTTPS fix
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ──────────── Initialize & Start ────────────
async function start() {
  const rawDb = await initializeDatabase();
  const db = createDbHelper(rawDb);
  console.log('✅ Database initialized');

  // API Routes
  app.use('/api/products', require('./routes/products')(db));
  app.use('/api/cart', require('./routes/cart')(db));
  app.use('/api/orders', require('./routes/orders')(db));
  app.use('/api/auth', require('./routes/auth')(db));
  app.use('/api/admin', require('./routes/admin')(db));

  // Page Routes
  const pages = ['products', 'product-detail', 'cart', 'checkout', 'login', 'orders'];
  pages.forEach(page => {
    app.get(`/${page}`, (req, res) => {
      res.sendFile(path.join(__dirname, 'public', `${page}.html`));
    });
  });

  // Admin Page Routes
  const adminPages = ['index', 'users', 'orders', 'products', 'analytics', 'coupons', 'login'];
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
  });
  adminPages.forEach(page => {
    app.get(`/admin/${page}`, (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'admin', `${page}.html`));
    });
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // ✅ IMPORTANT: Bind to 0.0.0.0 for Render
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║     🧵  A Charkha Story                         ║
║     Premium Handcrafted Clothing Store           ║
║                                                  ║
║     Server running on port: ${PORT}              ║
║                                                  ║
║     Demo login:                                  ║
║     Email: demo@charkha.in                       ║
║     Password: demo1234                           ║
║                                                  ║
╚══════════════════════════════════════════════════╝
    `);
  });

  process.on('SIGINT', () => {
    db.close();
    console.log('\nDatabase closed. Goodbye!');
    process.exit(0);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
