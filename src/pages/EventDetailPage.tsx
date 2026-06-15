import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Calendar, Clock, MapPin, Wifi, Copy, Share2, Check,
  Loader2, Users, ChevronRight, Sparkles, Film, Crown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

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
  reveal_mode: "surprise" | "vote";
  status: string;
  organizer_id: string;
  invite_link_token: string;
};

type Participant = {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
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

  const isOrganizer = !!user && event?.organizer_id === user.id;
  const inviteLink = event ? `${window.location.origin}/invite/${event.invite_link_token}` : "";

  // ── Chargement initial ───────────────────────────────────
  useEffect(() => {
    if (!id) return;
    loadEvent();
  }, [id, user]);

  const loadEvent = async () => {
    if (!id) return;

    const { data: ev, error } = await supabase
      .from("events" as any)
      .select("id, title, event_date, event_time, location, is_remote, context, reveal_mode, status, organizer_id, invite_link_token")
      .eq("id", id)
      .maybeSingle();

    if (error || !ev) { setNotFound(true); setLoading(false); return; }
    setEvent(ev as EventData);

    await loadParticipants(id);
    setLoading(false);
  };

  const loadParticipants = async (eventId: string) => {
    const { data: eps } = await supabase
      .from("event_participants" as any)
      .select("id, user_id, guest_name, guest_email, status")
      .eq("event_id", eventId);

    if (!eps) return;

    // Enrichit avec les display_name des comptes enregistrés
    const enriched: Participant[] = await Promise.all(
      (eps as Participant[]).map(async (ep) => {
        if (ep.user_id) {
          const { data: p } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", ep.user_id)
            .maybeSingle();
          return { ...ep, display_name: (p as any)?.display_name ?? ep.user_id.slice(0, 8) };
        }
        return { ...ep, display_name: ep.guest_name ?? "Invité" };
      })
    );
    setParticipants(enriched);

    if (user) {
      const mine = enriched.find(p => p.user_id === user.id);
      setMyParticipation(mine ?? null);
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

  const decline = async () => {
    if (!myParticipation) return;
    await supabase
      .from("event_participants" as any)
      .update({ status: "declined" })
      .eq("id", myParticipation.id);
    await loadParticipants(event!.id);
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
        <button onClick={() => navigate("/app/soirees")} className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors mb-3">
          <ArrowLeft className="w-5 h-5 text-foreground/60" />
        </button>

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
            <span>{event.reveal_mode === "surprise" ? "Film surprise · révélé le soir J" : "Vote pour choisir le film"}</span>
          </div>
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
                <button onClick={decline} className="text-[11px] text-foreground/30 font-sans hover:text-foreground/60 transition-colors">
                  Annuler
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* ── Participants ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-primary/60" />
            <p className="text-[11px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">
              Participants · {confirmed.length} confirmé{confirmed.length > 1 ? "s" : ""}
            </p>
          </div>

          <div className="space-y-2">
            {participants.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.05]"
              >
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-[13px] font-serif font-semibold text-primary shrink-0">
                  {(p.display_name ?? "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-sans font-medium text-foreground truncate">{p.display_name}</span>
                    {p.user_id === event.organizer_id && (
                      <Crown className="w-3 h-3 text-primary/60 shrink-0" />
                    )}
                  </div>
                </div>
                <span className={`text-[11px] font-sans font-medium ${statusLabel[p.status]?.color ?? "text-foreground/40"}`}>
                  {statusLabel[p.status]?.label ?? p.status}
                </span>
              </motion.div>
            ))}

            {participants.length === 0 && (
              <p className="text-sm text-foreground/30 font-sans text-center py-4">Aucun participant pour l'instant</p>
            )}
          </div>
        </div>

        {/* ── Lien d'invitation (organisateur seulement) ── */}
        {isOrganizer && (
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

        {/* ── Révéler le film (organisateur, mode surprise) ── */}
        {isOrganizer && event.reveal_mode === "surprise" && event.status !== "done" && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 flex items-center gap-3">
            <span className="text-2xl">🎩</span>
            <div className="flex-1">
              <p className="text-[13px] font-sans font-semibold text-foreground">Révéler le film</p>
              <p className="text-[11.5px] text-foreground/40 mt-0.5">Annonce le film Pick à tous les participants.</p>
            </div>
            <button
              onClick={() => toast("Bientôt disponible !", { description: "La révélation arrive dans la prochaine mise à jour." })}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/15 border border-primary/25 text-primary text-[12px] font-sans font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Révéler
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventDetailPage;
