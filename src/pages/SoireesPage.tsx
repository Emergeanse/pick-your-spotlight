import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Heart, Home, Users, UsersRound, User, Loader2, ChevronRight, Check, Clock, Eye, Timer, Film } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchVisibleProfiles } from "@/lib/visible-profiles";
import { formatAvecQui } from "@/lib/avec-qui";
import soireesBackground from "@/assets/soirees-background.webp";
import creerSoiree from "@/assets/creer-soiree.webp";
import creerSoireeActif from "@/assets/creer-soiree-actif.webp";
import groupeDuo from "@/assets/groupe-duo.webp";
import groupeFamille from "@/assets/groupe-famille.webp";
import groupeAmis from "@/assets/groupe-amis.webp";
import groupeSurprise from "@/assets/groupe-surprise.webp";
import salonSoiree from "@/assets/soiree-salon.webp";

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
  /** Prénoms des autres personnes de la soirée (organisateur compris, moi exclu). */
  avecQui: string[];
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

// Mêmes illustrations que l'accueil et la création de soirée.
const CONTEXT_ILLUSTRATION: Record<string, string> = {
  duo: groupeDuo, famille: groupeFamille, amis: groupeAmis, solo: groupeSurprise,
};

// Pastilles d'état : or pour le film révélé (prestige), violet pour ce qui reste à venir.
const PASTILLE = "inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[11px] font-sans font-semibold whitespace-nowrap";
const TITRE_SECTION = "font-serif text-[18px] text-pick-gold px-1";

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
  // Le chargeur est redéfini à chaque rendu ; il ne lit que ce qui figure dans les dépendances.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      .select("event_id, status, user_id, guest_name")
      .in("event_id", ids);

    // Prénoms : l'organisateur et les participants avec un compte, moi exclu ;
    // les invités sans compte par le prénom qu'ils ont donné.
    type Soiree = { id: string; organizer_id: string };
    type Participation = { event_id: string; status: string; user_id: string | null; guest_name: string | null };
    const soirees = allEvents as Soiree[];
    const participations = (epRows ?? []) as unknown as Participation[];
    const idsComptes = new Set<string>();
    soirees.forEach((e) => { if (e.organizer_id !== user.id) idsComptes.add(e.organizer_id); });
    participations.forEach((ep) => { if (ep.user_id && ep.user_id !== user.id) idsComptes.add(ep.user_id); });
    const profils = await fetchVisibleProfiles([...idsComptes]);
    const prenomDe = new Map(profils.map((p) => [p.id, p.display_name?.trim() || null]));
    const avecQuiParSoiree: Record<string, string[]> = {};
    soirees.forEach((e) => {
      const noms: string[] = [];
      if (e.organizer_id !== user.id) noms.push(prenomDe.get(e.organizer_id) ?? "Un ami");
      participations.forEach((ep) => {
        if (ep.event_id !== e.id || ep.status === "declined") return;
        if (ep.user_id === user.id || ep.user_id === e.organizer_id) return;
        noms.push(ep.user_id ? (prenomDe.get(ep.user_id) ?? "Un ami") : (ep.guest_name?.trim() || "Un invité"));
      });
      avecQuiParSoiree[e.id] = noms;
    });

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
        avecQui: avecQuiParSoiree[e.id] ?? [],
        myStatus: myStatusByEvent[e.id],
        final_pick_title: e.final_pick_title ?? null,
        final_pick_poster: e.final_pick_poster ?? null,
      }))
    );
    setLoading(false);
  };

  const upcoming = events.filter(e => isUpcoming(e.event_date));
  const past     = events.filter(e => !isUpcoming(e.event_date));

  const EventCard = ({ evt, i, avenir = false }: { evt: EventRow; i: number; avenir?: boolean }) => {
    const illustration = CONTEXT_ILLUSTRATION[evt.context ?? "solo"] ?? groupeSurprise;
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
        ? <span className="flex items-center gap-1 text-[11px] font-sans font-semibold text-pick-purple-light"><Check className="w-3 h-3" />Confirmé</span>
        : <span className="text-[11px] font-sans font-medium text-pick-text-secondary">En attente de ta réponse</span>
    ) : null;

    return (
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.06, duration: 0.35 }}
        onClick={() => navigate(`/app/soirees/${evt.id}`)}
        className={`w-full flex items-center gap-3.5 text-left backdrop-blur-md transition-colors duration-180 ease-pick active:scale-[0.99] ${
          avenir
            ? "p-4 rounded-pick-lg border border-pick-gold/40 bg-[linear-gradient(135deg,rgba(42,26,82,0.85),rgba(18,14,30,0.85))] shadow-[0_14px_34px_-14px_rgba(0,0,0,0.7),0_0_20px_-8px_rgba(229,194,107,0.3)]"
            : "p-3.5 rounded-pick-lg border border-pick-border bg-pick-surface/70 [@media(hover:hover)]:hover:border-pick-border-hover"
        }`}
      >
        {/* Icône ou affiche du film */}
        {hasFilm ? (
          evt.final_pick_poster ? (
            <img
              src={`https://image.tmdb.org/t/p/w92${evt.final_pick_poster}`}
              alt={evt.final_pick_title!}
              className="w-10 h-14 object-cover rounded-pick-sm shrink-0 shadow-md ring-1 ring-white/10"
            />
          ) : (
            <div className="w-10 h-14 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
              <Film className="w-4 h-4 text-foreground/40" />
            </div>
          )
        ) : (
          <div className={`${avenir ? "w-14 h-14" : "w-10 h-14"} rounded-pick-md flex items-center justify-center shrink-0 border border-pick-border bg-[radial-gradient(circle_at_50%_40%,rgba(139,92,246,0.25),rgba(0,0,0,0.5))]`}>
            <img src={illustration} alt="" aria-hidden="true" className={`${avenir ? "w-10 h-10" : "w-8 h-8"} object-contain`} />
          </div>
        )}

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`${avenir ? "font-serif text-[18px] text-white" : "text-[14px] font-sans font-semibold text-foreground"} leading-tight truncate`}>{evt.title.split(" · ")[0]}</p>
            {!isOrganizer && (
              <span className="text-[11px] font-sans font-semibold text-pick-purple-light bg-primary/15 px-1.5 py-0.5 rounded-full shrink-0">invité</span>
            )}
          </div>
          <p className="text-[12px] text-pick-text-secondary mt-0.5 capitalize">{formatDate(evt.event_date, evt.event_time)}</p>
          {evt.avecQui.length > 0 && (
            <p className="text-[12px] font-sans text-pick-text-secondary mt-0.5 truncate">
              avec <span className="font-semibold text-foreground/85">{formatAvecQui(evt.avecQui)}</span>
            </p>
          )}

          {/* Film révélé */}
          {hasFilm && (
            <p className="text-[12px] font-serif text-pick-gold mt-1 truncate">
              {evt.final_pick_title}
            </p>
          )}

          {/* Vue organisateur : statut des invités (si pas révélé) */}
          {!isRevealed && isOrganizer && invites > 0 && (
            <div className={`flex items-center gap-1 mt-1.5 ${allConfirmed ? "text-pick-purple-light" : someConfirmed ? "text-foreground/80" : "text-pick-text-muted"}`}>
              {allConfirmed ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              <span className="text-[11px] font-sans font-medium">
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
            <span className={`${PASTILLE} border-pick-gold/45 bg-pick-gold/10 text-pick-gold`}>
              <Check className="w-3 h-3" /> Film révélé
            </span>
          ) : isRevealed ? (
            <span className={`${PASTILLE} border-white/[0.08] bg-white/[0.04] text-pick-text-muted`}>Terminée</span>
          ) : evt.reveal_mode === "timed" ? (
            <span className={`${PASTILLE} border-pick-purple-light/45 bg-primary/15 text-pick-purple-light`}>
              <Timer className="w-3 h-3" /> Surprise
            </span>
          ) : (
            <span className={`${PASTILLE} border-pick-purple-light/45 bg-primary/15 text-pick-purple-light`}>
              <Eye className="w-3 h-3" /> À révéler
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-pick-text-muted" />
        </div>
      </motion.button>
    );
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Background image — screen blend : les noirs deviennent transparents, les lueurs violettes ressortent */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[380px] bg-cover bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: `url(${salonSoiree})`,
          backgroundPosition: "60% 30%",
          maskImage: "linear-gradient(to bottom, black 35%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 35%, transparent 100%)",
          opacity: 0.55,
        }}
      />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[380px] pointer-events-none bg-[linear-gradient(90deg,hsl(var(--background)/0.8)_0%,hsl(var(--background)/0.25)_60%,transparent_85%)]" />
      <div className="relative pt-[calc(3.5rem+env(safe-area-inset-top))] px-5 pb-4 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-[34px] text-white leading-[1.02] [text-shadow:0_2px_16px_rgba(0,0,0,0.6)]">
              Tes soirées<br /><span className="text-pick-purple-light">ciné.</span>
            </h1>
            <p className="mt-1.5 text-[13px] font-sans text-foreground/75">
              {upcoming.length > 0 ? `${upcoming.length} à venir · ${past.length} passée${past.length > 1 ? "s" : ""}` : "Organise la prochaine."}
            </p>
          </div>
          <button
            onClick={() => navigate("/app/soiree/nouvelle")}
            className="group relative mt-1 w-12 h-12 rounded-full flex items-center justify-center active:scale-[0.96] transition-transform"
            aria-label="Créer une nouvelle soirée ciné"
          >
            {/* Même ticket que le bouton central de la barre d'onglets : le
                halo déborde pour que le disque seul fasse les 48 px du bouton. */}
            <img
              src={creerSoiree}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="absolute w-16 h-16 max-w-none pointer-events-none select-none"
            />
            <img
              src={creerSoireeActif}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="absolute w-16 h-16 max-w-none pointer-events-none select-none opacity-0 group-active:opacity-100 group-focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity duration-200"
            />
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
            <img src={groupeDuo} alt="" aria-hidden="true" className="w-16 h-16 object-contain" />
            <p className="font-serif text-[22px] text-foreground">Aucune soirée pour l'instant</p>
            <p className="text-pick-text-secondary text-[14px] font-sans">Choisis une date, invite qui tu veux : Pick trouve le film pour tout le monde.</p>
            <button
              onClick={() => navigate("/app/soiree/nouvelle")}
              className="mt-3 h-12 px-6 rounded-full border-[1.5px] border-pick-purple-light/80 bg-[linear-gradient(180deg,#3a2470,#1c1040)] text-white text-[15px] font-sans font-semibold shadow-[0_0_0_4px_rgba(139,92,246,0.14),0_0_30px_rgba(168,85,247,0.5)]"
            >
              Crée ta première soirée
            </button>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="space-y-2.5">
                <h2 className={TITRE_SECTION}>À venir</h2>
                {upcoming.map((evt, i) => <EventCard key={evt.id} evt={evt} i={i} avenir />)}
              </div>
            )}
            {past.length > 0 && (
              <div className="space-y-2">
                <h2 className={TITRE_SECTION}>Souvenirs</h2>
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
