/**
 * Export et suppression du compte, depuis le profil.
 *
 * Les deux droits que la politique de confidentialité promet doivent être
 * exerçables sans écrire à personne — sinon la promesse n'en est pas une.
 *
 * La suppression exige de saisir un mot : c'est irréversible, sans corbeille ni
 * délai de grâce, et un clic malheureux ne doit pas suffire.
 */
import { useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";

const CONFIRMATION = "SUPPRIMER";

const MyDataSection = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-my-data");
      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pick-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Export téléchargé", description: "Le fichier contient tout ce que Pick détient sur toi." });
    } catch (e) {
      console.error("Export impossible:", e);
      toast({
        title: "Export impossible",
        description: "Réessaie dans un instant. Si ça persiste, préviens l'équipe Pick.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-my-account", {
        body: { confirm: CONFIRMATION },
      });
      // Une erreur métier revient dans le corps de la réponse, pas seulement
      // dans `error` : sans ce test, un échec passerait pour un succès.
      if (error || (data as { error?: string })?.error) {
        throw new Error((data as { error?: string })?.error ?? "Suppression refusée");
      }

      toast({ title: "Compte supprimé", description: "Tes données ont été effacées." });
      await signOut();
      navigate("/", { replace: true });
    } catch (e) {
      console.error("Suppression impossible:", e);
      toast({
        title: "Suppression impossible",
        description: e instanceof Error ? e.message : "Réessaie, ou préviens l'équipe Pick.",
        variant: "destructive",
      });
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        onClick={handleExport}
        disabled={exporting}
        className="justify-start text-foreground/45 hover:text-foreground text-xs font-sans gap-2 h-10"
      >
        {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {exporting ? "Préparation…" : "Exporter mes données"}
      </Button>

      <Button
        variant="ghost"
        onClick={() => {
          setConfirmText("");
          setDeleteOpen(true);
        }}
        className="justify-start text-foreground/45 hover:text-destructive text-xs font-sans gap-2 h-10"
      >
        <Trash2 className="w-3.5 h-3.5" /> Supprimer mon compte
      </Button>

      <AlertDialog open={deleteOpen} onOpenChange={(o) => !deleting && setDeleteOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement ton compte ?</AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <span className="block">
                Tout disparaît : profil, films aimés, watchlist, historique, profil de goût, amitiés,
                duos et soirées. Il n'y a ni corbeille ni retour en arrière.
              </span>
              <span className="block">
                Les soirées que tu as organisées sont effacées elles aussi, avec ce que les autres
                participants y ont laissé.
              </span>
              <span className="block">
                Si tu veux garder une trace, annule et exporte tes données d'abord.
              </span>
              <span className="block pt-1">
                Pour confirmer, écris <strong className="text-foreground">{CONFIRMATION}</strong> ci-dessous.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRMATION}
            aria-label={`Écrire ${CONFIRMATION} pour confirmer la suppression`}
            autoComplete="off"
            disabled={deleting}
          />

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={confirmText.trim() !== CONFIRMATION || deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Suppression…" : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MyDataSection;
