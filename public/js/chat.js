const socket = io('/public');
const messagesEl = document.getElementById('messages');
const input = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const charCount = document.getElementById('char-count');

socket.on('init', rows => {
  messagesEl.innerHTML = '';
  rows.forEach(addMessageToDOM);
});

socket.on('message', addMessageToDOM);
socket.on('purge', () => messagesEl.innerHTML = '');

input.addEventListener('input', () => {
  charCount.textContent = `${input.value.length}/300`;
});

sendBtn.addEventListener('click', async () => {
  if (!me.loggedIn) {
    alert('Please login to chat');
    return;
  }
  const text = input.value.trim();
  if (!text) return;
  
  const payload = {
    text: text.slice(0, 300),
    username: me.username,
    userId: me.userId
  };
  
  socket.emit('send', payload);
  input.value = '';
  charCount.textContent = '0/300';
});

function addMessageToDOM(m) {
  const d = new Date(m.timestamp);
  const el = document.createElement('div');
  el.className = 'msg';

  // avatar (initials)
  const initials = (m.username || 'A').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = initials;

  const bubble = document.createElement('div');
  bubble.className = 'bubble' + (m.chat_type === 'admin' ? ' admin' : '');
  
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

  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}