import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Calendar, MapPin, Wifi, Copy, Share2, Check,
  Loader2, Users, Sparkles, Film, Crown, Trash2, AlertTriangle, LogOut, Clock, Vote, Star, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchVisibleProfile } from "@/lib/visible-profiles";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { setRevealEvent, queueForReveal } from "@/lib/event-reveal";
import PostSoireeFlow, { type PostSoireeEvent } from "@/components/pick/PostSoireeFlow";
import FlipCardDetail from "@/components/pick/FlipCardDetail";
import SoireeFilmOverlay from "@/components/pick/SoireeFilmOverlay";
import { getMovieDetailsWithCredits, getWatchProviders, getDisplayTitle, type MovieDetail } from "@/lib/tmdb";
import { getUserTasteProfile } from "@/lib/interactions";
import { getLikedMovies } from "@/lib/liked-movies";
import { computeUserTasteVector, ensureMovieEmbedding } from "@/lib/taste-engine";
import {
  detectPickMediaType,
  loadFinalPickDetail,
  pickMediaTypesToTry,
  titlesMatch,
} from "@/lib/event-final-pick";

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
  final_pick_media_type: string | null;
};

type Participant = {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email?: string | null;
  status: "invited" | "confirmed" | "declined";
  display_name?: string;
};

type EventRecommendation = {
  id: string;
  movie_title: string | null;
  poster_path: string | null;
  tmdb_id: number | null;
  position: number | null;
  catalog_item_id: string | null;
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

const mediaTypeLabel = (mt: string | null | undefined) => {
  if (mt === "movie") return "Film";
  if (mt === "tv") return "Série";
  if (mt === "both") return "Film ou série";
  return null;
};

/** Résumé compact des critères de la soirée (genres, mood, type) */
const EventPickSummary = ({ event }: { event: EventData }) => {
  const mt = mediaTypeLabel(event.media_type);
  const hasGenres = (event.genre_tags?.length ?? 0) > 0;
  const hasMood = !!event.mood?.trim();
  if (!mt && !hasGenres && !hasMood) return null;

  return (
    <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-white/[0.06]">
      {mt && (
        <p className="text-[11px] font-sans text-foreground/45">
          Type · <span className="text-foreground/65">{mt}</span>
        </p>
      )}
      {hasGenres && (
        <div className="flex flex-wrap gap-1">
          {event.genre_tags!.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold bg-primary/15 border border-primary/25 text-primary/90"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {hasMood && (
        <p className="text-[11px] font-sans text-foreground/50 italic line-clamp-2">
          « {event.mood} »
        </p>
      )}
    </div>
  );
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
  const [isRevealing, setIsRevealing] = useState(false);
  const [recommendations, setRecommendations] = useState<EventRecommendation[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [myVoteId, setMyVoteId] = useState<string | null>(null);
  const [loadingVotes, setLoadingVotes] = useState(false);
  const [castingVoteId, setCastingVoteId] = useState<string | null>(null);
  const [revealingWinner, setRevealingWinner] = useState(false);
  const [hasFeedback, setHasFeedback] = useState(false);
  const [showPostSoiree, setShowPostSoiree] = useState(false);
  const [filmFicheMovie, setFilmFicheMovie] = useState<MovieDetail | null>(null);
  const [filmDetailOpen, setFilmDetailOpen] = useState(false);
  const [loadingFilmFiche, setLoadingFilmFiche] = useState(false);
  const [filmMatchData, setFilmMatchData] = useState<Record<string, unknown> | null>(null);
  const [filmMatchLoading, setFilmMatchLoading] = useState(false);
  const [filmFicheProviders, setFilmFicheProviders] = useState<{ name: string; logo_path: string; provider_id?: number }[]>([]);
  const [cardProviders, setCardProviders] = useState<{ name: string; logo_path: string; provider_id?: number }[]>([]);
  const autoRevealTriggeredRef = useRef(false);
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

  useEffect(() => {
    autoRevealTriggeredRef.current = false;
  }, [id]);

  useEffect(() => {
    if (!event?.final_pick_tmdb_id || !event.final_pick_title || event.status !== "done") {
      setCardProviders([]);
      return;
    }
    let cancelled = false;
    const types = pickMediaTypesToTry(event);
    (async () => {
      for (const mt of types) {
        try {
          const detail = await getMovieDetailsWithCredits(event.final_pick_tmdb_id!, mt);
          if (titlesMatch(event.final_pick_title!, getDisplayTitle(detail))) {
            const providers = await getWatchProviders(event.final_pick_tmdb_id!, mt);
            if (!cancelled) setCardProviders(providers);
            return;
          }
        } catch {
          /* try next */
        }
      }
      try {
        const providers = await getWatchProviders(event.final_pick_tmdb_id!, types[0]);
        if (!cancelled) setCardProviders(providers);
      } catch {
        if (!cancelled) setCardProviders([]);
      }
    })();
    return () => { cancelled = true; };
  }, [event?.id, event?.status, event?.final_pick_tmdb_id, event?.final_pick_title, event?.final_pick_media_type, event?.media_type]);

  // Vérifie si le feedback post-soirée a déjà été donné
  useEffect(() => {
    if (!user || !event || event.status !== "done") return;
    supabase
      .from("event_film_feedback" as any)
      .select("id")
      .eq("event_id", event.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setHasFeedback(!!data));
  }, [user, event?.id, event?.status]);

  const loadVoteData = useCallback(async (eventId: string) => {
    setLoadingVotes(true);
    try {
      const { data: recs } = await supabase
        .from("event_recommendations" as any)
        .select("id, movie_title, poster_path, tmdb_id, position, catalog_item_id")
        .eq("event_id", eventId)
        .order("position", { ascending: true });
      setRecommendations((recs ?? []) as unknown as EventRecommendation[]);

      const { data: votes } = await supabase
        .from("event_votes" as any)
        .select("recommendation_id, voter_id")
        .eq("event_id", eventId);

      const counts: Record<string, number> = {};
      let mine: string | null = null;
      ((votes ?? []) as unknown as Array<{ recommendation_id: string; voter_id: string | null }>).forEach((v) => {
        counts[v.recommendation_id] = (counts[v.recommendation_id] ?? 0) + 1;
        if (user && v.voter_id === user.id) mine = v.recommendation_id;
      });
      setVoteCounts(counts);
      setMyVoteId(mine);
    } finally {
      setLoadingVotes(false);
    }
  }, [user]);

  // ── Chargement initial ───────────────────────────────────
  useEffect(() => {
    if (!id) return;
    loadEvent();
  }, [id, user]);

  const loadEvent = async () => {
    if (!id) return;

    const { data: ev, error } = await supabase
      .from("events" as any)
      .select("id, title, event_date, event_time, location, is_remote, context, reveal_mode, status, organizer_id, invite_link_token, mood, genre_tags, media_type, final_pick_id, final_pick_title, final_pick_poster, final_pick_tmdb_id, final_pick_media_type")
      .eq("id", id)
      .maybeSingle();

    if (error || !ev) { setNotFound(true); setLoading(false); return; }
    setEvent(ev as unknown as EventData);

    await loadParticipants(id, ev as unknown as EventData);
    if ((ev as unknown as EventData).reveal_mode === "vote") {
      await loadVoteData(id);
    }
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
          const p = await fetchVisibleProfile(ep.user_id);
          let name: string = p?.display_name ?? "";
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
          const pProfile = await fetchVisibleProfile(partnerId);
          setDuoPartner({
            id: partnerId,
            name: pProfile?.display_name ?? "Ton duo",
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
      .subscribe((_, err) => { if (err) console.warn("[event] participants realtime:", err); });
    return () => { supabase.removeChannel(channel); };
  }, [id, user]);

  // Realtime votes (mode vote)
  useEffect(() => {
    if (!id || event?.reveal_mode !== "vote") return;
    const channel = supabase
      .channel(`event_votes_${id}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "event_votes", filter: `event_id=eq.${id}` },
        () => { void loadVoteData(id); }
      )
      .subscribe((_, err) => { if (err) console.warn("[event] votes realtime:", err); });
    return () => { supabase.removeChannel(channel); };
  }, [id, event?.reveal_mode, loadVoteData]);

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

  const revealFilm = useCallback(() => {
    if (!event || isRevealing) return;
    setIsRevealing(true);

    const participantIds = participants
      .filter(p => p.user_id)
      .map(p => p.user_id as string);

    const intent = {
      context:        event.context ?? "solo",
      genres:         event.genre_tags ?? [],
      mood:           event.mood ?? "",
      participantIds,
      mediaType:      (event.media_type as "movie" | "tv" | "both" | null) ?? "both",
      eventId:        event.id,
    };

    setRevealEvent({ eventId: event.id, eventTitle: event.title });
    queueForReveal(intent);
    (window as any).__pickRevealIntent = intent;
    console.log("[REVEAL] 📤 Intent posé — context:", intent.context, "| genres:", intent.genres, "| mediaType:", intent.mediaType);

    window.dispatchEvent(new CustomEvent("pick-reveal-event", { detail: intent }));
    navigate("/app", { state: { revealPending: true } });
  }, [event, isRevealing, participants, navigate]);

  const revealFilmRef = useRef(revealFilm);
  revealFilmRef.current = revealFilm;

  // Mode timed : révélation auto quand le compte à rebours atteint 0
  useEffect(() => {
    if (!isOrganizer || !event || event.reveal_mode !== "timed" || event.status === "done") return;
    if (timeLeft === null || timeLeft > 0) return;
    if (autoRevealTriggeredRef.current || isRevealing) return;

    autoRevealTriggeredRef.current = true;
    toast.info("C'est l'heure de la soirée — Pick prépare le film…", { duration: 4000 });
    const timer = setTimeout(() => revealFilmRef.current(), 900);
    return () => clearTimeout(timer);
  }, [timeLeft, isOrganizer, event, isRevealing]);

  const canVote = !!user && (isOrganizer || myParticipation?.status === "confirmed");
  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);

  const castVote = async (recommendationId: string) => {
    if (!user || !event || !canVote || castingVoteId) return;
    setCastingVoteId(recommendationId);
    try {
      await supabase
        .from("event_votes" as any)
        .delete()
        .eq("event_id", event.id)
        .eq("voter_id", user.id);
      const { error } = await supabase.from("event_votes" as any).insert({
        event_id: event.id,
        recommendation_id: recommendationId,
        voter_id: user.id,
      });
      if (error) throw error;
      toast.success("Vote enregistré !");
      await loadVoteData(event.id);
    } catch {
      toast.error("Impossible d'enregistrer ton vote");
    } finally {
      setCastingVoteId(null);
    }
  };

  const revealVoteWinner = async () => {
    if (!event || !isOrganizer || revealingWinner) return;
    if (totalVotes === 0) {
      toast.error("Aucun vote pour l'instant — attends que les participants votent.");
      return;
    }
    const sorted = [...recommendations].sort((a, b) => {
      const diff = (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0);
      return diff !== 0 ? diff : (a.position ?? 99) - (b.position ?? 99);
    });
    const winner = sorted[0];
    if (!winner?.movie_title) {
      toast.error("Aucune suggestion à révéler");
      return;
    }

    setRevealingWinner(true);
    try {
      const pickMediaType =
        winner.tmdb_id && winner.movie_title
          ? await detectPickMediaType(winner.tmdb_id, winner.movie_title)
          : "movie";

      const { error } = await supabase
        .from("events" as any)
        .update({
          final_pick_id: winner.catalog_item_id,
          final_pick_title: winner.movie_title,
          final_pick_poster: winner.poster_path,
          final_pick_tmdb_id: winner.tmdb_id,
          final_pick_media_type: pickMediaType,
          status: "done",
        })
        .eq("id", event.id);
      if (error) throw error;
      toast.success(`Le gagnant : ${winner.movie_title}`);
      await loadEvent();
    } catch {
      toast.error("Impossible de révéler le gagnant");
    } finally {
      setRevealingWinner(false);
    }
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

  const fetchFilmMatchData = useCallback(async (movie: MovieDetail) => {
    if (!user || !event) return null;
    setFilmMatchLoading(true);
    try {
      ensureMovieEmbedding(
        movie.id,
        movie.title || movie.name || "",
        movie.overview || "",
        (movie.genres || []).map((g) => g.name),
      );

      const eventContextMap: Record<string, string> = {
        duo: "couple",
        famille: "family",
        amis: "friends",
        solo: "alone",
      };

      const [tasteProfile, userTasteVector, likedMovies, cinematicProfile, vectorData] = await Promise.all([
        getUserTasteProfile(),
        computeUserTasteVector(user.id),
        getLikedMovies().catch(() => []),
        supabase
          .from("cinematic_profiles" as any)
          .select("personality_title, narrative, taste_traits")
          .eq("user_id", user.id)
          .maybeSingle()
          .then((r) => r.data),
        supabase
          .from("user_taste_vectors" as any)
          .select("avoidance_vector, recent_taste_vector")
          .eq("user_id", user.id)
          .maybeSingle()
          .then((r) => r.data),
      ]);

      const enrichedProfile = tasteProfile
        ? {
            ...tasteProfile,
            recentTasteVector: (vectorData as any)?.recent_taste_vector || null,
            avoidanceVector: (vectorData as any)?.avoidance_vector || null,
          }
        : null;

      const { data, error } = await supabase.functions.invoke("movie-match", {
        body: {
          movie,
          userCriteria: {
            mood: event.mood ?? null,
            context: event.context ? eventContextMap[event.context] ?? null : null,
            time: null,
          },
          tasteProfile: enrichedProfile,
          userTasteVector,
          likedMovieTitles: (likedMovies || []).map((m: { title: string }) => m.title),
          searchTags: event.genre_tags ?? [],
          cinematicProfile,
          peoplePreferences: tasteProfile?.peoplePreferences || null,
          userName: user.user_metadata?.display_name || user.email?.split("@")[0] || null,
        },
      });

      if (error) {
        console.error("[event] movie-match error:", error);
        return null;
      }

      return (data as Record<string, unknown>) ?? null;
    } catch (error) {
      console.error("[event] fetchFilmMatchData failed:", error);
      return null;
    } finally {
      setFilmMatchLoading(false);
    }
  }, [user, event]);

  const openFinalPickFiche = async () => {
    if (!event?.final_pick_title || loadingFilmFiche) return;
    setLoadingFilmFiche(true);
    setFilmMatchData(null);
    setFilmFicheProviders(cardProviders);
    setFilmDetailOpen(false);
    try {
      const { movie, mediaType, titleMismatch } = await loadFinalPickDetail(event);
      if (titleMismatch) {
        toast.warning("La fiche TMDB ne correspond pas au titre affiché — affichage des infos de la soirée.");
      }
      setFilmFicheMovie(movie);

      if (movie.id > 0) {
        const [providers, matchData] = await Promise.all([
          getWatchProviders(movie.id, mediaType).catch(() => []),
          fetchFilmMatchData(movie),
        ]);
        setFilmFicheProviders(providers);
        setFilmMatchData(matchData);
      }
    } catch {
      toast.error("Impossible de charger la fiche du film");
    } finally {
      setLoadingFilmFiche(false);
    }
  };

  const closeFilmFiche = () => {
    setFilmFicheMovie(null);
    setFilmDetailOpen(false);
    setFilmMatchData(null);
    setFilmFicheProviders([]);
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

        {/* ── Révéler le film (organisateur — surprise / timed) ── */}
        {isOrganizer && (event.reveal_mode === "surprise" || event.reveal_mode === "timed") && event.status !== "done" && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
            {event.reveal_mode === "timed" && timeLeft !== null && timeLeft > 0 ? (
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-primary/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-sans font-semibold text-foreground">Surprise sur le moment</p>
                  <p className="text-[11.5px] text-foreground/40 mt-0.5">
                    Révélation automatique dans{" "}
                    <span className="text-primary/70 font-semibold tabular-nums">{formatCountdown(timeLeft)}</span>
                  </p>
                  <EventPickSummary event={event} />
                </div>
              </div>
            ) : isRevealing ? (
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 text-primary animate-spin shrink-0" />
                <div className="flex-1">
                  <p className="text-[13px] font-sans font-semibold text-foreground">Pick prépare la surprise…</p>
                  <p className="text-[11.5px] text-foreground/40 mt-0.5">Analyse de ton profil en cours</p>
                  <EventPickSummary event={event} />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-2xl shrink-0">🎩</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-sans font-semibold text-foreground">
                    {event.reveal_mode === "timed" ? "L'heure est venue !" : "Révéler le film"}
                  </p>
                  <p className="text-[11.5px] text-foreground/40 mt-0.5">
                    {event.context === "duo"
                      ? "Pick analyse vos deux profils et propose 3 films."
                      : "Pick analyse ton profil et propose 3 films."}
                  </p>
                  <EventPickSummary event={event} />
                </div>
                <button
                  onClick={revealFilm}
                  disabled={isRevealing}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/15 border border-primary/25 text-primary text-[12px] font-sans font-semibold disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Révéler
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Mode vote ── */}
        {event.reveal_mode === "vote" && event.status !== "done" && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Vote className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-sans font-semibold text-foreground">Vote pour le film</p>
                <p className="text-[11.5px] text-foreground/40 mt-0.5">
                  {isOrganizer
                    ? "Les participants votent · tu révèles le gagnant quand tu veux."
                    : canVote
                      ? "Choisis ta préférence parmi les suggestions."
                      : "Confirme ta participation pour voter."}
                </p>
                <EventPickSummary event={event} />
              </div>
            </div>

            {loadingVotes ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
              </div>
            ) : recommendations.length === 0 ? (
              <p className="text-[12px] font-sans text-foreground/45 text-center py-4">
                Les suggestions sont en cours de génération… Reviens dans un instant.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {recommendations.map((rec) => {
                  const count = voteCounts[rec.id] ?? 0;
                  const isMine = myVoteId === rec.id;
                  const isCasting = castingVoteId === rec.id;
                  return (
                    <button
                      key={rec.id}
                      type="button"
                      disabled={!canVote || !!castingVoteId}
                      onClick={() => void castVote(rec.id)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                        isMine
                          ? "border-primary/40 bg-primary/10"
                          : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14]"
                      } ${!canVote ? "opacity-70 cursor-default" : ""}`}
                    >
                      {rec.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${rec.poster_path}`}
                          alt=""
                          className="w-10 h-14 object-cover rounded-lg shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-14 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                          <Film className="w-4 h-4 text-foreground/30" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-sans font-semibold text-foreground truncate">
                          {rec.movie_title ?? "Film"}
                        </p>
                        <p className="text-[11px] font-sans text-foreground/45 mt-0.5">
                          {count} vote{count !== 1 ? "s" : ""}
                          {isMine && <span className="text-primary ml-1.5">· Ton choix</span>}
                        </p>
                      </div>
                      {isCasting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                      ) : isMine ? (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      ) : canVote ? (
                        <span className="text-[10px] font-sans font-semibold text-primary/70 shrink-0">Voter</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

            {isOrganizer && recommendations.length > 0 && (
              <button
                type="button"
                onClick={() => void revealVoteWinner()}
                disabled={revealingWinner || totalVotes === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/15 border border-primary/25 text-primary text-[12.5px] font-sans font-semibold disabled:opacity-45 disabled:pointer-events-none"
              >
                {revealingWinner ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {revealingWinner ? "Révélation…" : `Révéler le gagnant${totalVotes > 0 ? ` (${totalVotes} vote${totalVotes !== 1 ? "s" : ""})` : ""}`}
              </button>
            )}
          </div>
        )}

        {/* ── Film révélé (visible par tous) ── */}
        {event.status === "done" && event.final_pick_title && (
          <button
            type="button"
            onClick={() => void openFinalPickFiche()}
            disabled={loadingFilmFiche}
            className="group w-full rounded-2xl overflow-hidden border border-primary/25 text-left cursor-pointer transition-all hover:border-primary/40 hover:bg-primary/[0.03] active:scale-[0.99] disabled:opacity-70 disabled:pointer-events-none"
            aria-label={`Voir la fiche : ${event.final_pick_title}`}
          >
            <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/[0.08]">
              <span className="text-base">🎩</span>
              <p className="text-[11px] font-sans font-semibold tracking-[0.15em] uppercase text-primary/80">Le pick de la soirée</p>
              {loadingFilmFiche && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary/60 ml-auto" />}
            </div>
            <div className="flex gap-3 p-3 bg-white/[0.02]">
              {event.final_pick_poster ? (
                <img
                  src={`https://image.tmdb.org/t/p/w185${event.final_pick_poster}`}
                  alt={event.final_pick_title}
                  className="w-16 h-24 object-cover rounded-xl shrink-0 pointer-events-none"
                />
              ) : (
                <div className="w-16 h-24 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 pointer-events-none">
                  <Film className="w-5 h-5 text-foreground/40" />
                </div>
              )}
              <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
                <p className="font-serif text-[16px] text-foreground leading-tight">{event.final_pick_title}</p>
                {cardProviders.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5 pointer-events-none">
                    {cardProviders.slice(0, 4).map((p) => p.logo_path && (
                      <img
                        key={p.provider_id ?? p.name}
                        src={`https://image.tmdb.org/t/p/w45${p.logo_path}`}
                        alt={p.name}
                        title={p.name}
                        className="h-4 w-auto rounded object-contain"
                      />
                    ))}
                  </div>
                )}
                <p className="text-[11px] font-sans font-semibold text-primary/70 group-hover:text-primary/90 transition-colors">
                  Voir la fiche
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-primary/50 shrink-0 self-center group-hover:text-primary/80 group-hover:translate-x-0.5 transition-all pointer-events-none" />
            </div>
          </button>
        )}

        {/* ── Badge post-soirée ── */}
        {event.status === "done" && !hasFeedback && (
          <button
            onClick={() => setShowPostSoiree(true)}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-primary/[0.07] border border-primary/20 hover:bg-primary/[0.11] transition-all text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Star className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-sans font-semibold text-foreground">Comment c'était ?</p>
              <p className="text-[11px] font-sans text-foreground/45 mt-0.5">Évalue la soirée et le film</p>
            </div>
            <span className="text-[11px] font-sans font-semibold text-primary shrink-0">Évaluer →</span>
          </button>
        )}
        {event.status === "done" && hasFeedback && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <Check className="w-4 h-4 text-primary/60 shrink-0" />
            <p className="text-[12px] font-sans text-foreground/40">Tu as évalué cette soirée</p>
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

      {/* ── Post-soirée flow ── */}
      {filmFicheMovie && (
        <>
          <SoireeFilmOverlay
            open={!filmDetailOpen}
            movie={filmFicheMovie}
            eventTitle={event.title}
            matchData={filmMatchData}
            matchLoading={filmMatchLoading}
            providers={filmFicheProviders}
            onClose={closeFilmFiche}
            onOpenDetail={() => setFilmDetailOpen(true)}
          />
          <FlipCardDetail
            item={filmFicheMovie}
            type="movie"
            isOpen={filmDetailOpen}
            onClose={() => setFilmDetailOpen(false)}
            recommendationTexts={filmMatchData}
            isEnriching={filmMatchLoading}
            watchProviders={filmFicheProviders}
          />
        </>
      )}

      {showPostSoiree && event && (
        <PostSoireeFlow
          event={{
            eventId:      event.id,
            eventTitle:   event.title,
            eventDate:    event.event_date,
            context:      event.context ?? "solo",
            filmTitle:    event.final_pick_title ?? "",
            filmPoster:   event.final_pick_poster,
            filmTmdbId:   event.final_pick_tmdb_id,
            participants: participants
              .filter((p) => p.user_id && p.user_id !== user?.id && p.status === "confirmed")
              .map((p) => ({ id: p.user_id!, name: p.display_name ?? p.guest_name ?? "Participant" })),
          }}
          onClose={() => setShowPostSoiree(false)}
          onComplete={() => { setShowPostSoiree(false); setHasFeedback(true); }}
        />
      )}
    </div>
  );
};

export default EventDetailPage;
