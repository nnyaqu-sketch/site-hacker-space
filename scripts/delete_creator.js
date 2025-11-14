const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const DB_PATH = path.join(__dirname, '..', 'club.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) return console.error('Failed to open DB', err);
});

db.serialize(() => {
  db.get("SELECT id FROM users WHERE username = 'creator'", (err, row) => {
    if (err) {
      console.error('Query error', err);
      db.close();
      process.exit(1);
    }
    if (!row) {
      console.log('creator not found');
      db.close();
      return;
    }

    const id = row.id;
    db.run('DELETE FROM users WHERE id = ?', [id], function(deleteErr) {
      if (deleteErr) {
        console.error('Delete error', deleteErr);
      } else {
        console.log('deleted creator id', id, 'changes', this.changes);
      }

      db.get("SELECT id, username, role FROM users WHERE username = 'creator'", (e2, row2) => {
        if (e2) console.error('Verify error', e2);
        else console.log(row2 ? JSON.stringify(row2) : 'creator not present');
        db.close();
      });
    });
  });
});
