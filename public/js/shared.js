// Shared state and utilities
let me = { loggedIn: false };

async function checkAuth() {
  const r = await fetch('/api/me');
  me = await r.json();
  updateStatus();
  // load any system messages for this user
  try {
    if (me.loggedIn) await loadSystemMessages();
  } catch (e) { console.error('failed to load system messages', e); }
  return me;
}

// system messages: fetch and render banners (persist dismissals in localStorage)
async function loadSystemMessages() {
  const res = await fetch('/api/system-messages');
  if (!res.ok) return;
  const msgs = await res.json();
  if (!msgs || msgs.length === 0) return;

  // container for banners
  let container = document.getElementById('system-banner-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'system-banner-container';
    container.style.position = 'fixed';
    container.style.top = '72px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.zIndex = 9999;
    container.style.width = 'min(920px, 96%)';
    document.body.appendChild(container);
  }

  const dismissed = JSON.parse(localStorage.getItem('dismissedSystemMsgs') || '[]');

  msgs.reverse().forEach(m => {
    if (dismissed.includes(m.id)) return;
    const el = document.createElement('div');
    el.className = 'system-banner';
    el.style.background = '#0ea5e9';
    el.style.color = 'white';
    el.style.padding = '12px 16px';
    el.style.borderRadius = '8px';
    el.style.boxShadow = '0 8px 20px rgba(2,6,23,0.08)';
    el.style.marginTop = '8px';
    el.style.display = 'flex';
    el.style.justifyContent = 'space-between';
    el.style.alignItems = 'center';

    const inner = document.createElement('div');
    inner.innerHTML = `<strong>${escapeHtml(m.title || '')}</strong> ${escapeHtml(m.content || '')}`;

    const btn = document.createElement('button');
    btn.textContent = 'Fermer';
    btn.style.marginLeft = '12px';
    btn.style.border = 'none';
    btn.style.background = 'rgba(255,255,255,0.12)';
    btn.style.color = 'white';
    btn.style.padding = '6px 10px';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => {
      // dismiss and record
      dismissed.push(m.id);
      localStorage.setItem('dismissedSystemMsgs', JSON.stringify(dismissed));
      el.remove();
    });

    el.appendChild(inner);
    el.appendChild(btn);
    container.appendChild(el);
  });
}

function updateStatus() {
  const s = document.getElementById('user-status');
  if (!s) return;
  
  // Update status display
  if (me.loggedIn) {
    s.innerHTML = `<span class="username">${escapeHtml(me.username)}</span>
                   <span class="role">${me.role === 'admin' ? 'Administrateur' : me.role === 'member' ? 'Membre' : 'Créateur'}</span>`;
    
    // Show/hide admin buttons
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = (me.role === 'admin' || me.role === 'creator') ? '' : 'none';
    });
    
    // Show/hide creator buttons
    document.querySelectorAll('.creator-only').forEach(el => {
      el.style.display = me.role === 'creator' ? '' : 'none';
    });
    
    // Update auth elements
    const auth = document.getElementById('auth');
    if (auth) {
      document.getElementById('username').style.display = 'none';
      document.getElementById('password').style.display = 'none';
      document.getElementById('register-code').style.display = 'none';
      document.getElementById('login-btn').style.display = 'none';
      document.getElementById('register-btn').style.display = 'none';
      document.getElementById('logout-btn').style.display = '';
    }
  } else {
    s.textContent = 'Non connecté';
    
    // Hide admin/creator elements when logged out
    document.querySelectorAll('.admin-only, .creator-only').forEach(el => {
      el.style.display = 'none';
    });
    
    // Update auth elements
    const auth = document.getElementById('auth');
    if (auth) {
      document.getElementById('username').style.display = '';
      document.getElementById('password').style.display = '';
      document.getElementById('register-code').style.display = '';
      document.getElementById('login-btn').style.display = '';
      document.getElementById('register-btn').style.display = '';
      document.getElementById('logout-btn').style.display = 'none';
    }
  }
}

function setupAuth() {
  const auth = document.getElementById('auth');
  if (!auth) return;

  const loginBtn = document.getElementById('login-btn');
  const registerBtn = document.getElementById('register-btn');
  const logoutBtn = document.getElementById('logout-btn');

  loginBtn?.addEventListener('click', async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const j = await r.json();
    if (j.success) {
      me = { loggedIn: true, username, role: j.role };
      updateStatus();
      alert('Connexion réussie');
      window.location.reload();
    } else alert('Échec de la connexion');
  });

  registerBtn?.addEventListener('click', async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const code = document.getElementById('register-code').value;
    const r = await fetch('/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password, code })
    });
    const j = await r.json();
    if (j.success) alert('Inscription réussie, veuillez vous connecter');
    else alert(j.error || 'Échec de l\'inscription');
  });

  logoutBtn?.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    me = { loggedIn: false };
    updateStatus();
    window.location.href = '/';
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupAuth();
});

// realtime system message listener (public)
try {
  const publicSocket = io('/public');
  publicSocket.on('system_message', (m) => {
    // if logged in, show immediately
    try { loadSystemMessages(); } catch (e) { console.error(e); }
  });
} catch (e) { /* socket might not be available in some pages */ }