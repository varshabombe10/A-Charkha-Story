document.addEventListener('DOMContentLoaded', async () => {
  const admin = await checkAdminAuth();
  if (!admin) return;

  loadCoupons();
});

async function loadCoupons() {
  try {
    const coupons = await AdminAPI.getCoupons();
    const tbody = document.getElementById('coupons-table');

    if (coupons.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>No coupons created yet</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = coupons.map(c => `
      <tr>
        <td><div class="fw-700" style="font-size:1.1rem;color:var(--color-terracotta);letter-spacing:0.05em;">${c.code}</div></td>
        <td>${c.discount_percent}%</td>
        <td>${c.expires_at ? formatDate(c.expires_at) : 'Never'}</td>
        <td>${c.used_count} ${c.max_uses ? '/ ' + c.max_uses : ''}</td>
        <td><span class="status-badge ${c.active ? 'active' : 'inactive'}">${c.active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <div class="flex gap-2">
            <button class="btn-icon" title="${c.active ? 'Deactivate' : 'Activate'}" onclick="toggleCoupon(${c.id}, ${c.active ? 0 : 1})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">${c.active 
                ? '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="13" x2="17" y2="13"/>'
                : '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>'
              }</svg>
            </button>
            <button class="btn-icon" title="Delete" onclick="deleteCoupon(${c.id}, '${c.code}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveCoupon() {
  const code = document.getElementById('c-code').value.toUpperCase().trim();
  const value = document.getElementById('c-value').value;
  const expiry = document.getElementById('c-expiry').value || null;
  const limit = document.getElementById('c-limit').value || null;

  if (!code || !value) {
    showToast('Code and Discount are required', 'error');
    return;
  }

  try {
    await AdminAPI.createCoupon({
      code,
      discount_percent: value,
      expires_at: expiry,
      max_uses: limit > 0 ? limit : null
    });
    
    showToast('Coupon created successfully');
    closeModal('coupon-modal');
    document.getElementById('coupon-form').reset();
    loadCoupons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleCoupon(id, active) {
  try {
    await AdminAPI.updateCoupon(id, active);
    showToast(`Coupon ${active ? 'activated' : 'deactivated'}`);
    loadCoupons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCoupon(id, code) {
  if (!confirm(`Delete coupon "${code}"? This cannot be undone.`)) return;
  try {
    await AdminAPI.deleteCoupon(id);
    showToast('Coupon deleted');
    loadCoupons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
