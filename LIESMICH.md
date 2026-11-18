<p align="center">
  <img src="public/logo.png" alt="Content-Vault Logo" width="128" />
</p>

<h1 align="center">Content-Vault</h1>
<p align="center"><strong>Pfadbasierte Zugriffskontrolle und serverseitiger Proxy für iFrame-eingebettete Lerninhalte und PDFs.</strong></p>

<p align="center">
  <a href="README.md">🇬🇧 English</a> · <a href="LIESMICH.md">🇩🇪 Deutsch</a>
</p>

---

## Überblick

**Content-Vault** ist eine Full-Stack-Anwendung zur pfadbasierten Zugriffskontrolle für iFrame-eingebettete Lerninhalte und PDF-Dokumente. Administratoren legen Benutzer-Zugangslinks mit optionalen Aufruflimits (`max_views`), Ablaufdaten (`expires_at`), benutzerdefinierten Open-Graph-Vorschauen und pfadbezogenen Routen an. Endbenutzer greifen über personalisierte URLs wie `https://lerninhalt.domain.de/max` oder `https://lerninhalt.domain.de/max/training/schulung1` auf ihre Inhalte zu.

Die tatsächlichen Ziel-URLs werden **niemals** an den Browser des Besuchers ausgeliefert. Jeder Seitenaufruf wird serverseitig validiert, und Inhalte werden über den Backend-Proxy bereitgestellt.

```text
┌─────────────────────┐    REST     ┌──────────────────┐     ┌────────────┐
│   React Frontend    │ ─────────── │   Express API    │ ──── │ PostgreSQL │
│   (React + Vite)    │ api.domain  │   (Node.js)      │     │            │
└─────────────────────┘             └──────────────────┘     └────────────┘
         ▲
         │ Caddy Reverse Proxy
         │
   ┌─────┴────────────────────────────────┐
   │ admin.domain.de       → Admin-Panel  │
   │ lerninhalt.domain.de  → Content View │
   │ api.domain.de         → Express API  │
   └──────────────────────────────────────┘
```

**Pfadbasierte URL-Struktur:**
- `lerninhalt.domain.de/max` → Startinhalt für Benutzer „max“ (Pfad `/`)
- `lerninhalt.domain.de/max/training/schulung1` → Spezifische Schulung (Pfad `/training/schulung1`)
- `lerninhalt.domain.de/` (ohne Benutzernamen) → Gesperrt (`BlockedPage`)

---

## Funktionen

- **Pfadbasierte Benutzer-Links**: Individuelle URLs (`/<benutzername>` und `/<benutzername>/<unterpfad>`) mit konfigurierbarer Bezeichnung (`label`), `target_url_base`, `max_views`, `expires_at` und `is_active`-Schalter.
- **Versteckte Ziel-URLs durch serverseitigen Proxy**: `POST /api/validate` liefert eine Proxy-URL (`/api/proxy/:username/...`) statt der echten Ziel-URL zurück. Bei HTML-Seiten werden Upstream-Origins und wurzelrelative Links (`src`, `href`, `action`) auf den Proxy umgeschrieben; PDFs und Binärdateien werden direkt gestreamt.
- **Benutzerspezifische Content-Routen**: Zuordnung einzelner Unterpfade (z. B. `/training/schulung1`) zu eigenen Ziel-URLs oder automatischer Fallback auf `target_url_base + pfad`.
- **Atomare Aufrufzählung & Zugriffslogs**: Jede Validierung erhöht `views_count` atomar und protokolliert `link_id`, `path`, `ip_address` und `accessed_at` in `access_logs`.
- **Subdomain-gesteuerte Frontend-Modi**: Automatische Erkennung zwischen Admin-Panel (`admin.*` oder `?mode=admin`) und Content-Viewer (`lerninhalt.*` / `localhost`).
- **Admin-Dashboard**: Passwortgeschützter JWT-Login (`sessionStorage`), Verwaltung von Benutzer-Links, Zurücksetzen von `views_count`, Routen-Verwaltung, Zugriffslog-Ansicht sowie Status-Badges (`Aktiv`, `Deaktiviert`, `Abgelaufen`, `Limit erreicht`).
- **Social-Media- & Messenger-Crawler-SSR**: Eine Express-Middleware erkennt Crawler (WhatsApp, Facebook, Twitter/X, LinkedIn, Slack, Telegram, Discord, Googlebot usw.) und liefert Open-Graph- und Twitter-Card-Metadaten (`og_title`, `og_description`, `og_image`) aus – ohne Aufrufe zu zählen oder inaktive/unbekannte Links preiszugeben.
- **PDF-Ansicht & Sperrseite**: Integrierte PDF-Leiste (*In neuem Tab öffnen* / *Herunterladen*) für `.pdf`-Ziele sowie eine gestaltete `BlockedPage` mit spezifischen Fehlercodes (`expired`, `limit_reached`, `inactive`, `not_found`, `no_user`).
- **Dynamischer Tab-Titel & Favicon**: Der Content-Viewer setzt `document.title` auf das aufgelöste Label und lädt ein passendes Favicon über den Google S2 Favicon Service.

---

## Funktionsweise & Tech-Stack

### Ablauf einer Anfrage & Validierung

1. Ein Besucher öffnet `https://lerninhalt.domain.de/max/training/schulung1`.
2. **Crawler-Anfragen** (`GET` bekannter Bots auf Nicht-API- und Nicht-Static-Pfaden) werden von der Express-Crawler-SSR-Middleware abgefangen. Sie liest `access_links` (Groß-/Kleinschreibung ignoriert) aus und liefert ein HTML-Dokument mit Open-Graph- / Twitter-Meta-Tags (`Cache-Control: public, max-age=300`), ohne `views_count` zu erhöhen.
3. **Browser-Anfragen** laden die React-SPA. `getAppMode()` prüft `window.location.hostname` (sowie `?mode=admin`).
4. `ContentViewer` extrahiert `username` (`max`) und `contentPath` (`/training/schulung1`) und ruft `POST /api/validate` auf.
5. Das Express-Backend prüft `is_active`, `expires_at` und `views_count < max_views`, erhöht `views_count`, ermittelt die Ziel-URL aus `content_routes` oder `target_url_base`, schreibt einen Eintrag in `access_logs` und antwortet mit `{ target_url: "<API_BASE>/api/proxy/...", label }`.
6. Der Content-Viewer lädt die zurückgegebene Proxy-URL im Vollbild-`<iframe>` (bei `.pdf`-URLs inklusive Aktionsleiste).

### Tech-Stack

| Schicht | Technologien |
|---------|-------------|
| **Frontend** | React 18, TypeScript, Vite, React Router DOM, TanStack React Query, Tailwind CSS, shadcn/ui (Radix UI), Lucide React |
| **Backend-API** | Node.js (v22 in Docker, ≥ 18 lokal), Express 4, `pg` (node-postgres), `jsonwebtoken`, `cors`, `dotenv` |
| **Datenbank** | PostgreSQL (≥ 13) mit Erweiterung `uuid-ossp` |
| **Container & Proxy** | Docker (Multi-Stage Node + Nginx Alpine für Frontend), Caddy (≥ 2) Reverse Proxy mit automatischem HTTPS |

### Ports

| Komponente | Standard-Port | Hinweise |
|------------|--------------|----------|
| **Backend Express-API** | `3001` | Konfigurierbar über Umgebungsvariable `PORT` |
| **Frontend Nginx-Container** | `80` | Liefert das gebaute `dist/` mit SPA-Fallback (`nginx.conf`) aus |
| **Vite Dev-Server** | `5173` (Standard) | Lokale Entwicklung (`npm run dev`) |

---

## Voraussetzungen & Installation

### Voraussetzungen

- **Node.js** ≥ 18 (die Dockerfiles nutzen `node:22-alpine`)
- **PostgreSQL** ≥ 13
- **Caddy** ≥ 2 (oder ein anderer Reverse Proxy mit TLS)
- **Domain** mit 3 DNS-A-Records: `admin.<domain>`, `lerninhalt.<domain>`, `api.<domain>`

### 1. Repository klonen

```bash
git clone https://github.com/orfelorfel23/Content-Vault.git
cd Content-Vault
```

### 2. PostgreSQL-Datenbank einrichten

Datenbank und Benutzer anlegen und anschließend `backend/schema.sql` einspielen:

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE content_vault;
CREATE USER content_vault WITH ENCRYPTED PASSWORD 'GEHEIM';
GRANT ALL PRIVILEGES ON DATABASE content_vault TO content_vault;
\q
```

```bash
psql -U content_vault -d content_vault -f backend/schema.sql
```

> **Hinweis:** Beim Start führt `backend/index.js` zusätzlich eine idempotente Schema-Prüfung aus (`CREATE TABLE IF NOT EXISTS ...` sowie `ALTER TABLE access_links ADD COLUMN IF NOT EXISTS og_title / og_description / og_image`).

**Tabellen:**
- `access_links` – ein Eintrag pro Benutzer (`id`, `username`, `label`, `target_url_base`, `max_views`, `expires_at`, `views_count`, `is_active`, `created_at`, `og_title`, `og_description`, `og_image`)
- `content_routes` – pfadbasierte Mapping-Einträge pro `link_id` (`path` → `target_url`, optional `label`)
- `access_logs` – Zugriffsprotokoll (`link_id`, `path`, `ip_address`, `accessed_at`)

### 3. Lokale Backend-Installation

```bash
cd backend
npm install
# .env anlegen (siehe Abschnitt Konfiguration)
node index.js
```

### 4. Lokale Frontend-Installation

Im Wurzelverzeichnis des Repositories:

```bash
npm install
# Entwicklungsserver starten oder Produktions-Bundle bauen:
npm run dev
npm run build
```

### 5. Docker-Build

**Frontend-Image** (liefert statisches `dist/` über Nginx auf Port `80` aus):

```bash
docker build --build-arg VITE_API_URL=https://api.domain.de -t content-vault-frontend .
docker run -d -p 8080:80 content-vault-frontend
```

**Backend-Image** (startet `node index.js` auf Port `3001`):

```bash
docker build -t content-vault-backend ./backend
docker run -d -p 3001:3001 --env-file ./backend/.env content-vault-backend
```

### 6. Caddy-Konfiguration (Beispiel)

Beispiel `/etc/caddy/Caddyfile`:

```caddy
# Admin-Panel (gleiche statische App, Modus über Hostname)
admin.domain.de {
    root * /var/www/content-vault/dist
    try_files {path} /index.html
    file_server
    encode gzip
}

# Content-Viewer
lerninhalt.domain.de {
    root * /var/www/content-vault/dist
    try_files {path} /index.html
    file_server
    encode gzip
}

# Express-API
api.domain.de {
    reverse_proxy localhost:3001
    encode gzip
}
```

Mit `sudo systemctl reload caddy` lädt Caddy die Konfiguration neu und bezieht automatisch Let's-Encrypt-Zertifikate.

---

## Konfiguration

### Backend-Umgebungsvariablen (`backend/.env`)

| Variable | Erforderlich | Standard | Beschreibung |
|----------|-------------|----------|--------------|
| `PORT` | Nein | `3001` | Port, auf dem Express lauscht |
| `DATABASE_URL` | Ja | — | PostgreSQL-Verbindungs-URL (z. B. `postgres://content_vault:GEHEIM@localhost:5432/content_vault`) |
| `ADMIN_PASSWORD` | Empfohlen | `admin` | Passwort für `POST /api/admin/login` |
| `JWT_SECRET` | Empfohlen | `secret` | Schlüssel zum Signieren/Prüfen von Admin-JWTs (1 Tag Gültigkeit) |
| `CORS_ORIGIN` | Empfohlen | `*` | Kommagetrennte Liste erlaubter Origins (z. B. `https://admin.domain.de,https://lerninhalt.domain.de`) |
| `VITE_API_URL` / `API_BASE_URL` | Empfohlen | `https://api.cbrn.orfel.de` | Öffentliche Basis-URL der API zur Konstruktion der `/api/proxy/...`-URLs |

### Frontend-Build-/Laufzeitvariablen

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `VITE_API_URL` | `http://localhost:3001` (Dev) / `https://api.cbrn.orfel.de` (Dockerfile ARG) | Basis-URL der Express-API, die beim Build in das Vite-Bundle eingebettet wird |

---

## Nutzung

### Erste Schritte nach dem Deployment

1. `https://admin.domain.de` öffnen (oder in Vorschau-/Dev-Umgebungen `?mode=admin` anhängen) und mit `ADMIN_PASSWORD` anmelden.
2. **Benutzer anlegen**: `username` (z. B. `max`), Bezeichnung (`label`), `target_url_base`, optional `max_views` und `expires_at` sowie optionale Vorschau-Metadaten (`og_title`, `og_description`, `og_image`) festlegen.
3. **Routen hinzufügen**: Benutzer auswählen und spezifische Pfade hinterlegen (z. B. `/training/schulung1` → Ziel-URL). Ohne passende Route wird `target_url_base + pfad` genutzt.
4. **Links teilen**: `https://lerninhalt.domain.de/max` bzw. `https://lerninhalt.domain.de/max/training/schulung1` an den Benutzer weitergeben.
5. **Überwachen**: Aktivierungsstatus umschalten, `views_count` zurücksetzen oder IP- und Zeitstempel-Einträge im Tab **Zugriffslogs** einsehen.

### API-Endpunkte

Admin-Endpunkte erfordern `Authorization: Bearer <token>`.

| Methode | Pfad | Auth | Zweck |
|---------|------|------|-------|
| `POST` | `/api/admin/login` | Öffentlich | Prüft `ADMIN_PASSWORD` und gibt JWT zurück (`expiresIn: '1d'`) |
| `GET` | `/api/admin/links` | JWT | Alle `access_links` sortiert nach `created_at DESC` abrufen |
| `POST` | `/api/admin/links` | JWT | Neuen Benutzer-Link anlegen |
| `PUT` | `/api/admin/links/:id` | JWT | Link-Felder aktualisieren (inkl. Zurücksetzen von `views_count`) |
| `DELETE` | `/api/admin/links/:id` | JWT | Zugangslink löschen (löscht verknüpfte Routen und Logs per Cascade) |
| `GET` | `/api/admin/links/:id/routes` | JWT | `content_routes` für einen Link abrufen |
| `POST` | `/api/admin/links/:id/routes` | JWT | Neue `content_routes`-Zuordnung anlegen |
| `DELETE` | `/api/admin/routes/:routeId` | JWT | `content_routes`-Eintrag löschen |
| `GET` | `/api/admin/links/:id/logs` | JWT | `access_logs` für einen Link sortiert nach `accessed_at DESC` |
| `POST` | `/api/validate` | Öffentlich | Validiert `{ username, path }`, erhöht `views_count`, loggt IP und liefert `{ target_url, label }` (Proxy-URL) |
| `GET` | `/api/proxy/:username/*` | Öffentlich | Validiert ohne Aufrufverbrauch und liefert HTML/PDF/Binärinhalte als Proxy aus |

### Fehlerbehebung (Troubleshooting)

- **Login schlägt fehl**: `VITE_API_URL` prüfen, API-Erreichbarkeit testen (`curl https://api.domain.de/api/admin/login`) und `CORS_ORIGIN` kontrollieren.
- **„Kein Zugang“ trotz gültigem Benutzer**: Prüfen, ob `is_active = true`, `expires_at` in der Zukunft liegt und `views_count < max_views` gilt.
- **iFrame bleibt leer**: Die Zielseite blockiert ggf. das Einbetten (`X-Frame-Options` / `CSP frame-ancestors`; über `/api/proxy/...` wird der Inhalt von der eigenen API-Origin ausgeliefert).
- **Admin-Panel in der Vorschau**: URL mit `?mode=admin` aufrufen.

---

## Projektstruktur

```text
Content-Vault/
├── backend/
│   ├── Dockerfile          # Node-22-Alpine-Container auf Port 3001
│   ├── index.js            # Express-API, Proxy, Crawler-SSR & DB-Initialisierung
│   ├── package.json        # Backend-Abhängigkeiten (express, pg, jwt, cors, dotenv)
│   └── schema.sql          # PostgreSQL-Schema (access_links, content_routes, access_logs)
├── public/
│   ├── logo.png            # Projektlogo
│   └── ...                 # Statische Assets (favicon.ico, robots.txt, placeholder.svg)
├── src/
│   ├── components/ui/      # shadcn/ui-Komponenten
│   ├── hooks/              # React-Hooks (use-mobile, use-toast)
│   ├── lib/
│   │   ├── api.ts          # REST-Client & Proxy-URL-Hilfsfunktion
│   │   ├── subdomain.ts    # Modus-Erkennung & Pfad-Extraktion
│   │   └── utils.ts        # Hilfsfunktionen
│   ├── pages/
│   │   ├── AdminLogin.tsx  # Passwort-Login für Administratoren
│   │   ├── AdminPanel.tsx  # Verwaltung von Links, Routen und Zugriffslogs
│   │   ├── BlockedPage.tsx # Sperrseite für ungültige/abgelaufene Links
│   │   ├── ContentViewer.tsx # Validierung + iFrame/PDF-Viewer + dynamisches Favicon
│   │   ├── Index.tsx       # Modus-Weiche (Admin vs. Content)
│   │   └── NotFound.tsx    # Fallback-Route
│   └── App.tsx             # React Router & React Query Setup
├── Dockerfile              # Multi-Stage-Frontend-Build (Vite -> Nginx Alpine)
├── nginx.conf              # Nginx SPA-Fallback & Asset-Caching
├── package.json            # Frontend-Skripte & -Abhängigkeiten
└── vite.config.ts          # Vite-Konfiguration
```

---

## Lizenz

Der eigene Quellcode und die Konfiguration dieses Projekts stehen unter **CC0 1.0 Universal** (Public Domain) — Details in [`LICENSE`](LICENSE).

Externe Abhängigkeiten, die über Paketmanager oder Docker-Images installiert werden, behalten ihre jeweiligen eigenen Open-Source-Lizenzen.
