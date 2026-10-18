let searchTimeout;

document.addEventListener('DOMContentLoaded', async () => {
  const admin = await checkAdminAuth();
  if (!admin) return;

  loadOrders();

  document.getElementById('order-search').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadOrders(), 300);
  });

  document.getElementById('order-status-filter').addEventListener('change', () => loadOrders());
  document.getElementById('order-from').addEventListener('change', () => loadOrders());
  document.getElementById('order-to').addEventListener('change', () => loadOrders());
});

function getFilters() {
  return {
    search: document.getElementById('order-search').value,
    status: document.getElementById('order-status-filter').value,
    from: document.getElementById('order-from').value,
    to: document.getElementById('order-to').value,
  };
}

async function loadOrders() {
  try {
    const orders = await AdminAPI.getOrders(getFilters());
    const tbody = document.getElementById('orders-table');

    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>No orders found</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(o => `
      <tr>
        <td class="fw-600">#${o.id}</td>
        <td>
          <div class="table-user">
            <div class="table-user-avatar">${getInitials(o.user_name)}</div>
            <div class="table-user-info">
              <span class="table-user-name">${o.user_name}</span>
              <span class="table-user-email">${o.user_email}</span>
            </div>
          </div>
        </td>
        <td class="fw-600">${formatPrice(o.total_amount)}</td>
        <td><span class="status-badge ${statusClass(o.status)}">${o.status}</span></td>
        <td>${formatDate(o.created_at)}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn-icon" title="View Details" onclick="viewOrder(${o.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <select class="form-control btn-sm" style="width:auto;padding:4px 8px;font-size:0.72rem;" onchange="updateStatus(${o.id}, this.value)" title="Change status">
              ${['Pending','Confirmed','Shipped','Delivered','Cancelled'].map(s =>
                `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`
              ).join('')}
            </select>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function viewOrder(id) {
  try {
    const order = await AdminAPI.getOrder(id);
    document.getElementById('order-modal-title').textContent = `Order #${order.id}`;

    document.getElementById('order-detail-content').innerHTML = `
      <div class="detail-grid" style="margin-bottom:24px;">
        <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value"><span class="status-badge ${statusClass(order.status)}">${order.status}</span></div></div>
        <div class="detail-item"><div class="detail-label">Date</div><div class="detail-value">${formatDateTime(order.created_at)}</div></div>
        <div class="detail-item"><div class="detail-label">Customer</div><div class="detail-value">${order.user_name} (${order.user_email})</div></div>
        <div class="detail-item"><div class="detail-label">Phone</div><div class="detail-value">${order.user_phone || '—'}</div></div>
        <div class="detail-item"><div class="detail-label">Ship To</div><div class="detail-value">${order.address}, ${order.city}, ${order.state} — ${order.pincode}</div></div>
        <div class="detail-item"><div class="detail-label">Total Amount</div><div class="detail-value fw-700" style="font-size:1.1rem;color:var(--color-terracotta);">${formatPrice(order.total_amount)}</div></div>
      </div>
      <h4 style="margin-bottom:12px;">Items (${order.items.length})</h4>
      <table>
        <thead><tr><th>Product</th><th>Category</th><th>Fabric</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead>
        <tbody>
          ${order.items.map(item => `
            <tr>
              <td class="fw-600">${item.name}</td>
              <td>${item.category}</td>
              <td>${item.fabric_type}</td>
              <td>${item.quantity}</td>
              <td>${formatPrice(item.price_at_purchase)}</td>
              <td class="fw-600">${formatPrice(item.price_at_purchase * item.quantity)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    openModal('order-modal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function updateStatus(id, status) {
  try {
    await AdminAPI.updateOrderStatus(id, status);
    showToast(`Order #${id} → ${status}`);
  } catch (err) {
    showToast(err.message, 'error');
    loadOrders();
  }
}

async function exportOrders() {
  try {
    const blob = await AdminAPI.exportOrders();
    downloadBlob(blob, 'orders_export.csv');
    showToast('Orders exported successfully');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
