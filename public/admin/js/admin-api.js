/**
 * Admin API Client
 * Centralized API communication for A Charkha Story Admin Dashboard
 */
const AdminAPI = {
  base: '/api/admin',

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('/api/') ? endpoint : `${this.base}${endpoint}`;
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
      // Handle CSV export
      if (res.headers.get('content-type')?.includes('text/csv')) {
        const blob = await res.blob();
        return blob;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') throw new Error('Unable to connect to server');
      throw err;
    }
  },

  // Auth
  login(email, password) { return this.request('/api/auth/login', { method: 'POST', body: { email, password } }); },
  getMe() { return this.request('/me'); },
  logout() { return this.request('/api/auth/logout', { method: 'POST' }); },

  // Dashboard
  getStats() { return this.request('/stats'); },
  getSalesChart() { return this.request('/sales-chart'); },
  getCategoryChart() { return this.request('/category-chart'); },
  getActivity(limit = 15) { return this.request(`/activity?limit=${limit}`); },

  // Users
  getUsers(search = '') { return this.request(`/users${search ? '?search=' + encodeURIComponent(search) : ''}`); },
  getUser(id) { return this.request(`/users/${id}`); },
  updateUserStatus(id, active) { return this.request(`/users/${id}/status`, { method: 'PUT', body: { active } }); },

  // Orders
  getOrders(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
    const qs = params.toString();
    return this.request(`/orders${qs ? '?' + qs : ''}`);
  },
  getOrder(id) { return this.request(`/orders/${id}`); },
  updateOrderStatus(id, status) { return this.request(`/orders/${id}/status`, { method: 'PUT', body: { status } }); },

  // Products
  getProducts(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
    const qs = params.toString();
    return this.request(`/products${qs ? '?' + qs : ''}`);
  },
  getLowStock() { return this.request('/products/low-stock'); },
  createProduct(data) { return this.request('/products', { method: 'POST', body: data }); },
  updateProduct(id, data) { return this.request(`/products/${id}`, { method: 'PUT', body: data }); },
  deleteProduct(id) { return this.request(`/products/${id}`, { method: 'DELETE' }); },

  // Coupons
  getCoupons() { return this.request('/coupons'); },
  createCoupon(data) { return this.request('/coupons', { method: 'POST', body: data }); },
  updateCoupon(id, active) { return this.request(`/coupons/${id}`, { method: 'PUT', body: { active } }); },
  deleteCoupon(id) { return this.request(`/coupons/${id}`, { method: 'DELETE' }); },

  // Analytics
  getRevenue(period = 'daily') { return this.request(`/analytics/revenue?period=${period}`); },
  getTopProducts() { return this.request('/analytics/top-products'); },
  getFabricPerformance() { return this.request('/analytics/fabric-performance'); },
  getUserGrowth() { return this.request('/analytics/user-growth'); },

  // Export
  exportOrders() { return this.request('/export/orders'); },
  exportUsers() { return this.request('/export/users'); },
  exportProducts() { return this.request('/export/products'); },
};

// Utility functions
function formatPrice(price) {
  return '₹' + Number(price).toLocaleString('en-IN');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(dateStr);
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
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
  setTimeout(() => toast.remove(), 3500);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function statusClass(status) {
  return (status || '').toLowerCase();
}

// Animate counter
function animateCounter(el, target, prefix = '', duration = 1200) {
  const start = 0;
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.floor(start + (target - start) * eased);
    el.textContent = prefix + value.toLocaleString('en-IN');
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = prefix + target.toLocaleString('en-IN');
  }
  requestAnimationFrame(update);
}

// Open / close modal
function openModal(id) {
  document.getElementById(id)?.classList.add('active');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

// Sidebar / mobile
function initSidebar() {
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');

  if (toggle) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay?.classList.toggle('active');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }
}

// Auth check on every admin page
async function checkAdminAuth() {
  try {
    const data = await AdminAPI.getMe();
    if (!data.user || data.user.role !== 'admin') {
      window.location.href = '/admin/login';
      return null;
    }
    // Update profile name in topbar
    const nameEl = document.getElementById('admin-name');
    const avatarEl = document.getElementById('admin-avatar');
    if (nameEl) nameEl.textContent = data.user.name;
    if (avatarEl) avatarEl.textContent = getInitials(data.user.name);
    return data.user;
  } catch {
    window.location.href = '/admin/login';
    return null;
  }
}

// Logout
async function adminLogout() {
  try {
    await AdminAPI.logout();
  } catch {}
  window.location.href = '/admin/login';
}

// Chart color palette (earthy tones)
const chartColors = [
  '#C2703E', // terracotta
  '#D4A439', // saffron
  '#8B9A6B', // sage
  '#2C4A6E', // indigo
  '#7B2D3B', // maroon
  '#5C4033', // brown
  '#C5A55A', // gold
  '#4A7DBF', // indigo light
  '#A84A5A', // maroon light
  '#B5C49A', // sage light
];

// Initialize common features
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
});
