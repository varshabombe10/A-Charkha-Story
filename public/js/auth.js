// Check if already logged in
document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (user) window.location.href = '/';
});

function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

  if (tab === 'login') {
    document.querySelectorAll('.auth-tab')[0].classList.add('active');
    document.getElementById('login-form').classList.add('active');
  } else {
    document.querySelectorAll('.auth-tab')[1].classList.add('active');
    document.getElementById('register-form').classList.add('active');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errDiv = document.getElementById('login-error');
  errDiv.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    await API.login(email, password);
    showToast('Welcome back!');
    window.location.href = '/';
  } catch (err) {
    errDiv.textContent = err.message;
    errDiv.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('register-btn');
  const errDiv = document.getElementById('register-error');
  errDiv.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Creating account...';

  try {
    const data = {
      name: document.getElementById('reg-name').value,
      email: document.getElementById('reg-email').value,
      phone: document.getElementById('reg-phone').value,
      password: document.getElementById('reg-password').value,
    };
    await API.register(data);
    showToast('Account created! Welcome to A Charkha Story');
    window.location.href = '/';
  } catch (err) {
    errDiv.textContent = err.message;
    errDiv.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}
