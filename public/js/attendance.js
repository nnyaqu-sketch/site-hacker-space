// Attendance page management
let socket;
let allMembers = [];
let todayAttendance = [];

document.addEventListener('DOMContentLoaded', async () => {
  const auth = await checkAuth();
  if (!auth.loggedIn) {
    window.location.href = '/';
    return;
  }

  initSocket();
  loadMembers();
  loadTodayAttendance();
  setupEventListeners();

  // Hide admin panel for non-admin/creator users
  if (auth.role !== 'admin' && auth.role !== 'creator') {
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = 'none';
    });
  }
});

function initSocket() {
  socket = io((window.API_BASE || '') + '/');
  
  // Listen for real-time attendance updates
  socket.on('attendance-marked', (record) => {
    loadTodayAttendance();
  });
}

async function loadMembers() {
  try {
    const res = await fetch(apiPath('/api/users'));
    if (res.ok) {
      const users = await res.json();
      allMembers = users.sort((a, b) => a.username.localeCompare(b.username));
      populateMemberSelect();
    }
  } catch (err) {
    console.error('Failed to load members:', err);
  }
}

function populateMemberSelect() {
  const select = document.getElementById('member-select');
  select.innerHTML = '<option value="">-- Choisir un membre --</option>';
  
  allMembers.forEach(member => {
    const opt = document.createElement('option');
    opt.value = member.id;
    opt.textContent = member.username;
    select.appendChild(opt);
  });
}

async function loadTodayAttendance() {
  try {
    const res = await fetch(apiPath('/api/attendance/today'));
    if (res.ok) {
      todayAttendance = await res.json();
      renderAttendanceList();
      updateStats();
    }
  } catch (err) {
    console.error('Failed to load attendance:', err);
  }
}

async function loadAttendanceByDate(date) {
  if (!date) {
    document.getElementById('history-list').innerHTML = 
      '<div class="empty-state">Sélectionnez une date pour voir les présences</div>';
    return;
  }

  try {
    const res = await fetch(apiPath(`/api/attendance/date/${date}`));
    if (res.ok) {
      const records = await res.json();
      renderHistoryList(records);
    }
  } catch (err) {
    console.error('Failed to load attendance history:', err);
  }
}

async function updateStats() {
  try {
    const res = await fetch(apiPath('/api/attendance/stats'));
    if (res.ok) {
      const stats = await res.json();
      document.getElementById('unique-count').textContent = stats.unique_members || 0;
      document.getElementById('total-count').textContent = stats.total_confirmations || 0;
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

function renderAttendanceList() {
  const container = document.getElementById('attendance-list');
  
  if (todayAttendance.length === 0) {
    container.innerHTML = '<div class="empty-state">Aucune présence enregistrée aujourd\'hui</div>';
    return;
  }

  container.innerHTML = todayAttendance.map(record => {
    const time = new Date(record.timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const confirmedBy = record.confirmed_by_username || 'Système';
    
    return `
      <div class="attendance-item">
        <div class="attendance-item-info">
          <div class="attendance-member">${escapeHtml(record.username)}</div>
          <div class="attendance-meta">Confirmé par: ${escapeHtml(confirmedBy)}</div>
        </div>
        <div class="attendance-time">${time}</div>
      </div>
    `;
  }).join('');
}

function renderHistoryList(records) {
  const container = document.getElementById('history-list');
  
  if (records.length === 0) {
    container.innerHTML = '<div class="empty-state">Aucune présence enregistrée pour cette date</div>';
    return;
  }

  container.innerHTML = records.map(record => {
    const time = new Date(record.timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const confirmedBy = record.confirmed_by_username || 'Système';
    
    return `
      <div class="attendance-item">
        <div class="attendance-item-info">
          <div class="attendance-member">${escapeHtml(record.username)}</div>
          <div class="attendance-meta">Confirmé par: ${escapeHtml(confirmedBy)}</div>
        </div>
        <div class="attendance-time">${time}</div>
      </div>
    `;
  }).join('');
}

function setupEventListeners() {
  // Admin: Mark member present
  const markBtn = document.getElementById('mark-present-btn');
  if (markBtn) {
    markBtn.addEventListener('click', async () => {
      const select = document.getElementById('member-select');
      const userId = parseInt(select.value);
      
      if (!userId) {
        alert('Veuillez sélectionner un membre');
        return;
      }
      
      try {
        const res = await fetch(apiPath('/api/attendance/mark'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        
        if (res.ok) {
          select.value = '';
          loadTodayAttendance();
        } else {
          const data = await res.json();
          alert('Erreur: ' + (data.error || 'Impossible de confirmer la présence'));
        }
      } catch (err) {
        console.error('Error marking attendance:', err);
        alert('Erreur lors de la confirmation');
      }
    });
  }

  // Self checkin
  const selfCheckinBtn = document.getElementById('self-checkin-btn');
  if (selfCheckinBtn) {
    selfCheckinBtn.addEventListener('click', async () => {
      const auth = await checkAuth();
      const feedback = document.getElementById('checkin-feedback');
      
      try {
        const res = await fetch(apiPath('/api/attendance/mark'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId: auth.userId })
        });
        
        if (res.ok) {
          feedback.className = 'feedback success';
          feedback.textContent = '✓ Votre présence a été confirmée!';
          feedback.style.display = 'block';
          
          setTimeout(() => {
            feedback.style.display = 'none';
          }, 3000);
          
          loadTodayAttendance();
        } else {
          const data = await res.json();
          feedback.className = 'feedback error';
          feedback.textContent = '✗ ' + (data.error || 'Erreur lors de la confirmation');
          feedback.style.display = 'block';
        }
      } catch (err) {
        console.error('Error with self checkin:', err);
        feedback.className = 'feedback error';
        feedback.textContent = '✗ Erreur de connexion';
        feedback.style.display = 'block';
      }
    });
  }

  // Date picker for history
  const datePicker = document.getElementById('date-picker');
  if (datePicker) {
    // Set default to today
    const today = new Date().toISOString().split('T')[0];
    datePicker.value = today;
    
    datePicker.addEventListener('change', (e) => {
      loadAttendanceByDate(e.target.value);
    });
    
    // Load today's data on init
    loadAttendanceByDate(today);
  }
}
