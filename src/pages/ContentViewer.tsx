import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { validateAccess, getProxyUrl } from "@/lib/api";
import { extractUsername, extractContentPath } from "@/lib/subdomain";
import BlockedPage from "./BlockedPage";
import { Loader2 } from "lucide-react";

const ContentViewer = () => {
  const location = useLocation();
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState<string | null>(null);

  const username = extractUsername(location.pathname);
  const contentPath = extractContentPath(location.pathname);

  // Favicon dynamisch vom iFrame-Ziel übernehmen.
  // Wichtig: Wegen Same-Origin-Policy können wir das <link rel="icon">
  // im iframe nicht auslesen. Daher nutzen wir den Google Favicon Service,
  // der serverseitig das echte Favicon der Domain holt und als PNG liefert –
  // funktioniert zuverlässig domainübergreifend.
  useEffect(() => {
    if (!targetUrl) return;
    try {
      const url = new URL(targetUrl);
      const domain = url.hostname;

      const setFavicon = (href: string, type = "image/png") => {
        // ALLE bestehenden Favicons (auch das aus index.html) entfernen
        document
          .querySelectorAll("link[rel~='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']")
          .forEach((el) => el.parentNode?.removeChild(el));
        const link = document.createElement("link");
        link.id = "favicon";
        link.rel = "icon";
        link.type = type;
        // Cache-Buster, damit Browser definitiv neu lädt
        link.href = `${href}${href.includes("?") ? "&" : "?"}_=${Date.now()}`;
        document.head.appendChild(link);
      };

      // Primär: Google S2 Favicon Service (höchste Trefferquote, liefert PNG)
      const googleHref = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      setFavicon(googleHref, "image/png");
    } catch {
      /* ignore */
    }
  }, [targetUrl]);

  useEffect(() => {
    if (!username) {
      setError("no_user");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setTargetUrl(null);

    validateAccess(username, contentPath)
      .then((result) => {
        setTargetUrl(result.target_url);
        setLabel(result.label);
      })
      .catch((err) => {
        setError(err.message || "unknown");
      })
      .finally(() => setLoading(false));
  }, [username, contentPath]);

  // Browser-Tab-Titel setzen (für normale Besucher; Crawler bekommen Titel via Backend-SSR)
  useEffect(() => {
    if (label) document.title = label;
  }, [label]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !targetUrl) {
    return <BlockedPage error={error} />;
  }

  // PDFs erkennen (Endung .pdf oder Content-Hint in URL)
  const isPdf = /\.pdf($|\?|#)/i.test(targetUrl);
  const proxyUrl = username ? getProxyUrl(username, contentPath) : targetUrl;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background">
      {label && (
        <div className="h-0 overflow-hidden">
          <title>{label}</title>
        </div>
      )}
      {isPdf ? (
        <>
          <div className="flex items-center justify-between gap-2 border-b bg-card px-4 py-2 text-sm">
            <span className="truncate font-medium text-foreground">
              {label || "PDF-Dokument"}
            </span>
            <div className="flex gap-2">
              <a
                href={proxyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-border bg-background px-3 py-1.5 text-foreground hover:bg-accent"
              >
                In neuem Tab öffnen
              </a>
              <a
                href={proxyUrl}
                download
                className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90"
              >
                Herunterladen
              </a>
            </div>
          </div>
          <iframe
            src={`${proxyUrl}#toolbar=1&navpanes=0`}
            className="h-full w-full flex-1 border-0"
            title={label || "PDF-Dokument"}
          />
        </>
      ) : (
        <iframe
          src={targetUrl}
          className="h-full w-full border-0"
          title={label || "Lerninhalt"}
        />
      )}
    </div>
  );
};

export default ContentViewer;
