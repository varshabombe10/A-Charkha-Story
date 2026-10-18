document.addEventListener('DOMContentLoaded', loadCart);

async function loadCart() {
  const container = document.getElementById('cart-container');
  const user = await checkAuth();
  if (!user) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
      <h3>Please log in</h3><p>You need to be logged in to view your cart</p>
      <a href="/login" class="btn btn-primary">Login / Register</a>
    </div>`;
    return;
  }

  try {
    const cart = await API.getCart();
    if (!cart.items.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg></div>
        <h3>Your cart is empty</h3><p>Discover our handcrafted collection and add items to your cart</p>
        <a href="/products" class="btn btn-primary">Browse Collection</a>
      </div>`;
      return;
    }

    renderCart(cart);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>Error loading cart</h3><p>${err.message}</p></div>`;
  }
}

function renderCart(cart) {
  const container = document.getElementById('cart-container');
  const itemsHTML = cart.items.map(item => {
    const placeholder = getProductPlaceholder(item.category, item.fabric_type);
    return `
      <div class="cart-item" data-id="${item.id}">
        <div class="cart-item-image">
          <div class="product-placeholder">${placeholder}</div>
        </div>
        <div class="cart-item-details">
          <a href="/product-detail?id=${item.product_id}" class="cart-item-name">${item.name}</a>
          <div class="cart-item-fabric">${item.fabric_type} • ${item.category}</div>
          <div class="cart-item-actions">
            <div class="quantity-controls">
              <button class="quantity-btn" onclick="updateQty(${item.id}, ${item.quantity - 1})">−</button>
              <span class="quantity-value">${item.quantity}</span>
              <button class="quantity-btn" onclick="updateQty(${item.id}, ${item.quantity + 1})">+</button>
            </div>
            <div class="cart-item-price">${formatPrice(item.price * item.quantity)}</div>
            <button class="cart-item-remove" onclick="removeItem(${item.id})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              Remove
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="cart-layout">
      <div class="cart-items">${itemsHTML}</div>
      <div class="cart-summary">
        <h3>Order Summary</h3>
        <div class="cart-summary-line"><span>Subtotal (${cart.count} items)</span><span>${formatPrice(cart.total)}</span></div>
        <div class="cart-summary-line"><span>Shipping</span><span style="color:var(--color-success)">Free</span></div>
        <div class="cart-summary-total"><span>Total</span><span>${formatPrice(cart.total)}</span></div>
        <a href="/checkout" class="btn btn-primary btn-full btn-lg">Proceed to Checkout</a>
        <a href="/products" class="btn btn-secondary btn-full" style="margin-top:8px">Continue Shopping</a>
      </div>
    </div>`;
}

async function updateQty(cartItemId, newQty) {
  try {
    if (newQty < 1) { await removeItem(cartItemId); return; }
    await API.updateCart(cartItemId, newQty);
    updateCartBadge();
    loadCart();
  } catch (err) { showToast(err.message, 'error'); }
}

async function removeItem(cartItemId) {
  try {
    await API.removeFromCart(cartItemId);
    showToast('Item removed');
    updateCartBadge();
    loadCart();
  } catch (err) { showToast(err.message, 'error'); }
}
