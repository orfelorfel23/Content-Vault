import { useState, useEffect, useCallback } from "react";
import {
  getLinks, createLink, updateLink, deleteLink,
  getRoutes, createRoute, deleteRoute, getLogs,
  adminLogout,
  type AccessLink, type ContentRoute, type AccessLog,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, LogOut, Eye, Route, FileText, ExternalLink, Pencil, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onLogout: () => void;
}

const DEFAULT_TARGET_URL = "https://erkw.orfel.de";
const PUBLIC_HOST = "cbrn.orfel.de";

// Konvertiert ISO-String -> "YYYY-MM-DDTHH:mm" für datetime-local
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const AdminPanel = ({ onLogout }: Props) => {
  const [links, setLinks] = useState<AccessLink[]>([]);
  const [selectedLink, setSelectedLink] = useState<AccessLink | null>(null);
  const [routes, setRoutes] = useState<ContentRoute[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();

  // Create form
  const [newUsername, setNewUsername] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newTargetUrl, setNewTargetUrl] = useState(DEFAULT_TARGET_URL);
  const [newMaxViews, setNewMaxViews] = useState("");
  const [newExpiresAt, setNewExpiresAt] = useState("");

  // Route form
  const [newPath, setNewPath] = useState("");
  const [newRouteUrl, setNewRouteUrl] = useState("");
  const [newRouteLabel, setNewRouteLabel] = useState("");

  // Edit form
  const [editingLink, setEditingLink] = useState<AccessLink | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editTargetUrl, setEditTargetUrl] = useState("");
  const [editMaxViews, setEditMaxViews] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");

  const loadLinks = useCallback(async () => {
    try {
      setLinks(await getLinks());
    } catch {
      toast({ title: "Fehler", description: "Links konnten nicht geladen werden", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  const handleCreate = async () => {
    try {
      await createLink({
        username: newUsername,
        label: newLabel || null,
        target_url_base: newTargetUrl,
        max_views: newMaxViews ? parseInt(newMaxViews) : null,
        expires_at: newExpiresAt || null,
      });
      setShowCreate(false);
      setNewUsername(""); setNewLabel(""); setNewTargetUrl(DEFAULT_TARGET_URL); setNewMaxViews(""); setNewExpiresAt("");
      loadLinks();
      toast({ title: "Benutzer erstellt" });
    } catch {
      toast({ title: "Fehler", description: "Erstellen fehlgeschlagen", variant: "destructive" });
    }
  };

  const openEdit = (link: AccessLink) => {
    setEditingLink(link);
    setEditLabel(link.label || "");
    setEditTargetUrl(link.target_url_base);
    setEditMaxViews(link.max_views?.toString() || "");
    setEditExpiresAt(toLocalInput(link.expires_at));
  };

  const handleSaveEdit = async () => {
    if (!editingLink) return;
    try {
      const updated = await updateLink(editingLink.id, {
        label: editLabel || null,
        target_url_base: editTargetUrl,
        max_views: editMaxViews ? parseInt(editMaxViews) : null,
        expires_at: editExpiresAt || null,
      });
      setEditingLink(null);
      if (selectedLink?.id === updated.id) setSelectedLink(updated);
      loadLinks();
      toast({ title: "Gespeichert" });
    } catch {
      toast({ title: "Fehler", description: "Speichern fehlgeschlagen", variant: "destructive" });
    }
  };

  const handleResetEditViews = async () => {
    if (!editingLink) return;
    try {
      const updated = await updateLink(editingLink.id, { views_count: 0 });
      setEditingLink(updated);
      loadLinks();
      toast({ title: "Aufrufe zurückgesetzt" });
    } catch {
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleToggleActive = async (link: AccessLink) => {
    try {
      await updateLink(link.id, { is_active: !link.is_active });
      loadLinks();
    } catch {
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleResetViews = async (link: AccessLink) => {
    try {
      await updateLink(link.id, { views_count: 0 });
      loadLinks();
      toast({ title: "Aufrufe zurückgesetzt" });
    } catch {
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Wirklich löschen?")) return;
    try {
      await deleteLink(id);
      if (selectedLink?.id === id) setSelectedLink(null);
      loadLinks();
      toast({ title: "Gelöscht" });
    } catch {
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const loadRoutes = async (linkId: string) => {
    try { setRoutes(await getRoutes(linkId)); } catch { /* ignore */ }
  };

  const loadLogs = async (linkId: string) => {
    try { setLogs(await getLogs(linkId)); } catch { /* ignore */ }
  };

  const selectLink = (link: AccessLink) => {
    setSelectedLink(link);
    loadRoutes(link.id);
    loadLogs(link.id);
  };

  const handleCreateRoute = async () => {
    if (!selectedLink) return;
    try {
      await createRoute(selectedLink.id, { path: newPath, target_url: newRouteUrl, label: newRouteLabel || undefined });
      setNewPath(""); setNewRouteUrl(""); setNewRouteLabel("");
      loadRoutes(selectedLink.id);
      toast({ title: "Route erstellt" });
    } catch {
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!selectedLink) return;
    try {
      await deleteRoute(routeId);
      loadRoutes(selectedLink.id);
      toast({ title: "Route gelöscht" });
    } catch {
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleLogout = () => {
    adminLogout();
    onLogout();
  };

  const formatDate = (d: string | null) => {
    if (!d) return "–";
    return new Date(d).toLocaleString("de-DE");
  };

  const getStatusBadge = (link: AccessLink) => {
    if (!link.is_active) return <Badge variant="secondary">Deaktiviert</Badge>;
    if (link.expires_at && new Date(link.expires_at) < new Date()) return <Badge variant="destructive">Abgelaufen</Badge>;
    if (link.max_views !== null && link.views_count >= link.max_views) return <Badge variant="destructive">Limit erreicht</Badge>;
    return <Badge className="bg-emerald-600 hover:bg-emerald-700">Aktiv</Badge>;
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Content Vault – Admin</h1>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Abmelden
          </Button>
        </div>

        {/* Links Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Benutzer-Links</CardTitle>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Neuer Benutzer</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Neuen Benutzer anlegen</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Username (URL-Pfad)</Label>
                    <Input placeholder="z.B. max" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
                    <p className="mt-1 text-xs text-muted-foreground">Erreichbar unter: {PUBLIC_HOST}/{newUsername || "{username}"}</p>
                  </div>
                  <div>
                    <Label>Bezeichnung</Label>
                    <Input placeholder="z.B. Max Mustermann" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
                  </div>
                  <div>
                    <Label>Ziel-URL (iFrame Basis)</Label>
                    <Input placeholder={DEFAULT_TARGET_URL} value={newTargetUrl} onChange={(e) => setNewTargetUrl(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Max. Aufrufe (leer = unbegrenzt)</Label>
                      <Input type="number" placeholder="z.B. 10" value={newMaxViews} onChange={(e) => setNewMaxViews(e.target.value)} />
                    </div>
                    <div>
                      <Label>Ablaufdatum (leer = kein Limit)</Label>
                      <Input type="datetime-local" value={newExpiresAt} onChange={(e) => setNewExpiresAt(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={handleCreate} className="w-full" disabled={!newUsername || !newTargetUrl}>
                    Erstellen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aufrufe</TableHead>
                  <TableHead>Ablauf</TableHead>
                  <TableHead>Aktiv</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow
                    key={link.id}
                    className={`cursor-pointer ${selectedLink?.id === link.id ? "bg-accent" : ""}`}
                    onClick={() => selectLink(link)}
                  >
                    <TableCell className="font-mono font-medium">{link.username}</TableCell>
                    <TableCell>{link.label || "–"}</TableCell>
                    <TableCell>{getStatusBadge(link)}</TableCell>
                    <TableCell>
                      {link.views_count}{link.max_views !== null ? ` / ${link.max_views}` : ""}
                    </TableCell>
                    <TableCell>{formatDate(link.expires_at)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={link.is_active}
                        onCheckedChange={() => handleToggleActive(link)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost" size="icon"
                          onClick={(e) => { e.stopPropagation(); openEdit(link); }}
                          title="Bearbeiten"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={(e) => { e.stopPropagation(); handleResetViews(link); }}
                          title="Aufrufe zurücksetzen"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={(e) => { e.stopPropagation(); handleDelete(link.id); }}
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {links.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Noch keine Benutzer angelegt
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingLink} onOpenChange={(o) => !o && setEditingLink(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Benutzer bearbeiten</DialogTitle>
            </DialogHeader>
            {editingLink && (
              <div className="space-y-4">
                <div>
                  <Label>Username (nicht änderbar)</Label>
                  <Input value={editingLink.username} disabled className="font-mono" />
                  <p className="mt-1 text-xs text-muted-foreground">Erreichbar unter: {PUBLIC_HOST}/{editingLink.username}</p>
                </div>
                <div>
                  <Label>Bezeichnung</Label>
                  <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                </div>
                <div>
                  <Label>Ziel-URL (iFrame Basis)</Label>
                  <Input value={editTargetUrl} onChange={(e) => setEditTargetUrl(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Max. Aufrufe (leer = unbegrenzt)</Label>
                    <Input type="number" value={editMaxViews} onChange={(e) => setEditMaxViews(e.target.value)} />
                  </div>
                  <div>
                    <Label>Ablaufdatum (leer = kein Limit)</Label>
                    <Input type="datetime-local" value={editExpiresAt} onChange={(e) => setEditExpiresAt(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Aufrufe: </span>
                    <span className="font-medium">{editingLink.views_count}{editingLink.max_views !== null ? ` / ${editingLink.max_views}` : ""}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleResetEditViews}>
                    <RotateCcw className="mr-2 h-3.5 w-3.5" /> Zurücksetzen
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setEditingLink(null)}>Abbrechen</Button>
                  <Button className="flex-1" onClick={handleSaveEdit} disabled={!editTargetUrl}>Speichern</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Detail Panel */}
        {selectedLink && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                {selectedLink.label || selectedLink.username}
                <span className="font-mono text-sm font-normal text-muted-foreground">
                  /{selectedLink.username}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="routes">
                <TabsList>
                  <TabsTrigger value="routes"><Route className="mr-2 h-4 w-4" />Routen</TabsTrigger>
                  <TabsTrigger value="logs"><FileText className="mr-2 h-4 w-4" />Zugriffslogs</TabsTrigger>
                </TabsList>

                <TabsContent value="routes" className="space-y-4">
                  <div className="flex gap-2">
                    <Input placeholder="/training/schulung1" value={newPath} onChange={(e) => setNewPath(e.target.value)} className="flex-1" />
                    <Input placeholder="https://ziel-url.de/seite" value={newRouteUrl} onChange={(e) => setNewRouteUrl(e.target.value)} className="flex-1" />
                    <Input placeholder="Bezeichnung" value={newRouteLabel} onChange={(e) => setNewRouteLabel(e.target.value)} className="w-40" />
                    <Button onClick={handleCreateRoute} disabled={!newPath || !newRouteUrl} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pfad</TableHead>
                        <TableHead>Ziel-URL</TableHead>
                        <TableHead>Bezeichnung</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {routes.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono">{r.path}</TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground">{r.target_url}</TableCell>
                          <TableCell>{r.label || "–"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteRoute(r.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {routes.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                            Keine Routen – es wird die Basis-URL verwendet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="logs">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Zeitpunkt</TableHead>
                        <TableHead>Pfad</TableHead>
                        <TableHead>IP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{formatDate(log.accessed_at)}</TableCell>
                          <TableCell className="font-mono">{log.path}</TableCell>
                          <TableCell className="text-muted-foreground">{log.ip_address}</TableCell>
                        </TableRow>
                      ))}
                      {logs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                            Keine Zugriffe
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
