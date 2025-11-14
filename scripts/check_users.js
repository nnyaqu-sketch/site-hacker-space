const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const DB_PATH = path.join(__dirname, '..', 'club.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) return console.error('Failed to open DB', err);
});

db.serialize(() => {
  db.all("SELECT id, username, role FROM users ORDER BY username", (err, rows) => {
    if (err) {
      console.error('Query error', err);
    } else {
      console.log('All users:');
      rows.forEach(row => console.log(`  ${row.id}: ${row.username} (${row.role})`));
      
      const bastian = rows.find(r => r.username === 'bastian');
      if (bastian) {
        console.log('\nBastian account found with role:', bastian.role);
        console.log('NOTE: Passwords are hashed and cannot be retrieved. You must reset the password using the application or a password reset endpoint.');
      } else {
        console.log('\nBastian account NOT found');
      }
    }
    db.close();
  });
});
