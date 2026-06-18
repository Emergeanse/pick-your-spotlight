import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Heart, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getDuoByInviteCode, acceptDuo } from "@/lib/duo-profiles";
import { supabase } from "@/integrations/supabase/client";
import { sendNotification } from "@/lib/notifications";
import { Button } from "@/components/ui/button";

export default function JoinDuo() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, isReady } = useAuth();

  const [duo, setDuo] = useState<Awaited<ReturnType<typeof getDuoByInviteCode>>>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      // Sauvegarder le code pour après la connexion
      sessionStorage.setItem("pending_duo_code", code ?? "");
      navigate("/auth");
      return;
    }
    if (!code) { setError("Lien invalide."); setLoading(false); return; }

    getDuoByInviteCode(code).then((data) => {
      if (!data) setError("Ce lien d'invitation est invalide ou a déjà été utilisé.");
      else if (data.user1_id === user.id) setError("Tu ne peux pas rejoindre ton propre duo.");
      else setDuo(data);
      setLoading(false);
    });
  }, [isReady, user, code, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name ?? user.email?.split("@")[0] ?? "Toi"));
  }, [user]);

  const handleAccept = async () => {
    if (!code || !user || !displayName) return;
    setAccepting(true);
    try {
      const result = await acceptDuo(code, user.id, displayName);
      if (result) {
        if (duo?.user1_id) {
          sendNotification(
            duo.user1_id,
            "duo_accepted",
            `${displayName} a rejoint ton duo !`,
            `Le duo « ${result.duo_name} » est maintenant actif.`,
            { duo_id: result.id },
          ).catch(() => {});
        }
        navigate("/app/duo", { state: { newDuoId: result.id, duoName: result.duo_name } });
      } else {
        setError("Une erreur est survenue. Réessaie.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Erreur inattendue.");
    } finally {
      setAccepting(false);
    }
  };

  if (!isReady || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <p className="text-foreground/70 font-sans">{error}</p>
        <Button variant="outline" onClick={() => navigate("/app")}>Retour à l'accueil</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm flex flex-col items-center gap-6 text-center"
      >
        {/* Icône */}
        <div className="w-20 h-20 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
          <Users className="w-9 h-9 text-primary" />
        </div>

        {/* Texte */}
        <div className="space-y-2">
          <h1 className="font-serif text-3xl text-foreground">
            Invitation Duo
          </h1>
          <p className="text-foreground/60 font-sans text-sm leading-relaxed">
            <span className="text-foreground font-medium">{duo?.user1_display_name ?? "Quelqu'un"}</span>
            {" "}t'invite à créer le duo{" "}
            <span className="text-primary font-semibold">«&nbsp;{duo?.duo_name}&nbsp;»</span>
          </p>
          <p className="text-foreground/40 font-sans text-xs">
            Vos goûts seront fusionnés pour créer un profil commun.
          </p>
        </div>

        {/* Affinité (aperçu) */}
        <div className="w-full bg-foreground/[0.04] border border-border/15 rounded-2xl px-4 py-4">
          <div className="flex items-center gap-3">
            <Heart className="w-4 h-4 text-primary shrink-0" />
            <p className="text-foreground/60 font-sans text-xs text-left">
              Une fois le duo créé, tu pourras voir vos genres en commun, votre score d'affinité et lancer des recommandations pour deux.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <Button
            className="w-full"
            onClick={handleAccept}
            disabled={accepting}
          >
            {accepting ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Fusion en cours…</>
            ) : (
              "Rejoindre le duo"
            )}
          </Button>
          <Button variant="ghost" className="w-full text-foreground/40" onClick={() => navigate("/app")}>
            Refuser
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
