

## Plan: Defaults, Favicon, Feuerwehr-Sperrseite & Link-Edit

### 1. Standard-Werte im "Neuer Benutzer"-Dialog (`src/pages/AdminPanel.tsx`)
- Beschreibungstext unter Username: `Erreichbar unter: cbrn.orfel.de/{username}`
- Ziel-URL Input bekommt `defaultValue` / Initial-State `"https://erkw.orfel.de"` statt leer (Placeholder bleibt sichtbar bis überschrieben — wir setzen es als Initial-Value des States).

### 2. Favicon vom iFrame-Ziel übernehmen (`index.html` + `src/pages/ContentViewer.tsx`)
- In `index.html` initial: `<link id="favicon" rel="icon" href="https://erkw.orfel.de/favicon.ico">`
- Im `ContentViewer` zusätzlich dynamisch das Favicon auf Basis der validierten `target_url` setzen (Origin extrahieren → `/favicon.ico`), via `useEffect` das `<link id="favicon">` patchen. So wird auch bei wechselnden Zielen das richtige Icon angezeigt.

### 3. Feuerwehr-Design für `BlockedPage` + Darkmode-Support (`src/index.css`, `src/pages/BlockedPage.tsx`)
- **Design-Tokens** in `src/index.css` ergänzen (HSL): Feuerwehr-Rot als `--fire-red: 0 75% 45%`, dunkler Hintergrund-Gradient für Sperrseite, Akzent-Gold/Gelb für Warnstreifen, plus Darkmode-Varianten. Tokens in `tailwind.config.ts` registrieren (über CSS-Vars).
- **BlockedPage neu gestalten:**
  - Vollflächiger Hintergrund mit dezentem radialen Glow + diagonalem Warnstreifen-Muster (rot/schwarz, sehr subtil via CSS `repeating-linear-gradient`).
  - Zentrale Karte mit dunklem Glas-Effekt (`backdrop-blur`, semi-transparent), roter Akzent-Border oben (4px Streifen).
  - Großes Icon in pulsierendem roten Kreis (Tailwind `animate-pulse` oder custom Keyframe), zusätzlich Feuerwehr-Symbolik: `Flame`/`Siren`/`ShieldAlert` aus lucide-react je nach Fehlertyp.
  - Typografie: größere, kondensierte Headline, Uppercase, Letter-Spacing.
  - Footer-Zeile mit kleinem "Zugangskontrolle • Content Vault"-Text.
  - Funktioniert in Light- und Darkmode (Tokens reagieren auf `.dark`).

### 4. Links nachträglich bearbeiten (`src/pages/AdminPanel.tsx`)
- Neuen "Bearbeiten"-Button (Pencil-Icon) pro Tabellenzeile, neben Reset/Delete.
- Öffnet einen **Edit-Dialog** (Reuse derselben Felder wie Create, aber vorausgefüllt):
  - Bezeichnung
  - Ziel-URL
  - Max. Aufrufe (leer = unbegrenzt)
  - Ablaufdatum (leer = kein Limit)
  - Aktueller Aufruf-Counter (read-only Anzeige + "Zurücksetzen"-Knopf inline)
- State: `editingLink: AccessLink | null`. Bei Speichern: `updateLink(id, {...})` mit den geänderten Feldern, danach `loadLinks()` und Toast.
- Username bleibt **read-only** im Edit-Dialog (URL-Pfad sollte stabil bleiben).

### Technische Details

**Geänderte/neue Dateien:**
| Datei | Änderung |
|------|----------|
| `index.html` | `<link id="favicon">` mit erkw.orfel.de-Default |
| `src/index.css` | Feuerwehr-Farbtokens (rot, gold, dark surface) für Light/Dark |
| `tailwind.config.ts` | `fire`-Farben aus CSS-Vars registrieren |
| `src/pages/BlockedPage.tsx` | Komplett neues Layout, animierte Icons, Warnstreifen |
| `src/pages/ContentViewer.tsx` | `useEffect` zum Favicon-Update aus `target_url`-Origin |
| `src/pages/AdminPanel.tsx` | Default-URL `https://erkw.orfel.de`, neuer Edit-Dialog, Hinweistext `cbrn.orfel.de` |

**Favicon-Logik:**
```ts
useEffect(() => {
  if (!targetUrl) return;
  try {
    const origin = new URL(targetUrl).origin;
    const link = document.getElementById('favicon') as HTMLLinkElement | null;
    if (link) link.href = `${origin}/favicon.ico`;
  } catch {}
}, [targetUrl]);
```

**Edit-Dialog State:**
```ts
const [editingLink, setEditingLink] = useState<AccessLink | null>(null);
const [editLabel, setEditLabel] = useState('');
const [editTargetUrl, setEditTargetUrl] = useState('');
const [editMaxViews, setEditMaxViews] = useState('');
const [editExpiresAt, setEditExpiresAt] = useState('');
// beim Öffnen: Felder aus link befüllen; beim Speichern: updateLink(...)
```

**Keine Backend-Änderungen nötig** — `updateLink` akzeptiert bereits `Partial<AccessLink>`.

