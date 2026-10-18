const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/adminAuth');
const { logActivity } = require('../database/init');

module.exports = function(db) {

  // All admin routes require admin auth
  router.use(requireAdmin(db));

  // ═══════════════════════════════════════════
  //  DASHBOARD STATS
  // ═══════════════════════════════════════════

  router.get('/stats', (req, res) => {
    try {
      const totalRevenue = db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders').get();
      const totalOrders = db.prepare('SELECT COUNT(*) as total FROM orders').get();
      const totalUsers = db.prepare("SELECT COUNT(*) as total FROM users WHERE role = 'customer'").get();
      const totalProducts = db.prepare('SELECT COUNT(*) as total FROM products').get();
      const pendingOrders = db.prepare("SELECT COUNT(*) as total FROM orders WHERE status = 'Pending'").get();
      const lowStockCount = db.prepare('SELECT COUNT(*) as total FROM products WHERE stock <= 5').get();

      res.json({
        totalRevenue: totalRevenue.total,
        totalOrders: totalOrders.total,
        totalUsers: totalUsers.total,
        totalProducts: totalProducts.total,
        pendingOrders: pendingOrders.total,
        lowStockCount: lowStockCount.total
      });
    } catch (err) {
      console.error('Stats error:', err);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // ═══════════════════════════════════════════
  //  SALES CHART — Last 30 days
  // ═══════════════════════════════════════════

  router.get('/sales-chart', (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT DATE(created_at) as date, SUM(total_amount) as revenue, COUNT(*) as orders
        FROM orders
        WHERE created_at >= DATE('now', '-30 days')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `).all();
      res.json(rows);
    } catch (err) {
      console.error('Sales chart error:', err);
      res.status(500).json({ error: 'Failed to fetch sales data' });
    }
  });

  // ═══════════════════════════════════════════
  //  CATEGORY CHART
  // ═══════════════════════════════════════════

  router.get('/category-chart', (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT p.category, COUNT(DISTINCT oi.order_id) as order_count, SUM(oi.quantity) as items_sold
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        GROUP BY p.category
        ORDER BY items_sold DESC
      `).all();
      res.json(rows);
    } catch (err) {
      console.error('Category chart error:', err);
      res.status(500).json({ error: 'Failed to fetch category data' });
    }
  });

  // ═══════════════════════════════════════════
  //  ACTIVITY LOG
  // ═══════════════════════════════════════════

  router.get('/activity', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const rows = db.prepare(`
        SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?
      `).all(limit);
      res.json(rows);
    } catch (err) {
      console.error('Activity error:', err);
      res.status(500).json({ error: 'Failed to fetch activity' });
    }
  });

  // ═══════════════════════════════════════════
  //  USER MANAGEMENT
  // ═══════════════════════════════════════════

  router.get('/users', (req, res) => {
    try {
      let query = `
        SELECT u.id, u.name, u.email, u.phone, u.role, u.active, u.created_at,
               COUNT(o.id) as total_orders,
               COALESCE(SUM(o.total_amount), 0) as total_spent
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        WHERE u.role = 'customer'
      `;
      const params = [];

      if (req.query.search) {
        query += ` AND (u.name LIKE ? OR u.email LIKE ?)`;
        const term = `%${req.query.search}%`;
        params.push(term, term);
      }

      query += ` GROUP BY u.id ORDER BY u.created_at DESC`;

      const users = db.prepare(query).all(...params);
      res.json(users);
    } catch (err) {
      console.error('Users list error:', err);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  router.get('/users/:id', (req, res) => {
    try {
      const user = db.prepare(`
        SELECT id, name, email, phone, address, city, state, pincode, role, active, created_at
        FROM users WHERE id = ?
      `).get(req.params.id);

      if (!user) return res.status(404).json({ error: 'User not found' });

      const orders = db.prepare(`
        SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC
      `).all(req.params.id);

      res.json({ ...user, orders });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  router.put('/users/:id/status', (req, res) => {
    try {
      const { active } = req.body;
      db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, req.params.id);
      const user = db.prepare('SELECT id, name, email, active FROM users WHERE id = ?').get(req.params.id);
      logActivity(db, 'user', `User "${user.name}" ${active ? 'activated' : 'deactivated'}`, user.id);
      res.json({ message: `User ${active ? 'activated' : 'deactivated'}`, user });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update user status' });
    }
  });

  // ═══════════════════════════════════════════
  //  ORDER MANAGEMENT
  // ═══════════════════════════════════════════

  router.get('/orders', (req, res) => {
    try {
      let query = `
        SELECT o.*, u.name as user_name, u.email as user_email
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE 1=1
      `;
      const params = [];

      if (req.query.status) {
        query += ` AND o.status = ?`;
        params.push(req.query.status);
      }

      if (req.query.from) {
        query += ` AND DATE(o.created_at) >= ?`;
        params.push(req.query.from);
      }

      if (req.query.to) {
        query += ` AND DATE(o.created_at) <= ?`;
        params.push(req.query.to);
      }

      if (req.query.search) {
        query += ` AND (u.name LIKE ? OR u.email LIKE ? OR CAST(o.id AS TEXT) LIKE ?)`;
        const term = `%${req.query.search}%`;
        params.push(term, term, term);
      }

      query += ` ORDER BY o.created_at DESC`;

      const orders = db.prepare(query).all(...params);
      res.json(orders);
    } catch (err) {
      console.error('Orders list error:', err);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  router.get('/orders/:id', (req, res) => {
    try {
      const order = db.prepare(`
        SELECT o.*, u.name as user_name, u.email as user_email, u.phone as user_phone,
               u.address as user_address, u.city as user_city, u.state as user_state, u.pincode as user_pincode
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.id = ?
      `).get(req.params.id);

      if (!order) return res.status(404).json({ error: 'Order not found' });

      const items = db.prepare(`
        SELECT oi.*, p.name, p.image, p.category, p.fabric_type
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `).all(order.id);

      res.json({ ...order, items });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch order' });
    }
  });

  router.put('/orders/:id/status', (req, res) => {
    try {
      const { status } = req.body;
      const valid = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
      if (!valid.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${valid.join(', ')}` });
      }

      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
      logActivity(db, 'order', `Order #${req.params.id} status changed to "${status}"`, parseInt(req.params.id));

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      res.json({ message: 'Status updated', order });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  // ═══════════════════════════════════════════
  //  PRODUCT MANAGEMENT
  // ═══════════════════════════════════════════

  router.get('/products', (req, res) => {
    try {
      let query = 'SELECT * FROM products WHERE 1=1';
      const params = [];

      if (req.query.search) {
        query += ` AND (name LIKE ? OR category LIKE ? OR fabric_type LIKE ?)`;
        const term = `%${req.query.search}%`;
        params.push(term, term, term);
      }

      if (req.query.category) {
        query += ` AND category = ?`;
        params.push(req.query.category);
      }

      query += ` ORDER BY created_at DESC`;

      const products = db.prepare(query).all(...params);
      res.json(products);
    } catch (err) {
      console.error('Products list error:', err);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  router.get('/products/low-stock', (req, res) => {
    try {
      const products = db.prepare('SELECT * FROM products WHERE stock <= 5 ORDER BY stock ASC').all();
      res.json(products);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch low stock products' });
    }
  });

  router.post('/products', (req, res) => {
    try {
      const { name, category, fabric_type, price, description, image, stock, featured, gift_worthy } = req.body;

      if (!name || !category || !fabric_type || !price) {
        return res.status(400).json({ error: 'Name, category, fabric type, and price are required' });
      }

      const result = db.prepare(`
        INSERT INTO products (name, category, fabric_type, price, description, image, stock, featured, gift_worthy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, category, fabric_type, parseFloat(price), description || '', image || '', parseInt(stock) || 0, featured ? 1 : 0, gift_worthy ? 1 : 0);

      logActivity(db, 'product', `New product added: "${name}"`, result.lastInsertRowid);

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json({ message: 'Product created', product });
    } catch (err) {
      console.error('Product create error:', err);
      res.status(500).json({ error: 'Failed to create product' });
    }
  });

  router.put('/products/:id', (req, res) => {
    try {
      const { name, category, fabric_type, price, description, image, stock, featured, gift_worthy } = req.body;

      db.prepare(`
        UPDATE products SET
          name = COALESCE(?, name),
          category = COALESCE(?, category),
          fabric_type = COALESCE(?, fabric_type),
          price = COALESCE(?, price),
          description = COALESCE(?, description),
          image = COALESCE(?, image),
          stock = COALESCE(?, stock),
          featured = COALESCE(?, featured),
          gift_worthy = COALESCE(?, gift_worthy)
        WHERE id = ?
      `).run(name, category, fabric_type, price ? parseFloat(price) : null, description, image, stock != null ? parseInt(stock) : null, featured != null ? (featured ? 1 : 0) : null, gift_worthy != null ? (gift_worthy ? 1 : 0) : null, req.params.id);

      logActivity(db, 'product', `Product #${req.params.id} updated`, parseInt(req.params.id));

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
      res.json({ message: 'Product updated', product });
    } catch (err) {
      console.error('Product update error:', err);
      res.status(500).json({ error: 'Failed to update product' });
    }
  });

  router.delete('/products/:id', (req, res) => {
    try {
      const product = db.prepare('SELECT name FROM products WHERE id = ?').get(req.params.id);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
      logActivity(db, 'product', `Product deleted: "${product.name}"`, parseInt(req.params.id));

      res.json({ message: 'Product deleted' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  // ═══════════════════════════════════════════
  //  COUPONS
  // ═══════════════════════════════════════════

  router.get('/coupons', (req, res) => {
    try {
      const coupons = db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all();
      res.json(coupons);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch coupons' });
    }
  });

  router.post('/coupons', (req, res) => {
    try {
      const { code, discount_percent, max_uses, expires_at } = req.body;
      if (!code || !discount_percent) {
        return res.status(400).json({ error: 'Code and discount percentage are required' });
      }

      const result = db.prepare(`
        INSERT INTO coupons (code, discount_percent, max_uses, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(code.toUpperCase(), parseFloat(discount_percent), parseInt(max_uses) || 0, expires_at || null);

      logActivity(db, 'coupon', `Coupon "${code.toUpperCase()}" created (${discount_percent}% off)`);

      const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json({ message: 'Coupon created', coupon });
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Coupon code already exists' });
      }
      res.status(500).json({ error: 'Failed to create coupon' });
    }
  });

  router.put('/coupons/:id', (req, res) => {
    try {
      const { active } = req.body;
      db.prepare('UPDATE coupons SET active = ? WHERE id = ?').run(active ? 1 : 0, req.params.id);
      const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(req.params.id);
      res.json({ message: `Coupon ${active ? 'activated' : 'deactivated'}`, coupon });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update coupon' });
    }
  });

  router.delete('/coupons/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
      res.json({ message: 'Coupon deleted' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete coupon' });
    }
  });

  // ═══════════════════════════════════════════
  //  ANALYTICS
  // ═══════════════════════════════════════════

  router.get('/analytics/revenue', (req, res) => {
    try {
      const period = req.query.period || 'daily'; // daily, weekly, monthly
      let groupBy, dateFormat;

      switch (period) {
        case 'weekly':
          groupBy = "strftime('%Y-W%W', created_at)";
          break;
        case 'monthly':
          groupBy = "strftime('%Y-%m', created_at)";
          break;
        default:
          groupBy = "DATE(created_at)";
      }

      const rows = db.prepare(`
        SELECT ${groupBy} as period, SUM(total_amount) as revenue, COUNT(*) as orders
        FROM orders
        GROUP BY ${groupBy}
        ORDER BY period DESC
        LIMIT 30
      `).all();

      res.json(rows.reverse());
    } catch (err) {
      console.error('Revenue analytics error:', err);
      res.status(500).json({ error: 'Failed to fetch revenue analytics' });
    }
  });

  router.get('/analytics/top-products', (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT p.id, p.name, p.category, p.fabric_type, p.price,
               SUM(oi.quantity) as total_sold,
               SUM(oi.quantity * oi.price_at_purchase) as total_revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        GROUP BY p.id
        ORDER BY total_sold DESC
        LIMIT 10
      `).all();
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch top products' });
    }
  });

  router.get('/analytics/fabric-performance', (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT p.fabric_type,
               COUNT(DISTINCT oi.order_id) as order_count,
               SUM(oi.quantity) as items_sold,
               SUM(oi.quantity * oi.price_at_purchase) as revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        GROUP BY p.fabric_type
        ORDER BY revenue DESC
      `).all();
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch fabric performance' });
    }
  });

  router.get('/analytics/user-growth', (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as new_users
        FROM users
        WHERE role = 'customer'
        GROUP BY strftime('%Y-%m', created_at)
        ORDER BY month DESC
        LIMIT 12
      `).all();
      res.json(rows.reverse());
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch user growth' });
    }
  });

  // ═══════════════════════════════════════════
  //  EXPORT (CSV)
  // ═══════════════════════════════════════════

  router.get('/export/orders', (req, res) => {
    try {
      const orders = db.prepare(`
        SELECT o.id, u.name as customer, u.email, o.total_amount, o.status, o.address, o.city, o.state, o.pincode, o.created_at
        FROM orders o JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
      `).all();

      const header = 'Order ID,Customer,Email,Total Amount,Status,Address,City,State,Pincode,Date\n';
      const rows = orders.map(o =>
        `${o.id},"${o.customer}","${o.email}",${o.total_amount},"${o.status}","${o.address}","${o.city}","${o.state}","${o.pincode}","${o.created_at}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="orders_export.csv"');
      res.send(header + rows);
    } catch (err) {
      res.status(500).json({ error: 'Export failed' });
    }
  });

  router.get('/export/users', (req, res) => {
    try {
      const users = db.prepare(`
        SELECT id, name, email, phone, city, state, created_at FROM users WHERE role = 'customer' ORDER BY created_at DESC
      `).all();

      const header = 'ID,Name,Email,Phone,City,State,Joined\n';
      const rows = users.map(u =>
        `${u.id},"${u.name}","${u.email}","${u.phone || ''}","${u.city || ''}","${u.state || ''}","${u.created_at}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="users_export.csv"');
      res.send(header + rows);
    } catch (err) {
      res.status(500).json({ error: 'Export failed' });
    }
  });

  router.get('/export/products', (req, res) => {
    try {
      const products = db.prepare('SELECT * FROM products ORDER BY id').all();

      const header = 'ID,Name,Category,Fabric,Price,Stock,Featured,Gift Worthy\n';
      const rows = products.map(p =>
        `${p.id},"${p.name}","${p.category}","${p.fabric_type}",${p.price},${p.stock},${p.featured ? 'Yes' : 'No'},${p.gift_worthy ? 'Yes' : 'No'}`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="products_export.csv"');
      res.send(header + rows);
    } catch (err) {
      res.status(500).json({ error: 'Export failed' });
    }
  });

  // ═══════════════════════════════════════════
  //  ADMIN AUTH CHECK
  // ═══════════════════════════════════════════

  router.get('/me', (req, res) => {
    try {
      const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.session.userId);
      res.json({ user });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch admin user' });
    }
  });

  return router;
};
