/**
 * API Client Module
 * Centralized API communication for A Charkha Story
 */
const API = {
  base: '/api',

  async request(endpoint, options = {}) {
    const url = `${this.base}${endpoint}`;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const res = await fetch(url, config);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Unable to connect to server');
      }
      throw err;
    }
  },

  // ──── Products ────
  getProducts(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val) params.append(key, val);
    });
    const qs = params.toString();
    return this.request(`/products${qs ? '?' + qs : ''}`);
  },

  getProduct(id) {
    return this.request(`/products/${id}`);
  },

  getFeatured() {
    return this.request('/products/featured');
  },

  getGiftWorthy() {
    return this.request('/products/gift-worthy');
  },

  getCategories() {
    return this.request('/products/categories');
  },

  // ──── Cart ────
  getCart() {
    return this.request('/cart');
  },

  addToCart(product_id, quantity = 1) {
    return this.request('/cart', {
      method: 'POST',
      body: { product_id, quantity },
    });
  },

  updateCart(cartItemId, quantity) {
    return this.request(`/cart/${cartItemId}`, {
      method: 'PUT',
      body: { quantity },
    });
  },

  removeFromCart(cartItemId) {
    return this.request(`/cart/${cartItemId}`, {
      method: 'DELETE',
    });
  },

  // ──── Orders ────
  placeOrder(orderData) {
    return this.request('/orders', {
      method: 'POST',
      body: orderData,
    });
  },

  validateCoupon(code) {
    return this.request('/orders/validate-coupon', {
      method: 'POST',
      body: { code },
    });
  },

  getOrders() {
    return this.request('/orders');
  },

  getOrder(id) {
    return this.request(`/orders/${id}`);
  },

  // ──── Auth ────
  login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  },

  register(data) {
    return this.request('/auth/register', {
      method: 'POST',
      body: data,
    });
  },

  logout() {
    return this.request('/auth/logout', { method: 'POST' });
  },

  getMe() {
    return this.request('/auth/me');
  },

  updateProfile(data) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: data,
    });
  },
};

// ──── Utility Functions ────
function formatPrice(price) {
  return '₹' + Number(price).toLocaleString('en-IN');
}

function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

function getProductPlaceholder(category, fabricType) {
  const colors = {
    'Silk': { bg: '#8B2252', fg: '#DFC98E', accent: '#C5A55A' },
    'Khadi': { bg: '#E8DCC8', fg: '#5C4033', accent: '#8B6F5E' },
    'Cotton': { bg: '#E8E2DA', fg: '#4A7D5A', accent: '#8B9A6B' },
    'Chanderi': { bg: '#F0E6F0', fg: '#7B2D3B', accent: '#A84A5A' },
    'Linen': { bg: '#E8E0D0', fg: '#6B5B4F', accent: '#A89B8C' },
  };
  const icons = {
    'Sarees': `<path d="M20 8c-3 0-5 2-7 5s-4 7-8 7v2c5 0 7-3 9-6s4-6 6-6 4 2 6 5 4 7 9 7v-2c-4 0-6-3-8-6s-4-6-7-6z" fill="currentColor" opacity="0.3"/><path d="M15 18c-2 3-4 6-9 6v2c6 0 8-4 10-7s4-7 8-7 5 3 7 6 4 8 10 8v-2c-5 0-7-4-9-7s-4-6-8-6-6 3-9 7z" fill="currentColor" opacity="0.2"/>`,
    'Kurtis': `<path d="M25 10h-10l-3 8v16h16V18l-3-8zm-5 2l2 6h-4l2-6zm-6 8h12v12H14V20z" fill="currentColor" opacity="0.3"/>`,
    'Shirts': `<path d="M30 14l-5-4h-4l-1 3-1-3h-4l-5 4 3 4 2-1v16h10V17l2 1 3-4zm-10-2l1 3 1-3h2l-3 4-3-4h2z" fill="currentColor" opacity="0.3"/>`,
    'Dupattas': `<path d="M15 8c0 0-5 10-5 20s3 12 3 12h2s-3-4-3-12 4-18 4-18l10 2c0 0 4 10 4 16s-3 12-3 12h2s3-4 3-12-5-18-5-18l-12-2z" fill="currentColor" opacity="0.3"/>`,
    'Fabrics': `<path d="M10 12h20v2H10zm0 5h20v2H10zm0 5h20v2H10zm0 5h20v2H10z" fill="currentColor" opacity="0.2"/><path d="M14 10v22M20 10v22M26 10v22" stroke="currentColor" stroke-width="0.5" opacity="0.15"/>`,
  };

  const c = colors[fabricType] || colors['Cotton'];
  const icon = icons[category] || icons['Fabrics'];

  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;background:${c.bg}">
    <defs>
      <pattern id="weave-${category}-${fabricType}" width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M0 4h8M4 0v8" stroke="${c.fg}" stroke-width="0.3" opacity="0.1"/>
      </pattern>
    </defs>
    <rect width="40" height="40" fill="url(#weave-${category}-${fabricType})"/>
    <g transform="translate(0,0)" color="${c.fg}">${icon}</g>
    <text x="20" y="38" text-anchor="middle" font-family="Georgia,serif" font-size="2.5" fill="${c.fg}" opacity="0.5">${fabricType}</text>
  </svg>`;
}

async function updateCartBadge() {
  try {
    const data = await API.getCart();
    const badge = document.querySelector('.cart-badge');
    if (badge) {
      badge.textContent = data.count || 0;
      badge.classList.toggle('show', data.count > 0);
    }
  } catch {
    // User not logged in, hide badge
    const badge = document.querySelector('.cart-badge');
    if (badge) badge.classList.remove('show');
  }
}

async function checkAuth() {
  try {
    const data = await API.getMe();
    return data.user;
  } catch {
    return null;
  }
}

function updateAuthUI(user) {
  const authLink = document.querySelector('#auth-link');
  if (!authLink) return;

  if (user) {
    authLink.href = '#';
    authLink.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    authLink.title = user.name;
    authLink.onclick = async (e) => {
      e.preventDefault();
      if (confirm(`Logged in as ${user.name}. Log out?`)) {
        await API.logout();
        window.location.href = '/';
      }
    };
  } else {
    authLink.href = '/login';
    authLink.title = 'Login / Register';
    authLink.onclick = null;
  }
}

// Initialize header on every page
document.addEventListener('DOMContentLoaded', async () => {
  // Scroll header effect
  window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (header) {
      header.classList.toggle('scrolled', window.scrollY > 20);
    }
  });

  // Mobile menu
  const toggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
    });
  }

  // Check auth & update UI
  const user = await checkAuth();
  updateAuthUI(user);
  updateCartBadge();
});
