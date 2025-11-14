# Club Site (local)

Simple local site for club features: chat, checklists, advertising lounge, admin/creator roles.

Quick start (Windows PowerShell):

```powershell
cd "c:\Users\Eleve\Desktop\hacker space official"
npm install
npm start
```

Open http://localhost:3000

Default creator account (change immediately):
- username: creator
- password: creatorpass

Features implemented:
- Public chat: saved to SQLite, timestamped, messages older than 24h are automatically removed hourly; messages limited to 300 chars (server and client). Real-time via Socket.IO.
- Admin chat (separate namespace) implemented on server and accessible via /admin namespace for admin/creator clients.
- Checklists with items, sub-items supported via parent_id column. Changes broadcast to clients.
- Announcements saved by admins and broadcast.
- One-time codes: admins/creator can create one-time registration codes using POST /api/create-code with { role }.
- Manual purge endpoint: POST /api/purge-chat (admin/creator) to immediately clear old messages.
- Account management: register (requires a code), login, logout, delete user (admin or user him/herself), change password.

Notes & next steps:
- This is a minimal demo scaffold. For production you should: use HTTPS, secure session store, input validation, rate-limiting, CSRF protections, and stronger password policies.
- Frontend can be improved with routing, better admin UI, and dedicated admin page.
