const express = require('express');
const router = express.Router();

module.exports = function(db) {

  // GET /api/products/featured — Featured products
  router.get('/featured', (req, res) => {
    try {
      const products = db.prepare('SELECT * FROM products WHERE featured = 1 AND stock > 0 ORDER BY price DESC').all();
      res.json(products);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch featured products' });
    }
  });

  // GET /api/products/gift-worthy — Gift-worthy products
  router.get('/gift-worthy', (req, res) => {
    try {
      const products = db.prepare('SELECT * FROM products WHERE gift_worthy = 1 AND stock > 0 ORDER BY price DESC').all();
      res.json(products);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch gift-worthy products' });
    }
  });

  // GET /api/products/categories — Get all categories with counts
  router.get('/categories', (req, res) => {
    try {
      const categories = db.prepare('SELECT category, COUNT(*) as count FROM products GROUP BY category ORDER BY count DESC').all();
      res.json(categories);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // GET /api/products — List all products with optional filters
  router.get('/', (req, res) => {
    try {
      let query = 'SELECT * FROM products WHERE stock > 0';
      const params = [];

      // Category filter
      if (req.query.category) {
        query += ' AND category = ?';
        params.push(req.query.category);
      }

      // Fabric type filter
      if (req.query.fabric) {
        query += ' AND fabric_type = ?';
        params.push(req.query.fabric);
      }

      // Price range filter
      if (req.query.min_price) {
        query += ' AND price >= ?';
        params.push(parseFloat(req.query.min_price));
      }
      if (req.query.max_price) {
        query += ' AND price <= ?';
        params.push(parseFloat(req.query.max_price));
      }

      // Search filter
      if (req.query.search) {
        query += ' AND (name LIKE ? OR description LIKE ? OR fabric_type LIKE ?)';
        const searchTerm = `%${req.query.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      // Sorting
      const sortOptions = {
        'price_asc': 'price ASC',
        'price_desc': 'price DESC',
        'newest': 'created_at DESC',
        'name': 'name ASC'
      };
      const sort = sortOptions[req.query.sort] || 'created_at DESC';
      query += ` ORDER BY ${sort}`;

      const products = db.prepare(query).all(...params);
      res.json(products);
    } catch (err) {
      console.error('Product list error:', err);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  // GET /api/products/:id — Single product
  router.get('/:id', (req, res) => {
    try {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Get related products (same category, different product)
      const related = db.prepare(
        'SELECT * FROM products WHERE category = ? AND id != ? AND stock > 0 ORDER BY RANDOM() LIMIT 4'
      ).all(product.category, product.id);

      res.json({ ...product, related });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch product' });
    }
  });

  return router;
};
