document.addEventListener('DOMContentLoaded', () => {
  // Read URL params for pre-selected filters
  const params = new URLSearchParams(window.location.search);
  if (params.get('category')) {
    document.querySelector(`input[name="category"][value="${params.get('category')}"]`).checked = true;
    document.getElementById('page-title').textContent = params.get('category');
    document.getElementById('breadcrumb-current').textContent = params.get('category');
  }
  if (params.get('fabric')) {
    document.querySelector(`input[name="fabric"][value="${params.get('fabric')}"]`).checked = true;
  }
  if (params.get('search')) {
    document.getElementById('search-input').value = params.get('search');
  }

  // Load products
  applyFilters();

  // Search on enter
  document.getElementById('search-input').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') applyFilters();
  });

  // Filter on radio change
  document.querySelectorAll('input[name="category"], input[name="fabric"]').forEach(el => {
    el.addEventListener('change', applyFilters);
  });
});

async function applyFilters() {
  const grid = document.getElementById('product-grid');
  grid.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';

  const filters = {
    category: document.querySelector('input[name="category"]:checked')?.value || '',
    fabric: document.querySelector('input[name="fabric"]:checked')?.value || '',
    min_price: document.getElementById('min-price')?.value || '',
    max_price: document.getElementById('max-price')?.value || '',
    search: document.getElementById('search-input')?.value || '',
    sort: document.getElementById('sort-select')?.value || 'newest',
  };

  try {
    const products = await API.getProducts(filters);
    document.getElementById('result-count').textContent = `${products.length} product${products.length !== 1 ? 's' : ''} found`;

    if (products.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1">
          <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div>
          <h3>No products found</h3>
          <p>Try adjusting your filters or search terms</p>
          <button class="btn btn-primary" onclick="clearFilters()">Clear Filters</button>
        </div>`;
      return;
    }

    grid.innerHTML = products.map(p => createProductCard(p)).join('');
  } catch (err) {
    grid.innerHTML = '<p class="text-center" style="grid-column:1/-1;color:var(--color-gray-500)">Failed to load products</p>';
  }
}

function clearFilters() {
  document.querySelectorAll('input[name="category"]')[0].checked = true;
  document.querySelectorAll('input[name="fabric"]')[0].checked = true;
  document.getElementById('min-price').value = '';
  document.getElementById('max-price').value = '';
  document.getElementById('search-input').value = '';
  document.getElementById('sort-select').value = 'newest';
  document.getElementById('page-title').textContent = 'Our Collection';
  document.getElementById('breadcrumb-current').textContent = 'Shop';
  window.history.replaceState({}, '', '/products');
  applyFilters();
}

function createProductCard(product) {
  const placeholder = getProductPlaceholder(product.category, product.fabric_type);
  const badges = [];
  if (product.featured) badges.push('<span class="badge badge-featured">Featured</span>');
  if (product.gift_worthy) badges.push('<span class="badge badge-gift">Gift Worthy</span>');

  return `
    <div class="product-card" onclick="window.location.href='/product-detail?id=${product.id}'">
      <div class="product-card-image">
        <div class="product-placeholder">${placeholder}</div>
        ${badges.length ? `<div class="product-badges">${badges.join('')}</div>` : ''}
        <div class="product-card-quick-add">
          <button class="btn btn-primary btn-full btn-sm" onclick="event.stopPropagation(); quickAdd(${product.id})">Add to Cart</button>
        </div>
      </div>
      <div class="product-card-body">
        <div class="product-card-category">${product.category}</div>
        <h3 class="product-card-name">${product.name}</h3>
        <div class="product-card-fabric">${product.fabric_type}</div>
        <div class="product-card-price">${formatPrice(product.price)}</div>
      </div>
    </div>`;
}

async function quickAdd(productId) {
  try {
    const user = await checkAuth();
    if (!user) { showToast('Please login first', 'info'); window.location.href = '/login'; return; }
    await API.addToCart(productId);
    showToast('Added to cart!');
    updateCartBadge();
  } catch (err) { showToast(err.message, 'error'); }
}
