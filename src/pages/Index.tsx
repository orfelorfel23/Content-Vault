import { useState, useEffect } from "react";
import { getAppMode } from "@/lib/subdomain";
import { isAdminLoggedIn } from "@/lib/api";
import AdminLogin from "./AdminLogin";
import AdminPanel from "./AdminPanel";
import ContentViewer from "./ContentViewer";

const Index = () => {
  const mode = getAppMode();
  const [loggedIn, setLoggedIn] = useState(isAdminLoggedIn());

  // Re-check on mount
  useEffect(() => {
    setLoggedIn(isAdminLoggedIn());
  }, []);

  if (mode === "admin") {
    if (!loggedIn) {
      return <AdminLogin onLogin={() => setLoggedIn(true)} />;
    }
    return <AdminPanel onLogout={() => setLoggedIn(false)} />;
  }

  // Content mode: handles /:username and /:username/*
  return <ContentViewer />;
};

export default Index;
