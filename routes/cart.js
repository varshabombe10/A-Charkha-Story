const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

module.exports = function(db) {

  // All cart routes require authentication
  router.use(requireAuth);

  // GET /api/cart — Get user's cart with product details
  router.get('/', (req, res) => {
    try {
      const items = db.prepare(`
        SELECT c.id, c.quantity, c.product_id,
               p.name, p.price, p.image, p.stock, p.fabric_type, p.category
        FROM cart c
        JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
      `).all(req.session.userId);

      const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const count = items.reduce((sum, item) => sum + item.quantity, 0);

      res.json({ items, total: Math.round(total * 100) / 100, count });
    } catch (err) {
      console.error('Cart fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch cart' });
    }
  });

  // POST /api/cart — Add item to cart
  router.post('/', (req, res) => {
    try {
      const { product_id, quantity = 1 } = req.body;

      if (!product_id) {
        return res.status(400).json({ error: 'Product ID is required' });
      }

      // Check product exists and has stock
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      if (product.stock < quantity) {
        return res.status(400).json({ error: 'Insufficient stock' });
      }

      // Check if product already in cart — if so, update quantity
      const existing = db.prepare('SELECT * FROM cart WHERE user_id = ? AND product_id = ?')
        .get(req.session.userId, product_id);

      if (existing) {
        const newQty = existing.quantity + quantity;
        if (newQty > product.stock) {
          return res.status(400).json({ error: `Only ${product.stock} available` });
        }
        db.prepare('UPDATE cart SET quantity = ? WHERE id = ?').run(newQty, existing.id);
      } else {
        db.prepare('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)')
          .run(req.session.userId, product_id, quantity);
      }

      // Return updated cart
      const items = db.prepare(`
        SELECT c.id, c.quantity, c.product_id,
               p.name, p.price, p.image, p.stock, p.fabric_type, p.category
        FROM cart c JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?
      `).all(req.session.userId);
      const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const count = items.reduce((sum, item) => sum + item.quantity, 0);

      res.json({ message: 'Added to cart', items, total: Math.round(total * 100) / 100, count });
    } catch (err) {
      console.error('Cart add error:', err);
      res.status(500).json({ error: 'Failed to add to cart' });
    }
  });

  // PUT /api/cart/:id — Update cart item quantity
  router.put('/:id', (req, res) => {
    try {
      const { quantity } = req.body;
      const cartItem = db.prepare('SELECT c.*, p.stock FROM cart c JOIN products p ON c.product_id = p.id WHERE c.id = ? AND c.user_id = ?')
        .get(req.params.id, req.session.userId);

      if (!cartItem) {
        return res.status(404).json({ error: 'Cart item not found' });
      }

      if (quantity < 1) {
        // Remove item if quantity is 0 or less
        db.prepare('DELETE FROM cart WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
      } else if (quantity > cartItem.stock) {
        return res.status(400).json({ error: `Only ${cartItem.stock} available` });
      } else {
        db.prepare('UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?')
          .run(quantity, req.params.id, req.session.userId);
      }

      // Return updated cart
      const items = db.prepare(`
        SELECT c.id, c.quantity, c.product_id,
               p.name, p.price, p.image, p.stock, p.fabric_type, p.category
        FROM cart c JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?
      `).all(req.session.userId);
      const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const count = items.reduce((sum, item) => sum + item.quantity, 0);

      res.json({ items, total: Math.round(total * 100) / 100, count });
    } catch (err) {
      console.error('Cart update error:', err);
      res.status(500).json({ error: 'Failed to update cart' });
    }
  });

  // DELETE /api/cart/:id — Remove item from cart
  router.delete('/:id', (req, res) => {
    try {
      const result = db.prepare('DELETE FROM cart WHERE id = ? AND user_id = ?')
        .run(req.params.id, req.session.userId);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Cart item not found' });
      }

      // Return updated cart
      const items = db.prepare(`
        SELECT c.id, c.quantity, c.product_id,
               p.name, p.price, p.image, p.stock, p.fabric_type, p.category
        FROM cart c JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?
      `).all(req.session.userId);
      const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const count = items.reduce((sum, item) => sum + item.quantity, 0);

      res.json({ message: 'Removed from cart', items, total: Math.round(total * 100) / 100, count });
    } catch (err) {
      console.error('Cart delete error:', err);
      res.status(500).json({ error: 'Failed to remove from cart' });
    }
  });

  return router;
};
