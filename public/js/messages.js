// Private Messages Page
let currentConversationUser = null;
let allUsers = [];
const socket = io('/messages');

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await checkAuth();
    if (!auth.loggedIn) {
        window.location.href = '/login.html';
        return;
    }

    await loadUsers();
    setupEventListeners();
    setupSocketListeners();
});

async function loadUsers() {
    try {
        const res = await fetch('/api/users');
        allUsers = await res.json();
        renderUsersList(allUsers);
    } catch (err) {
        console.error('Failed to load users:', err);
        // Show mock users for now
        allUsers = [
            { id: 1, username: 'Alice', role: 'member' },
            { id: 2, username: 'Bob', role: 'admin' },
            { id: 3, username: 'Charlie', role: 'member' }
        ].filter(u => u.username !== me.username);
        renderUsersList(allUsers);
    }
}

function renderUsersList(users) {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';

    users.forEach(user => {
        if (user.id === me.userId) return; // Don't show current user

        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.dataset.userId = user.id;

        const initials = (user.username || 'U').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
        
        userItem.innerHTML = `
            <div class="user-avatar">${initials}</div>
            <div class="user-details">
                <span class="user-name">${escapeHtml(user.username)}</span>
                <span class="user-role">${user.role === 'admin' ? 'Administrateur' : user.role === 'creator' ? 'Créateur' : 'Membre'}</span>
            </div>
        `;

        userItem.addEventListener('click', () => openConversation(user));
        usersList.appendChild(userItem);
    });
}

function openConversation(user) {
    currentConversationUser = user;

    // Update UI
    document.getElementById('no-conversation').style.display = 'none';
    document.getElementById('conversation-view').style.display = 'flex';

    // Update active state
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.userId == user.id) {
            item.classList.add('active');
        }
    });

    // Update conversation header
    const initials = (user.username || 'U').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
    document.getElementById('conv-avatar').textContent = initials;
    document.getElementById('conv-username').textContent = user.username;

    // Load messages
    loadConversation(user.id);

    // Reinitialize icons
    lucide.createIcons();
}

async function loadConversation(userId) {
    try {
        const res = await fetch(`/api/messages/${userId}`);
        const messages = await res.json();
        renderMessages(messages);
    } catch (err) {
        console.error('Failed to load conversation:', err);
        // Show empty conversation for now
        renderMessages([]);
    }
}

function renderMessages(messages) {
    const messagesContainer = document.getElementById('conversation-messages');
    messagesContainer.innerHTML = '';

    messages.forEach(msg => {
        addMessageToDOM(msg);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addMessageToDOM(msg) {
    const messagesContainer = document.getElementById('conversation-messages');
    const messageItem = document.createElement('div');
    messageItem.className = 'message-item';
    
    const isSent = msg.sender_id === me.userId;
    if (isSent) {
        messageItem.classList.add('sent');
    }

    const initials = (msg.sender_username || 'U').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
    const timestamp = new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    messageItem.innerHTML = `
        <div class="message-avatar">${initials}</div>
        <div class="message-bubble">
            <div class="message-text">${escapeHtml(msg.text)}</div>
            <div class="message-time">${timestamp}</div>
        </div>
    `;

    messagesContainer.appendChild(messageItem);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function setupEventListeners() {
    const messageInput = document.getElementById('message-input');
    const charCount = document.getElementById('message-char-count');
    const sendBtn = document.getElementById('send-message-btn');
    const closeBtn = document.getElementById('close-conversation');
    const searchInput = document.getElementById('user-search');

    messageInput.addEventListener('input', () => {
        charCount.textContent = `${messageInput.value.length}/500`;
    });

    sendBtn.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    closeBtn.addEventListener('click', () => {
        document.getElementById('conversation-view').style.display = 'none';
        document.getElementById('no-conversation').style.display = 'flex';
        document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
        currentConversationUser = null;
    });

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredUsers = allUsers.filter(user => 
            user.username.toLowerCase().includes(searchTerm)
        );
        renderUsersList(filteredUsers);
    });
}

async function sendMessage() {
    if (!currentConversationUser) return;

    const messageInput = document.getElementById('message-input');
    const text = messageInput.value.trim();
    
    if (!text) return;

    try {
        const res = await fetch(`/api/messages/${currentConversationUser.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text.slice(0, 500) })
        });

        if (res.ok) {
            const message = await res.json();
            addMessageToDOM(message);
            messageInput.value = '';
            document.getElementById('message-char-count').textContent = '0/500';
        }
    } catch (err) {
        console.error('Failed to send message:', err);
        alert('Erreur lors de l\'envoi du message');
    }
}

function setupSocketListeners() {
    socket.on('new_message', (message) => {
        // Only add if we're viewing this conversation
        if (currentConversationUser && 
            (message.sender_id === currentConversationUser.id || 
             message.receiver_id === currentConversationUser.id)) {
            addMessageToDOM(message);
        }
    });
}