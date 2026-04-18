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

  // Favicon dynamisch vom iFrame-Ziel übernehmen
  useEffect(() => {
    if (!targetUrl) return;
    try {
      const url = new URL(targetUrl);
      const domain = url.hostname;
      const origin = url.origin;

      const setFavicon = (href: string) => {
        // Alte Favicons entfernen, damit der Browser den neuen Wert nimmt
        document
          .querySelectorAll("link[rel~='icon']")
          .forEach((el) => el.parentNode?.removeChild(el));
        const link = document.createElement("link");
        link.id = "favicon";
        link.rel = "icon";
        link.href = href;
        document.head.appendChild(link);
      };

      // 1. Versuch: direkt /favicon.ico vom Ziel-Origin
      const directHref = `${origin}/favicon.ico`;
      const tester = new Image();
      tester.onload = () => setFavicon(directHref);
      tester.onerror = () => {
        // 2. Fallback: Google Favicon-Service (funktioniert für fast alle Domains)
        setFavicon(
          `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
        );
      };
      tester.src = directHref;
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
