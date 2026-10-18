let currentProduct = null;
let quantity = 1;

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) { window.location.href = '/products'; return; }
  loadProduct(id);
});

async function loadProduct(id) {
  const container = document.getElementById('product-container');
  try {
    const product = await API.getProduct(id);
    currentProduct = product;
    document.title = `${product.name} — A Charkha Story`;

    const placeholder = getProductPlaceholder(product.category, product.fabric_type);
    const stockLevel = product.stock > 10 ? 'in-stock' : product.stock > 0 ? 'low-stock' : 'out-of-stock';
    const stockText = product.stock > 10 ? 'In Stock' : product.stock > 0 ? `Only ${product.stock} left` : 'Out of Stock';

    container.innerHTML = `
      <div class="breadcrumb" style="margin-bottom:var(--space-xl)">
        <a href="/">Home</a><span class="breadcrumb-sep">›</span>
        <a href="/products">Shop</a><span class="breadcrumb-sep">›</span>
        <a href="/products?category=${product.category}">${product.category}</a><span class="breadcrumb-sep">›</span>
        <span>${product.name}</span>
      </div>
      <div class="product-detail-grid">
        <div class="product-detail-image">
          <div class="product-placeholder">${placeholder}</div>
        </div>
        <div class="product-detail-info">
          <div class="product-detail-category">${product.category}</div>
          <h1 class="product-detail-name">${product.name}</h1>
          <div class="product-detail-price">${formatPrice(product.price)}</div>
          <div class="product-detail-fabric">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg>
            ${product.fabric_type} Fabric
          </div>
          <p class="product-detail-description">${product.description}</p>
          <div class="product-detail-stock">
            <span class="stock-dot ${stockLevel}"></span>
            <span>${stockText}</span>
          </div>
          ${product.stock > 0 ? `
            <div class="quantity-selector">
              <label>Quantity</label>
              <div class="quantity-controls">
                <button class="quantity-btn" onclick="changeQty(-1)">−</button>
                <span class="quantity-value" id="qty-display">1</span>
                <button class="quantity-btn" onclick="changeQty(1)">+</button>
              </div>
            </div>
            <button class="btn btn-primary btn-lg btn-full" onclick="addToCart()" id="add-to-cart-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
              Add to Cart — ${formatPrice(product.price)}
            </button>
          ` : `<button class="btn btn-secondary btn-lg btn-full" disabled>Out of Stock</button>`}
        </div>
      </div>
    `;

    // Related products
    if (product.related && product.related.length) {
      document.getElementById('related-products').innerHTML = product.related.map(p => {
        const ph = getProductPlaceholder(p.category, p.fabric_type);
        return `
          <div class="product-card" onclick="window.location.href='/product-detail?id=${p.id}'">
            <div class="product-card-image"><div class="product-placeholder">${ph}</div></div>
            <div class="product-card-body">
              <div class="product-card-category">${p.category}</div>
              <h3 class="product-card-name">${p.name}</h3>
              <div class="product-card-fabric">${p.fabric_type}</div>
              <div class="product-card-price">${formatPrice(p.price)}</div>
            </div>
          </div>`;
      }).join('');
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>Product not found</h3><p>${err.message}</p><a href="/products" class="btn btn-primary">Browse Products</a></div>`;
  }
}

function changeQty(delta) {
  if (!currentProduct) return;
  quantity = Math.max(1, Math.min(quantity + delta, currentProduct.stock));
  document.getElementById('qty-display').textContent = quantity;
  const btn = document.getElementById('add-to-cart-btn');
  if (btn) btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg> Add to Cart — ${formatPrice(currentProduct.price * quantity)}`;
}

async function addToCart() {
  try {
    const user = await checkAuth();
    if (!user) { showToast('Please login first', 'info'); window.location.href = '/login'; return; }
    await API.addToCart(currentProduct.id, quantity);
    showToast(`Added ${quantity} item${quantity > 1 ? 's' : ''} to cart!`);
    updateCartBadge();
  } catch (err) { showToast(err.message, 'error'); }
}
