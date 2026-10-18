const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'store.db');

async function initializeDatabase() {
  const SQL = await initSqlJs();

  let db;
  // Load existing DB if present
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      role TEXT DEFAULT 'customer',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add role and active columns if missing (migration for existing DBs)
  try { db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'customer'`); } catch(e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1`); } catch(e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_percent REAL NOT NULL,
      max_uses INTEGER DEFAULT 0,
      used_count INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      reference_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      fabric_type TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      image TEXT,
      stock INTEGER DEFAULT 0,
      featured INTEGER DEFAULT 0,
      gift_worthy INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE(user_id, product_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'Pending',
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price_at_purchase REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  // Indexes
  try { db.run('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)'); } catch(e) {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_products_fabric ON products(fabric_type)'); } catch(e) {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured)'); } catch(e) {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_cart_user ON cart(user_id)'); } catch(e) {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)'); } catch(e) {}

  // Order schema migrations
  try { db.run('ALTER TABLE orders ADD COLUMN coupon_code TEXT'); } catch(e) {}
  try { db.run('ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0'); } catch(e) {}

  // Seed data only if products table is empty
  const result = db.exec('SELECT COUNT(*) as cnt FROM products');
  const count = result[0]?.values[0][0] || 0;

  if (count === 0) {
    seedProducts(db);
    seedDemoUser(db);
    saveDb(db);
  }

  // Seed admin user if not exists
  seedAdminUser(db);
  saveDb(db);

  return db;
}

function saveDb(db) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Helper to wrap sql.js for Express routes (mimics better-sqlite3 API)
function createDbHelper(db) {
  const helper = {
    _db: db,
    _inTransaction: false,

    prepare(sql) {
      const self = this;
      return {
        get(...params) {
          const stmt = self._db.prepare(sql);
          stmt.bind(params);
          let row = null;
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            row = {};
            cols.forEach((c, i) => row[c] = vals[i]);
          }
          stmt.free();
          return row;
        },
        all(...params) {
          const result = self._db.exec(sql, params);
          if (!result.length) return [];
          const cols = result[0].columns;
          return result[0].values.map(vals => {
            const row = {};
            cols.forEach((c, i) => row[c] = vals[i]);
            return row;
          });
        },
        run(...params) {
          self._db.run(sql, params);
          const lastId = self._db.exec('SELECT last_insert_rowid()')[0]?.values[0][0];
          const changes = self._db.getRowsModified();
          if (!self._inTransaction) {
            saveDb(self._db);
          }
          return { lastInsertRowid: lastId, changes };
        }
      };
    },

    exec(sql) {
      this._db.run(sql);
      if (!this._inTransaction) {
        saveDb(this._db);
      }
    },

    transaction(fn) {
      const self = this;
      return function(...args) {
        self._inTransaction = true;
        self._db.run('BEGIN TRANSACTION');
        try {
          const result = fn(...args);
          self._db.run('COMMIT');
          self._inTransaction = false;
          saveDb(self._db);
          return result;
        } catch(e) {
          try { self._db.run('ROLLBACK'); } catch(re) { /* ignore */ }
          self._inTransaction = false;
          throw e;
        }
      };
    },

    close() {
      this._db.close();
    }
  };

  return helper;
}

function seedDemoUser(db) {
  const hash = bcrypt.hashSync('demo1234', 10);
  db.run(
    `INSERT INTO users (name, email, phone, password_hash, address, city, state, pincode, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Demo User', 'demo@charkha.in', '9876543210', hash, '42 Handloom Lane', 'Jaipur', 'Rajasthan', '302001', 'customer']
  );
}

function seedAdminUser(db) {
  // Only seed if admin doesn't already exist
  const existing = db.exec("SELECT COUNT(*) FROM users WHERE email = 'admin@charkha.in'");
  const adminExists = existing[0]?.values[0][0] || 0;
  if (adminExists > 0) return;

  const hash = bcrypt.hashSync('admin1234', 10);
  db.run(
    `INSERT INTO users (name, email, phone, password_hash, address, city, state, pincode, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Admin', 'admin@charkha.in', '9999999999', hash, 'HQ, Handloom Bhawan', 'New Delhi', 'Delhi', '110001', 'admin']
  );
  console.log('✅ Seeded admin user (admin@charkha.in / admin1234)');
}

function logActivity(db, type, message, referenceId = null) {
  try {
    if (db.prepare) {
      db.prepare(`INSERT INTO activity_log (type, message, reference_id) VALUES (?, ?, ?)`).run(type, message, referenceId);
    } else {
      db.run(`INSERT INTO activity_log (type, message, reference_id) VALUES (?, ?, ?)`, [type, message, referenceId]);
      saveDb(db);
    }
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

function seedProducts(db) {
  const products = [
    // SAREES
    ['Varanasi Silk Banarasi Saree','Sarees','Silk',12999,'An exquisite Banarasi silk saree handwoven by master artisans in Varanasi. Features intricate gold zari work with traditional motifs inspired by Mughal architecture.','/images/products/silk-saree.jpg',8,1,1],
    ['Handspun Khadi Cotton Saree','Sarees','Khadi',3499,'A beautiful handspun khadi saree crafted on traditional charkha. The natural off-white cotton with indigo block-printed borders celebrates India\'s freedom movement heritage.','/images/products/khadi-saree.jpg',15,1,1],
    ['Chanderi Silk-Cotton Saree','Sarees','Chanderi',5999,'A gossamer-light Chanderi saree blending silk and cotton in perfect harmony. Handwoven in Madhya Pradesh.','/images/products/chanderi-saree.jpg',10,0,1],
    ['Bengal Cotton Tant Saree','Sarees','Cotton',2499,'Classic Bengali tant saree in pure cotton with jamdani-inspired motifs reflecting centuries of Bengal\'s textile tradition.','/images/products/cotton-saree.jpg',20,0,0],
    ['Tussar Silk Kantha Saree','Sarees','Silk',8999,'A stunning tussar silk saree adorned with hand-embroidered kantha work from rural Bengal.','/images/products/tussar-saree.jpg',6,1,1],
    ['Maheshwari Handloom Saree','Sarees','Cotton',4299,'A regal Maheshwari saree handwoven in the tradition of the Holkar dynasty with signature reversible borders.','/images/products/maheshwari-saree.jpg',12,0,1],
    ['Paithani Silk Bridal Saree','Sarees','Silk',15999,'A magnificent Paithani silk saree handwoven in Yeola, Maharashtra. Takes artisans up to 6 months to complete.','/images/products/paithani-saree.jpg',3,1,1],
    ['Kalamkari Cotton Saree','Sarees','Cotton',3799,'A hand-painted Kalamkari saree from Machilipatnam, Andhra Pradesh with intricate mythological scenes.','/images/products/kalamkari-saree.jpg',7,0,1],
    // KURTIS
    ['Khadi Block Print Anarkali Kurti','Kurtis','Khadi',1899,'A flowing Anarkali-style kurti in handspun khadi with traditional Rajasthani block prints using natural vegetable dyes.','/images/products/khadi-kurti.jpg',25,1,0],
    ['Cotton Chikankari Lucknowi Kurti','Kurtis','Cotton',2299,'Delicate hand-embroidered chikankari kurti from the artisans of Lucknow. White-on-white shadow work on fine cotton muslin.','/images/products/chikankari-kurti.jpg',18,1,1],
    ['Silk Brocade Festive Kurti','Kurtis','Silk',3999,'A resplendent silk brocade kurti with Banarasi-inspired metallic weave for festive occasions.','/images/products/silk-kurti.jpg',14,0,1],
    ['Ikat Print Cotton Straight Kurti','Kurtis','Cotton',1499,'A contemporary straight-cut kurti featuring traditional Pochampally ikat patterns.','/images/products/ikat-kurti.jpg',30,0,0],
    ['Ajrakh Hand-Block Kurti','Kurtis','Cotton',1799,'An authentic Ajrakh block-printed kurti from the Kutch region with patterns dating back 4,000 years.','/images/products/ajrakh-kurti.jpg',22,0,0],
    ['Linen A-Line Summer Kurti','Kurtis','Linen',2099,'A breezy A-line kurti in premium handwoven linen with delicate embroidery at the neckline.','/images/products/linen-kurti.jpg',16,0,0],
    ['Jamdani Muslin Kurti','Kurtis','Cotton',2799,'A luxurious kurti in Dhakai jamdani muslin — once called "woven air" by the Mughals.','/images/products/jamdani-kurti.jpg',10,0,1],
    // SHIRTS
    ['Khadi Mandarin Collar Shirt','Shirts','Khadi',1599,'A refined mandarin-collar shirt in handspun khadi cotton. Perfect for the conscious gentleman.','/images/products/khadi-shirt.jpg',20,1,1],
    ['Linen Kurta Shirt','Shirts','Linen',2199,'A versatile linen kurta-style shirt that transitions seamlessly from office to evening.','/images/products/linen-shirt.jpg',18,0,1],
    ['Cotton Kalamkari Print Shirt','Shirts','Cotton',1399,'A vibrant Kalamkari pen-painted cotton shirt featuring mythological motifs.','/images/products/kalamkari-shirt.jpg',15,0,0],
    ['Silk Blend Nehru Jacket','Shirts','Silk',4499,'A distinguished silk-blend Nehru jacket with subtle brocade patterns for weddings and receptions.','/images/products/nehru-jacket.jpg',10,1,1],
    // DUPATTAS
    ['Chanderi Zari Dupatta','Dupattas','Chanderi',1299,'A luminous Chanderi dupatta with fine zari stripes and tissue borders.','/images/products/chanderi-dupatta.jpg',25,0,1],
    ['Khadi Handblock Print Dupatta','Dupattas','Khadi',899,'An earthy khadi dupatta with hand-block printed geometric patterns using natural dyes.','/images/products/khadi-dupatta.jpg',30,0,0],
    ['Banarasi Silk Dupatta','Dupattas','Silk',3499,'A luxurious Banarasi silk dupatta with intricate gold and silver zari jaal work.','/images/products/silk-dupatta.jpg',12,1,1],
    ['Cotton Bandhani Dupatta','Dupattas','Cotton',799,'A vibrant bandhani tie-dye dupatta handcrafted in Jamnagar, Gujarat.','/images/products/bandhani-dupatta.jpg',28,0,0],
    ['Khadi Pashmina Shawl','Dupattas','Khadi',5999,'An ultra-soft khadi-pashmina blend shawl handwoven in Kashmir with sozni embroidery.','/images/products/pashmina-shawl.jpg',8,1,1],
    ['Hand-Woven Patola Dupatta','Dupattas','Silk',4999,'A double-ikat Patola dupatta handwoven by the Salvi family artisans of Patan, Gujarat.','/images/products/patola-dupatta.jpg',5,1,1],
    // FABRICS
    ['Premium Khadi Fabric — Natural White (per meter)','Fabrics','Khadi',599,'Premium handspun, handwoven khadi fabric in natural undyed white.','/images/products/khadi-fabric.jpg',50,0,0],
    ['Pure Silk Fabric — Mulberry (per meter)','Fabrics','Silk',1499,'Lustrous mulberry silk fabric in a rich jewel-tone palette from Kanchipuram.','/images/products/silk-fabric.jpg',35,0,0],
    ['Handloom Cotton Fabric — Organic (per meter)','Fabrics','Cotton',399,'Organic handloom cotton fabric woven by rural artisan cooperatives.','/images/products/cotton-fabric.jpg',60,0,0],
    ['Chanderi Tissue Fabric (per meter)','Fabrics','Chanderi',899,'Gossamer Chanderi tissue fabric with a subtle shimmer.','/images/products/chanderi-fabric.jpg',40,0,0],
    ['Belgian Linen Fabric — Premium (per meter)','Fabrics','Linen',799,'Premium Belgian linen fabric with a refined, cool-to-touch hand feel.','/images/products/linen-fabric.jpg',45,0,0],
  ];

  const sql = `INSERT INTO products (name, category, fabric_type, price, description, image, stock, featured, gift_worthy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  products.forEach(p => db.run(sql, p));
  console.log(`✅ Seeded ${products.length} products`);
}

module.exports = { initializeDatabase, createDbHelper, saveDb, DB_PATH, logActivity };
