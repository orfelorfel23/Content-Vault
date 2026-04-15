

## Zugangsschutz – Überarbeiteter Plan

### Architektur-Übersicht

```text
┌─────────────────────┐     REST API      ┌──────────────────┐     ┌────────────┐
│  Lovable Frontend   │ ───────────────── │  Express API     │ ──── │ PostgreSQL │
│  (React App)        │   api.domain.de   │  (auf deinem     │     │ (dein      │
│                     │                   │   Server)        │     │  Server)   │
└─────────────────────┘                   └──────────────────┘     └────────────┘
```

**Caddy leitet weiter:**
- `admin.domain.de` → Lovable App (Admin-Modus)
- `lerninhalt.domain.de` → Lovable App (Content-Modus)
- `api.domain.de` → Express API (Port 3001 o.ä.)

**URL-Struktur (pfadbasiert):**
- `lerninhalt.domain.de/max` → Startseite für Benutzer "max"
- `lerninhalt.domain.de/max/training/schulung1` → Spezifische Schulung
- `lerninhalt.domain.de` ohne Pfad → Gesperrt (zeigt Fehlermeldung)

---

### 1. PostgreSQL-Schema

**Tabelle `access_links`:** `id`, `username` (unique), `label`, `target_url_base` (iFrame-Basis-URL), `max_views` (nullable), `expires_at` (nullable), `views_count`, `is_active`, `created_at`

**Tabelle `content_routes`:** `id`, `link_id` (FK), `path` (z.B. "/training/schulung1"), `target_url` (tatsächliche iFrame-URL)

**Tabelle `access_logs`:** `id`, `link_id` (FK), `path`, `accessed_at`, `ip_address`

SQL-Migrations-Script wird als Datei bereitgestellt.

---

### 2. Express API (als Artifact/Datei zum Deployen)

Lovable erstellt den API-Code als herunterladbare Datei(en). Du deployst sie auf deinem Server.

**Endpoints:**
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| POST | `/api/admin/login` | Admin-Passwort prüfen, JWT zurückgeben |
| GET | `/api/admin/links` | Alle Links auflisten |
| POST | `/api/admin/links` | Neuen Benutzer/Link anlegen |
| PUT | `/api/admin/links/:id` | Link bearbeiten |
| DELETE | `/api/admin/links/:id` | Link löschen |
| GET | `/api/admin/links/:id/routes` | Routen eines Links |
| POST | `/api/admin/links/:id/routes` | Route hinzufügen |
| DELETE | `/api/admin/routes/:id` | Route löschen |
| GET | `/api/admin/links/:id/logs` | Zugriffslogs |
| POST | `/api/validate` | Username + Pfad → validieren, iFrame-URL zurückgeben |

Admin-Endpoints sind JWT-geschützt. Das Admin-Passwort wird als Env-Variable gesetzt.

---

### 3. Lovable Frontend (React)

**Modus-Erkennung** via `window.location.hostname`:
- `admin.domain.de` → Admin-Panel
- `lerninhalt.domain.de` → Content-Viewer

**Admin-Panel:**
- Passwort-Login → JWT in sessionStorage
- Dashboard: Alle Benutzer-Links in Tabelle (Status, Aufrufe, Ablauf)
- Benutzer anlegen: Username, Ziel-URL, optionales Zeit-/Aufruflimit
- Routen verwalten: Pfade pro Benutzer definieren
- Zugriffslogs einsehen

**Content-Viewer (`lerninhalt.domain.de/:username/*`):**
- Liest Username + Pfad aus der URL
- Ruft `/api/validate` auf → bekommt iFrame-URL oder Fehler
- Gültig: Zeigt iFrame fullscreen
- Ungültig/Abgelaufen: Zeigt Sperr-Seite
- Ohne Username (`/`): Zeigt "Kein Zugang"
- **Jede Navigation** löst erneute Validierung aus

**Konfiguration:** API-URL wird als Env-Variable (`VITE_API_URL`) gesetzt, sodass du `api.domain.de` angeben kannst.

---

### 4. Lieferumfang

| Was | Wo |
|-----|-----|
| SQL-Schema | Downloadbare `.sql` Datei |
| Express API | Downloadbare Dateien (index.js, package.json) |
| React Frontend | Im Lovable-Projekt (live) |
| Caddy-Config Beispiel | In der Dokumentation |

---

### Sicherheit

- iFrame-URLs werden **nie im Frontend exponiert** – nur nach serverseitiger Validierung
- Admin-Panel durch JWT + Passwort geschützt
- `views_count` wird bei Validierung inkrementiert
- Limit erreicht → **alle Pfade** des Benutzers gesperrt

