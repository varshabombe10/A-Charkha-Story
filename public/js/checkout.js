let appliedCoupon = null;
let currentCartTotal = 0;

document.addEventListener('DOMContentLoaded', loadCheckout);

async function loadCheckout() {
  const container = document.getElementById('checkout-container');
  const user = await checkAuth();
  if (!user) { window.location.href = '/login'; return; }

  try {
    const cart = await API.getCart();
    if (!cart.items.length) { window.location.href = '/cart'; return; }
    currentCartTotal = cart.total;

    const itemsHTML = cart.items.map(item => `
      <div class="checkout-item">
        <span class="checkout-item-name">${item.name}</span>
        <span class="checkout-item-qty">×${item.quantity}</span>
        <span class="checkout-item-price">${formatPrice(item.price * item.quantity)}</span>
      </div>`).join('');

    container.innerHTML = `
      <div class="checkout-layout">
        <div class="checkout-form-section">
          <h3>Shipping Address</h3>
          <form id="checkout-form" onsubmit="placeOrder(event)">
            <div class="form-group">
              <label for="address">Street Address *</label>
              <input type="text" id="address" class="form-control" required placeholder="e.g., 42 Handloom Lane" value="${user.address || ''}">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="city">City *</label>
                <input type="text" id="city" class="form-control" required placeholder="e.g., Jaipur" value="${user.city || ''}">
              </div>
              <div class="form-group">
                <label for="state">State *</label>
                <input type="text" id="state" class="form-control" required placeholder="e.g., Rajasthan" value="${user.state || ''}">
              </div>
            </div>
            <div class="form-group">
              <label for="pincode">PIN Code *</label>
              <input type="text" id="pincode" class="form-control" required placeholder="e.g., 302001" maxlength="6" pattern="[0-9]{6}" value="${user.pincode || ''}">
            </div>
            <button type="submit" class="btn btn-primary btn-lg btn-full" id="place-order-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Place Order — <span id="btn-total-price">${formatPrice(currentCartTotal)}</span>
            </button>
          </form>
        </div>
        <div class="checkout-summary">
          <div class="checkout-summary-card">
            <h3>Order Summary</h3>
            ${itemsHTML}
            
            <div class="coupon-section" style="margin-top:var(--space-md);padding-top:var(--space-md);border-top:1px solid var(--color-gray-200)">
              <div class="flex" style="gap:8px">
                <input type="text" id="coupon-code" class="form-control" placeholder="Discount code" style="text-transform:uppercase" ${appliedCoupon ? 'disabled value="'+appliedCoupon.code+'"' : ''}>
                <button type="button" class="btn btn-secondary" onclick="applyCoupon()" id="apply-coupon-btn" ${appliedCoupon ? 'disabled' : ''}>Apply</button>
              </div>
              <div id="coupon-message" style="margin-top:8px;font-size:0.875rem;font-weight:500"></div>
            </div>

            <div class="cart-summary-line" style="margin-top:var(--space-md);padding-top:var(--space-md);border-top:1px solid var(--color-gray-200)">
              <span>Subtotal</span><span>${formatPrice(currentCartTotal)}</span>
            </div>
            <div id="discount-row" class="cart-summary-line" style="display:none;color:var(--color-success)">
              <span>Discount</span><span id="discount-amount-display">-₹0</span>
            </div>
            <div class="cart-summary-line"><span>Shipping</span><span style="color:var(--color-success)">Free</span></div>
            <div class="cart-summary-total"><span>Total</span><span id="final-total-display">${formatPrice(currentCartTotal)}</span></div>
          </div>
        </div>
      </div>`;
    
    // If a coupon was already applied before reloading layout, update UI
    if (appliedCoupon) updateTotalsUI();

  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

async function applyCoupon() {
  const codeInput = document.getElementById('coupon-code');
  const btn = document.getElementById('apply-coupon-btn');
  const msg = document.getElementById('coupon-message');
  const code = codeInput.value.trim().toUpperCase();

  if (!code) return;

  btn.disabled = true;
  btn.textContent = '...';
  msg.textContent = '';
  msg.style.color = '';

  try {
    const validCoupon = await API.validateCoupon(code);
    appliedCoupon = validCoupon;
    
    msg.textContent = `${validCoupon.discount_percent}% off applied!`;
    msg.style.color = 'var(--color-success)';
    codeInput.disabled = true;
    
    updateTotalsUI();
  } catch (err) {
    msg.textContent = err.message;
    msg.style.color = 'var(--color-error)';
    btn.disabled = false;
    btn.textContent = 'Apply';
  }
}

function updateTotalsUI() {
  if (!appliedCoupon) return;
  
  const discountAmount = Math.round((currentCartTotal * appliedCoupon.discount_percent / 100) * 100) / 100;
  const newTotal = currentCartTotal - discountAmount;

  document.getElementById('discount-row').style.display = 'flex';
  document.getElementById('discount-amount-display').textContent = '-' + formatPrice(discountAmount);
  document.getElementById('final-total-display').textContent = formatPrice(newTotal);
  document.getElementById('btn-total-price').textContent = formatPrice(newTotal);
}

async function placeOrder(e) {
  e.preventDefault();
  const btn = document.getElementById('place-order-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm" style="margin:0 auto"></div> Processing...';

  try {
    const orderData = {
      address: document.getElementById('address').value,
      city: document.getElementById('city').value,
      state: document.getElementById('state').value,
      pincode: document.getElementById('pincode').value,
      coupon_code: appliedCoupon ? appliedCoupon.code : null
    };

    const result = await API.placeOrder(orderData);
    updateCartBadge();

    // Show success modal
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="success-modal">
        <div class="modal">
          <div class="modal-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h2>Order Placed!</h2>
          <p>Your order #${result.order.id} has been placed successfully. We'll start preparing your handcrafted items with care.</p>
          <div style="display:flex;gap:var(--space-md);justify-content:center;flex-wrap:wrap">
            <a href="/orders" class="btn btn-primary">View My Orders</a>
            <a href="/products" class="btn btn-secondary">Continue Shopping</a>
          </div>
        </div>
      </div>`);
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = 'Place Order';
  }
}
