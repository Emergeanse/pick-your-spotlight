import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Heart, Home, Users, UsersRound, Plus, Loader2, ChevronRight, Check, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

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
  reveal_mode: "surprise" | "vote";
  invite_link_token: string;
  participants: ParticipantSummary;
};

const CONTEXT_ICON: Record<string, React.ComponentType<any>> = {
  duo:     Heart,
  famille: Home,
  amis:    Users,
  solo:    UsersRound,
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

    // Récupère les soirées de l'organisateur
    const { data: evRows } = await supabase
      .from("events" as any)
      .select("id, title, event_date, event_time, context, status, reveal_mode, invite_link_token")
      .eq("organizer_id", user.id)
      .neq("status", "cancelled")
      .order("event_date", { ascending: true });

    if (!evRows?.length) { setEvents([]); setLoading(false); return; }

    const ids = (evRows as any[]).map(e => e.id);

    // Récupère tous les participants de ces soirées en une seule requête
    const { data: epRows } = await supabase
      .from("event_participants" as any)
      .select("event_id, status")
      .in("event_id", ids);

    // Groupe par event_id
    const byEvent: Record<string, ParticipantSummary> = {};
    ids.forEach(id => { byEvent[id] = { total: 0, confirmed: 0 }; });
    (epRows ?? []).forEach((ep: any) => {
      if (!byEvent[ep.event_id]) return;
      byEvent[ep.event_id].total++;
      if (ep.status === "confirmed") byEvent[ep.event_id].confirmed++;
    });

    setEvents(
      (evRows as any[]).map(e => ({ ...e, participants: byEvent[e.id] ?? { total: 0, confirmed: 0 } }))
    );
    setLoading(false);
  };

  const upcoming = events.filter(e => isUpcoming(e.event_date));
  const past     = events.filter(e => !isUpcoming(e.event_date));

  const EventCard = ({ evt, i }: { evt: EventRow; i: number }) => {
    const Icon = CONTEXT_ICON[evt.context ?? "solo"] ?? UsersRound;
    const { total, confirmed } = evt.participants;
    // -1 pour exclure l'organisateur lui-même du décompte "invités"
    const invites = Math.max(0, total - 1);
    const confirmedInvites = Math.max(0, confirmed - 1);
    const allConfirmed = invites > 0 && confirmedInvites === invites;
    const someConfirmed = confirmedInvites > 0 && !allConfirmed;

    return (
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.06, duration: 0.35 }}
        onClick={() => navigate(`/app/soirees/${evt.id}`)}
        className="w-full flex items-center gap-3.5 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.07] text-left"
      >
        {/* Icône */}
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" strokeWidth={1.7} />
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-sans font-semibold text-foreground truncate">{evt.title}</p>
          <p className="text-[11px] text-foreground/45 mt-0.5 capitalize">{formatDate(evt.event_date, evt.event_time)}</p>

          {/* Statut participants */}
          {invites > 0 && (
            <div className={`flex items-center gap-1 mt-1.5 ${allConfirmed ? "text-emerald-400" : someConfirmed ? "text-amber-400" : "text-foreground/30"}`}>
              {allConfirmed
                ? <Check className="w-3 h-3" />
                : <Clock className="w-3 h-3" />
              }
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
        </div>

        {/* Mode + chevron */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-foreground/45">
            {evt.reveal_mode === "surprise" ? "🎩" : "🗳️"}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-foreground/20" />
        </div>
      </motion.button>
    );
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="pt-[calc(3.5rem+env(safe-area-inset-top))] px-5 pb-4 shrink-0">
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

      <div className="flex-1 overflow-y-auto px-5 pb-[calc(5rem+env(safe-area-inset-bottom))] space-y-5">
        {loading ? (
          <div className="flex justify-center pt-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary/50" />
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
                <p className="text-[11px] font-sans font-semibold tracking-widest uppercase text-foreground/35 px-1">À venir</p>
                {upcoming.map((evt, i) => <EventCard key={evt.id} evt={evt} i={i} />)}
              </div>
            )}
            {past.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-sans font-semibold tracking-widest uppercase text-foreground/35 px-1">Passées</p>
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
