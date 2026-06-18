import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Heart, Home, Users, MapPin, Wifi,
  Sparkles, Vote, Film, Tv, LayoutGrid, Copy, Share2, Check, Loader2, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { computeMultiVectorProfile } from "@/lib/taste-engine";
import { getUserTasteProfile } from "@/lib/interactions";
import { fetchMyDuos, loadAcceptedFriends, type DuoProfile, type DuoFriendCandidate } from "@/lib/duo-profiles";
import { toast } from "sonner";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
type EventContext = "duo" | "famille" | "amis" | "solo";
type RevealMode  = "surprise" | "timed";
type MediaType   = "movie" | "tv" | "both";

const CONTEXT_CONFIG: Record<EventContext, { label: string; Icon: React.ComponentType<any>; color: string; emoji: string; disabled?: boolean }> = {
  duo:     { label: "Duo",          Icon: Heart, color: "text-primary",     emoji: "💑" },
  famille: { label: "Famille",      Icon: Home,  color: "text-accent",      emoji: "🏠", disabled: true },
  amis:    { label: "Entre amis",   Icon: Users, color: "text-emerald-400", emoji: "🎉", disabled: true },
  solo:    { label: "Solo",         Icon: Users, color: "text-orange-400",  emoji: "🎬" },
};

const TAB_ACTIVE = "linear-gradient(135deg, hsl(var(--primary) / 0.40) 0%, hsl(var(--primary) / 0.15) 100%)";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
const autoTitle = (context: EventContext | null, date: string) => {
  const labels: Record<EventContext, string> = {
    duo:     "Soirée Duo",
    famille: "Soirée Famille",
    amis:    "Soirée entre amis",
    solo:    "Soirée Solo",
  };
  const dateStr = date
    ? new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
    : "";
  const prefix = context ? labels[context] : "Soirée ciné";
  return dateStr ? `${prefix} · ${dateStr}` : prefix;
};

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────
const CreateEventPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // Pré-remplissage depuis le contexte home
  const preContext  = (searchParams.get("context") as EventContext | null) ?? null;
  const preDate     = searchParams.get("date") ?? "";
  const preTime     = searchParams.get("time") ?? "";
  const preLocation = searchParams.get("location") ?? "";
  const preRemote   = searchParams.get("remote") === "true";
  const preDuoId    = searchParams.get("duoId") ?? null;
  const preGenres   = searchParams.get("genres")?.split(",").filter(Boolean) ?? [];

  // Si on arrive depuis le modal (context + date pré-remplis), sauter l'étape 0
  const [step, setStep] = useState(preContext && preDate ? 1 : 0);

  // Step 1 — La soirée
  const [context, setContext]       = useState<EventContext | null>(preContext);
  const [title, setTitle]           = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [date, setDate]             = useState(preDate);
  const [time, setTime]             = useState(preTime);
  const [isRemote, setIsRemote]     = useState(preRemote);
  const [location, setLocation]     = useState(preLocation);

  // Sélection duo / groupe
  const [duos, setDuos]             = useState<DuoProfile[]>([]);
  const [duosLoaded, setDuosLoaded] = useState(false);
  const [selectedDuoId, setSelectedDuoId] = useState<string | null>(preDuoId);
  const [groupFriends, setGroupFriends]   = useState<DuoFriendCandidate[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  // Chargement duos / amis selon le contexte
  useEffect(() => {
    if (!user) return;
    if (context === "duo") {
      setDuosLoaded(false);
      fetchMyDuos(user.id).then(d => {
        setDuos(d);
        setDuosLoaded(true);
        // Auto-sélection si 1 seul duo ou si duoId pré-rempli
        if (!selectedDuoId) {
          if (preDuoId && d.find(duo => duo.id === preDuoId)) setSelectedDuoId(preDuoId);
          else if (d.length === 1) setSelectedDuoId(d[0].id);
        }
      });
    } else if (context === "famille" || context === "amis") {
      loadAcceptedFriends(user.id).then(setGroupFriends);
    }
  }, [context, user]);

  // Step 2 — Le film
  const [revealMode, setRevealMode] = useState<RevealMode>("surprise");
  const [mediaType, setMediaType]   = useState<MediaType>("both");
  const [mood, setMood]             = useState("");

  // Step 3 — Résultat
  const [creating, setCreating]   = useState(false);
  const [eventId, setEventId]     = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);

  const inviteLink = inviteToken ? `${window.location.origin}/invite/${inviteToken}` : "";

  // Auto-title
  useEffect(() => {
    if (!titleEdited) setTitle(autoTitle(context, date));
  }, [context, date, titleEdited]);

  // Validation step 1
  const step1Valid = !!context && !!date &&
    (context !== "duo" || !!selectedDuoId);

  // ── Création de l'événement ──────────────────────────────
  const createEvent = async () => {
    if (!user || !context || !date) return;
    setCreating(true);
    try {
      // 1. INSERT event
      const { data: ev, error: evErr } = await supabase
        .from("events" as any)
        .insert({
          organizer_id: user.id,
          title: title.trim() || autoTitle(context, date),
          event_date: date,
          event_time: time || null,
          location: isRemote ? null : (location.trim() || null),
          is_remote: isRemote,
          context,
          reveal_mode: revealMode,
          status: "planning",
          mood: mood.trim() || null,
          genre_tags: preGenres.length > 0 ? preGenres : null,
          media_type: mediaType,
        })
        .select("id, invite_link_token")
        .single();

      if (evErr || !ev) throw evErr ?? new Error("Création échouée");
      const eid = (ev as any).id as string;
      const token = (ev as any).invite_link_token as string;

      // 2. Organisateur → participant confirmé
      await supabase.from("event_participants" as any).insert({
        event_id: eid,
        user_id: user.id,
        status: "confirmed",
      });

      // 2b. Duo → invite le partenaire du duo sélectionné
      if (context === "duo" && selectedDuoId) {
        const selectedDuo = duos.find(d => d.id === selectedDuoId);
        const partnerId = selectedDuo
          ? (selectedDuo.user1_id === user.id ? selectedDuo.user2_id : selectedDuo.user1_id)
          : null;
        if (partnerId) {
          const { error: inviteErr } = await supabase.from("event_participants" as any).insert({
            event_id: eid, user_id: partnerId, status: "invited",
          });
          if (inviteErr) console.warn("[CreateEvent] Invite partner failed:", inviteErr.message);
        }
      }

      // 2c. Groupe → invite les participants sélectionnés
      if ((context === "famille" || context === "amis") && selectedParticipants.length > 0) {
        await Promise.all(selectedParticipants.map(pid =>
          supabase.from("event_participants" as any).insert({
            event_id: eid, user_id: pid, status: "invited",
          }).then(() => null)
        ));
      }

      // 3. Génère les recommandations (profil de l'organisateur)
      await generateRecommendations(eid);

      setEventId(eid);
      setInviteToken(token);
      setStep(2);
    } catch (e: any) {
      toast.error(e?.message ?? "Une erreur est survenue");
    } finally {
      setCreating(false);
    }
  };

  const generateRecommendations = async (eid: string) => {
    if (!user) return;
    try {
      const [multiProfile, tasteProfile] = await Promise.all([
        computeMultiVectorProfile(user.id),
        getUserTasteProfile(),
      ]);

      const moodContext = mood.trim()
        ? `L'utilisateur décrit l'ambiance : "${mood}".`
        : undefined;

      const { data } = await supabase.functions.invoke("surprise-personalized", {
        body: {
          userTasteVector: multiProfile?.stableTasteVector ?? null,
          recentTasteVector: multiProfile?.recentTasteVector ?? null,
          avoidanceVector: multiProfile?.avoidanceVector ?? null,
          tasteProfile,
          mediaType,
          count: 3,
          minMatchScore: 65,
          ...(moodContext && { moodContext }),
        },
      });

      const movies: any[] = data?.movies ?? [];
      if (!movies.length) return;

      // Sauvegarde les recommandations avec données film pour l'affichage
      await Promise.all(
        movies.slice(0, 3).map(async (m: any, i: number) => {
          const movie = m?.movie ?? m;
          const tmdbId = movie?.id;
          if (!tmdbId) return;
          const movieTitle = movie?.title ?? movie?.name ?? "Film";
          const posterPath = movie?.poster_path ?? null;

          const { data: ci } = await supabase
            .from("catalog_items")
            .select("id")
            .eq("tmdb_id", tmdbId)
            .maybeSingle();

          await supabase.from("event_recommendations" as any).insert({
            event_id: eid,
            catalog_item_id: (ci as any)?.id ?? null,
            position: i + 1,
            tmdb_id: tmdbId,
            movie_title: movieTitle,
            poster_path: posterPath,
          });
        })
      );
    } catch (e) {
      // Non bloquant — l'événement est créé, les recos peuvent être générées plus tard
      console.warn("[CreateEvent] Recommandations non générées :", e);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (navigator.share) {
      await navigator.share({ title: title, text: `Rejoins ma soirée ciné !`, url: inviteLink });
    } else {
      await copyLink();
    }
  };

  // ── Rendu ────────────────────────────────────────────────
  const STEPS = ["La soirée", "Le film", "C'est parti !"];

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Header */}
      <div className="pt-[calc(3rem+env(safe-area-inset-top))] px-5 pb-4 flex items-center gap-3 shrink-0">
        <button
          onClick={() => (step > 0 && !(step === 1 && preContext && preDate)) ? setStep(s => s - 1) : navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground/60" />
        </button>
        <div className="flex-1">
          <p className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-primary/70">
            Nouvelle soirée
          </p>
          <h1 className="font-serif text-[20px] text-foreground leading-tight">{STEPS[step]}</h1>
        </div>
        {/* Indicateur de progression */}
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-white/15"}`} />
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto scrollbar-hide pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <AnimatePresence mode="wait">

          {/* ── Step 0 : La soirée ── */}
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="px-5 pt-2 flex flex-col gap-5">

              {/* Contexte */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">Pour qui ?</label>
                <div className="flex gap-2">
                  {(Object.entries(CONTEXT_CONFIG) as [EventContext, typeof CONTEXT_CONFIG["duo"]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => !cfg.disabled && setContext(key)}
                      disabled={cfg.disabled}
                      className={`relative flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl text-[11.5px] font-sans font-semibold transition-all overflow-hidden border ${cfg.disabled ? "border-white/[0.05] text-foreground/40 opacity-35 cursor-not-allowed" : context === key ? "border-primary/50 text-foreground" : "border-white/[0.08] text-foreground/50"}`}
                    >
                      {context === key && !cfg.disabled && <div className="absolute inset-0 rounded-2xl" style={{ background: TAB_ACTIVE }} />}
                      <span className="relative text-lg">{cfg.emoji}</span>
                      <span className="relative">{cfg.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sélection du duo */}
              {context === "duo" && (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">Avec qui ?</label>
                  {!duosLoaded ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-foreground/45" />
                    </div>
                  ) : duos.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-5 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                      <p className="text-sm text-foreground/40 font-sans">Aucun duo actif pour l'instant.</p>
                      <button
                        onClick={() => navigate("/app/duo")}
                        className="px-4 py-2 rounded-xl bg-primary/20 border border-primary/30 text-primary text-[12.5px] font-sans font-semibold"
                      >
                        Créer un duo →
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {duos.map(duo => {
                        const partnerName = duo.user1_id === user?.id ? duo.user2_display_name : duo.user1_display_name;
                        const isSelected = selectedDuoId === duo.id;
                        return (
                          <button
                            key={duo.id}
                            onClick={() => setSelectedDuoId(duo.id)}
                            className={`relative flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all overflow-hidden ${isSelected ? "border-primary/50" : "border-white/[0.08]"}`}
                          >
                            {isSelected && <div className="absolute inset-0 rounded-2xl" style={{ background: TAB_ACTIVE }} />}
                            <span className="relative text-xl">💑</span>
                            <div className="relative flex-1 min-w-0">
                              <p className="font-sans font-semibold text-[13px] text-foreground">{duo.duo_name}</p>
                              <p className="font-sans text-[11px] text-foreground/50">avec {partnerName ?? "…"}</p>
                            </div>
                            {duo.affinity_score > 0 && (
                              <span className="relative text-[11px] font-sans font-semibold text-primary/70">{duo.affinity_score}%</span>
                            )}
                            {isSelected && <Check className="relative w-4 h-4 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => navigate("/app/duo")}
                        className="text-[11.5px] font-sans text-primary/50 text-center py-1.5 hover:text-primary/70 transition-colors"
                      >
                        + Créer un nouveau duo
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Sélection des participants groupe */}
              {(context === "famille" || context === "amis") && (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">Qui invite-t-on ?</label>
                  {groupFriends.length === 0 ? (
                    <p className="text-sm text-foreground/40 font-sans py-2">Aucun ami pour l'instant — commence par en ajouter.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {groupFriends.map(friend => {
                        const isSelected = selectedParticipants.includes(friend.id);
                        return (
                          <button
                            key={friend.id}
                            onClick={() => setSelectedParticipants(prev =>
                              isSelected ? prev.filter(id => id !== friend.id) : [...prev, friend.id]
                            )}
                            className={`relative flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all overflow-hidden ${isSelected ? "border-primary/50" : "border-white/[0.08]"}`}
                          >
                            {isSelected && <div className="absolute inset-0 rounded-2xl" style={{ background: TAB_ACTIVE }} />}
                            <div className="relative w-8 h-8 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center shrink-0">
                              <span className="text-[13px] font-semibold text-primary">{friend.displayName[0].toUpperCase()}</span>
                            </div>
                            <p className="relative flex-1 font-sans text-[13px] font-medium text-foreground">{friend.displayName}</p>
                            {isSelected && <Check className="relative w-4 h-4 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Titre */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">Titre</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => { setTitle(e.target.value); setTitleEdited(true); }}
                  onBlur={() => { if (!title.trim()) { setTitleEdited(false); setTitle(autoTitle(context, date)); } }}
                  placeholder="Soirée ciné"
                  className="bg-card border border-border/30 rounded-xl px-4 py-3 text-sm font-sans text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {/* Date + Heure */}
              <div className="flex gap-3">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">Date *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="bg-card border border-border/30 rounded-xl px-4 py-3 text-sm font-sans text-foreground outline-none focus:border-primary/50 transition-colors [color-scheme:dark]"
                  />
                </div>
                <div className="flex flex-col gap-2 w-28">
                  <label className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">Heure</label>
                  <input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="bg-card border border-border/30 rounded-xl px-4 py-3 text-sm font-sans text-foreground outline-none focus:border-primary/50 transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Lieu / À distance */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">Où ?</label>
                <div className="flex gap-2 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                  <button
                    onClick={() => setIsRemote(false)}
                    className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-sans font-medium transition-all overflow-hidden ${!isRemote ? "text-foreground border border-primary/40" : "text-foreground/45"}`}
                  >
                    {!isRemote && <div className="absolute inset-0 rounded-xl" style={{ background: TAB_ACTIVE }} />}
                    <MapPin className="relative w-3.5 h-3.5" />
                    <span className="relative">En présentiel</span>
                  </button>
                  <button
                    onClick={() => setIsRemote(true)}
                    className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-sans font-medium transition-all overflow-hidden ${isRemote ? "text-foreground border border-primary/40" : "text-foreground/45"}`}
                  >
                    {isRemote && <div className="absolute inset-0 rounded-xl" style={{ background: TAB_ACTIVE }} />}
                    <Wifi className="relative w-3.5 h-3.5" />
                    <span className="relative">À distance</span>
                  </button>
                </div>
                <AnimatePresence>
                  {!isRemote && (
                    <motion.input
                      key="location"
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      type="text"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="Chez nous, home cinéma, salon…"
                      className="bg-card border border-border/30 rounded-xl px-4 py-3 text-sm font-sans text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
                    />
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ── Step 1 : Le film ── */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="px-5 pt-2 flex flex-col gap-5">

              {/* Mode surprise / vote */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">Mode</label>
                <div className="flex gap-3">
                  {([
                    { id: "surprise" as RevealMode, label: "Révélation avant",      desc: "Tu lances le film quand tu veux, avant la soirée",     emoji: "🎩" },
                    { id: "timed"    as RevealMode, label: "Surprise sur le moment", desc: "Révélation automatique à l'heure de la soirée",          emoji: "⏰" },
                  ]).map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setRevealMode(opt.id)}
                      className={`relative flex-1 flex flex-col gap-2 p-4 rounded-2xl border text-left transition-all overflow-hidden ${revealMode === opt.id ? "border-primary/50 text-foreground" : "border-white/[0.08] text-foreground/50"}`}
                    >
                      {revealMode === opt.id && <div className="absolute inset-0" style={{ background: TAB_ACTIVE }} />}
                      <span className="relative text-2xl">{opt.emoji}</span>
                      <div className="relative">
                        <p className="font-sans font-semibold text-[13px]">{opt.label}</p>
                        <p className="text-[11px] text-foreground/50 mt-0.5 leading-snug">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Type de média */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">Type de contenu</label>
                <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                  {([
                    { id: "movie" as MediaType, label: "Film",   Icon: Film },
                    { id: "tv"    as MediaType, label: "Série",  Icon: Tv },
                    { id: "both"  as MediaType, label: "Les deux", Icon: LayoutGrid },
                  ]).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      onClick={() => setMediaType(id)}
                      className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-sans font-medium transition-all overflow-hidden ${mediaType === id ? "text-foreground border border-primary/40" : "text-foreground/45"}`}
                    >
                      {mediaType === id && <div className="absolute inset-0 rounded-xl" style={{ background: TAB_ACTIVE }} />}
                      <Icon className="relative w-3.5 h-3.5" />
                      <span className="relative">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood libre */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">
                  Ambiance <span className="normal-case font-normal text-foreground/45">(optionnel)</span>
                </label>
                <textarea
                  value={mood}
                  onChange={e => setMood(e.target.value)}
                  placeholder="Un film d'action plutôt drôle, quelque chose de court, ambiance feel-good…"
                  rows={3}
                  className="bg-card border border-border/30 rounded-xl px-4 py-3 text-sm font-sans text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors resize-none"
                />
              </div>
            </motion.div>
          )}

          {/* ── Step 2 : C'est parti ── */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="px-5 pt-4 flex flex-col gap-5">

              {creating ? (
                <div className="flex flex-col items-center gap-4 py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="font-serif text-lg text-foreground">Pick prépare ta soirée…</p>
                  <p className="text-foreground/40 text-sm font-sans text-center">Je génère les meilleures suggestions pour le groupe.</p>
                </div>
              ) : (
                <>
                  {/* Succès */}
                  <div className="flex flex-col items-center gap-2 pt-4 text-center">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="w-16 h-16 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mb-1"
                    >
                      <Sparkles className="w-7 h-7 text-primary" />
                    </motion.div>
                    <h2 className="font-serif text-[22px] text-foreground">{title}</h2>
                    <p className="text-foreground/45 text-sm font-sans">
                      {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                      {time ? ` · ${time.slice(0, 5)}` : ""}
                      {" · "}{isRemote ? "À distance" : (location || "Lieu à confirmer")}
                    </p>
                  </div>

                  {/* Lien d'invitation */}
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">Lien d'invitation</p>
                    <div className="flex items-center gap-2 bg-card border border-border/30 rounded-xl px-4 py-3">
                      <p className="flex-1 text-[12px] font-sans text-foreground/60 truncate">{inviteLink}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={copyLink}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-sans font-medium transition-all ${copied ? "border-primary/40 bg-primary/10 text-primary" : "border-white/[0.10] bg-white/[0.04] text-foreground/80"}`}
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? "Copié !" : "Copier"}
                      </button>
                      <button
                        onClick={shareLink}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-sans font-semibold"
                      >
                        <Share2 className="w-4 h-4" />
                        Partager
                      </button>
                    </div>
                  </div>

                  {/* Infos sur le mode */}
                  <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3.5 flex items-start gap-3">
                    <span className="text-xl shrink-0 mt-0.5">{revealMode === "timed" ? "⏰" : "🎩"}</span>
                    <div>
                      <p className="text-[12.5px] font-sans font-semibold text-foreground/80">
                        {revealMode === "timed" ? "Surprise sur le moment" : "Révélation avant"}
                      </p>
                      <p className="text-[11.5px] text-foreground/45 font-sans mt-0.5 leading-snug">
                        {revealMode === "timed"
                          ? "Le film sera révélé automatiquement à l'heure de la soirée."
                          : "Tu pourras lancer la révélation quand tu le souhaites depuis la fiche soirée."}
                      </p>
                    </div>
                  </div>

                  {/* CTA vers la gestion */}
                  <button
                    onClick={() => navigate("/app/soirees")}
                    className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.07] text-left"
                  >
                    <div>
                      <p className="text-[13px] font-sans font-semibold text-foreground">Gérer la soirée</p>
                      <p className="text-[11px] text-foreground/45 mt-0.5">Participants, votes, révélation</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-foreground/45 shrink-0" />
                  </button>
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Footer CTA */}
      <div className="absolute bottom-0 inset-x-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] px-5 pt-6 bg-gradient-to-t from-background via-background/95 to-transparent">
        {step === 0 && (
          <button
            onClick={() => setStep(1)}
            disabled={!step1Valid}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-sans font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
          >
            Continuer <ArrowRight className="w-4 h-4" />
          </button>
        )}
        {step === 1 && (
          <button
            onClick={createEvent}
            disabled={creating}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-sans font-semibold text-sm flex items-center justify-center gap-2"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Créer la soirée</>}
          </button>
        )}
      </div>
    </div>
  );
};

export default CreateEventPage;
