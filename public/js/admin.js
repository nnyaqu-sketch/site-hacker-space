const adminSocket = io('/admin');
let adminMessagesEl, adminInput, adminSendBtn, adminCharCount;

function setupAdminChat() {
  adminMessagesEl = document.getElementById('admin-messages');
  adminInput = document.getElementById('admin-msg-input');
  adminSendBtn = document.getElementById('admin-send-btn');
  adminCharCount = document.getElementById('admin-char-count');

  adminSocket.on('init', rows => {
    adminMessagesEl.innerHTML = '';
    rows.forEach(addAdminMessage);
  });

  adminSocket.on('message', addAdminMessage);
  adminSocket.on('purge', () => adminMessagesEl.innerHTML = '');

  adminInput.addEventListener('input', () => {
    adminCharCount.textContent = `${adminInput.value.length}/300`;
  });

  adminSendBtn.addEventListener('click', () => {
    const text = adminInput.value.trim();
    if (!text) return;
    
    const payload = {
      text: text.slice(0, 300),
      username: me.username,
      userId: me.userId
    };
    
    adminSocket.emit('send', payload);
    adminInput.value = '';
    adminCharCount.textContent = '0/300';
  });
}

function addAdminMessage(m) {
  const d = new Date(m.timestamp);
  const el = document.createElement('div');
  el.className = 'msg';

  const initials = (m.username || 'A').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  const avatar = document.createElement('div');
  avatar.className = 'avatar admin';
  avatar.textContent = initials;

  const bubble = document.createElement('div');
  bubble.className = 'bubble admin';
  
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `<strong>${escapeHtml(m.username || '')}</strong>
                   <span class="time">${d.toLocaleString()}</span>`;
  
  const text = document.createElement('div');
  text.className = 'text';
  text.textContent = m.text;

  bubble.appendChild(meta);
  bubble.appendChild(text);
  el.appendChild(avatar);
  el.appendChild(bubble);

  adminMessagesEl.appendChild(el);
  adminMessagesEl.scrollTop = adminMessagesEl.scrollHeight;
}

async function setupCodeGeneration() {
  const generateBtn = document.getElementById('generate-code');
  const roleSelect = document.getElementById('code-role');
  const display = document.getElementById('generated-code');

  generateBtn.addEventListener('click', async () => {
    const role = roleSelect.value;
    const r = await fetch('/api/create-code', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role })
    });
    const { code } = await r.json();
    display.innerHTML = `<div class="code">${code}</div>
                        <div class="code-help">One-time use registration code</div>`;
  });
}

async function setupChatPurge() {
  const purgeBtn = document.getElementById('purge-chat');
  purgeBtn.addEventListener('click', async () => {
    if (!confirm('Purge old messages now?')) return;
    await fetch('/api/purge-chat', { method: 'POST' });
    alert('Chat purged');
  });
}

async function setupUserManagement() {
  const userSelect = document.getElementById('manage-users');
  const deleteBtn = document.getElementById('delete-user');
  const resetBtn = document.getElementById('reset-password');

  // TODO: Add endpoint to list users
  // const users = await fetch('/api/users').then(r => r.json());
  // users.forEach(u => {
  //   const opt = document.createElement('option');
  //   opt.value = u.id;
  //   opt.textContent = u.username;
  //   userSelect.appendChild(opt);
  // });

  deleteBtn.addEventListener('click', async () => {
    const userId = userSelect.value;
    if (!userId || !confirm('Delete this user?')) return;
    
    await fetch('/api/user/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    alert('User deleted');
  });

  resetBtn.addEventListener('click', async () => {
    const userId = userSelect.value;
    if (!userId) return;
    const newPassword = prompt('Enter new password:');
    if (!newPassword) return;

    await fetch('/api/user/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, newPassword })
    });
    alert('Password changed');
  });
}

// Check admin access and initialize
document.addEventListener('DOMContentLoaded', async () => {
  const auth = await checkAuth();
  if (auth.role !== 'admin' && auth.role !== 'creator') {
    document.body.innerHTML = '<div class="error-page">Access denied</div>';
    return;
  }

  setupAdminChat();
  setupCodeGeneration();
  setupChatPurge();
  setupUserManagement();
  
  // Setup club open notification button
  const btn = document.getElementById('club-open-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/send-club-open', {
          method: 'POST',
          headers: { 'content-type': 'application/json' }
        });
        
        const data = await res.json();
        if (data.success) {
          alert('Notification envoyée!');
        } else {
          alert('Erreur: ' + (data.error || 'Échec de l\'envoi'));
        }
      } catch (err) {
        console.error('Error sending club open notification:', err);
        alert('Erreur lors de l\'envoi de la notification');
      }
    });
  }
});