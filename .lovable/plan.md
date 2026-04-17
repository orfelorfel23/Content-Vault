

## Plan: Variante A — PDF-Proxy via Backend

### Frontend-Änderungen

**1. `src/lib/api.ts`** — Neue Helper-Funktion:
```ts
export function getProxyUrl(username: string, path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}/api/proxy/${encodeURIComponent(username)}${cleanPath}`;
}
```

**2. `src/pages/ContentViewer.tsx`** — Bei PDFs Proxy-URL nutzen:
- `<object>`-Block durch `<iframe src={proxyUrl} />` ersetzen (ohne `sandbox`)
- Toolbar-Links („Neuer Tab" / „Download") ebenfalls auf `proxyUrl` zeigen
- `targetUrl` weiterhin nur für die `isPdf`-Erkennung verwenden (Endung prüfen)
- Nicht-PDF-Fall (HTML) bleibt unverändert mit Sandbox-iFrame

### Backend-Prompt (Englisch, als separate Datei)

Datei: `/mnt/documents/backend-pdf-proxy-prompt.md` — enthält einen vollständigen, copy-paste-fähigen Prompt für eine KI, um die Express-API um den Proxy-Endpunkt zu erweitern. Inhalt:
- Endpoint-Spezifikation `GET /api/proxy/:username/*`
- Wiederverwendung der bestehenden Validierungslogik aus `/api/validate` (Link aktiv, `expires_at`, `max_views`, `views_count++`, Logging)
- Korrekte Response-Header: `Content-Type: application/pdf`, `Content-Disposition: inline`, `Cache-Control: private, no-store`, **kein** `X-Frame-Options`
- Streaming der Upstream-Response (kein Buffering)
- Fehlerbehandlung: 403 bei blockiert, 502 bei Upstream-Fehler, 404 wenn Route nicht existiert
- CORS-Hinweis: bestehende CORS-Config muss diesen Endpunkt einschließen
- Sicherheits-Hinweis: nur PDFs streamen (Content-Type prüfen) — optionales Hardening

### Lieferumfang dieses Schritts

| Datei | Änderung |
|------|----------|
| `src/lib/api.ts` | + `getProxyUrl()` |
| `src/pages/ContentViewer.tsx` | PDF-Zweig nutzt Proxy-URL via iFrame |
| `/mnt/documents/backend-pdf-proxy-prompt.md` | Neuer KI-Prompt (EN) zum Backend-Update |

### Was du danach tust
1. Prompt aus `/mnt/documents/backend-pdf-proxy-prompt.md` an deine Backend-KI/dich selbst geben → Express-Route ergänzen, deployen.
2. Im Frontend einen PDF-Link aufrufen → PDF wird via Proxy im iFrame angezeigt, Ziel-URL bleibt verborgen.

