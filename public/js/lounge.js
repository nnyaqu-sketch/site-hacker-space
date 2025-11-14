const announcementsEl = document.getElementById('announcements');
const adminControls = document.getElementById('admin-controls');
const socket = io('/public');

// Show admin controls if admin/creator
async function checkAdmin() {
  if (me.role === 'admin' || me.role === 'creator') {
    adminControls.style.display = 'block';
    setupAdminControls();
  }
}

function setupAdminControls() {
  const titleInput = document.getElementById('announcement-title');
  const contentInput = document.getElementById('announcement-content');
  const postBtn = document.getElementById('post-announcement');

  postBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    if (!title || !content) {
      alert('Title and content required');
      return;
    }

    await fetch('/api/announcement', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, content })
    });

    titleInput.value = '';
    contentInput.value = '';
    loadAnnouncements();
  });
}

async function loadAnnouncements() {
  if (!me.loggedIn) {
    announcementsEl.innerHTML = '<div class="login-prompt">Veuillez vous connecter pour voir les annonces</div>';
    return;
  }

  const res = await fetch('/api/announcements');
  const announcements = await res.json();
  
  announcementsEl.innerHTML = '';
  announcements.forEach(a => {
    const el = document.createElement('div');
    el.className = 'announcement';
    const d = new Date(a.timestamp);
    el.innerHTML = `
      <div class="announcement-header">
        <h3>${escapeHtml(a.title)}</h3>
        <span class="time">${d.toLocaleString()}</span>
      </div>
      <div class="announcement-content">${escapeHtml(a.content)}</div>
    `;
    announcementsEl.appendChild(el);
  });
}

// Listen for new announcements
socket.on('announcement', loadAnnouncements);

document.addEventListener('DOMContentLoaded', async () => {
  // Ensure we know who the user is before deciding what to show
  await checkAuth();
  // Now safe to load announcements and admin controls
  loadAnnouncements();
  checkAdmin();
});