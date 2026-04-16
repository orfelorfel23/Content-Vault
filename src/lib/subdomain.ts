export type AppMode = "admin" | "content" | "unknown";

export function getAppMode(): AppMode {
  const hostname = window.location.hostname;
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");

  // Query param override (for dev/preview)
  if (mode === "admin") return "admin";

  // Local dev: default to content
  if (hostname === "localhost" || hostname === "127.0.0.1") return "content";

  // Production: detect by subdomain
  if (hostname.startsWith("admin.")) return "admin";
  return "content";
}

export function extractUsername(pathname: string): string | null {
  // pathname like "/max" or "/max/training/schulung1"
  const parts = pathname.split("/").filter(Boolean);
  return parts.length > 0 ? parts[0] : null;
}

export function extractContentPath(pathname: string): string {
  // Remove username from path: "/max/training/schulung1" → "/training/schulung1"
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return "/";
  return "/" + parts.slice(1).join("/");
}
