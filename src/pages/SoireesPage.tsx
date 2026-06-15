import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, UsersRound, Heart, Home, Users, Plus, Loader2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type EventRow = {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  context: "duo" | "famille" | "amis" | "solo" | null;
  status: string;
  reveal_mode: "surprise" | "vote";
  invite_link_token: string;
};

const CONTEXT_ICON: Record<string, React.ComponentType<any>> = {
  duo:     Heart,
  famille: Home,
  amis:    Users,
  solo:    UsersRound,
};

const CONTEXT_LABEL: Record<string, string> = {
  duo:     "Duo",
  famille: "Famille",
  amis:    "Entre amis",
  solo:    "Solo",
};

const isUpcoming = (dateStr: string) =>
  new Date(dateStr + "T23:59:59") >= new Date();

const SoireesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("events" as any)
        .select("id, title, event_date, event_time, context, status, reveal_mode, invite_link_token")
        .eq("organizer_id", user.id)
        .neq("status", "cancelled")
        .order("event_date", { ascending: true });
      setEvents((data as EventRow[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const upcoming = events.filter(e => isUpcoming(e.event_date));
  const past     = events.filter(e => !isUpcoming(e.event_date));

  const formatDate = (dateStr: string, time: string | null) => {
    const d = new Date(dateStr + "T12:00:00");
    const date = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    return time ? `${date} · ${time.slice(0, 5)}` : date;
  };

  const EventCard = ({ evt, i }: { evt: EventRow; i: number }) => {
    const Icon = CONTEXT_ICON[evt.context ?? "solo"] ?? UsersRound;
    return (
      <motion.button
        key={evt.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.06, duration: 0.35 }}
        onClick={() => navigate(`/app/soirees/${evt.id}`)}
        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.07] text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" strokeWidth={1.7} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-sans font-semibold text-foreground truncate">{evt.title}</p>
          <p className="text-xs text-foreground/45 mt-0.5 capitalize">{formatDate(evt.event_date, evt.event_time)}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-foreground/50">
            {evt.reveal_mode === "surprise" ? "🎩 Surprise" : "🗳️ Vote"}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-foreground/20" />
        </div>
      </motion.button>
    );
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="pt-[calc(3.5rem+env(safe-area-inset-top))] px-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <CalendarDays className="w-5 h-5 text-primary" strokeWidth={1.8} />
              <span className="text-[11px] font-sans font-semibold tracking-[0.12em] uppercase text-primary/80">
                Soirées
              </span>
            </div>
            <h1 className="text-[28px] font-serif font-bold text-foreground leading-tight">
              Tes soirées<br />
              <span className="italic text-primary">ciné</span>
            </h1>
          </div>
          <button
            onClick={() => navigate("/app/soiree/nouvelle")}
            className="w-10 h-10 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center"
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
