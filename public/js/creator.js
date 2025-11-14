let socket;

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await checkAuth();
    if (!auth.loggedIn || auth.role !== 'creator') {
        window.location.href = '/';
        return;
    }

    initSocket();
    loadStats();
    loadUsers();
    setupEventListeners();
});

function initSocket() {
    socket = io();
    
    socket.on('stats_update', (stats) => {
        updateStats(stats);
    });
    
    socket.on('user_update', () => {
        loadUsers();
    });
}

async function loadStats() {
    try {
        const res = await fetch('/api/creator/stats');
        const stats = await res.json();
        updateStats(stats);
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

function updateStats(stats) {
    const statsContainer = document.getElementById('stats');
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-title">Utilisateurs</div>
            <div class="stat-value">${stats.totalUsers}</div>
        </div>
        <div class="stat-card">
            <div class="stat-title">Messages</div>
            <div class="stat-value">${stats.totalMessages}</div>
        </div>
        <div class="stat-card">
            <div class="stat-title">Listes</div>
            <div class="stat-value">${stats.totalChecklists}</div>
        </div>
        <div class="stat-card">
            <div class="stat-title">Annonces</div>
            <div class="stat-value">${stats.totalAnnouncements}</div>
        </div>
    `;
}

async function loadUsers() {
    try {
        const res = await fetch('/api/creator/users');
        const users = await res.json();
        const userList = document.getElementById('user-list');
            const targetSelect = document.getElementById('system-target');
            if (targetSelect) {
                targetSelect.innerHTML = `<option value="">-- Destinataire (tous) --</option>`;
            }
        
        userList.innerHTML = users.map(user => `
            <div class="user-item">
                <div class="user-info">
                    <span class="username">${escapeHtml(user.username)}</span>
                    <span class="role-badge ${user.role}">${user.role}</span>
                </div>
                <div class="user-actions">
                    ${user.role !== 'creator' ? `
                        <button class="danger small" onclick="deleteUser(${user.id})">
                            Supprimer
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        // populate target select for private system messages
        if (targetSelect) {
            users.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = `${u.username} (${u.role})`;
                targetSelect.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Failed to load users:', err);
    }
}

function setupEventListeners() {
    // Setup club open notification button
    const clubOpenBtn = document.getElementById('club-open-btn');
    if (clubOpenBtn) {
        clubOpenBtn.addEventListener('click', async () => {
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

    document.getElementById('generate-admin').addEventListener('click', async () => {
        try {
            const res = await fetch('/api/creator/generate-admin-code', { method: 'POST' });
            const { code } = await res.json();
            document.getElementById('new-admin-code').value = code;
        } catch (err) {
            alert('Erreur lors de la génération du code');
        }
    });

    document.getElementById('set-message').addEventListener('click', async () => {
        const message = document.getElementById('system-message').value;
        const isPrivate = document.getElementById('system-private')?.checked;
        const target = document.getElementById('system-target')?.value || null;
        try {
            await fetch('/api/creator/system-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, is_private: !!isPrivate, target_user: target ? Number(target) : null })
            });
            alert('Message système mis à jour');
        } catch (err) {
            alert('Erreur lors de la mise à jour du message');
        }
    });

    document.getElementById('clear-chat').addEventListener('click', async () => {
        if (!confirm('Êtes-vous sûr de vouloir nettoyer tout l\'historique du chat ?')) return;
        try {
            await fetch('/api/creator/clear-chat', { method: 'POST' });
            alert('Historique du chat nettoyé');
        } catch (err) {
            alert('Erreur lors du nettoyage du chat');
        }
    });

    document.getElementById('clear-announcements').addEventListener('click', async () => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer toutes les annonces ?')) return;
        try {
            await fetch('/api/creator/clear-announcements', { method: 'POST' });
            alert('Annonces supprimées');
        } catch (err) {
            alert('Erreur lors de la suppression des annonces');
        }
    });
}

async function deleteUser(userId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;
    try {
        await fetch(`/api/creator/users/${userId}`, { method: 'DELETE' });
        loadUsers();
    } catch (err) {
        alert('Erreur lors de la suppression de l\'utilisateur');
    }
}