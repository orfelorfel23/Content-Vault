import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { validateAccess } from "@/lib/api";
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

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background">
      {label && (
        <div className="h-0 overflow-hidden">
          <title>{label}</title>
        </div>
      )}
      {isPdf ? (
        <>
          {/* Toolbar mit Fallback-Aktionen, falls das Embed blockiert wird */}
          <div className="flex items-center justify-between gap-2 border-b bg-card px-4 py-2 text-sm">
            <span className="truncate font-medium text-foreground">
              {label || "PDF-Dokument"}
            </span>
            <div className="flex gap-2">
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-border bg-background px-3 py-1.5 text-foreground hover:bg-accent"
              >
                In neuem Tab öffnen
              </a>
              <a
                href={targetUrl}
                download
                className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90"
              >
                Herunterladen
              </a>
            </div>
          </div>
          {/* <object> nutzt das native PDF-Plugin und respektiert keine sandbox-Restriktionen.
              Wenn der Server X-Frame-Options/CSP setzt, kommt der Inhalt im <object>-Body als Fallback. */}
          <object
            data={`${targetUrl}#toolbar=1&navpanes=0`}
            type="application/pdf"
            className="h-full w-full flex-1"
          >
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-foreground">
                Dein Browser kann dieses PDF nicht direkt anzeigen.
              </p>
              <p className="text-sm text-muted-foreground">
                Vermutlich blockiert der Server das Einbetten (X-Frame-Options / CSP).
              </p>
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
              >
                PDF in neuem Tab öffnen
              </a>
            </div>
          </object>
        </>
      ) : (
        <iframe
          src={targetUrl}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title={label || "Lerninhalt"}
        />
      )}
    </div>
  );
};

export default ContentViewer;
