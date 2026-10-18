let searchTimeout;

document.addEventListener('DOMContentLoaded', async () => {
  const admin = await checkAdminAuth();
  if (!admin) return;

  loadUsers();

  document.getElementById('user-search').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadUsers(e.target.value), 300);
  });
});

async function loadUsers(search = '') {
  try {
    const users = await AdminAPI.getUsers(search);
    const tbody = document.getElementById('users-table');

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><p>No users found</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div class="table-user">
            <div class="table-user-avatar">${getInitials(u.name)}</div>
            <div class="table-user-info">
              <span class="table-user-name">${u.name}</span>
              <span class="table-user-email">${u.email}</span>
            </div>
          </div>
        </td>
        <td>${u.phone || '—'}</td>
        <td>${formatDate(u.created_at)}</td>
        <td>${u.total_orders}</td>
        <td class="fw-600">${formatPrice(u.total_spent)}</td>
        <td><span class="status-badge ${u.active ? 'active' : 'inactive'}">${u.active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <div class="flex gap-2">
            <button class="btn-icon" title="View Details" onclick="viewUser(${u.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn-icon" title="${u.active ? 'Deactivate' : 'Activate'}" onclick="toggleUserStatus(${u.id}, ${u.active ? 0 : 1})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">${u.active
                ? '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="13" x2="17" y2="13"/>'
                : '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>'
              }</svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function viewUser(id) {
  try {
    const user = await AdminAPI.getUser(id);
    const content = document.getElementById('user-detail-content');

    content.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
        <div class="table-user-avatar" style="width:52px;height:52px;font-size:1.1rem;">${getInitials(user.name)}</div>
        <div>
          <h4 style="margin-bottom:2px;">${user.name}</h4>
          <span class="text-muted text-sm">${user.email}</span>
          <div style="margin-top:4px;"><span class="status-badge ${user.active ? 'active' : 'inactive'}">${user.active ? 'Active' : 'Inactive'}</span></div>
        </div>
      </div>
      <div class="detail-grid" style="margin-bottom:24px;">
        <div class="detail-item"><div class="detail-label">Phone</div><div class="detail-value">${user.phone || '—'}</div></div>
        <div class="detail-item"><div class="detail-label">Joined</div><div class="detail-value">${formatDate(user.created_at)}</div></div>
        <div class="detail-item"><div class="detail-label">Address</div><div class="detail-value">${user.address || '—'}</div></div>
        <div class="detail-item"><div class="detail-label">City</div><div class="detail-value">${[user.city, user.state, user.pincode].filter(Boolean).join(', ') || '—'}</div></div>
      </div>
      <h4 style="margin-bottom:12px;">Order History (${user.orders.length})</h4>
      ${user.orders.length === 0 ? '<p class="text-muted text-sm">No orders yet</p>' : `
        <table>
          <thead><tr><th>Order ID</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            ${user.orders.map(o => `
              <tr>
                <td>#${o.id}</td>
                <td class="fw-600">${formatPrice(o.total_amount)}</td>
                <td><span class="status-badge ${statusClass(o.status)}">${o.status}</span></td>
                <td>${formatDate(o.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    `;
    openModal('user-modal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleUserStatus(id, active) {
  const action = active ? 'activate' : 'deactivate';
  if (!confirm(`Are you sure you want to ${action} this user?`)) return;

  try {
    await AdminAPI.updateUserStatus(id, active);
    showToast(`User ${action}d successfully`);
    loadUsers(document.getElementById('user-search').value);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function exportUsers() {
  try {
    const blob = await AdminAPI.exportUsers();
    downloadBlob(blob, 'users_export.csv');
    showToast('Users exported successfully');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
