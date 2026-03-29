# Harmeet Landscaping Website

Production-oriented site with a **public lead form**, **sticky “Get free quote” modal**, and a **password-protected admin** where you edit copy in **plain text** (the server turns it into safe HTML) and upload **before/after gallery** images.

## Features

- Landing page loads content from `GET /api/content` (stored in `data/site-content.json`, seeded from `data/default-site-content.json`).
- Sticky **Get free quote** button opens a modal with the quote form (`POST /api/leads`). Submissions are appended to **`data/leads.jsonl`**, and you can optionally receive **email copies** (see below).
- **Admin UI** at **`/admin`** (same site as the homepage — not a separate project). Login, plain-text fields with a **jump-to** sidebar, image uploads to `public/uploads/`, save to server. Bookmark `/admin`; it is not shown in the main navigation.
- **Before/after gallery**: reorder, delete, add projects; both images required per project on save (upload in admin — no pasted URLs); **visible count** controls how many pairs show before a **View more** control on the public site. **Testimonials** support an optional photo upload.
- Sessions via `express-session`; password via bcrypt (`ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`).

## Setup

1. Install Node.js 18+.
2. Copy environment file and edit secrets:

   ```bash
   cp .env.example .env
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Run:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) and the admin screen at [http://localhost:3000/admin](http://localhost:3000/admin).

### Admin password

- **Development:** set `ADMIN_PASSWORD` in `.env`. The server hashes it on startup for login checks (no stale `admin.hash` file required). Log in at `/admin`.
- **Production:** prefer `ADMIN_PASSWORD_HASH` (bcrypt) instead of a plain `ADMIN_PASSWORD`:

  ```bash
  npm run hash-password -- "your-strong-password"
  ```

  Paste the output into `.env` as `ADMIN_PASSWORD_HASH=...`.

Also set a strong `SESSION_SECRET` in production.

### Quote email notifications (optional)

To get an email whenever someone submits the quote form, add to `.env`:

| Variable | Purpose |
|----------|---------|
| `LEAD_EMAIL_TO` | Your address (comma-separated for several inboxes) |
| `SMTP_HOST` | e.g. `smtp.gmail.com`, your host’s SMTP, SendGrid, etc. |
| `SMTP_PORT` | Usually `587` (STARTTLS) or `465` (SSL) |
| `SMTP_USER` / `SMTP_PASS` | SMTP login (Gmail needs an [App Password](https://support.google.com/accounts/answer/185833), not your normal password) |
| `SMTP_SECURE` | Set `true` only if you use port **465** |
| `LEAD_EMAIL_FROM` | Optional “From” header (defaults to `Harmeet Landscaping <SMTP_USER>`) |
| `LEAD_EMAIL_DISABLED` | Set `true` to keep saving leads but skip sending mail |
| `SMTP_VERIFY_ON_START` | Set `true` to log SMTP login test when the server starts |

If `LEAD_EMAIL_TO` or SMTP is not set, leads are still saved to disk; the server logs `Lead email: disabled` at startup.

**If you do not receive emails:**

1. **Use `.env` in the project folder** — not only `.env.example`. Restart the server after any change (`npm run dev`).
2. **Run** `npm run test:smtp` — it checks the SMTP connection and sends one test message to `LEAD_EMAIL_TO`. If this fails, fix credentials before testing the form again.
3. **Gmail:** create an [App Password](https://support.google.com/accounts/answer/185833) (2-Step Verification must be on). Use `SMTP_PORT=587`, `SMTP_SECURE=false`.
4. **Production (e.g. Render):** add the same variables in the host’s **Environment** tab; they are not copied from your laptop automatically.
5. **Spam folder** — new senders often land in Promotions/Spam.

After each form submit, the server log will show either `[Lead email] Sent OK` or a clear reason (e.g. not configured, or SMTP error details).

## Project layout

```text
landscaping-leads-site/
├─ data/
│  ├─ default-site-content.json   # seed content (edit to change first-run defaults)
│  └─ site-content.json           # live content (created on first run, gitignored)
├─ lib/
│  ├─ content.js
│  └─ leadEmail.js
├─ public/
│  ├─ index.html
│  ├─ app.js
│  ├─ styles.css
│  ├─ admin.html                  # redirects to /admin
│  ├─ admin.js
│  ├─ admin.css
│  └─ uploads/                    # gallery uploads (gitignored except .gitkeep)
├─ scripts/
│  ├─ hash-password.js
│  └─ test-smtp.js
├─ server.js
└─ package.json
```

## API (summary)

| Endpoint | Description |
|----------|-------------|
| `GET /api/content` | Public site JSON |
| `POST /api/leads` | Quote form submission |
| `POST /api/admin/login` | Admin login (JSON `{ "password": "..." }`) |
| `POST /api/admin/logout` | Logout |
| `GET /api/admin/me` | `{ "admin": true/false }` |
| `GET /api/admin/content` | Full content (requires admin session) |
| `PUT /api/admin/content` | Save content (requires admin) |
| `POST /api/admin/upload` | Multipart `file` field (requires admin) |

## Troubleshooting (“nothing changed”)

1. **Run the real server** — Open `http://localhost:3000` (or your `PORT`) after `npm run dev`. Opening `index.html` as a file or from another static host will **not** load `/api/content`, so the page will look stuck or broken.
2. **Hard refresh** — `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows) so the browser loads the latest `app.js` / `admin.js`.
3. **Restart** the dev server after pulling changes.
4. **Admin URL** — Use **`http://localhost:3000/admin`** (not only `admin.html`). The homepage does not show every new admin feature; gallery tools appear under **Before & after gallery** after login.

## Production deploy on Render

This app runs as a **Node web service** (not static hosting). **[Render](https://render.com)** has a free tier and gives you a real `https://…onrender.com` URL.

**What you need:** a [GitHub](https://github.com) account and a [Render](https://render.com) account (sign in with GitHub).

### 1. Push this code to GitHub

From the project folder:

```bash
git init
git add -A
git commit -m "Initial commit"
```

On GitHub, create a **new empty repository** (no README/license — you already have files). Then connect and push (replace the URL with yours):

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

`.gitignore` keeps `.env`, local uploads, and `data/site-content.json` out of the repo; production will **seed** `site-content.json` from `data/default-site-content.json` on first run.

### 2. Create the web service on Render

1. In Render: **New → Web Service** → connect the GitHub repo you just pushed.
2. **Name:** anything (e.g. `harmeet-landscaping`).
3. **Region:** choose one close to you.
4. **Branch:** `main`.
5. **Runtime:** Node.
6. **Build command:** `npm install`
7. **Start command:** `npm start`
8. **Instance type:** Free (or paid if you prefer).
9. **Health check path:** `/api/health`

### 3. Environment variables (required)

Open **Environment** and add:

| Variable | Example / notes |
|----------|------------------|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | Long random string (e.g. 40+ characters). |
| `ADMIN_PASSWORD` | Password you will use to log in at **`/admin`**. |

Alternatively you can set **`ADMIN_PASSWORD_HASH`** (from `npm run hash-password -- "your-password"`) instead of `ADMIN_PASSWORD`.

**Quote emails:** add the same **`LEAD_EMAIL_TO`** and **`SMTP_*`** variables you use locally so new leads are emailed in production.

If you use the included **`render.yaml`** (Blueprint) instead of a manual Web Service, Render can generate `SESSION_SECRET` for you — you must still add **`ADMIN_PASSWORD`** (or hash) in the dashboard after deploy.

### 4. Deploy and test

Click **Create Web Service**. When the build finishes, open the **HTTPS URL** Render shows (for example `https://harmeet-landscaping.onrender.com`). Visit the homepage, then **`/admin`**, and sign in with the password you set.

**Note:** On the **free** tier the service **spins down after idle**; the first request after sleep can take ~30–60 seconds. Paid plans stay warm.

## Share a link for testers

### Option A — Instant URL from your laptop (good for a quick demo)

1. In one terminal: `npm run dev` (or `npm start`).
2. In another terminal: `npm run share`.

The second command prints a public `https://…loca.lt` (or similar) URL you can send. Anyone hitting it reaches your machine, so **keep the dev server running** and **do not use this for real passwords** you care about.

If the tunnel shows a one-time “Click to continue” page, that is normal for Localtunnel.

### Why not Netlify for this project?

**[Netlify](https://www.netlify.com)** is built for **static sites** and **short-lived serverless functions**. This app is a **long-running Node (Express) server** with **sessions**, **file uploads to disk**, and **JSON files** under `data/`. Running it “on Netlify” would mean rewriting the backend (storage, auth, uploads) for serverless — it is not a drop-in fit.

Use a **Node-friendly host** (below). You still get a **free HTTPS URL** to share now, and you can **attach your own domain** later from any registrar (Namecheap, Google Domains, Cloudflare, etc.) — you do **not** need Netlify for that.

### Option B — Persistent URL (same as production)

Follow **[Production deploy on Render](#production-deploy-on-render)** above. That is the right way to get a stable public URL.

**Blueprint:** You can also use **New → Blueprint** in Render and select this repo so it reads **`render.yaml`**, then add **`ADMIN_PASSWORD`** in the service environment after deploy.

**Alternatives:** [Railway](https://railway.app), [Fly.io](https://fly.io), or any VPS — same `npm install` / `npm start` idea. **Docker:** use the included `Dockerfile` where supported.

### Custom domain later (works with Render)

When you buy a domain (any registrar):

1. In the Render dashboard, open your **Web Service → Settings → Custom Domains**, and add your domain (e.g. `www.harmeetlandscaping.com`). Render shows the **DNS records** you need (usually a **CNAME** for `www` and sometimes an **A** or **ALIAS** for the apex).
2. At your domain registrar (or **Cloudflare** if you use them for DNS), create those records exactly as Render specifies.
3. Wait for DNS to propagate; Render provisions **HTTPS** (Let’s Encrypt) automatically.

Your public site and **`/admin`** stay on the **same hostname**, so **cookies and uploads keep working** — which is why hosting the whole app on one service like Render is simpler than splitting the front end onto Netlify and the API somewhere else.

### Deployment notes

- Use HTTPS in production so session cookies stay secure (`secure` cookie is enabled when `NODE_ENV=production`).
- Behind a reverse proxy, `trust proxy` is set to `1` in `server.js`.
- On free PaaS tiers, **disk is often ephemeral**: content and uploads may reset if the instance restarts. For a serious site, add a persistent disk or external storage and back up `data/site-content.json` and `public/uploads/`.
