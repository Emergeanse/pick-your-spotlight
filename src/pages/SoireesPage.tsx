import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Heart, Home, Users, UsersRound, User, Plus, Loader2, ChevronRight, Check, Clock, Eye, Timer, Film } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import soireesBackground from "@/assets/soirees-background.webp";

type ParticipantSummary = {
  total: number;
  confirmed: number;
};

type EventRow = {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  context: "duo" | "famille" | "amis" | "solo" | null;
  status: string;
  reveal_mode: "surprise" | "vote" | "timed";
  invite_link_token: string;
  organizer_id: string;
  participants: ParticipantSummary;
  myStatus?: "confirmed" | "invited" | "declined";
  final_pick_title: string | null;
  final_pick_poster: string | null;
};

const CONTEXT_ICON: Record<string, React.ComponentType<any>> = {
  duo:     Heart,
  famille: Home,
  amis:    Users,
  solo:    User,
};

const CONTEXT_COLOR: Record<string, { card: string; iconBg: string; iconText: string }> = {
  duo:     { card: "bg-pink-500/10 border-pink-500/20",     iconBg: "bg-pink-500/15",    iconText: "text-pink-400" },
  famille: { card: "bg-indigo-500/10 border-indigo-500/20", iconBg: "bg-indigo-500/15",  iconText: "text-indigo-400" },
  amis:    { card: "bg-emerald-500/10 border-emerald-500/20", iconBg: "bg-emerald-500/15", iconText: "text-emerald-400" },
  solo:    { card: "bg-orange-400/10 border-orange-400/20", iconBg: "bg-orange-400/15",  iconText: "text-orange-400" },
};

const isUpcoming = (dateStr: string) =>
  new Date(dateStr + "T23:59:59") >= new Date();

const formatDate = (dateStr: string, time: string | null) => {
  const d = new Date(dateStr + "T12:00:00");
  const date = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return time ? `${date} · ${time.slice(0, 5)}` : date;
};

const SoireesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadEvents();
  }, [user]);

  const loadEvents = async () => {
    if (!user) return;

    // 1. Soirées où je suis organisateur
    const { data: orgRows } = await supabase
      .from("events" as any)
      .select("id, title, event_date, event_time, context, status, reveal_mode, invite_link_token, organizer_id, final_pick_title, final_pick_poster")
      .eq("organizer_id", user.id)
      .neq("status", "cancelled");

    // 2. Soirées où je suis participant invité (pas organisateur)
    const { data: myEps } = await supabase
      .from("event_participants" as any)
      .select("event_id, status")
      .eq("user_id", user.id);

    const participatingIds = (myEps ?? [])
      .map((ep: any) => ep.event_id)
      .filter((eid: string) => !(orgRows ?? []).find((e: any) => e.id === eid));

    let guestRows: any[] = [];
    if (participatingIds.length > 0) {
      const { data } = await supabase
        .from("events" as any)
        .select("id, title, event_date, event_time, context, status, reveal_mode, invite_link_token, organizer_id, final_pick_title, final_pick_poster")
        .in("id", participatingIds)
        .neq("status", "cancelled");
      guestRows = data ?? [];
    }

    const allEvents = [...(orgRows ?? []), ...guestRows];
    if (!allEvents.length) { setEvents([]); setLoading(false); return; }

    allEvents.sort((a, b) => a.event_date.localeCompare(b.event_date));

    const ids = allEvents.map((e: any) => e.id);

    // Participants de toutes ces soirées
    const { data: epRows } = await supabase
      .from("event_participants" as any)
      .select("event_id, status, user_id")
      .in("event_id", ids);

    // Groupe par event_id
    const byEvent: Record<string, ParticipantSummary> = {};
    const myStatusByEvent: Record<string, "confirmed" | "invited" | "declined"> = {};
    ids.forEach((id: string) => { byEvent[id] = { total: 0, confirmed: 0 }; });
    (epRows ?? []).forEach((ep: any) => {
      if (!byEvent[ep.event_id]) return;
      byEvent[ep.event_id].total++;
      if (ep.status === "confirmed") byEvent[ep.event_id].confirmed++;
      if (ep.user_id === user.id) myStatusByEvent[ep.event_id] = ep.status;
    });

    setEvents(
      allEvents.map((e: any) => ({
        ...e,
        participants: byEvent[e.id] ?? { total: 0, confirmed: 0 },
        myStatus: myStatusByEvent[e.id],
        final_pick_title: e.final_pick_title ?? null,
        final_pick_poster: e.final_pick_poster ?? null,
      }))
    );
    setLoading(false);
  };

  const upcoming = events.filter(e => isUpcoming(e.event_date));
  const past     = events.filter(e => !isUpcoming(e.event_date));

  const EventCard = ({ evt, i }: { evt: EventRow; i: number }) => {
    const Icon = CONTEXT_ICON[evt.context ?? "solo"] ?? UsersRound;
    const colors = CONTEXT_COLOR[evt.context ?? "solo"] ?? CONTEXT_COLOR.solo;
    const isOrganizer = evt.organizer_id === user?.id;
    const { total, confirmed } = evt.participants;
    const invites = Math.max(0, total - 1);
    const confirmedInvites = Math.max(0, confirmed - 1);
    const allConfirmed = invites > 0 && confirmedInvites === invites;
    const someConfirmed = confirmedInvites > 0 && !allConfirmed;
    const isRevealed = evt.status === "done";
    const hasFilm = isRevealed && !!evt.final_pick_title;

    // Badge mon statut (vue invité)
    const myStatusBadge = !isOrganizer && evt.myStatus ? (
      evt.myStatus === "confirmed"
        ? <span className="flex items-center gap-1 text-[10px] font-sans font-semibold text-emerald-400"><Check className="w-3 h-3" />Confirmé</span>
        : <span className="text-[10px] font-sans font-medium text-amber-400/80">En attente</span>
    ) : null;

    return (
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.06, duration: 0.35 }}
        onClick={() => navigate(`/app/soirees/${evt.id}`)}
        className={`w-full flex items-center gap-3.5 p-4 rounded-2xl border text-left transition-colors backdrop-blur-sm ${
          hasFilm ? "bg-white/[0.03] border-white/[0.08]" : colors.card
        }`}
      >
        {/* Icône ou affiche du film */}
        {hasFilm ? (
          evt.final_pick_poster ? (
            <img
              src={`https://image.tmdb.org/t/p/w92${evt.final_pick_poster}`}
              alt={evt.final_pick_title!}
              className="w-10 h-14 object-cover rounded-xl shrink-0 shadow-md"
            />
          ) : (
            <div className="w-10 h-14 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
              <Film className="w-4 h-4 text-foreground/40" />
            </div>
          )
        ) : (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors.iconBg}`}>
            <Icon className={`w-5 h-5 ${colors.iconText}`} strokeWidth={1.7} />
          </div>
        )}

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[13.5px] font-sans font-semibold text-foreground truncate">{evt.title}</p>
            {!isOrganizer && (
              <span className="text-[9px] font-sans font-semibold tracking-wide uppercase text-primary/50 bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">invité</span>
            )}
          </div>
          <p className="text-[11px] text-foreground/45 mt-0.5 capitalize">{formatDate(evt.event_date, evt.event_time)}</p>

          {/* Film révélé */}
          {hasFilm && (
            <p className="text-[11px] font-sans font-medium text-primary/70 mt-1 truncate italic">
              {evt.final_pick_title}
            </p>
          )}

          {/* Vue organisateur : statut des invités (si pas révélé) */}
          {!isRevealed && isOrganizer && invites > 0 && (
            <div className={`flex items-center gap-1 mt-1.5 ${allConfirmed ? "text-emerald-400" : someConfirmed ? "text-amber-400" : "text-foreground/45"}`}>
              {allConfirmed ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              <span className="text-[10.5px] font-sans font-medium">
                {allConfirmed
                  ? `${invites} invité${invites > 1 ? "s" : ""} confirmé${invites > 1 ? "s" : ""}`
                  : confirmedInvites > 0
                    ? `${confirmedInvites}/${invites} confirmé${confirmedInvites > 1 ? "s" : ""}`
                    : `${invites} invité${invites > 1 ? "s" : ""} · en attente`
                }
              </span>
            </div>
          )}

          {/* Vue invité : mon statut */}
          {!isOrganizer && <div className="mt-1.5">{myStatusBadge}</div>}
        </div>

        {/* Badge mode / état + chevron */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {hasFilm ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/25">
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-sans font-semibold text-emerald-400">Film révélé</span>
            </div>
          ) : isRevealed ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/[0.06] border border-white/[0.1]">
              <span className="text-[10px] font-sans font-semibold text-foreground/40">Terminée</span>
            </div>
          ) : evt.reveal_mode === "timed" ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500/15 border border-amber-500/25">
              <Timer className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-sans font-semibold text-amber-400">Surprise</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-violet-500/15 border border-violet-500/25">
              <Eye className="w-3 h-3 text-violet-400" />
              <span className="text-[10px] font-sans font-semibold text-violet-400">Révélation</span>
            </div>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-foreground/40" />
        </div>
      </motion.button>
    );
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Background image — screen blend : les noirs deviennent transparents, les lueurs violettes ressortent */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${soireesBackground})`, opacity: 0.18 }}
      />
      <div className="relative pt-[calc(3.5rem+env(safe-area-inset-top))] px-5 pb-4 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="w-5 h-5 text-primary" strokeWidth={1.8} />
              <span className="text-[11px] font-sans font-semibold tracking-[0.12em] uppercase text-primary/80">Soirées</span>
            </div>
            <h1 className="text-[28px] font-serif font-bold text-foreground leading-tight">
              Tes soirées<br /><span className="italic text-primary">ciné</span>
            </h1>
          </div>
          <button
            onClick={() => navigate("/app/soiree/nouvelle")}
            className="mt-2 w-10 h-10 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center"
          >
            <Plus className="w-5 h-5 text-primary" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto px-5 pb-[calc(5rem+env(safe-area-inset-bottom))] space-y-5">
        {loading ? (
          <div className="flex justify-center pt-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 pt-16 text-center px-4">
            <span className="text-4xl">🎬</span>
            <p className="font-serif text-xl text-foreground">Aucune soirée pour l'instant</p>
            <p className="text-foreground/40 text-sm font-sans">Organise ta première soirée ciné avec Pick.</p>
            <button
              onClick={() => navigate("/app/soiree/nouvelle")}
              className="mt-3 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-sans font-semibold"
            >
              Créer une soirée
            </button>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-sans font-semibold tracking-widest uppercase text-foreground/50 px-1">À venir</p>
                {upcoming.map((evt, i) => <EventCard key={evt.id} evt={evt} i={i} />)}
              </div>
            )}
            {past.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-sans font-semibold tracking-widest uppercase text-foreground/50 px-1">Passées</p>
                {past.map((evt, i) => <EventCard key={evt.id} evt={evt} i={i} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SoireesPage;
