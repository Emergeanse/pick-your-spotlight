import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, LogIn, UserPlus, Sparkles, Star, Film, Users, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import PickCharacter from "@/components/pick/PickCharacter";

const BENEFITS = [
  { icon: Bookmark, text: "Sauvegarde tes recommandations" },
  { icon: Star, text: "Profil cinéma personnalisé (CinéDNA)" },
  { icon: Film, text: "Crée tes propres soirées ciné" },
  { icon: Users, text: "Retrouve tes amis cinéphiles" },
];

const JoinSession = () => {
  const [searchParams] = useSearchParams();
  const sessionCode = searchParams.get("session");
  const navigate = useNavigate();
  const { user, isReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{ name: string; creatorName: string; sessionId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState("");

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
          sessionId: data.session.id,
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

  const joinAsGuest = async () => {
    if (!guestName.trim()) return;
    setJoining(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("join-session", {
        body: { sessionCode, guest: true, guestName: guestName.trim() },
      });
      if (fnErr || data?.error) {
        toast.error(data?.error || "Impossible de rejoindre");
        setJoining(false);
        return;
      }
      toast.success(`Bienvenue ${guestName.trim()} ! 🍿`);
      navigate(`/app/pick-together?session=${data.session.id}`, { replace: true });
    } catch {
      toast.error("Erreur de connexion");
      setJoining(false);
    }
  };

  const handleCreateAccount = () => {
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

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          {/* Hero */}
          <div className="text-center">
            <PickCharacter mood="wave" size="lg" animate />

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/15 border border-primary/25"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-primary text-xs font-sans font-semibold">Soirée ciné</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-serif mt-4 mb-2"
            >
              {sessionInfo?.creatorName} t'invite à une soirée ciné !
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-foreground/50 text-sm font-sans mb-8"
            >
              Rejoins « {sessionInfo?.name} » pour trouver le film parfait ensemble.
            </motion.p>
          </div>

          {/* CTA: Create account */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              onClick={handleCreateAccount}
              variant="hero"
              size="xl"
              className="w-full gap-2 font-sans"
            >
              <UserPlus className="w-4 h-4" />
              Créer un compte gratuit
            </Button>
          </motion.div>

          {/* Benefits */}
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-5 space-y-2.5 px-2"
          >
            {BENEFITS.map((b, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.1 }}
                className="flex items-center gap-3 text-foreground/60 text-[13px] font-sans"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <b.icon className="w-3.5 h-3.5 text-primary" />
                </div>
                {b.text}
              </motion.li>
            ))}
          </motion.ul>

          {/* Separator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex items-center gap-4 my-7"
          >
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-foreground/30 text-xs font-sans uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-border/50" />
          </motion.div>

          {/* Guest flow */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
          >
            {!showGuestForm ? (
              <Button
                onClick={() => setShowGuestForm(true)}
                variant="heroOutline"
                size="xl"
                className="w-full gap-2 font-sans"
              >
                <LogIn className="w-4 h-4" />
                Rejoindre en invité
              </Button>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-3"
              >
                <Input
                  placeholder="Ton prénom"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && joinAsGuest()}
                  className="h-14 rounded-lg text-center text-base font-sans border-primary/30 focus-visible:ring-primary/40"
                  autoFocus
                />
                <Button
                  onClick={joinAsGuest}
                  disabled={!guestName.trim()}
                  variant="hero"
                  size="xl"
                  className="w-full gap-2 font-sans"
                >
                  <Sparkles className="w-4 h-4" />
                  Rejoindre la soirée
                </Button>
              </motion.div>
            )}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-foreground/20 text-[11px] font-sans text-center mt-5"
          >
            En invité, tes recommandations ne seront pas sauvegardées
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};

export default JoinSession;
