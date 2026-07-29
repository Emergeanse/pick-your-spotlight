import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, MapPin, Wifi, Film, Users, Loader2, Check, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import pickLogo from "@/assets/pick-logo.webp";

type EventData = {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  is_remote: boolean;
  context: "duo" | "famille" | "amis" | "solo" | null;
  reveal_mode: "surprise" | "vote";
  status: string;
  organizer_id: string;
  organizer_name?: string;
};

const CONTEXT_LABELS: Record<string, string> = {
  duo: "Soirée Duo",
  famille: "Soirée Famille",
  amis: "Soirée entre amis",
  solo: "Soirée solo",
};

const InvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isReady } = useAuth();

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState<"landing" | "guest-form" | "joined">("landing");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [joining, setJoining] = useState(false);
  const [alreadyJoined, setAlreadyJoined] = useState(false);

  // Charge l'événement par token
  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase
        .rpc("get_event_by_invite_token" as any, { _token: token });

      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) { setNotFound(true); setLoading(false); return; }

      setEvent({ ...(row as any), organizer_name: (row as any).organizer_name || "Quelqu'un" });
      setLoading(false);
    })();
  }, [token]);

  // Si l'user est déjà connecté et arrive sur la page, vérifie s'il est déjà participant
  useEffect(() => {
    if (!isReady || !user || !event) return;
    supabase
      .from("event_participants" as any)
      .select("id, status")
      .eq("event_id", event.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setAlreadyJoined(true);
      });
  }, [isReady, user, event]);

  // Après inscription via Auth (skip_onboarding), revient ici pour rejoindre l'événement
  useEffect(() => {
    if (!isReady || !user || !event || alreadyJoined) return;
    const fromAuth = searchParams.get("joined") === "1";
    if (fromAuth) joinAsAuthUser();
  }, [isReady, user, event, alreadyJoined]);

  const joinAsAuthUser = async () => {
    if (!user || !event || !token) return;
    setJoining(true);
    try {
      const { error } = await supabase.rpc("join_event_as_user" as any, { _token: token });
      if (error && !error.message.includes("duplicate")) throw error;
      setAlreadyJoined(true);
      setStep("joined");
    } catch (e: any) {
      toast.error("Impossible de rejoindre l'événement");
    } finally {
      setJoining(false);
    }
  };

  const joinAsGuest = async () => {
    if (!guestName.trim() || !event || !token) return;
    setJoining(true);
    try {
      const { error } = await supabase.rpc("join_event_as_guest" as any, {
        _token: token,
        _guest_name: guestName.trim(),
        _guest_email: guestEmail.trim() || null,
      });
      if (error && !error.message.includes("duplicate")) throw error;
      setStep("joined");
    } catch (e: any) {
      toast.error("Impossible de rejoindre l'événement");
    } finally {
      setJoining(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  };

  const formatTime = (timeStr: string) => timeStr.slice(0, 5);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="text-5xl">🎬</span>
        <h1 className="font-serif text-2xl text-foreground">Invitation introuvable</h1>
        <p className="text-foreground/50 text-sm font-sans">Ce lien est invalide ou la soirée a été annulée.</p>
        <button onClick={() => navigate("/")} className="mt-4 text-primary text-sm font-sans hover:underline">
          Retour à l'accueil
        </button>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center p-5 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm py-8"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={pickLogo} alt="Pick" className="h-12 w-auto object-contain" />
        </div>

        <AnimatePresence mode="wait">

          {/* ── Étape JOINED ── */}
          {step === "joined" && (
            <motion.div key="joined" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 text-center">
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center"
              >
                <Check className="w-8 h-8 text-primary" />
              </motion.div>
              <h2 className="font-serif text-2xl text-foreground">Tu es de la partie !</h2>
              <p className="text-foreground/50 text-sm font-sans">
                Tu as rejoint <span className="text-foreground font-medium">{event.title}</span>.<br />
                Rendez-vous le {formatDate(event.event_date)}{event.event_time ? ` à ${formatTime(event.event_time)}` : ""}.
              </p>
              {user ? (
                <button
                  onClick={() => navigate("/app")}
                  className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-sans font-semibold"
                >
                  Ouvrir Pick <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="mt-4 flex flex-col gap-2 w-full">
                  <p className="text-xs text-foreground/40 font-sans">Tu veux que Pick retienne tes goûts pour la prochaine fois ?</p>
                  <button
                    onClick={() => navigate(`/auth?event_token=${token}&skip_onboarding=true`)}
                    className="w-full py-2.5 rounded-xl border border-primary/30 bg-primary/10 text-primary text-sm font-sans font-semibold"
                  >
                    Créer mon compte Pick
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Étape GUEST FORM ── */}
          {step === "guest-form" && (
            <motion.div key="guest-form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="font-serif text-2xl text-foreground mb-2">Rejoindre en invité</h2>
              <p className="text-foreground/50 text-sm font-sans mb-6">Ton prénom suffit. Ton email est optionnel.</p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Ton prénom *"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  autoFocus
                  className="w-full bg-card border border-border/30 rounded-xl px-4 py-3 text-sm font-sans text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                />
                <input
                  type="email"
                  inputMode="email"
                  placeholder="Email (pour retrouver ton accès)"
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                  className="w-full bg-card border border-border/30 rounded-xl px-4 py-3 text-sm font-sans text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  onClick={joinAsGuest}
                  disabled={!guestName.trim() || joining}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-sans font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : "Je rejoins la soirée"}
                </button>
                <button
                  onClick={() => setStep("landing")}
                  className="w-full text-center text-foreground/40 text-xs font-sans py-1 hover:text-foreground/70 transition-colors"
                >
                  Retour
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Étape LANDING ── */}
          {step === "landing" && (
            <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* Card événement */}
              <div className="rounded-2xl bg-card border border-white/[0.07] p-5 mb-6">
                <p className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-primary/70 mb-1">
                  {event.context ? CONTEXT_LABELS[event.context] : "Soirée ciné"}
                </p>
                <h1 className="font-serif text-[22px] text-foreground leading-tight mb-4">
                  {event.title}
                </h1>

                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2.5 text-sm font-sans text-foreground/70">
                    <Calendar className="w-4 h-4 text-primary/60 shrink-0" />
                    <span>{formatDate(event.event_date)}</span>
                  </div>
                  {event.event_time && (
                    <div className="flex items-center gap-2.5 text-sm font-sans text-foreground/70">
                      <Clock className="w-4 h-4 text-primary/60 shrink-0" />
                      <span>{formatTime(event.event_time)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 text-sm font-sans text-foreground/70">
                    {event.is_remote
                      ? <Wifi className="w-4 h-4 text-primary/60 shrink-0" />
                      : <MapPin className="w-4 h-4 text-primary/60 shrink-0" />
                    }
                    <span>{event.is_remote ? "À distance" : (event.location || "Lieu à confirmer")}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm font-sans text-foreground/70">
                    <Film className="w-4 h-4 text-primary/60 shrink-0" />
                    <span>
                      {event.reveal_mode === "surprise"
                        ? "Film surprise — révélé le soir J"
                        : "Vote pour choisir le film"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/[0.06] text-xs font-sans text-foreground/40">
                  Organisé par <span className="text-foreground/70">{event.organizer_name}</span>
                </div>
              </div>

              {/* Actions */}
              {alreadyJoined ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-primary text-sm font-sans font-medium">
                    <Check className="w-4 h-4" />
                    Tu participes déjà à cette soirée
                  </div>
                  <button
                    onClick={() => navigate("/app")}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-sans font-semibold"
                  >
                    Ouvrir Pick <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : user ? (
                // Utilisateur déjà connecté → rejoindre directement
                <div className="flex flex-col gap-3">
                  <p className="text-center text-sm font-sans text-foreground/60">
                    Connecté en tant que <span className="text-foreground">{user.email}</span>
                  </p>
                  <button
                    onClick={joinAsAuthUser}
                    disabled={joining}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-sans font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Rejoindre la soirée <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              ) : (
                // Non connecté → deux options
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => navigate(`/auth?event_token=${token}&skip_onboarding=true`)}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-sans font-semibold text-sm"
                  >
                    Créer mon compte Pick
                  </button>
                  <button
                    onClick={() => setStep("guest-form")}
                    className="w-full py-3 rounded-2xl border border-white/[0.10] bg-white/[0.04] text-foreground/80 font-sans text-sm font-medium"
                  >
                    Rejoindre en invité
                  </button>
                  <p className="text-center text-[11px] text-foreground/45 font-sans">
                    Compte Pick = tes goûts retenus pour les prochaines soirées
                  </p>
                </div>
              )}

            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default InvitePage;
