document.addEventListener('DOMContentLoaded', () => {
  loadFeatured();
  loadGiftWorthy();
  loadCategories();
});

async function loadFeatured() {
  const container = document.getElementById('featured-products');
  try {
    const products = await API.getFeatured();
    container.innerHTML = products.slice(0, 8).map(p => createProductCard(p)).join('');
  } catch (err) {
    container.innerHTML = '<p class="text-center" style="color:var(--color-gray-500)">Unable to load products</p>';
  }
}

async function loadGiftWorthy() {
  const container = document.getElementById('gift-products');
  try {
    const products = await API.getGiftWorthy();
    container.innerHTML = products.slice(0, 4).map(p => createProductCard(p)).join('');
  } catch (err) {
    container.innerHTML = '<p class="text-center" style="color:var(--color-gray-500)">Unable to load products</p>';
  }
}

async function loadCategories() {
  const container = document.getElementById('category-grid');
  const categoryData = [
    { name: 'Sarees', desc: 'Timeless drapes', gradient: 'linear-gradient(135deg, #8B2252 0%, #C2703E 100%)' },
    { name: 'Kurtis', desc: 'Everyday elegance', gradient: 'linear-gradient(135deg, #2C4A6E 0%, #4A7DBF 100%)' },
    { name: 'Shirts', desc: 'Refined classics', gradient: 'linear-gradient(135deg, #5C4033 0%, #8B6F5E 100%)' },
    { name: 'Dupattas', desc: 'Grace & color', gradient: 'linear-gradient(135deg, #7B2D3B 0%, #A84A5A 100%)' },
    { name: 'Fabrics', desc: 'By the meter', gradient: 'linear-gradient(135deg, #8B9A6B 0%, #B5C49A 100%)' },
  ];

  container.innerHTML = categoryData.map(cat => `
    <a href="/products?category=${cat.name}" class="category-card" style="background:${cat.gradient}">
      <div class="category-card-overlay">
        <div class="category-card-name">${cat.name}</div>
        <div class="category-card-count">${cat.desc}</div>
      </div>
    </a>
  `).join('');
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
    </div>
  `;
}

async function quickAdd(productId) {
  try {
    const user = await checkAuth();
    if (!user) {
      showToast('Please login to add items to cart', 'info');
      window.location.href = '/login';
      return;
    }
    await API.addToCart(productId);
    showToast('Added to cart!');
    updateCartBadge();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
