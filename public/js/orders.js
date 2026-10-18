document.addEventListener('DOMContentLoaded', loadOrders);

async function loadOrders() {
  const container = document.getElementById('orders-container');
  const user = await checkAuth();
  if (!user) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
      <h3>Please log in</h3><p>Log in to view your order history</p>
      <a href="/login" class="btn btn-primary">Login / Register</a>
    </div>`;
    return;
  }

  try {
    const orders = await API.getOrders();
    if (!orders.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
        <h3>No orders yet</h3><p>Start shopping to see your orders here</p>
        <a href="/products" class="btn btn-primary">Browse Collection</a>
      </div>`;
      return;
    }

    container.innerHTML = orders.map(order => {
      const statusClass = order.status.toLowerCase();
      const date = new Date(order.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

      const itemsHTML = order.items.map(item => {
        const placeholder = getProductPlaceholder(item.category, item.fabric_type);
        return `
          <div class="order-item">
            <div class="order-item-image"><div class="product-placeholder">${placeholder}</div></div>
            <div class="order-item-info">
              <h5>${item.name}</h5>
              <span>Qty: ${item.quantity} × ${formatPrice(item.price_at_purchase)}</span>
            </div>
            <div class="order-item-price">${formatPrice(item.quantity * item.price_at_purchase)}</div>
          </div>`;
      }).join('');

      return `
        <div class="order-card">
          <div class="order-card-header">
            <span class="order-id">Order #${order.id}</span>
            <span class="order-status ${statusClass}">${order.status}</span>
          </div>
          <div class="order-card-body">
            <div class="order-items-list">${itemsHTML}</div>
          </div>
          <div class="order-card-footer">
            <span class="order-date">${date}</span>
            <span class="order-total">Total: ${formatPrice(order.total_amount)}</span>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>Error loading orders</h3><p>${err.message}</p></div>`;
  }
}
