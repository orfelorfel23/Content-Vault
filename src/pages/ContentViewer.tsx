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
    <div className="h-screen w-screen overflow-hidden">
      {label && (
        <div className="h-0 overflow-hidden">
          <title>{label}</title>
        </div>
      )}
      {isPdf ? (
        // Für PDFs KEIN sandbox-Attribut – sonst blockt Chrome das PDF-Plugin.
        // #toolbar=1 aktiviert die native PDF-Toolbar im Browser.
        <iframe
          src={`${targetUrl}#toolbar=1&navpanes=0`}
          className="h-full w-full border-0"
          title={label || "Lerninhalt"}
        />
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
