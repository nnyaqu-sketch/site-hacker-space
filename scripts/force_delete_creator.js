const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const DB_PATH = path.join(__dirname, '..', 'club.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) return console.error('Failed to open DB', err);
});

db.serialize(() => {
  // Delete all creators
  db.run('DELETE FROM users WHERE username = "creator"', function(err) {
    if (err) {
      console.error('Delete error', err);
    } else {
      console.log('Deleted', this.changes, 'creator records');
    }
    
    // Show remaining users
    db.all('SELECT id, username, role FROM users', (e, rows) => {
      if (e) console.error('Query error', e);
      else {
        console.log('Remaining users:');
        rows.forEach(r => console.log(`  ${r.id}: ${r.username} (${r.role})`));
      }
      db.close();
    });
  });
});
