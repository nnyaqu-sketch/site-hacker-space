const socket = io('/public');
const messagesEl = document.getElementById('messages');
const input = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const charCount = document.getElementById('char-count');

let me = { loggedIn: false };

fetch('/api/me').then(r=>r.json()).then(j=>{ me = j; updateStatus(); });

function updateStatus(){
  const s = document.getElementById('user-status');
  if (me.loggedIn) s.textContent = `Logged in as ${me.username} (${me.role})`;
  else s.textContent = 'Not logged in';
}

socket.on('init', rows => {
  messagesEl.innerHTML = '';
  rows.forEach(addMessageToDOM);
});
socket.on('message', addMessageToDOM);
socket.on('purge', () => messagesEl.innerHTML = '');

input.addEventListener('input', ()=>{ charCount.textContent = `${input.value.length}/300`; });

sendBtn.addEventListener('click', async ()=>{
  const text = input.value.trim();
  if (!text) return;
  const payload = { text: text.slice(0,300), username: me.username || 'Anonymous', userId: me.userId || null };
  socket.emit('send', payload);
  input.value = '';
  charCount.textContent = '0/300';
});

function addMessageToDOM(m){
  const d = new Date(m.timestamp);
  const el = document.createElement('div');
  el.className = 'msg';

  // avatar (initials)
  const initials = (m.username || 'A').split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase();
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = initials;

  const bubble = document.createElement('div');
  bubble.className = 'bubble' + (m.chat_type === 'admin' ? ' admin' : '');
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `<strong>${escapeHtml(m.username||'')}</strong> <span class="time">${d.toLocaleString()}</span>`;
  const text = document.createElement('div');
  text.className = 'text';
  text.innerHTML = escapeHtml(m.text);

  bubble.appendChild(meta);
  bubble.appendChild(text);

  el.appendChild(avatar);
  el.appendChild(bubble);

  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// auth controls
document.getElementById('login-btn').addEventListener('click', async ()=>{
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const r = await fetch('/api/login', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ username, password }) });
  const j = await r.json();
  if (j.success) { me = { loggedIn:true, username, role: j.role }; updateStatus(); alert('Logged in'); }
  else alert('Login failed');
});

document.getElementById('register-btn').addEventListener('click', async ()=>{
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const code = document.getElementById('register-code').value;
  const r = await fetch('/api/register', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ username, password, code }) });
  const j = await r.json();
  if (j.success) alert('Registered, please login'); else alert(j.error || 'failed');
});

document.getElementById('logout-btn').addEventListener('click', async ()=>{
  await fetch('/api/logout', { method: 'POST' });
  me = { loggedIn:false }; updateStatus();
});
