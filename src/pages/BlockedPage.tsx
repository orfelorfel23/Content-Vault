import { ShieldX, Clock, Eye, Ban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  error: string | null;
}

const BlockedPage = ({ error }: Props) => {
  let icon = <ShieldX className="h-12 w-12 text-destructive" />;
  let title = "Zugang verweigert";
  let message = "Du hast keinen Zugriff auf diese Seite.";

  switch (error) {
    case "expired":
      icon = <Clock className="h-12 w-12 text-destructive" />;
      title = "Zugang abgelaufen";
      message = "Der Zugriffszeitraum für diesen Link ist abgelaufen.";
      break;
    case "limit_reached":
      icon = <Eye className="h-12 w-12 text-destructive" />;
      title = "Aufruflimit erreicht";
      message = "Die maximale Anzahl an Aufrufen wurde erreicht.";
      break;
    case "inactive":
      icon = <Ban className="h-12 w-12 text-destructive" />;
      title = "Link deaktiviert";
      message = "Dieser Zugangslink wurde deaktiviert.";
      break;
    case "not_found":
      title = "Nicht gefunden";
      message = "Dieser Zugangslink existiert nicht.";
      break;
    case "no_user":
      title = "Kein Zugang";
      message = "Bitte verwende einen gültigen Zugangslink.";
      break;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
          {icon}
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BlockedPage;
