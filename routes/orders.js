const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

module.exports = function(db) {

  router.use(requireAuth);

  // POST /api/orders/validate-coupon
  router.post('/validate-coupon', (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: 'Coupon code is required' });

      const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? COLLATE NOCASE').get(code);

      if (!coupon) {
        return res.status(404).json({ error: 'Invalid coupon code' });
      }
      if (!coupon.active) {
        return res.status(400).json({ error: 'This coupon is no longer active' });
      }
      if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
        return res.status(400).json({ error: 'This coupon has reached its usage limit' });
      }
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        return res.status(400).json({ error: 'This coupon has expired' });
      }

      res.json({
        code: coupon.code,
        discount_percent: coupon.discount_percent
      });
    } catch (err) {
      console.error('Coupon validation error:', err);
      res.status(500).json({ error: 'Failed to validate coupon' });
    }
  });

  // POST /api/orders — Place order from cart
  router.post('/', (req, res) => {
    try {
      const { address, city, state, pincode, coupon_code } = req.body;

      // Validate address fields
      if (!address || !city || !state || !pincode) {
        return res.status(400).json({ error: 'Complete delivery address is required' });
      }

      // Get cart items
      const cartItems = db.prepare(`
        SELECT c.*, p.price, p.stock, p.name
        FROM cart c
        JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?
      `).all(req.session.userId);

      if (cartItems.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
      }

      // Validate all items have sufficient stock
      for (const item of cartItems) {
        if (item.quantity > item.stock) {
          return res.status(400).json({
            error: `Insufficient stock for "${item.name}". Only ${item.stock} available.`
          });
        }
      }

      // Calculate total
      let totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      let discountAmount = 0;
      let appliedCoupon = null;

      // Place order atomically
      const placeOrder = db.transaction(() => {
        // Apply coupon if provided
        if (coupon_code) {
          appliedCoupon = db.prepare('SELECT * FROM coupons WHERE code = ? COLLATE NOCASE').get(coupon_code);
          if (appliedCoupon && appliedCoupon.active && 
              (!appliedCoupon.max_uses || appliedCoupon.used_count < appliedCoupon.max_uses) && 
              (!appliedCoupon.expires_at || new Date(appliedCoupon.expires_at) >= new Date())) {
            
            discountAmount = Math.round((totalAmount * appliedCoupon.discount_percent / 100) * 100) / 100;
            totalAmount = totalAmount - discountAmount;

            // Increment usage
            db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(appliedCoupon.id);
          } else {
            throw new Error('Invalid or expired coupon code');
          }
        }

        // Create order
        const orderResult = db.prepare(`
          INSERT INTO orders (user_id, total_amount, status, address, city, state, pincode, coupon_code, discount_amount)
          VALUES (?, ?, 'Pending', ?, ?, ?, ?, ?, ?)
        `).run(req.session.userId, Math.round(totalAmount * 100) / 100, address, city, state, pincode, appliedCoupon ? appliedCoupon.code : null, discountAmount);

        const orderId = orderResult.lastInsertRowid;

        // Create order items and update stock
        const insertItem = db.prepare(`
          INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
          VALUES (?, ?, ?, ?)
        `);
        const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

        for (const item of cartItems) {
          insertItem.run(orderId, item.product_id, item.quantity, item.price);
          updateStock.run(item.quantity, item.product_id);
        }

        // Clear cart
        db.prepare('DELETE FROM cart WHERE user_id = ?').run(req.session.userId);

        return orderId;
      });

      const orderId = placeOrder();

      // Fetch complete order
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      const items = db.prepare(`
        SELECT oi.*, p.name, p.image, p.category, p.fabric_type
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `).all(orderId);

      res.status(201).json({
        message: 'Order placed successfully!',
        order: { ...order, items }
      });
    } catch (err) {
      console.error('Order placement error:', err);
      res.status(500).json({ error: 'Failed to place order' });
    }
  });

  // GET /api/orders — Get user's orders
  router.get('/', (req, res) => {
    try {
      const orders = db.prepare(`
        SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC
      `).all(req.session.userId);

      // Attach items to each order
      const getItems = db.prepare(`
        SELECT oi.*, p.name, p.image, p.category, p.fabric_type
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `);

      const ordersWithItems = orders.map(order => ({
        ...order,
        items: getItems.all(order.id)
      }));

      res.json(ordersWithItems);
    } catch (err) {
      console.error('Orders fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  // GET /api/orders/:id — Get single order detail
  router.get('/:id', (req, res) => {
    try {
      const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
        .get(req.params.id, req.session.userId);

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

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

  return router;
};
