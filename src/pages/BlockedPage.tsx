import { Flame, Clock, Eye, Ban, ShieldAlert, Siren } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  error: string | null;
}

interface ErrorConfig {
  Icon: LucideIcon;
  code: string;
  title: string;
  message: string;
}

const CONFIG: Record<string, ErrorConfig> = {
  expired: {
    Icon: Clock,
    code: "ERR-401 · ABGELAUFEN",
    title: "Zugang abgelaufen",
    message: "Der Zugriffszeitraum für diesen Link ist abgelaufen.",
  },
  limit_reached: {
    Icon: Eye,
    code: "ERR-429 · LIMIT",
    title: "Aufruflimit erreicht",
    message: "Die maximale Anzahl an Aufrufen wurde erreicht.",
  },
  inactive: {
    Icon: Ban,
    code: "ERR-403 · DEAKTIVIERT",
    title: "Link deaktiviert",
    message: "Dieser Zugangslink wurde vom Administrator deaktiviert.",
  },
  not_found: {
    Icon: ShieldAlert,
    code: "ERR-404 · UNBEKANNT",
    title: "Nicht gefunden",
    message: "Dieser Zugangslink existiert nicht.",
  },
  no_user: {
    Icon: Siren,
    code: "ERR-400 · KEIN ZUGANG",
    title: "Kein Zugang",
    message: "Bitte verwende einen gültigen Zugangslink.",
  },
};

const DEFAULT: ErrorConfig = {
  Icon: Flame,
  code: "ERR-000 · GESPERRT",
  title: "Zugang verweigert",
  message: "Du hast keinen Zugriff auf diese Seite.",
};

const BlockedPage = ({ error }: Props) => {
  const cfg = (error && CONFIG[error]) || DEFAULT;
  const { Icon } = cfg;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden fire-glow p-4 text-primary-foreground bg-primary">
      {/* Diagonale Warnstreifen — sehr dezent */}
      <div className="absolute inset-0 fire-stripes pointer-events-none" />

      {/* Top + Bottom Akzent-Streifen (Feuerwehr-Look) */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[hsl(var(--fire-red))]" />
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-[hsl(var(--fire-amber))]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-[hsl(var(--fire-red)/0.3)] bg-[hsl(var(--fire-surface)/0.85)] p-8 shadow-2xl backdrop-blur-xl text-primary-foreground bg-primary">
          {/* Roter Akzent oben */}
          <div className="absolute -top-px left-8 right-8 h-1 rounded-full bg-gradient-to-r from-transparent via-[hsl(var(--fire-red))] to-transparent" />

          {/* Icon im pulsierenden Kreis */}
          <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-[hsl(var(--fire-red)/0.35)]" />
            <div className="absolute inset-2 rounded-full bg-[hsl(var(--fire-red)/0.15)]" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-[hsl(var(--fire-red))] bg-[hsl(var(--fire-darker))] shadow-[0_0_40px_hsl(var(--fire-red)/0.6)] border-primary-foreground">
              <Icon className="h-10 w-10 text-[hsl(var(--fire-red-glow))]" strokeWidth={2.2} />
            </div>
          </div>

          <p className="mb-2 text-center font-mono text-xs font-semibold tracking-[0.2em] text-[hsl(var(--fire-amber))] text-primary-foreground">
            {cfg.code}
          </p>
          <h1 className="mb-3 text-center text-3xl font-black uppercase tracking-wider text-white">
            {cfg.title}
          </h1>
          <p className="text-center text-sm leading-relaxed text-white/70">
            {cfg.message}
          </p>

          <div className="mt-8 flex items-center justify-center gap-2 border-t border-white/10 pt-5">
            <Flame className="h-3.5 w-3.5 text-[hsl(var(--fire-red))]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/50">
              Zugangskontrolle · Content Vault
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockedPage;
