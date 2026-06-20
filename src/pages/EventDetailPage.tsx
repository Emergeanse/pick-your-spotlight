import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Calendar, MapPin, Wifi, Copy, Share2, Check,
  Loader2, Users, Sparkles, Film, Crown, Trash2, AlertTriangle, LogOut, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { setRevealEvent } from "@/lib/event-reveal";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
type EventData = {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  is_remote: boolean;
  context: string | null;
  reveal_mode: "surprise" | "vote" | "timed";
  status: string;
  organizer_id: string;
  invite_link_token: string;
  mood: string | null;
  genre_tags: string[] | null;
  media_type: string | null;
  final_pick_id: string | null;
  final_pick_title: string | null;
  final_pick_poster: string | null;
  final_pick_tmdb_id: number | null;
};

type Participant = {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email?: string | null;
  status: "invited" | "confirmed" | "declined";
  display_name?: string;
};

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
const formatDate = (d: string, t: string | null) => {
  const date = new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });
  return t ? `${date} · ${t.slice(0, 5)}` : date;
};

const statusLabel: Record<string, { label: string; color: string }> = {
  confirmed: { label: "Confirmé",  color: "text-emerald-400" },
  invited:   { label: "Invité",    color: "text-foreground/40" },
  declined:  { label: "Décliné",   color: "text-red-400/70" },
};

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
const formatCountdown = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}j ${h}h ${m}m ${sec}s`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
};

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────
const EventDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState<EventData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [myParticipation, setMyParticipation] = useState<Participant | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [duoPartner, setDuoPartner] = useState<{ id: string; name: string } | null>(null);
  const [addingPartner, setAddingPartner] = useState(false);
  const isOrganizer = !!user && event?.organizer_id === user.id;
  const inviteLink = event ? `${window.location.origin}/invite/${event.invite_link_token}` : "";

  // Compte à rebours pour le mode "surprise sur le moment"
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!event || event.reveal_mode !== "timed" || event.status === "done") return;
    const getEventMs = () => {
      const t = event.event_time ?? "20:00:00";
      return new Date(`${event.event_date}T${t}`).getTime();
    };
    const update = () => setTimeLeft(Math.max(0, getEventMs() - Date.now()));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [event]);

  // ── Chargement initial ───────────────────────────────────
  useEffect(() => {
    if (!id) return;
    loadEvent();
  }, [id, user]);

  const loadEvent = async () => {
    if (!id) return;

    const { data: ev, error } = await supabase
      .from("events" as any)
      .select("id, title, event_date, event_time, location, is_remote, context, reveal_mode, status, organizer_id, invite_link_token, mood, genre_tags, media_type, final_pick_id, final_pick_title, final_pick_poster, final_pick_tmdb_id")
      .eq("id", id)
      .maybeSingle();

    if (error || !ev) { setNotFound(true); setLoading(false); return; }
    setEvent(ev as unknown as EventData);

    await loadParticipants(id, ev as unknown as EventData);
    setLoading(false);
  };

  const loadParticipants = async (eventId: string, evData?: EventData) => {
    const currentEvent = evData ?? event;
    const { data: eps } = await supabase
      .from("event_participants" as any)
      .select("id, user_id, guest_name, status")
      .eq("event_id", eventId);

    if (!eps) return;

    // Enrichit avec les display_name des comptes enregistrés
    const enriched: Participant[] = await Promise.all(
      (eps as unknown as Participant[]).map(async (ep) => {
        if (ep.user_id) {
          const { data: p } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", ep.user_id)
            .maybeSingle();
          let name: string = (p as any)?.display_name;
          if (!name) {
            // Fallback : cherche le nom dans le profil duo
            const { data: duo } = await (supabase as any)
              .from("duo_taste_profiles")
              .select("user1_id, user1_display_name, user2_id, user2_display_name")
              .or(`user1_id.eq.${ep.user_id},user2_id.eq.${ep.user_id}`)
              .maybeSingle();
            if (duo) {
              name = (duo as any).user1_id === ep.user_id
                ? (duo as any).user1_display_name
                : (duo as any).user2_display_name;
            }
          }
          return { ...ep, display_name: name ?? "Participant" };
        }
        return { ...ep, display_name: ep.guest_name ?? "Invité" };
      })
    );
    setParticipants(enriched);

    if (user) {
      const mine = enriched.find(p => p.user_id === user.id);
      setMyParticipation(mine ?? null);
    }

    // Détecte si le partenaire duo est absent des participants (soirée Duo)
    // Permet de l'ajouter rétroactivement si la soirée a été créée avant le fix auto-invite
    if (user && currentEvent?.context === "duo" && user.id === currentEvent?.organizer_id) {
      const { data: duo } = await supabase
        .from("duo_taste_profiles" as any)
        .select("user1_id, user2_id")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .eq("status", "active")
        .maybeSingle();
      if (duo) {
        const partnerId = (duo as any).user1_id === user.id
          ? (duo as any).user2_id
          : (duo as any).user1_id;
        if (partnerId && !enriched.find(p => p.user_id === partnerId)) {
          const { data: pProfile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", partnerId)
            .maybeSingle();
          setDuoPartner({
            id: partnerId,
            name: (pProfile as any)?.display_name ?? "Ton duo",
          });
        } else {
          setDuoPartner(null);
        }
      }
    }
  };

  // ── Realtime : mise à jour live des participants ──────────
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`event_participants_${id}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "event_participants", filter: `event_id=eq.${id}` },
        () => loadParticipants(id)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, user]);

  // ── Confirmer / annuler sa participation ─────────────────
  const confirm = async () => {
    if (!user || !event) return;
    setConfirming(true);
    try {
      if (myParticipation) {
        // Mise à jour du statut
        await supabase
          .from("event_participants" as any)
          .update({ status: "confirmed" })
          .eq("id", myParticipation.id);
      } else {
        // Nouveau participant
        await supabase
          .from("event_participants" as any)
          .insert({ event_id: event.id, user_id: user.id, status: "confirmed" });
      }
      await loadParticipants(event.id);
      toast.success("Participation confirmée !");
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setConfirming(false);
    }
  };

  const addDuoPartner = async () => {
    if (!duoPartner || !event) return;
    setAddingPartner(true);
    const { error } = await supabase.from("event_participants" as any).insert({
      event_id: event.id,
      user_id: duoPartner.id,
      status: "invited",
    });
    setAddingPartner(false);
    if (error) {
      toast.error("Impossible d'inviter le partenaire", { description: error.message });
      return;
    }
    setDuoPartner(null);
    await loadParticipants(event.id);
    toast.success(`${duoPartner.name} a été invité·e !`);
  };

  const decline = async () => {
    if (!myParticipation) return;
    await supabase
      .from("event_participants" as any)
      .update({ status: "declined" })
      .eq("id", myParticipation.id);
    await loadParticipants(event!.id);
  };

  const deleteEvent = async () => {
    if (!event) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("events" as any)
        .delete()
        .eq("id", event.id);
      if (error) throw error;
      toast.success("Soirée supprimée");
      navigate("/app/soirees");
    } catch {
      toast.error("Impossible de supprimer la soirée");
      setDeleting(false);
    }
  };

  const leaveEvent = async () => {
    if (!myParticipation) return;
    setLeaving(true);
    try {
      const { error } = await supabase
        .from("event_participants" as any)
        .delete()
        .eq("id", myParticipation.id);
      if (error) throw error;
      toast.success("Tu as quitté la soirée");
      navigate("/app/soirees");
    } catch {
      toast.error("Impossible de quitter la soirée");
      setLeaving(false);
    }
  };

  const revealFilm = () => {
    if (!event) return;
    // Stocke l'ID + tous les paramètres pipeline dans le singleton (source de vérité primaire)
    setRevealEvent({
      eventId: event.id,
      eventTitle: event.title,
      context: event.context ?? undefined,
      genres: event.genre_tags ?? [],
      mood: event.mood ?? "",
    });
    // location.state comme backup secondaire
    navigate("/app", {
      state: {
        revealEventId: event.id,
        revealContext: event.context,
        revealGenres: event.genre_tags ?? [],
        revealMood: event.mood ?? "",
      },
    });
  };


  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (navigator.share) {
      await navigator.share({ title: event?.title, text: "Rejoins ma soirée ciné !", url: inviteLink });
    } else {
      await copyLink();
    }
  };

  // ── Rendu ────────────────────────────────────────────────
  if (loading) return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  if (notFound || !event) return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="text-5xl">🎬</span>
      <h1 className="font-serif text-2xl text-foreground">Soirée introuvable</h1>
      <button onClick={() => navigate("/app/soirees")} className="mt-2 text-primary text-sm font-sans">
        Retour aux soirées
      </button>
    </div>
  );

  const confirmed = participants.filter(p => p.status === "confirmed");
  const pending   = participants.filter(p => p.status !== "confirmed");
  const myStatus  = myParticipation?.status;

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Header */}
      <div className="pt-[calc(3rem+env(safe-area-inset-top))] px-5 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <button aria-label="Retour aux soirées" onClick={() => navigate("/app/soirees")} className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground/60" />
          </button>
          {isOrganizer ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-full hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4.5 h-4.5 text-red-400/60" />
            </button>
          ) : myParticipation ? (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="p-2 rounded-full hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4.5 h-4.5 text-red-400/60" />
            </button>
          ) : null}
        </div>

        <p className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-primary/70 mb-0.5">
          {event.context ? ({ duo: "Soirée Duo", famille: "Soirée Famille", amis: "Soirée entre amis", solo: "Soirée solo" }[event.context] ?? "Soirée ciné") : "Soirée ciné"}
        </p>
        <h1 className="font-serif text-[24px] text-foreground leading-tight">{event.title}</h1>

        {/* Méta */}
        <div className="flex flex-col gap-1.5 mt-3">
          <div className="flex items-center gap-2 text-[13px] font-sans text-foreground/60">
            <Calendar className="w-3.5 h-3.5 text-primary/50 shrink-0" />
            <span className="capitalize">{formatDate(event.event_date, event.event_time)}</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] font-sans text-foreground/60">
            {event.is_remote ? <Wifi className="w-3.5 h-3.5 text-primary/50 shrink-0" /> : <MapPin className="w-3.5 h-3.5 text-primary/50 shrink-0" />}
            <span>{event.is_remote ? "À distance" : (event.location || "Lieu à confirmer")}</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] font-sans text-foreground/60">
            <Film className="w-3.5 h-3.5 text-primary/50 shrink-0" />
            <span>{
              event.reveal_mode === "timed"
                ? "Surprise sur le moment · révélation à l'heure de la soirée"
                : event.reveal_mode === "surprise"
                  ? "Révélation avant · l'organisateur choisit quand"
                  : "Vote pour choisir le film"
            }</span>
          </div>
          {(event.genre_tags?.length || event.mood) && (
            <div className="flex items-start gap-2 mt-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary/50 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1.5">
                {event.genre_tags && event.genre_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {event.genre_tags.map(tag => (
                      <span key={tag} className="px-2.5 py-0.5 rounded-full text-[11px] font-sans font-semibold bg-primary/20 border border-primary/35 text-primary">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {event.mood && (
                  <span className="text-[12.5px] font-sans text-foreground/55 italic">"{event.mood}"</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenu scrollable */}
      <div className="flex-1 overflow-y-auto px-5 pb-[calc(6rem+env(safe-area-inset-bottom))] space-y-5">

        {/* ── Ma participation (si pas organisateur) ── */}
        {!isOrganizer && (
          <AnimatePresence>
            {myStatus !== "confirmed" ? (
              <motion.div
                key="cta-confirm"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-primary/10 border border-primary/30 p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-[13px] font-sans font-semibold text-foreground">Tu participes ?</p>
                  <p className="text-[11.5px] text-foreground/45 mt-0.5">Confirme ta présence pour que l'organisateur le sache.</p>
                </div>
                <button
                  onClick={confirm}
                  disabled={confirming}
                  className="shrink-0 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-[12.5px] font-sans font-semibold flex items-center gap-1.5 disabled:opacity-60"
                >
                  {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Confirmer
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="confirmed-badge"
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 flex items-center gap-3"
              >
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-[13px] font-sans font-semibold text-emerald-400">Ta présence est confirmée</p>
                </div>
                <button onClick={decline} className="text-[11px] text-foreground/45 font-sans hover:text-foreground/60 transition-colors">
                  Annuler
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* ── Partenaire duo manquant ── */}
        <AnimatePresence>
          {duoPartner && isOrganizer && (
            <motion.div
              key="duo-missing"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="rounded-2xl bg-primary/[0.08] border border-primary/25 p-4 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-[14px] font-serif font-semibold text-primary shrink-0">
                {duoPartner.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-sans font-semibold text-foreground">{duoPartner.name}</p>
                <p className="text-[11px] text-foreground/40 mt-0.5">Pas encore invité·e à cette soirée</p>
              </div>
              <button
                onClick={addDuoPartner}
                disabled={addingPartner}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-[12px] font-sans font-semibold disabled:opacity-60"
              >
                {addingPartner ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Inviter"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Participants ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary/60" />
              <p className="text-[11px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">
                Participants
              </p>
            </div>
            {participants.length > 0 && (
              <span className="text-[11px] font-sans font-semibold text-emerald-400">
                {confirmed.length}/{participants.length} confirmé{confirmed.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {participants.length === 0 ? (
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] px-4 py-6 text-center">
              <p className="text-sm text-foreground/45 font-sans">Aucun participant pour l'instant</p>
              {isOrganizer && (
                <p className="text-[11px] text-foreground/40 font-sans mt-1">Partagez le lien ci-dessous pour inviter</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {participants.map((p, i) => {
                const isOwner = p.user_id === event.organizer_id;
                const statusConfig = {
                  confirmed: { label: "Confirmé",   dot: "bg-emerald-400", text: "text-emerald-400",  ring: "ring-emerald-400/30" },
                  invited:   { label: "En attente", dot: "bg-amber-400 animate-pulse", text: "text-amber-400/80", ring: "ring-amber-400/20" },
                  declined:  { label: "Décliné",    dot: "bg-red-400",     text: "text-red-400/70",   ring: "ring-transparent" },
                }[p.status] ?? { label: p.status, dot: "bg-white/20", text: "text-foreground/40", ring: "ring-transparent" };

                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border transition-colors ${
                      p.status === "confirmed"
                        ? "bg-emerald-500/5 border-emerald-500/15"
                        : p.status === "invited"
                          ? "bg-amber-500/5 border-amber-500/15"
                          : "bg-white/5 border-white/10"
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`relative w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-serif font-semibold shrink-0 ring-2 ${statusConfig.ring} ${
                      isOwner ? "bg-primary/25 text-primary" : "bg-white/10 text-foreground/70"
                    }`}>
                      {(p.display_name ?? "?")[0].toUpperCase()}
                      {/* Dot de statut */}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${statusConfig.dot}`} />
                    </div>

                    {/* Nom + rôle */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13.5px] font-sans font-semibold text-foreground truncate">{p.display_name}</span>
                        {isOwner && <Crown className="w-3 h-3 text-primary/50 shrink-0" />}
                      </div>
                      <span className={`text-[11px] font-sans font-medium ${statusConfig.text}`}>
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Icône statut */}
                    {p.status === "confirmed" && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Lien d'invitation (organisateur, hors soirée Duo) ── */}
        {isOrganizer && event.context !== "duo" && (
          <div>
            <p className="text-[11px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40 mb-2">
              Inviter des amis
            </p>
            <div className="rounded-xl bg-card border border-border/30 px-4 py-2.5 mb-2">
              <p className="text-[11.5px] font-sans text-foreground/50 truncate">{inviteLink}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyLink}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[12.5px] font-sans font-medium transition-all ${copied ? "border-primary/40 bg-primary/10 text-primary" : "border-white/[0.10] bg-white/[0.04] text-foreground/70"}`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copié !" : "Copier"}
              </button>
              <button
                onClick={shareLink}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-[12.5px] font-sans font-semibold"
              >
                <Share2 className="w-3.5 h-3.5" />
                Partager
              </button>
            </div>
          </div>
        )}

        {/* ── Révéler le film (organisateur) ── */}
        {isOrganizer && (event.reveal_mode === "surprise" || event.reveal_mode === "timed") && event.status !== "done" && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 flex items-center gap-3">
            {event.reveal_mode === "timed" && timeLeft !== null && timeLeft > 0 ? (
              <>
                <Clock className="w-6 h-6 text-primary/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-sans font-semibold text-foreground">Surprise sur le moment</p>
                  <p className="text-[11.5px] text-foreground/40 mt-0.5">
                    Révélation dans <span className="text-primary/70 font-semibold tabular-nums">{formatCountdown(timeLeft)}</span>
                  </p>
                </div>
              </>
            ) : (
              <>
                <span className="text-2xl">🎩</span>
                <div className="flex-1">
                  <p className="text-[13px] font-sans font-semibold text-foreground">
                    {event.reveal_mode === "timed" ? "L'heure est venue !" : "Révéler le film"}
                  </p>
                  <p className="text-[11.5px] text-foreground/40 mt-0.5">
                    {event.context === "duo" ? "Pick analyse vos deux profils et propose 3 films." : "Pick analyse ton profil et propose 3 films."}
                  </p>
                </div>
                <button
                  onClick={revealFilm}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/15 border border-primary/25 text-primary text-[12px] font-sans font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Révéler
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Film révélé (visible par tous) ── */}
        {event.status === "done" && event.final_pick_title && (
          <div className="rounded-2xl overflow-hidden border border-primary/25">
            <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/[0.08]">
              <span className="text-base">🎩</span>
              <p className="text-[11px] font-sans font-semibold tracking-[0.15em] uppercase text-primary/80">Le pick de la soirée</p>
            </div>
            <div className="flex gap-3 p-3 bg-white/[0.02]">
              {event.final_pick_poster ? (
                <img
                  src={`https://image.tmdb.org/t/p/w185${event.final_pick_poster}`}
                  alt={event.final_pick_title}
                  className="w-16 h-24 object-cover rounded-xl shrink-0"
                />
              ) : (
                <div className="w-16 h-24 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
                  <Film className="w-5 h-5 text-foreground/40" />
                </div>
              )}
              <div className="flex-1 flex flex-col justify-center gap-1">
                <p className="font-serif text-[16px] text-foreground leading-tight">{event.final_pick_title}</p>
                <p className="text-[11px] font-sans text-foreground/40">Choisi par l'organisateur</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom sheet confirmation suppression ── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              className="fixed inset-0 bg-black/60 z-50"
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="fixed bottom-0 inset-x-0 z-50 bg-[hsl(240_22%_6%)] border-t border-white/[0.08] rounded-t-3xl px-5 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))]"
            >
              <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-5" />

              <div className="flex flex-col items-center gap-3 text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="font-serif text-[18px] text-foreground">Supprimer la soirée ?</p>
                  <p className="text-[12.5px] text-foreground/45 font-sans mt-1 leading-snug">
                    Cette action est irréversible.<br />
                    Tous les participants et votes seront supprimés.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={deleteEvent}
                  disabled={deleting}
                  className="w-full py-3.5 rounded-2xl bg-red-500/90 text-white font-sans font-semibold text-[13.5px] flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {deleting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Trash2 className="w-4 h-4" /> Supprimer définitivement</>
                  }
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] text-foreground/70 font-sans text-[13.5px]"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Bottom sheet confirmation quitter ── */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowLeaveConfirm(false)}
              className="fixed inset-0 bg-black/60 z-50"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="fixed bottom-0 inset-x-0 z-50 bg-[hsl(240_22%_6%)] border-t border-white/[0.08] rounded-t-3xl px-5 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))]"
            >
              <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-5" />
              <div className="flex flex-col items-center gap-3 text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="font-serif text-[18px] text-foreground">Quitter la soirée ?</p>
                  <p className="text-[12.5px] text-foreground/45 font-sans mt-1 leading-snug">
                    Tu seras retiré·e de la liste des participants.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={leaveEvent}
                  disabled={leaving}
                  className="w-full py-3.5 rounded-2xl bg-red-500/90 text-white font-sans font-semibold text-[13.5px] flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {leaving
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><LogOut className="w-4 h-4" /> Quitter la soirée</>
                  }
                </button>
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="w-full py-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] text-foreground/70 font-sans text-[13.5px]"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EventDetailPage;
