<p align="center">
  <img src="public/logo.png" alt="Content-Vault Logo" width="128" />
</p>

<h1 align="center">Content-Vault</h1>
<p align="center"><strong>Path-based access control and server-side proxy for iFrame-embedded learning content and PDFs.</strong></p>

<p align="center">
  <a href="README.md">🇬🇧 English</a> · <a href="LIESMICH.md">🇩🇪 Deutsch</a>
</p>

---

## Overview

**Content-Vault** is a full-stack application for path-based access control of iFrame-embedded learning materials and PDF documents. Administrators create user access links with optional view limits (`max_views`), expiration dates (`expires_at`), custom Open Graph previews, and per-path route mappings. End users open their personalized URL (e.g., `https://lerninhalt.domain.de/max` or `https://lerninhalt.domain.de/max/training/schulung1`).

Actual upstream target URLs are **never** exposed to the client browser. Every navigation triggers server-side validation, and content is delivered through the backend proxy endpoint.

```text
┌─────────────────────┐    REST     ┌──────────────────┐     ┌────────────┐
│   React Frontend    │ ─────────── │   Express API    │ ──── │ PostgreSQL │
│   (React + Vite)    │ api.domain  │   (Node.js)      │     │            │
└─────────────────────┘             └──────────────────┘     └────────────┘
         ▲
         │ Caddy Reverse Proxy
         │
   ┌─────┴────────────────────────────────┐
   │ admin.domain.de       → Admin Panel  │
   │ lerninhalt.domain.de  → Content View │
   │ api.domain.de         → Express API  │
   └──────────────────────────────────────┘
```

**Path-Based URL Structure:**
- `lerninhalt.domain.de/max` → Default landing content for user `max` (path `/`)
- `lerninhalt.domain.de/max/training/schulung1` → Specific training route (`/training/schulung1`)
- `lerninhalt.domain.de/` (without a username segment) → Blocked (`BlockedPage`)

---

## Features

- **Path-Based User Access Links**: Per-user URLs (`/<username>` and `/<username>/<subpath>`) with configurable `label`, `target_url_base`, `max_views`, `expires_at`, and `is_active` toggle.
- **Hidden Upstream URLs via Server-Side Proxy**: `POST /api/validate` returns a proxied `/api/proxy/:username/...` URL rather than the real upstream URL. HTML responses have upstream origins and root-relative links (`src`, `href`, `action`) rewritten through the proxy; PDFs and binary files are streamed inline.
- **Per-User Content Routes**: Map specific subpaths (e.g., `/training/schulung1`) to distinct target URLs, or fall back automatically to `target_url_base + path`.
- **Atomic View Counting & Access Logging**: Every validation atomically increments `views_count` and records `link_id`, `path`, `ip_address`, and `accessed_at` in `access_logs`.
- **Subdomain-Driven Frontend Modes**: Automatically switches between Admin Panel (`admin.*` or `?mode=admin`) and Content Viewer (`lerninhalt.*` / `localhost`).
- **Admin Dashboard**: Password-protected JWT login (`sessionStorage`), user link CRUD, view-counter reset, route management, access log viewer, and status badges (`Aktiv`, `Deaktiviert`, `Abgelaufen`, `Limit erreicht`).
- **Social Media & Messenger Crawler SSR**: Dedicated Express middleware detects crawlers (WhatsApp, Facebook, Twitter/X, LinkedIn, Slack, Telegram, Discord, Googlebot, etc.) and serves Open Graph & Twitter Card metadata (`og_title`, `og_description`, `og_image`) without counting a view or leaking inactive/unknown links.
- **Dedicated PDF & Blocked Views**: Built-in PDF toolbar (*Open in new tab* / *Download*) for `.pdf` targets and a themed `BlockedPage` displaying specific error states (`expired`, `limit_reached`, `inactive`, `not_found`, `no_user`).
- **Dynamic Tab Title & Favicon**: Content Viewer sets `document.title` to the resolved label and updates the browser favicon via Google's S2 favicon service.

---

## How It Works & Tech Stack

### Request & Validation Flow

1. A visitor opens `https://lerninhalt.domain.de/max/training/schulung1`.
2. **Crawler requests** (`GET` from recognized bots on non-API, non-static paths) are intercepted by the Express crawler SSR middleware, which queries `access_links` by `username` (case-insensitive) and returns an HTML document with Open Graph / Twitter meta tags (`Cache-Control: public, max-age=300`) without incrementing `views_count`.
3. **Browser requests** load the React SPA. `getAppMode()` inspects `window.location.hostname` (and `?mode=admin`).
4. `ContentViewer` extracts `username` (`max`) and `contentPath` (`/training/schulung1`) and calls `POST /api/validate`.
5. The Express backend validates `is_active`, `expires_at`, and `views_count < max_views`, increments `views_count`, resolves the target URL from `content_routes` or `target_url_base`, writes an entry to `access_logs`, and responds with `{ target_url: "<API_BASE>/api/proxy/...", label }`.
6. The Content Viewer loads the returned proxy URL inside a full-viewport `<iframe>` (with a PDF action bar if the URL ends in `.pdf`).

### Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript, Vite, React Router DOM, TanStack React Query, Tailwind CSS, shadcn/ui (Radix UI), Lucide React |
| **Backend API** | Node.js (v22 in Docker, ≥ 18 local), Express 4, `pg` (node-postgres), `jsonwebtoken`, `cors`, `dotenv` |
| **Database** | PostgreSQL (≥ 13) with `uuid-ossp` extension |
| **Containers & Proxy** | Docker (multi-stage Node + Nginx 1.x Alpine for frontend), Caddy (≥ 2) reverse proxy with automatic HTTPS |

### Ports

| Component | Default Port | Notes |
|-----------|-------------|-------|
| **Backend Express API** | `3001` | Configurable via `PORT` environment variable |
| **Frontend Nginx Container** | `80` | Serves built `dist/` with SPA fallback (`nginx.conf`) |
| **Vite Dev Server** | `5173` (default) | Local development (`npm run dev`) |

---

## Prerequisites & Installation

### Prerequisites

- **Node.js** ≥ 18 (Dockerfiles use `node:22-alpine`)
- **PostgreSQL** ≥ 13
- **Caddy** ≥ 2 (or another reverse proxy with TLS)
- **Domain** with 3 DNS A-records: `admin.<domain>`, `lerninhalt.<domain>`, `api.<domain>`

### 1. Clone the Repository

```bash
git clone https://github.com/orfelorfel23/Content-Vault.git
cd Content-Vault
```

### 2. PostgreSQL Database Setup

Create the database and user, then apply `backend/schema.sql`:

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE content_vault;
CREATE USER content_vault WITH ENCRYPTED PASSWORD 'SECRET';
GRANT ALL PRIVILEGES ON DATABASE content_vault TO content_vault;
\q
```

```bash
psql -U content_vault -d content_vault -f backend/schema.sql
```

> **Note:** On startup, `backend/index.js` also runs an idempotent schema initialization (`CREATE TABLE IF NOT EXISTS ...` and `ALTER TABLE access_links ADD COLUMN IF NOT EXISTS og_title / og_description / og_image`).

**Tables:**
- `access_links` – one row per user (`id`, `username`, `label`, `target_url_base`, `max_views`, `expires_at`, `views_count`, `is_active`, `created_at`, `og_title`, `og_description`, `og_image`)
- `content_routes` – subpath mappings per `link_id` (`path` → `target_url`, optional `label`)
- `access_logs` – validation audit log (`link_id`, `path`, `ip_address`, `accessed_at`)

### 3. Local Backend Setup

```bash
cd backend
npm install
# Create .env (see Configuration section)
node index.js
```

### 4. Local Frontend Setup

From the repository root:

```bash
npm install
# Build for production (with VITE_API_URL) or start dev server:
npm run dev
npm run build
```

### 5. Docker Build

**Frontend image** (serves static `dist/` via Nginx on port `80`):

```bash
docker build --build-arg VITE_API_URL=https://api.domain.de -t content-vault-frontend .
docker run -d -p 8080:80 content-vault-frontend
```

**Backend image** (runs `node index.js` on port `3001`):

```bash
docker build -t content-vault-backend ./backend
docker run -d -p 3001:3001 --env-file ./backend/.env content-vault-backend
```

### 6. Caddy Reverse Proxy Example

Example `/etc/caddy/Caddyfile`:

```caddy
# Admin Panel (same static app; mode detected by hostname)
admin.domain.de {
    root * /var/www/content-vault/dist
    try_files {path} /index.html
    file_server
    encode gzip
}

# Content Viewer
lerninhalt.domain.de {
    root * /var/www/content-vault/dist
    try_files {path} /index.html
    file_server
    encode gzip
}

# Express API
api.domain.de {
    reverse_proxy localhost:3001
    encode gzip
}
```

Reload Caddy with `sudo systemctl reload caddy` to automatically provision Let's Encrypt certificates.

---

## Configuration

### Backend Environment Variables (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Port on which Express listens |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (e.g., `postgres://content_vault:SECRET@localhost:5432/content_vault`) |
| `ADMIN_PASSWORD` | Recommended | `admin` | Password checked on `POST /api/admin/login` |
| `JWT_SECRET` | Recommended | `secret` | Secret key used to sign/verify admin JWTs (1-day expiry) |
| `CORS_ORIGIN` | Recommended | `*` | Comma-separated allowed origins (e.g., `https://admin.domain.de,https://lerninhalt.domain.de`) |
| `VITE_API_URL` / `API_BASE_URL` | Recommended | `https://api.cbrn.orfel.de` | Public base URL of the API used to construct `/api/proxy/...` URLs |

### Frontend Build / Runtime Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3001` (dev) / `https://api.cbrn.orfel.de` (Dockerfile ARG) | Base URL of the Express API baked into the Vite bundle at build time |

---

## Usage

### First Steps After Deployment

1. Open `https://admin.domain.de` (or append `?mode=admin` in local/preview environments) and log in with `ADMIN_PASSWORD`.
2. **Create a user**: Set `username` (e.g., `max`), `label`, `target_url_base`, optional `max_views`, optional `expires_at`, and optional Open Graph preview metadata (`og_title`, `og_description`, `og_image`).
3. **Add routes**: Select a user and add specific path mappings (e.g., `/training/schulung1` → target URL). If no route matches, `target_url_base + path` is used.
4. **Share links**: Send `https://lerninhalt.domain.de/max` or `https://lerninhalt.domain.de/max/training/schulung1` to the recipient.
5. **Monitor**: Toggle active status, reset `views_count`, or inspect IP/timestamp entries in the **Zugriffslogs** tab.

### API Endpoints

Admin endpoints require `Authorization: Bearer <token>`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/admin/login` | Public | Verify `ADMIN_PASSWORD` and return JWT (`expiresIn: '1d'`) |
| `GET` | `/api/admin/links` | JWT | List all `access_links` ordered by `created_at DESC` |
| `POST` | `/api/admin/links` | JWT | Create a new user access link |
| `PUT` | `/api/admin/links/:id` | JWT | Update link fields (including resetting `views_count`) |
| `DELETE` | `/api/admin/links/:id` | JWT | Delete an access link (cascades routes & logs) |
| `GET` | `/api/admin/links/:id/routes` | JWT | List `content_routes` for a link |
| `POST` | `/api/admin/links/:id/routes` | JWT | Create a `content_routes` entry |
| `DELETE` | `/api/admin/routes/:routeId` | JWT | Delete a `content_routes` entry |
| `GET` | `/api/admin/links/:id/logs` | JWT | List `access_logs` for a link ordered by `accessed_at DESC` |
| `POST` | `/api/validate` | Public | Validate `{ username, path }`, increment `views_count`, log IP, and return `{ target_url, label }` (proxy URL) |
| `GET` | `/api/proxy/:username/*` | Public | Validate without consuming a view and proxy HTML/PDF/binary content |

### Troubleshooting

- **Login fails**: Verify `VITE_API_URL`, check API reachability (`curl https://api.domain.de/api/admin/login`), and verify `CORS_ORIGIN`.
- **"Kein Zugang" despite valid user**: Check `is_active = true`, `expires_at` in the future, and `views_count < max_views`.
- **iFrame remains empty**: The upstream target site may block embedding via `X-Frame-Options` or `CSP frame-ancestors` (note: proxying through `/api/proxy/...` serves content from your API origin).
- **Admin Panel in preview/dev**: Append `?mode=admin` to the URL.

---

## Project Structure

```text
Content-Vault/
├── backend/
│   ├── Dockerfile          # Node 22 Alpine container exposing port 3001
│   ├── index.js            # Express API, proxy, crawler SSR & DB init
│   ├── package.json        # Backend dependencies (express, pg, jwt, cors, dotenv)
│   └── schema.sql          # PostgreSQL schema (access_links, content_routes, access_logs)
├── public/
│   ├── logo.png            # Project logo
│   └── ...                 # Static assets (favicon.ico, robots.txt, placeholder.svg)
├── src/
│   ├── components/ui/      # shadcn/ui components
│   ├── hooks/              # Custom React hooks (use-mobile, use-toast)
│   ├── lib/
│   │   ├── api.ts          # REST client & proxy URL helper
│   │   ├── subdomain.ts    # Mode detection & URL path parsing
│   │   └── utils.ts        # Utility helpers
│   ├── pages/
│   │   ├── AdminLogin.tsx  # Admin password login screen
│   │   ├── AdminPanel.tsx  # Link, route, and access-log management UI
│   │   ├── BlockedPage.tsx # Access denied / expired / limit-reached screen
│   │   ├── ContentViewer.tsx # Validation + iFrame/PDF viewer + dynamic favicon
│   │   ├── Index.tsx       # Mode router (admin vs. content)
│   │   └── NotFound.tsx    # Fallback route
│   └── App.tsx             # React Router & React Query setup
├── Dockerfile              # Multi-stage frontend build (Vite -> Nginx Alpine)
├── nginx.conf              # Nginx SPA fallback & static asset caching
├── package.json            # Frontend scripts & dependencies
└── vite.config.ts          # Vite configuration
```

---

## License

This project's own code and configuration are dedicated to the public domain under **CC0 1.0 Universal** — see [`LICENSE`](LICENSE).

External dependencies installed via package managers or Docker images retain their respective open-source licenses.
