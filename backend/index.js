const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { Readable } = require('node:stream');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Trust reverse proxy (Caddy) for correct req.ip
app.set('trust proxy', true);

// ==========================================================================
// Helpers
// ==========================================================================

// Inline HTML escaper — no extra dependency needed
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ==========================================================================
// CORS + JSON parsing (must come first)
// ==========================================================================
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true,
}));
app.use(express.json());

// ==========================================================================
// Database
// ==========================================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ==========================================================================
// Auth middleware
// ==========================================================================
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// ==========================================================================
// Shared access validation helper
// ==========================================================================
// Validates username + path access, increments views_count, writes access log.
// Returns { targetUrl, label, link, route } on success.
// Throws { status, error } on validation failure.
async function resolveAndConsumeAccess(username, path, ip, { skipConsume = false } = {}) {
  const linkRes = await pool.query('SELECT * FROM access_links WHERE username = $1', [username]);
  if (linkRes.rows.length === 0) {
    throw { status: 403, error: 'Benutzer nicht gefunden' };
  }

  const link = linkRes.rows[0];

  if (!link.is_active) {
    throw { status: 403, error: 'inactive' };
  }

  if (link.expires_at && new Date() > new Date(link.expires_at)) {
    throw { status: 403, error: 'expired' };
  }

  if (link.max_views !== null && link.views_count >= link.max_views) {
    throw { status: 403, error: 'limit_reached' };
  }

  if (!skipConsume) {
    await pool.query('UPDATE access_links SET views_count = views_count + 1 WHERE id = $1', [link.id]);
  }

  const routeRes = await pool.query('SELECT * FROM content_routes WHERE link_id = $1 AND path = $2', [link.id, path]);

  let targetUrl = '';
  let label = '';
  let route = null;

  if (routeRes.rows.length > 0) {
    route = routeRes.rows[0];
    targetUrl = route.target_url;
    label = route.label || link.label;
  } else {
    if (link.target_url_base) {
      targetUrl = `${link.target_url_base}${path}`;
      label = link.label;
    } else {
      throw { status: 404, error: 'not_found' };
    }
  }

  if (!skipConsume) {
    await pool.query('INSERT INTO access_logs (link_id, path, ip_address) VALUES ($1, $2, $3)', [link.id, path, ip]);
  }

  return { targetUrl, label, link, route };
}

// ==========================================================================
// Public API base URL (used by validate + proxy)
// ==========================================================================
const API_BASE = process.env.VITE_API_URL || process.env.API_BASE_URL || 'https://api.cbrn.orfel.de';

// ==========================================================================
// /api/* routes — MUST be registered before crawler middleware
// ==========================================================================

// --- Auth ---
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Falsches Passwort' });
  }
});

// --- Admin Links ---
app.get('/api/admin/links', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM access_links ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/links', authenticateToken, async (req, res) => {
  const { username, label, target_url_base, max_views, expires_at, is_active,
          og_title, og_description, og_image } = req.body;

  // Validate og_image if provided
  const ogImageVal = og_image || null;
  if (ogImageVal && !isValidHttpUrl(ogImageVal)) {
    return res.status(400).json({ error: 'og_image muss eine gültige http(s) URL sein' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO access_links
         (username, label, target_url_base, max_views, expires_at, is_active,
          og_title, og_description, og_image)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        username,
        label || null,
        target_url_base || '',
        max_views || null,
        expires_at || null,
        is_active !== false,
        og_title || null,
        og_description || null,
        ogImageVal,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Erstellen' });
  }
});

app.put('/api/admin/links/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  // Validate og_image if present in body
  if (req.body.og_image !== undefined && req.body.og_image !== '' && req.body.og_image !== null) {
    if (!isValidHttpUrl(req.body.og_image)) {
      return res.status(400).json({ error: 'og_image muss eine gültige http(s) URL sein' });
    }
  }

  const fields = [
    'username', 'label', 'target_url_base', 'max_views', 'expires_at',
    'is_active', 'views_count', 'og_title', 'og_description', 'og_image',
  ];
  const updates = [];
  const values = [];

  fields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = $${updates.length + 1}`);
      let val = req.body[field];
      // Treat empty strings as NULL for nullable fields
      if (val === '' && ['max_views', 'expires_at', 'og_title', 'og_description', 'og_image'].includes(field)) {
        val = null;
      }
      values.push(val);
    }
  });

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id);
  const query = `UPDATE access_links SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`;

  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Link nicht gefunden' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

app.delete('/api/admin/links/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM access_links WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// --- Admin Routes ---
app.get('/api/admin/links/:id/routes', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM content_routes WHERE link_id = $1', [id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/links/:id/routes', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { path, target_url, label } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO content_routes (link_id, path, target_url, label) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, path, target_url, label]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Erstellen' });
  }
});

app.delete('/api/admin/routes/:routeId', authenticateToken, async (req, res) => {
  const { routeId } = req.params;
  try {
    await pool.query('DELETE FROM content_routes WHERE id = $1', [routeId]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// --- Admin Logs ---
app.get('/api/admin/links/:id/logs', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM access_logs WHERE link_id = $1 ORDER BY accessed_at DESC', [id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Public Validate ---
app.post('/api/validate', async (req, res) => {
  const { username, path } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    const result = await resolveAndConsumeAccess(username, path, ip);
    const proxyPath = path.startsWith('/') ? path.substring(1) : path;
    const proxyUrl = `${API_BASE}/api/proxy/${username}/${proxyPath}`;
    res.json({ target_url: proxyUrl, label: result.label });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    console.error(err);
    res.status(500).json({ error: 'Server Fehler' });
  }
});

// --- Public Proxy ---
function sanitizeFilename(raw) {
  const name = (raw || 'dokument').replace(/[^A-Za-z0-9._\- ]/g, '').trim().substring(0, 80);
  return name || 'dokument';
}

function extractOrigin(url) {
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return null;
  }
}

app.get('/api/proxy/:username/*', async (req, res) => {
  const { username } = req.params;
  const contentPath = '/' + (req.params[0] || '');
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  let accessResult;
  try {
    accessResult = await resolveAndConsumeAccess(username, contentPath, ip, { skipConsume: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    console.error(err);
    return res.status(500).json({ error: 'Server Fehler' });
  }

  const { targetUrl, label } = accessResult;

  let upstream;
  try {
    upstream = await fetch(targetUrl, { redirect: 'follow' });
  } catch (err) {
    console.error(`Proxy upstream network error for ${targetUrl}:`, err.message);
    return res.status(502).json({ error: 'upstream_unreachable' });
  }

  if (!upstream.ok) {
    console.error(`Proxy upstream HTTP ${upstream.status} for ${targetUrl}`);
    return res.status(502).json({ error: 'upstream_error', status: upstream.status });
  }

  const upstreamContentType = upstream.headers.get('content-type') || '';
  const urlPath = targetUrl.split('?')[0].split('#')[0];
  const expectsPdf = urlPath.toLowerCase().endsWith('.pdf');
  const isHtml = upstreamContentType.includes('text/html');

  if (expectsPdf && !upstreamContentType.includes('application/pdf')) {
    return res.status(415).json({ error: 'not_a_pdf' });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (isHtml) {
    const upstreamOrigin = extractOrigin(targetUrl);
    const proxyBase = `${API_BASE}/api/proxy/${username}`;

    let html;
    try {
      html = await upstream.text();
    } catch (err) {
      console.error('Proxy HTML buffer error:', err.message);
      return res.status(502).json({ error: 'upstream_error' });
    }

    if (upstreamOrigin) {
      html = html.replaceAll(upstreamOrigin + '/', proxyBase + '/');
      html = html.replaceAll(upstreamOrigin, proxyBase);
    }

    html = html.replace(/((?:src|href|action)\s*=\s*["'])\/(?!\/)/gi, `$1${proxyBase}/`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  const safeFilename = sanitizeFilename(label) + (expectsPdf ? '.pdf' : '');
  const contentType = expectsPdf ? 'application/pdf' : (upstreamContentType || 'application/octet-stream');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);

  const contentLength = upstream.headers.get('content-length');
  if (contentLength) res.setHeader('Content-Length', contentLength);

  try {
    const nodeStream = Readable.fromWeb(upstream.body);
    nodeStream.pipe(res);
    nodeStream.on('error', (err) => {
      console.error('Proxy stream error:', err.message);
      if (!res.headersSent) res.status(502).json({ error: 'upstream_error' });
    });
  } catch (err) {
    console.error('Proxy stream setup error:', err.message);
    if (!res.headersSent) res.status(502).json({ error: 'upstream_error' });
  }
});

// ==========================================================================
// Crawler SSR middleware — AFTER /api/*, BEFORE static files / SPA fallback
// ==========================================================================
const CRAWLER_RE = /(facebookexternalhit|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|Pinterest|SkypeUriPreview|redditbot|Applebot|Googlebot|bingbot|DuckDuckBot|YandexBot|Embedly|vkShare|W3C_Validator|outbrain|quora|nuzzel)/i;

// Paths / extensions that should always pass through to static / SPA
const STATIC_EXT_RE = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|json|webp|avif)$/i;

function buildCrawlerHtml(title, description, imageUrl, requestUrl) {
  const t = escHtml(title);
  const d = escHtml(description);
  const u = escHtml(requestUrl);
  const imgTags = imageUrl
    ? `  <meta property="og:image" content="${escHtml(imageUrl)}">\n  <meta name="twitter:image" content="${escHtml(imageUrl)}">\n`
    : '';
  const twitterCard = imageUrl ? 'summary_large_image' : 'summary';

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>${t}</title>
  <meta name="description" content="${d}">
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${u}">
${imgTags}  <meta name="twitter:card" content="${twitterCard}">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
</head>
<body></body>
</html>`;
}

app.use(async (req, res, next) => {
  // Only handle GET requests on non-API, non-static paths
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api/')) return next();
  if (req.path.startsWith('/assets/')) return next();
  if (STATIC_EXT_RE.test(req.path)) return next();

  const ua = req.headers['user-agent'] || '';
  const isCrawler = CRAWLER_RE.test(ua);

  // Extract username from path (first segment)
  const segments = req.path.split('/').filter(Boolean);
  const username = segments[0] || null;

  console.log(`[crawler-ssr] path=${req.path} crawler=${isCrawler} username=${username}`);

  if (!isCrawler || !username) return next();

  // Look up link — no validate logic, no view counting
  let link = null;
  try {
    const result = await pool.query(
      'SELECT id, label, is_active, og_title, og_description, og_image FROM access_links WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    if (result.rows.length > 0 && result.rows[0].is_active) {
      link = result.rows[0];
    }
  } catch (err) {
    console.error('[crawler-ssr] DB error:', err.message);
    // Fall through to generic response on error
  }

  const requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  let title, description, imageUrl;

  if (!link) {
    // Not found or inactive — generic neutral response, don't leak existence
    title = 'Geschützter Inhalt';
    description = 'Dieser Inhalt ist nur für autorisierte Benutzer zugänglich.';
    imageUrl = null;
  } else {
    title = link.og_title || link.label || 'Geschützter Inhalt';
    description = link.og_description || 'Dieser Inhalt ist nur für autorisierte Benutzer zugänglich.';
    imageUrl = link.og_image || null;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).send(buildCrawlerHtml(title, description, imageUrl, requestUrl));
});

// ==========================================================================
// Database schema init (idempotent)
// ==========================================================================
pool.query(`
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  CREATE TABLE IF NOT EXISTS access_links (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      username VARCHAR(255) NOT NULL UNIQUE,
      label VARCHAR(255),
      target_url_base VARCHAR(255),
      max_views INTEGER,
      expires_at TIMESTAMP WITH TIME ZONE,
      views_count INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- OG metadata columns (idempotent migration)
  ALTER TABLE access_links ADD COLUMN IF NOT EXISTS og_title TEXT;
  ALTER TABLE access_links ADD COLUMN IF NOT EXISTS og_description TEXT;
  ALTER TABLE access_links ADD COLUMN IF NOT EXISTS og_image TEXT;

  CREATE TABLE IF NOT EXISTS content_routes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      link_id UUID REFERENCES access_links(id) ON DELETE CASCADE,
      path VARCHAR(255) NOT NULL,
      target_url TEXT NOT NULL,
      label VARCHAR(255),
      UNIQUE(link_id, path)
  );

  CREATE TABLE IF NOT EXISTS access_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      link_id UUID REFERENCES access_links(id) ON DELETE CASCADE,
      path VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45) NOT NULL,
      accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`).then(() => console.log('Database schema verified.'))
  .catch((err) => console.error('Error verifying database schema', err));


app.listen(port, () => {
  console.log(`Content Vault API listening on port ${port}`);
});
