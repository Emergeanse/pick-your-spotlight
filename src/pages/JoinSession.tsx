import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Users, LogIn, UserPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import PickCharacter from "@/components/pick/PickCharacter";

const JoinSession = () => {
  const [searchParams] = useSearchParams();
  const sessionCode = searchParams.get("session");
  const navigate = useNavigate();
  const { user, isReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{ name: string; creatorName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionCode) {
      setError("Lien d'invitation invalide");
      setLoading(false);
      return;
    }
    if (!isReady) return;

    if (user) {
      joinSession();
    } else {
      lookupSession();
    }
  }, [sessionCode, user, isReady]);

  const lookupSession = async () => {
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("join-session", {
        body: { sessionCode },
      });
      if (fnErr || data?.error) {
        setError(data?.error || "Session introuvable");
      } else {
        setSessionInfo({
          name: data.session.name,
          creatorName: data.creator.displayName,
        });
      }
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async () => {
    setJoining(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("join-session", {
        body: { sessionCode },
      });
      if (fnErr || data?.error) {
        setError(data?.error || "Impossible de rejoindre la session");
        setLoading(false);
        setJoining(false);
        return;
      }
      toast.success(`Tu as rejoint "${data.session.name}" !`);
      navigate(`/app/pick-together?session=${data.session.id}`, { replace: true });
    } catch {
      setError("Erreur de connexion");
      setLoading(false);
      setJoining(false);
    }
  };

  const handleLogin = () => {
    navigate(`/auth?redirect=${encodeURIComponent(`/join?session=${sessionCode}`)}`);
  };

  const handleSignup = () => {
    navigate(`/auth?redirect=${encodeURIComponent(`/join?session=${sessionCode}`)}`);
  };

  if (loading || joining) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-6">
        <PickCharacter mood="think" size="md" animate />
        <Loader2 className="w-6 h-6 text-primary animate-spin mt-6" />
        <p className="text-foreground/50 text-sm font-sans mt-4">
          {joining ? "Rejoindre la soirée…" : "Chargement…"}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-6">
        <PickCharacter mood="default" size="md" animate={false} />
        <p className="text-foreground/60 text-sm font-sans mt-6 text-center">{error}</p>
        <Button onClick={() => navigate("/")} variant="outline" className="mt-6 rounded-xl font-sans">
          Retour à l'accueil
        </Button>
      </div>
    );
  }

  // Unauthenticated user — show join options
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <PickCharacter mood="wave" size="md" animate />

        <div className="mt-6 mb-2 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/15 border border-primary/25">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-primary text-xs font-sans font-semibold">Soirée ciné</span>
        </div>

        <h1 className="text-2xl font-serif mt-4 mb-2">
          {sessionInfo?.creatorName} t'invite !
        </h1>
        <p className="text-foreground/50 text-sm font-sans mb-8">
          Rejoins la soirée « {sessionInfo?.name} » pour trouver le film parfait ensemble.
        </p>

        <div className="space-y-3">
          <Button
            onClick={handleLogin}
            variant="hero"
            size="xl"
            className="w-full gap-2 font-sans"
          >
            <LogIn className="w-4 h-4" />
            Se connecter / S'inscrire
          </Button>

          <p className="text-foreground/25 text-[11px] font-sans">
            Crée un compte gratuit ou connecte-toi pour rejoindre
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default JoinSession;
