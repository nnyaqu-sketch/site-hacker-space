const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'club.db');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

let db;
// Promise wrappers for sqlite3
function dbOpen() {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(DB_PATH, (err) => err ? reject(err) : resolve(database));
  });
}

function promisifyDb(database) {
  return {
    run(sql, params=[]) { return new Promise((res, rej) => database.run(sql, params, function(err){ if(err) rej(err); else res(this); })); },
    get(sql, params=[]) { return new Promise((res, rej) => database.get(sql, params, (err,row)=> err?rej(err):res(row))); },
    all(sql, params=[]) { return new Promise((res, rej) => database.all(sql, params, (err,rows)=> err?rej(err):res(rows))); },
    exec(sql){ return new Promise((res, rej) => database.exec(sql, (err)=> err?rej(err):res())); }
  };
}

async function initDb() {
  const raw = await dbOpen();
  db = promisifyDb(raw);
  await db.exec(`PRAGMA foreign_keys = ON;`);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT,
      role TEXT DEFAULT 'member'
    );
  `);
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS codes (
      code TEXT PRIMARY KEY,
      role TEXT,
      used INTEGER DEFAULT 0,
      created_by INTEGER
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      text TEXT,
      timestamp INTEGER,
      chat_type TEXT DEFAULT 'public'
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      description TEXT,
      created_by INTEGER
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER,
      text TEXT,
      checked INTEGER DEFAULT 0,
      parent_id INTEGER,
      FOREIGN KEY(checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      created_by INTEGER,
      timestamp INTEGER
    );
  `);

  // System messages (global or private)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS system_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      created_by INTEGER,
      is_private INTEGER DEFAULT 0,
      target_user INTEGER,
      timestamp INTEGER,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(target_user) REFERENCES users(id) ON DELETE SET NULL
    );
  `);
  
  // Private messages table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS private_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER,
      receiver_id INTEGER,
      text TEXT,
      timestamp INTEGER,
      read INTEGER DEFAULT 0,
      FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(receiver_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  
  // User profiles table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY,
      display_name TEXT,
      bio TEXT,
      avatar_color TEXT DEFAULT '#c7d2fe',
      is_public INTEGER DEFAULT 1,
      show_stats INTEGER DEFAULT 1,
      created_at INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

// Helper: require auth
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'unauthenticated' });
}

// Discord webhook for club open notification
const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1435241804558503936/JnWywyi61cZtIOijFD_sxqDbT_nJ2KfgHyjAWHP-X-5ERSsS6vA-wxqLYDQk02ftXrWM';

app.post('/api/send-club-open', requireAuth, async (req, res) => {
  if (req.session.role !== 'admin' && req.session.role !== 'creator') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const response = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '🟢 Le club est maintenant ouvert! Vous pouvez venir.',
        username: 'Club Bot'
      })
    });

    if (!response.ok) {
      throw new Error('Discord webhook failed');
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Discord webhook error:', err);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session || !req.session.role) return res.status(401).json({ error: 'unauthenticated' });
    if (req.session.role === role || req.session.role === 'creator') return next();
    if (role === 'admin' && req.session.role === 'admin') return next();
    res.status(403).json({ error: 'forbidden' });
  };
}

// Register using a one-time code
app.post('/api/register', async (req, res) => {
  const { username, password, code } = req.body;
  if (!username || !password || !code) {
    return res.status(400).json({ error: 'Veuillez remplir tous les champs' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Le nom d\'utilisateur doit comporter au moins 3 caractères' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit comporter au moins 6 caractères' });
  }
  const codeRow = await db.get(`SELECT * FROM codes WHERE code = ?`, [code]);
  if (!codeRow || codeRow.used) {
    return res.status(400).json({ error: 'Code d\'inscription invalide ou déjà utilisé' });
  }
  const role = codeRow.role || 'member';
  const hash = await bcrypt.hash(password, 10);
  try {
    const result = await db.run(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`, [username, hash, role]);
    await db.run(`UPDATE codes SET used = 1 WHERE code = ?`, [code]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Ce nom d\'utilisateur existe déjà' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Veuillez remplir tous les champs' });
  }
  const user = await db.get(`SELECT * FROM users WHERE username = ?`, [username]);
  if (!user) return res.status(400).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(400).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;
  res.json({ success: true, role: user.role });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// Creator endpoints
function requireCreator(req, res, next) {
  if (req.session.role !== 'creator') return res.status(403).json({ error: 'creator only' });
  next();
}

app.get('/api/creator/stats', requireCreator, async (req, res) => {
  const [users, messages, checklists, announcements] = await Promise.all([
    db.get('SELECT COUNT(*) as count FROM users'),
    db.get('SELECT COUNT(*) as count FROM messages'),
    db.get('SELECT COUNT(*) as count FROM checklists'),
    db.get('SELECT COUNT(*) as count FROM announcements')
  ]);
  res.json({
    totalUsers: users.count,
    totalMessages: messages.count,
    totalChecklists: checklists.count,
    totalAnnouncements: announcements.count
  });
});

app.get('/api/creator/users', requireCreator, async (req, res) => {
  const users = await db.all('SELECT id, username, role FROM users');
  res.json(users);
});

app.post('/api/creator/generate-admin-code', requireCreator, async (req, res) => {
  const code = uuidv4();
  await db.run('INSERT INTO codes (code, role, created_by) VALUES (?, ?, ?)', 
    [code, 'admin', req.session.userId]);
  res.json({ code });
});

app.post('/api/creator/system-message', requireCreator, async (req, res) => {
  const { title, message, is_private, target_user } = req.body;
  const ts = Date.now();

  // persist the system message
  await db.run(`INSERT INTO system_messages (title, content, created_by, is_private, target_user, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
    [title || null, message || '', req.session.userId, is_private ? 1 : 0, target_user || null, ts]);

  // If public, broadcast immediately to public/admin namespaces
  if (!is_private) {
    io.of('/public').emit('system_message', { title, message, timestamp: ts });
    io.of('/admin').emit('system_message', { title, message, timestamp: ts });
  }

  res.json({ success: true });
});

app.post('/api/creator/clear-chat', requireCreator, async (req, res) => {
  await db.run('DELETE FROM messages WHERE chat_type = "public"');
  io.emit('chat_cleared');
  res.json({ success: true });
});

app.post('/api/creator/clear-announcements', requireCreator, async (req, res) => {
  await db.run('DELETE FROM announcements');
  io.emit('announcements_cleared');
  res.json({ success: true });
});

// Get system messages for current user (public + private targeting this user)
app.get('/api/system-messages', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const rows = await db.all(`SELECT id, title, content, created_by, is_private, target_user, timestamp FROM system_messages WHERE (is_private = 0) OR (is_private = 1 AND target_user = ?) ORDER BY timestamp DESC LIMIT 50`, [userId]);
  res.json(rows);
});

app.delete('/api/creator/users/:id', requireCreator, async (req, res) => {
  const userId = parseInt(req.params.id);
  await db.run('DELETE FROM users WHERE id = ? AND role != "creator"', [userId]);
  res.json({ success: true });
});

// create one-time code (admin or creator)
app.post('/api/create-code', requireAuth, async (req, res) => {
  // Only creators may generate admin-level codes. Admins may generate member-level codes only.
  const { role } = req.body; // expected 'member' or 'admin'
  if (role === 'admin') {
    if (req.session.role !== 'creator') return res.status(403).json({ error: 'forbidden' });
  } else {
    // for non-admin codes, allow admin or creator
    if (!(req.session.role === 'admin' || req.session.role === 'creator')) return res.status(403).json({ error: 'forbidden' });
  }

  const code = uuidv4();
  await db.run(`INSERT INTO codes (code, role, created_by) VALUES (?, ?, ?)`, [code, role || 'member', req.session.userId]);
  res.json({ code });
});

// purge messages older than 24 hours (admin/creator) or manual purge
app.post('/api/purge-chat', requireAuth, async (req, res) => {
  if (!(req.session.role === 'admin' || req.session.role === 'creator')) return res.status(403).json({ error: 'forbidden' });
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  await db.run(`DELETE FROM messages WHERE timestamp < ?`, [cutoff]);
  io.emit('purge');
  res.json({ success: true });
});

// announcements (admin)
app.post('/api/announcement', requireAuth, async (req, res) => {
  if (!(req.session.role === 'admin' || req.session.role === 'creator')) return res.status(403).json({ error: 'forbidden' });
  const { title, content } = req.body;
  const ts = Date.now();
  await db.run(`INSERT INTO announcements (title, content, created_by, timestamp) VALUES (?, ?, ?, ?)`, [title, content, req.session.userId, ts]);
  const ann = await db.get(`SELECT * FROM announcements ORDER BY id DESC LIMIT 1`);
  io.emit('announcement', ann);
  res.json({ success: true, ann });
});

app.get('/api/announcements', requireAuth, async (req, res) => {
  const rows = await db.all(`SELECT * FROM announcements ORDER BY timestamp DESC`);
  res.json(rows);
});

// Checklists CRUD
app.post('/api/checklists', requireAuth, async (req, res) => {
  const { name, description } = req.body;
  const result = await db.run(`INSERT INTO checklists (name, description, created_by) VALUES (?, ?, ?)`, [name, description, req.session.userId]);
  const checklist = await db.get(`SELECT * FROM checklists WHERE id = ?`, [result.lastID]);
  io.emit('checklist-updated');
  res.json(checklist);
});

app.get('/api/checklists', requireAuth, async (req, res) => {
  const lists = await db.all(`SELECT * FROM checklists`);
  for (const l of lists) {
    l.items = await db.all(`SELECT * FROM checklist_items WHERE checklist_id = ?`, [l.id]);
  }
  res.json(lists);
});

app.post('/api/checklist/:id/items', requireAuth, async (req, res) => {
  const checklist_id = req.params.id;
  const { text, parent_id } = req.body;
  const result = await db.run(`INSERT INTO checklist_items (checklist_id, text, parent_id) VALUES (?, ?, ?)`, [checklist_id, text, parent_id || null]);
  const item = await db.get(`SELECT * FROM checklist_items WHERE id = ?`, [result.lastID]);
  io.emit('checklist-updated');
  res.json(item);
});

app.post('/api/checklist/items/:id/toggle', requireAuth, async (req, res) => {
  const id = req.params.id;
  const item = await db.get(`SELECT * FROM checklist_items WHERE id = ?`, [id]);
  await db.run(`UPDATE checklist_items SET checked = ? WHERE id = ?`, [item.checked ? 0 : 1, id]);
  io.emit('checklist-updated');
  res.json({ success: true });
});

app.delete('/api/checklists/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  // only admin/creator or creator of checklist can delete
  const checklist = await db.get(`SELECT * FROM checklists WHERE id = ?`, [id]);
  if (!checklist) return res.status(404).json({ error: 'not found' });
  if (!(req.session.role === 'admin' || req.session.role === 'creator' || req.session.userId === checklist.created_by)) return res.status(403).json({ error: 'forbidden' });
  await db.run(`DELETE FROM checklists WHERE id = ?`, [id]);
  io.emit('checklist-updated');
  res.json({ success: true });
});

// Get list of all users (for private messages)
app.get('/api/users', requireAuth, async (req, res) => {
  const users = await db.all('SELECT id, username, role FROM users WHERE id != ?', [req.session.userId]);
  res.json(users);
});

// Private Messages endpoints
app.get('/api/messages/:userId', requireAuth, async (req, res) => {
  const otherUserId = parseInt(req.params.userId);
  const currentUserId = req.session.userId;
  
  // Get all messages between current user and the other user
  const messages = await db.all(`
    SELECT pm.*, 
           sender.username as sender_username,
           receiver.username as receiver_username
    FROM private_messages pm
    JOIN users sender ON pm.sender_id = sender.id
    JOIN users receiver ON pm.receiver_id = receiver.id
    WHERE (pm.sender_id = ? AND pm.receiver_id = ?) 
       OR (pm.sender_id = ? AND pm.receiver_id = ?)
    ORDER BY pm.timestamp ASC
  `, [currentUserId, otherUserId, otherUserId, currentUserId]);
  
  // Mark messages as read
  await db.run(`
    UPDATE private_messages 
    SET read = 1 
    WHERE receiver_id = ? AND sender_id = ? AND read = 0
  `, [currentUserId, otherUserId]);
  
  res.json(messages);
});

app.post('/api/messages/:userId', requireAuth, async (req, res) => {
  const receiverId = parseInt(req.params.userId);
  const senderId = req.session.userId;
  const { text } = req.body;
  
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }
  
  const timestamp = Date.now();
  const result = await db.run(`
    INSERT INTO private_messages (sender_id, receiver_id, text, timestamp)
    VALUES (?, ?, ?, ?)
  `, [senderId, receiverId, text.slice(0, 500), timestamp]);
  
  const message = await db.get(`
    SELECT pm.*, 
           sender.username as sender_username,
           receiver.username as receiver_username
    FROM private_messages pm
    JOIN users sender ON pm.sender_id = sender.id
    JOIN users receiver ON pm.receiver_id = receiver.id
    WHERE pm.id = ?
  `, [result.lastID]);
  
  // Emit to both users via socket
  io.of('/messages').emit('new_message', message);
  
  res.json(message);
});

// Profile endpoints
app.get('/api/profile', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  
  // Get or create profile
  let profile = await db.get('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
  
  if (!profile) {
    // Create default profile
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    const createdAt = Date.now();
    await db.run(`
      INSERT INTO user_profiles (user_id, display_name, bio, avatar_color, created_at)
      VALUES (?, ?, '', '#c7d2fe', ?)
    `, [userId, user.username, createdAt]);
    profile = await db.get('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
  }
  
  // Get message count
  const messageCount = await db.get(`
    SELECT COUNT(*) as count 
    FROM messages 
    WHERE user_id = ?
  `, [userId]);
  
  profile.message_count = messageCount.count;
  
  res.json(profile);
});

app.post('/api/profile', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { display_name, bio, avatar_color, is_public, show_stats } = req.body;
  
  // Check if profile exists
  const existing = await db.get('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
  
  if (existing) {
    // Update existing profile
    await db.run(`
      UPDATE user_profiles 
      SET display_name = ?, bio = ?, avatar_color = ?, is_public = ?, show_stats = ?
      WHERE user_id = ?
    `, [display_name, bio || '', avatar_color || '#c7d2fe', is_public ? 1 : 0, show_stats ? 1 : 0, userId]);
  } else {
    // Create new profile
    const createdAt = Date.now();
    await db.run(`
      INSERT INTO user_profiles (user_id, display_name, bio, avatar_color, is_public, show_stats, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [userId, display_name, bio || '', avatar_color || '#c7d2fe', is_public ? 1 : 0, show_stats ? 1 : 0, createdAt]);
  }
  
  res.json({ success: true });
});

app.get('/api/profile/:userId', requireAuth, async (req, res) => {
  const userId = parseInt(req.params.userId);
  
  const profile = await db.get('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
  
  if (!profile || !profile.is_public) {
    return res.status(404).json({ error: 'Profile not found or private' });
  }
  
  const user = await db.get('SELECT username, role FROM users WHERE id = ?', [userId]);
  
  // Get message count if stats are shown
  let messageCount = 0;
  if (profile.show_stats) {
    const count = await db.get('SELECT COUNT(*) as count FROM messages WHERE user_id = ?', [userId]);
    messageCount = count.count;
  }
  
  res.json({
    ...profile,
    username: user.username,
    role: user.role,
    message_count: messageCount
  });
});

// user management endpoints
app.post('/api/user/delete', requireAuth, async (req, res) => {
  const { userId } = req.body;
  // admin/creator can delete any; users can delete self
  if (req.session.userId !== Number(userId) && !(req.session.role === 'admin' || req.session.role === 'creator')) return res.status(403).json({ error: 'forbidden' });
  await db.run(`DELETE FROM users WHERE id = ?`, [userId]);
  res.json({ success: true });
});

app.post('/api/user/change-password', requireAuth, async (req, res) => {
  const { userId, newPassword } = req.body;
  if (req.session.userId !== Number(userId) && !(req.session.role === 'admin' || req.session.role === 'creator')) return res.status(403).json({ error: 'forbidden' });
  const hash = await bcrypt.hash(newPassword, 10);
  await db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, userId]);
  res.json({ success: true });
});

// Serve app
app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, username: req.session.username, role: req.session.role, userId: req.session.userId });
});

// Private messages socket namespace
io.of('/messages').on('connection', async (socket) => {
  // No initial data needed, messages are loaded via API
});

// Chat sockets
io.of('/public').on('connection', async (socket) => {
  // on connect send last 500 messages only younger than 24h
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const rows = await db.all(`SELECT * FROM messages WHERE chat_type = 'public' AND timestamp >= ? ORDER BY timestamp ASC LIMIT 500`, [cutoff]);
  socket.emit('init', rows);
  socket.on('send', async (msg) => {
    if (!msg || !msg.text) return;
    const text = String(msg.text).slice(0, 300);
    const username = msg.username || 'Anonymous';
    const ts = Date.now();
    const r = await db.run(`INSERT INTO messages (user_id, username, text, timestamp, chat_type) VALUES (?, ?, ?, ?, 'public')`, [msg.userId || null, username, text, ts]);
    const saved = await db.get(`SELECT * FROM messages WHERE id = ?`, [r.lastID]);
    io.of('/public').emit('message', saved);
  });
});

// admin chat namespace
io.of('/admin').on('connection', async (socket) => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const rows = await db.all(`SELECT * FROM messages WHERE chat_type = 'admin' AND timestamp >= ? ORDER BY timestamp ASC LIMIT 500`, [cutoff]);
  socket.emit('init', rows);
  socket.on('send', async (msg) => {
    if (!msg || !msg.text) return;
    const text = String(msg.text).slice(0, 300);
    const username = msg.username || 'Admin';
    const ts = Date.now();
    const r = await db.run(`INSERT INTO messages (user_id, username, text, timestamp, chat_type) VALUES (?, ?, ?, ?, 'admin')`, [msg.userId || null, username, text, ts]);
    const saved = await db.get(`SELECT * FROM messages WHERE id = ?`, [r.lastID]);
    io.of('/admin').emit('message', saved);
  });
});

// periodic cleanup: every hour purge messages older than 24h
setInterval(async () => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  await db.run(`DELETE FROM messages WHERE timestamp < ?`, [cutoff]);
}, 60 * 60 * 1000);

(async () => {
  await initDb();
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
})();
