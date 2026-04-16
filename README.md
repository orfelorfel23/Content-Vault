# Zugangsschutz – Lerninhalt-Plattform

Pfadbasierte Zugriffskontrolle für iFrame-eingebettete Lerninhalte. Admins legen Benutzer mit Zeit- und Aufruflimits an; Benutzer greifen über `lerninhalt.domain.de/<benutzername>` auf ihre Inhalte zu. Die tatsächlichen Ziel-URLs werden niemals an den Browser ausgeliefert, sondern erst nach serverseitiger Validierung im iFrame geladen.

---

## 1. Architektur

```text
┌─────────────────────┐    REST     ┌──────────────────┐     ┌────────────┐
│  Lovable Frontend   │ ─────────── │  Express API     │ ──── │ PostgreSQL │
│  (React + Vite)     │ api.domain  │  (Node.js)       │     │            │
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

**URL-Struktur (pfadbasiert):**
- `lerninhalt.domain.de/max` → Startseite Benutzer „max"
- `lerninhalt.domain.de/max/training/schulung1` → spezifische Schulung
- `lerninhalt.domain.de/` (ohne Pfad) → gesperrt

---

## 2. Voraussetzungen (auf deinem Server)

| Komponente | Version | Zweck |
|------------|---------|-------|
| **Node.js** | ≥ 18 | Express-API |
| **PostgreSQL** | ≥ 13 | Datenbank |
| **Caddy** | ≥ 2 | Reverse Proxy + automatisches HTTPS |
| **Domain** mit 3 DNS-A-Records | – | `admin.`, `lerninhalt.`, `api.` |

---

## 3. Datenbank (PostgreSQL)

Datenbank und Benutzer anlegen, dann das Schema einspielen:

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE zugangsschutz;
CREATE USER zugangsschutz WITH ENCRYPTED PASSWORD 'GEHEIM';
GRANT ALL PRIVILEGES ON DATABASE zugangsschutz TO zugangsschutz;
\q
```

Danach das mitgelieferte `schema.sql` ausführen:

```bash
psql -U zugangsschutz -d zugangsschutz -f schema.sql
```

**Tabellen:**
- `access_links` – ein Eintrag pro Benutzer (`username`, `max_views`, `expires_at`, `views_count`, `is_active` …)
- `content_routes` – pfadbasierte Mapping-Einträge (`/training/schulung1` → echte iFrame-URL)
- `access_logs` – jede Validierung (Zeit, Pfad, IP)

---

## 4. Express API

Die API liegt im Ordner `express-api/` (separat geliefert). Installation:

```bash
cd express-api
npm install
cp .env.example .env
# .env bearbeiten (siehe unten)
node index.js     # oder: pm2 start index.js --name zugangsschutz-api
```

**`.env`:**
```env
PORT=3001
DATABASE_URL=postgres://zugangsschutz:GEHEIM@localhost:5432/zugangsschutz
ADMIN_PASSWORD=DeinSicheresAdminPasswort
JWT_SECRET=ein-langer-zufaelliger-string
CORS_ORIGIN=https://admin.domain.de,https://lerninhalt.domain.de
```

**Endpoints (Admin = JWT-geschützt):**

| Methode | Pfad | Zweck |
|---------|------|-------|
| POST | `/api/admin/login` | Passwort → JWT |
| GET / POST / PUT / DELETE | `/api/admin/links[/:id]` | Benutzer/Links verwalten |
| GET / POST / DELETE | `/api/admin/links/:id/routes`, `/api/admin/routes/:id` | Pfade pro Benutzer |
| GET | `/api/admin/links/:id/logs` | Zugriffslogs |
| POST | `/api/validate` | **Public** – prüft Username + Pfad, gibt iFrame-URL zurück |

---

## 5. Frontend (Lovable App)

Die React-App erkennt anhand der Subdomain automatisch ihren Modus:
- `admin.domain.de` → Admin-Panel (Login + Dashboard)
- `lerninhalt.domain.de` → Content-Viewer (validiert + lädt iFrame)

**Build & Deployment:**

```bash
npm install
npm run build       # erzeugt dist/
```

Die `dist/` kann statisch ausgeliefert werden – z. B. direkt durch Caddy (siehe unten) oder den von Lovable bereitgestellten Hosting-Endpunkt.

**Environment-Variable beim Build:**

```env
VITE_API_URL=https://api.domain.de
```

**Test im Lovable Preview:** `…lovable.app/?mode=admin` öffnet das Admin-Panel ohne echte Subdomain.

---

## 6. Caddy-Konfiguration

Beispiel `/etc/caddy/Caddyfile`:

```caddy
# Admin-Panel (gleiche statische App, Modus über Hostname)
admin.domain.de {
    root * /var/www/zugangsschutz/dist
    try_files {path} /index.html
    file_server
    encode gzip
}

# Content-Viewer
lerninhalt.domain.de {
    root * /var/www/zugangsschutz/dist
    try_files {path} /index.html
    file_server
    encode gzip
}

# API
api.domain.de {
    reverse_proxy localhost:3001
    encode gzip
}
```

`sudo systemctl reload caddy` – Caddy holt sich automatisch Let's-Encrypt-Zertifikate.

---

## 7. Erste Schritte nach Deployment

1. `https://admin.domain.de` öffnen → mit `ADMIN_PASSWORD` einloggen.
2. **Benutzer anlegen:** Username (z. B. `max`), Label, optional `max_views` und `expires_at`.
3. **Routen hinzufügen:** Pfad (z. B. `/training/schulung1`) → echte iFrame-URL.
4. Link an den Benutzer geben: `https://lerninhalt.domain.de/max` bzw. `…/max/training/schulung1`.
5. Zugriffe einsehen unter „Logs" pro Benutzer.

---

## 8. Sicherheitskonzept

- iFrame-Ziel-URLs werden **nur serverseitig** aufgelöst – nie im Frontend exponiert.
- Admin-Bereich durch Passwort + JWT geschützt; Token im `sessionStorage` (kein Persist).
- `views_count` wird bei jeder Validierung atomar erhöht.
- Limit erreicht oder `expires_at` überschritten → **alle Pfade** des Benutzers gesperrt (`BlockedPage`).
- Jede Navigation im Content-Viewer löst eine erneute Validierung aus – kein Client-seitiges Caching der Berechtigung.
- CORS auf `admin.` und `lerninhalt.` Domains beschränken.

---

## 9. Lieferumfang

| Komponente | Ort |
|------------|-----|
| React Frontend | dieses Repo (`src/`) |
| SQL-Schema | `schema.sql` (separat) |
| Express API | `express-api/` (separat) |
| Caddy-Beispiel | dieses README, Abschnitt 6 |

---

## 10. Troubleshooting

- **Login schlägt fehl** → `VITE_API_URL` korrekt? API erreichbar (`curl https://api.domain.de/api/admin/login`)? CORS gesetzt?
- **„Kein Zugang" trotz gültigem User** → `is_active = true`? `expires_at` in der Zukunft? `views_count < max_views`?
- **iFrame bleibt leer** → Ziel-Site verbietet evtl. Embedding (`X-Frame-Options` / `CSP frame-ancestors`).
- **Admin-Panel im Preview** → URL mit `?mode=admin` aufrufen.
