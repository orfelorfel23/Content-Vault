const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function getToken(): string | null {
  return sessionStorage.getItem("admin_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

// --- Admin Auth ---
export async function adminLogin(password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error("Falsches Passwort");
  const data = await res.json();
  sessionStorage.setItem("admin_token", data.token);
  return data.token;
}

export function adminLogout() {
  sessionStorage.removeItem("admin_token");
}

export function isAdminLoggedIn(): boolean {
  return !!getToken();
}

// --- Links ---
export interface AccessLink {
  id: string;
  username: string;
  label: string | null;
  target_url_base: string;
  max_views: number | null;
  expires_at: string | null;
  views_count: number;
  is_active: boolean;
  created_at: string;
}

function handleAuthError(res: Response) {
  if (res.status === 401 || res.status === 403) {
    sessionStorage.removeItem("admin_token");
    // Reload, damit AdminLogin wieder angezeigt wird
    if (typeof window !== "undefined") window.location.reload();
    throw new Error("Sitzung abgelaufen – bitte erneut einloggen");
  }
}

export async function getLinks(): Promise<AccessLink[]> {
  const res = await fetch(`${API_URL}/api/admin/links`, { headers: authHeaders() });
  if (!res.ok) {
    handleAuthError(res);
    throw new Error("Fehler beim Laden");
  }
  return res.json();
}

export async function createLink(data: Partial<AccessLink>): Promise<AccessLink> {
  const res = await fetch(`${API_URL}/api/admin/links`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Fehler beim Erstellen");
  return res.json();
}

export async function updateLink(id: string, data: Partial<AccessLink>): Promise<AccessLink> {
  const res = await fetch(`${API_URL}/api/admin/links/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Fehler beim Aktualisieren");
  return res.json();
}

export async function deleteLink(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/links/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Fehler beim Löschen");
}

// --- Routes ---
export interface ContentRoute {
  id: string;
  link_id: string;
  path: string;
  target_url: string;
  label: string | null;
}

export async function getRoutes(linkId: string): Promise<ContentRoute[]> {
  const res = await fetch(`${API_URL}/api/admin/links/${linkId}/routes`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Fehler beim Laden");
  return res.json();
}

export async function createRoute(linkId: string, data: { path: string; target_url: string; label?: string }): Promise<ContentRoute> {
  const res = await fetch(`${API_URL}/api/admin/links/${linkId}/routes`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Fehler beim Erstellen");
  return res.json();
}

export async function deleteRoute(routeId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/routes/${routeId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Fehler beim Löschen");
}

// --- Logs ---
export interface AccessLog {
  id: string;
  link_id: string;
  path: string;
  ip_address: string;
  accessed_at: string;
}

export async function getLogs(linkId: string): Promise<AccessLog[]> {
  const res = await fetch(`${API_URL}/api/admin/links/${linkId}/logs`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Fehler beim Laden");
  return res.json();
}

// --- Proxy ---
export function getProxyUrl(username: string, path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_URL}/api/proxy/${encodeURIComponent(username)}${cleanPath}`;
}

// --- Public Validate ---
export interface ValidateResult {
  target_url: string;
  label: string | null;
}

export async function validateAccess(username: string, path: string): Promise<ValidateResult> {
  const res = await fetch(`${API_URL}/api/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, path }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(data.error || "Zugang verweigert");
  }
  return res.json();
}
