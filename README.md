# Club Site (local)

Simple local site for club features: chat, checklists, advertising lounge, admin/creator roles.

Quick start (Windows PowerShell):

```powershell
cd "c:\Users\Eleve\Desktop\hacker space official"
npm install
npm start
```

Run locally and open http://localhost:3001 (server defaults to port 3001).

GitHub Pages note: This repository contains a Node/Express server with Socket.IO. GitHub Pages can only host static files — it cannot run the server-side code. To publish the static frontend on GitHub Pages (UI only), this project now includes a GitHub Actions workflow that will publish the contents of the `public/` folder to the `gh-pages` branch on pushes to `main`.

Important: The GitHub Pages deployment will host only the static frontend (HTML/CSS/JS). Dynamic features that require the Node server (chat, real-time Socket.IO, user registration/login, announcements, and the database) will not function on GitHub Pages. To run the full app with those features you must host the Node server on a platform that supports Node (Render, Railway, Heroku, a VPS, etc.) and point the frontend to that server.

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
 - Frontend can be improved with routing, better admin UI, and dedicated admin page.

GitHub Pages usage:

 - Push your code to the `main` branch on GitHub. The workflow `.github/workflows/deploy-pages.yml` will publish `public/` to Pages automatically.
 - After the workflow completes, your static frontend will be available at `https://<your-username>.github.io/<repo-name>/`.

If you want, I can also:
 - Prepare a small guide and GitHub Actions workflow to automatically deploy the full Node app to a service like Render or Railway (requires you to connect the repo and provide an API key or allow the service access).
 - Modify the frontend to point at a remote server URL (if you already have a server hosted elsewhere).
	- Prepare a small guide and GitHub Actions workflow to automatically build and publish a Docker image of the app to GitHub Container Registry (GHCR) and instructions to deploy that image to Render/Railway.
	- Modify the frontend to point at a remote server URL (if you already have a server hosted elsewhere).

Full-app deployment via Docker (optional automatic image publish)

- This repo includes a `Dockerfile` and a GitHub Actions workflow `.github/workflows/docker-publish.yml` that builds and pushes a container image to GitHub Container Registry (GHCR) on pushes to `main`.
- After the workflow runs you will have an image at `ghcr.io/<your-username>/<repo-name>:latest` which can be deployed to Render, Railway, Fly, or any container host.

Quick Render steps (example):

1. Sign up / log in to Render and create a new "Web Service".
2. Choose "Private Service" and either connect your GitHub repo directly (Render will build from the repo) or choose "Docker" and point Render to the GHCR image `ghcr.io/<your-username>/<repo-name>:latest`.
3. If deploying from the repo, set the build command to `npm install && npm run build` (if you added a build step) and the start command to `node server.js`. Ensure Render's `PORT` env var is set (Render provides one automatically).
4. If using the GHCR image, set the startup command to `node server.js` and set the environment variable `PORT` to `3001` (or leave Render's default).
5. After deployment, you'll get a public URL. Set the static frontend's `window.API_BASE` (in `public/js/config.js` or by creating a small inline script in the Pages site) to that URL so the Pages frontend connects to the running backend.

If you want, I can:
- Commit the `Dockerfile` and GHCR workflow (already added) and then help you run the first push and monitor the Actions run.
- Walk you through connecting Render to the repo or configuring it to pull the GHCR image.
