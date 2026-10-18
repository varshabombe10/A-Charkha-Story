let searchTimeout;

document.addEventListener('DOMContentLoaded', async () => {
  const admin = await checkAdminAuth();
  if (!admin) return;

  loadProducts();
  checkLowStock();

  document.getElementById('product-search').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadProducts(), 300);
  });
  document.getElementById('product-category-filter').addEventListener('change', () => loadProducts());
});

function getFilters() {
  return {
    search: document.getElementById('product-search').value,
    category: document.getElementById('product-category-filter').value,
  };
}

async function loadProducts() {
  try {
    const products = await AdminAPI.getProducts(getFilters());
    const tbody = document.getElementById('products-table');

    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p>No products found</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = products.map(p => `
      <tr>
        <td class="text-muted">${p.id}</td>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:40px;height:40px;border-radius:var(--radius-md);background:var(--color-cream-dark);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">🧵</div>
            <div>
              <div class="fw-600" style="font-size:0.8375rem;line-height:1.3;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</div>
            </div>
          </div>
        </td>
        <td>${p.category}</td>
        <td>${p.fabric_type}</td>
        <td class="fw-600">${formatPrice(p.price)}</td>
        <td>
          <span style="font-weight:600;color:${p.stock <= 5 ? 'var(--color-error)' : 'var(--color-deep-brown)'};">${p.stock}</span>
          ${p.stock <= 5 ? '<span class="text-xs" style="color:var(--color-error);margin-left:4px;">Low</span>' : ''}
        </td>
        <td>${p.featured ? '⭐' : '—'}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn-icon" title="Edit" onclick="editProduct(${p.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon" title="Delete" onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')">
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

async function checkLowStock() {
  try {
    const products = await AdminAPI.getLowStock();
    const alertEl = document.getElementById('low-stock-alert');
    const textEl = document.getElementById('low-stock-text');
    if (products.length > 0) {
      alertEl.classList.remove('hidden');
      alertEl.style.display = 'flex';
      textEl.textContent = `⚠ ${products.length} product${products.length > 1 ? 's' : ''} with low stock (≤ 5 units): ${products.map(p => p.name).slice(0, 3).join(', ')}${products.length > 3 ? '...' : ''}`;
    }
  } catch {}
}

function openProductModal(product = null) {
  document.getElementById('product-modal-title').textContent = product ? 'Edit Product' : 'Add New Product';
  document.getElementById('product-id').value = product ? product.id : '';
  document.getElementById('p-name').value = product ? product.name : '';
  document.getElementById('p-price').value = product ? product.price : '';
  document.getElementById('p-category').value = product ? product.category : '';
  document.getElementById('p-fabric').value = product ? product.fabric_type : '';
  document.getElementById('p-stock').value = product ? product.stock : 0;
  document.getElementById('p-image').value = product ? (product.image || '') : '';
  document.getElementById('p-description').value = product ? (product.description || '') : '';
  document.getElementById('p-featured').checked = product ? !!product.featured : false;
  document.getElementById('p-gift').checked = product ? !!product.gift_worthy : false;
  openModal('product-modal');
}

async function editProduct(id) {
  try {
    const products = await AdminAPI.getProducts();
    const product = products.find(p => p.id === id);
    if (product) openProductModal(product);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveProduct() {
  const id = document.getElementById('product-id').value;
  const data = {
    name: document.getElementById('p-name').value,
    price: document.getElementById('p-price').value,
    category: document.getElementById('p-category').value,
    fabric_type: document.getElementById('p-fabric').value,
    stock: document.getElementById('p-stock').value,
    image: document.getElementById('p-image').value,
    description: document.getElementById('p-description').value,
    featured: document.getElementById('p-featured').checked,
    gift_worthy: document.getElementById('p-gift').checked,
  };

  if (!data.name || !data.price || !data.category || !data.fabric_type) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  try {
    if (id) {
      await AdminAPI.updateProduct(id, data);
      showToast('Product updated successfully');
    } else {
      await AdminAPI.createProduct(data);
      showToast('Product created successfully');
    }
    closeModal('product-modal');
    loadProducts();
    checkLowStock();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteProduct(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await AdminAPI.deleteProduct(id);
    showToast('Product deleted');
    loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function exportProducts() {
  try {
    const blob = await AdminAPI.exportProducts();
    downloadBlob(blob, 'products_export.csv');
    showToast('Products exported successfully');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
