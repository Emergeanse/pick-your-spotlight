import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { consumePendingDuoPick } from "@/lib/duo-pending";
import { toast } from "sonner";
import { Sparkles, WandSparkles, Clapperboard, ChevronRight, Flame, Eye, Coffee, Heart, Shuffle, Home, Users } from "lucide-react";

import { ALL_PLATFORMS } from "@/lib/platforms";
import type { Movie, MovieDetail } from "@/lib/tmdb";
import type { VoiceSearchFilters } from "./VoiceChat";
import { getTrendingMovies, getBackdropUrl, getWatchProviders, getMovieDetails } from "@/lib/tmdb";
import { getLikedMovies } from "@/lib/liked-movies";
import { trackInteraction, getUserTasteProfile } from "@/lib/interactions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { computeMultiVectorProfile } from "@/lib/taste-engine";
import {
  extractRecommendationMovies,
  ensureRecommendationBatch,
  enrichMoviesLazy,
  getRecommendationScore,
  RECOMMENDATION_BATCH_SIZE,
  type RecommendationMovieDetail,
} from "@/lib/recommendation-batch";
import { getEngagementData, getProgressionMessage, type EngagementData } from "@/lib/engagement";
import { listFeedbackByType } from "@/lib/feedback";
import { getMyPreferences } from "@/lib/preferences";
import { getRevealEvent } from "@/lib/event-reveal";

import BrandHeader from "./BrandHeader";
import QuickFilters, { type QuickFilterState, type ProfileDefaults } from "./QuickFilters";
import TasteTrainer from "./TasteTrainer";
import DiscoverySection from "./DiscoverySection";
import HomeScreenChoiceModal, { type LaunchContext } from "./HomeScreenChoiceModal";
import TonightPickOverlay from "./TonightPickOverlay";
import FlipCardDetail from "./FlipCardDetail";
import { type AmbianceMood } from "./HomeAmbianceSection";
import homeBackground from "@/assets/home-background.png";
import loadingBackground from "@/assets/loading-background.png";

interface HomeScreenProps {
  onStart: () => void;
  onOpenChat: () => void;
  onOpenMoodCapture: () => void;
  onSurprise: (movies: MovieDetail[], startIndex?: number, seenMovieIds?: Set<number>) => void;
  onMovieSelect: (movie: MovieDetail) => void;
  loading: boolean;
  openTrainerOnMount?: boolean;
  forceCloseTrainer?: boolean;
  onTrainerOpened?: () => void;
  chatSuggestedMovies?: MovieDetail[] | null;
  chatSuggestedStartIndex?: number;
  chatSuggestedSeenMovieIds?: Set<number>;
  onChatSuggestedConsumed?: () => void;
  activationTrainerMode?: boolean;
  onActivationTrainingComplete?: () => void;
}

type RecommendationMatch = {
  confidence: number;
  reason: string;
};

type RejectionContext = {
  reason: string;
  rejectedGenres: string[];
  rejectedTitle: string;
};

const AMBIANCES: { id: AmbianceMood; label: string; Icon: React.ComponentType<any> }[] = [
  { id: "intense", label: "Intense", Icon: Flame },
  { id: "mysterious", label: "Mystérieux", Icon: Eye },
  { id: "comfort", label: "Réconfortant", Icon: Coffee },
  { id: "couple", label: "À deux", Icon: Heart },
  { id: "surprise", label: "Surprends-moi", Icon: Shuffle },
];

type MoodConfig = {
  boostGenres?: string[];
  explorationOverride?: number;
  maxDurationOverride?: number;
  mediaTypeOverride?: "movie" | "tv";
  minMatchScoreOverride?: number;
  minRatingBoost?: number;
  moodContext?: string;
};

const MOOD_CONFIGS: Record<AmbianceMood, MoodConfig> = {
  intense: {
    boostGenres: ["Thriller", "Horreur", "Action", "Crime"],
    explorationOverride: 4,
    moodContext: "L'utilisateur veut une expérience intense, haletante, à fort suspense ou action.",
  },
  mysterious: {
    boostGenres: ["Mystère", "Thriller", "Crime", "Science-Fiction"],
    explorationOverride: 6,
    minRatingBoost: 0.5,
    moodContext: "L'utilisateur veut quelque chose de mystérieux, intrigant, avec une atmosphère sombre et envoûtante.",
  },
  comfort: {
    boostGenres: ["Comédie", "Romance", "Animation", "Famille"],
    explorationOverride: 5,
    maxDurationOverride: 120,
    minMatchScoreOverride: 65,
    moodContext: "L'utilisateur veut se détendre — favorise les films légers, chaleureux, feel-good.",
  },
  couple: {
    boostGenres: ["Romance", "Comédie", "Aventure", "Drame"],
    mediaTypeOverride: "movie",
    explorationOverride: 5,
    maxDurationOverride: 150,
    moodContext: "L'utilisateur regarde en couple — favorise les films romantiques, feel-good ou à fort impact émotionnel.",
  },
  surprise: {
    explorationOverride: 9,
    minMatchScoreOverride: 55,
    minRatingBoost: 0.5,
    moodContext: "L'utilisateur veut être surpris — ose des choix audacieux, inattendus, hors des sentiers battus.",
  },
};

type QuickReco = { id: number; title: string; poster_path: string | null; vote_average?: number };
const QUICK_RECO_KEY = "pick_last_reco_v1";

const extractTmdbIdsFromFeedbackRows = (rows: any[]): number[] =>
  rows.map((row) => row?.catalog_items?.tmdb_id).filter((id): id is number => typeof id === "number" && id > 0);

const loadUnifiedUserFeedbackState = async () => {
  const [likedRows, lovedRows, seenRows, watchlistRows, notForMeRows, dislikeRows, skipRows, unknownRows] =
    await Promise.all([
      listFeedbackByType("like"),
      listFeedbackByType("love"),
      listFeedbackByType("seen"),
      listFeedbackByType("watchlist"),
      listFeedbackByType("not_for_me"),
      listFeedbackByType("dislike"),
      listFeedbackByType("skip"),
      listFeedbackByType("unknown"),
    ]);

  const excludeIds = [
    ...extractTmdbIdsFromFeedbackRows(likedRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(lovedRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(seenRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(notForMeRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(dislikeRows as any[]),
  ];

  const evaluatedIds = [
    ...extractTmdbIdsFromFeedbackRows(likedRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(lovedRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(seenRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(notForMeRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(dislikeRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(skipRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(unknownRows as any[]),
  ];

  return {
    excludeIds: [...new Set(excludeIds)],
    evaluatedCount: [...new Set(evaluatedIds)].length,
  };
};

const LOADING_MESSAGES = [
  "Je cherche la perle rare…",
  "Voyons voir ce que j'ai pour toi…",
  "Attends, j'ai peut-être la perle parfaite.",
  "Je parcours mes favoris…",
  "Laisse-moi réfléchir deux secondes…",
  "Je fouille dans ma cinémathèque…",
  "Un instant, je fais chauffer mes neurones.",
  "C'est presque prêt, promis !",
  "Je compare quelques options pour toi…",
  "Hmm, difficile de choisir, t'as bon goût !",
  "J'affine ma sélection…",
  "Encore un petit moment, ça va valoir le coup.",
  "Je suis en train de te concocter un truc sympa.",
  "Ça cogite sévère de mon côté !",
];

const PLATFORM_LABELS: Record<number, string> = {
  8: "Netflix", 119: "Amazon Prime", 337: "Disney+",
  381: "Canal+", 56: "Paramount+", 350: "Apple TV+", 234: "OCS",
};

const rnd = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function buildPersonalizedLoadingMessages({
  genres,
  mediaType,
  explorationLevel,
  ambiance,
  platformIds,
  likedTitles = [],
}: {
  genres: string[];
  mediaType: string;
  explorationLevel: number;
  ambiance: string | null;
  platformIds: number[];
  likedTitles?: string[];
}): string[] {
  const topGenres = genres.slice(0, 3);
  const g1 = topGenres[0] ?? "tes genres favoris";
  const g2 = topGenres[1];
  const genreStr = g2 ? `${g1} & ${g2}` : g1;
  const typeStr = mediaType === "tv" ? rnd(["série", "émission"]) : rnd(["film", "long métrage"]);
  const platformNames = platformIds.map((id) => PLATFORM_LABELS[id]).filter(Boolean).slice(0, 2).join(" et ");
  const likedTitle = likedTitles.length > 0 ? likedTitles[Math.floor(Math.random() * likedTitles.length)] : null;

  return [
    ambiance
      ? rnd([
          `Mode "${ambiance}" activé — je cherche ce qui va t'embarquer…`,
          `Une soirée "${ambiance}" ? Je sais ce qu'il te faut…`,
          `Je cherche le ${typeStr} parfait pour l'ambiance "${ambiance}"…`,
        ])
      : rnd([
          `Je cherche ton prochain ${typeStr} de ${genreStr}…`,
          `Un ${typeStr} de ${genreStr} qui n'attend que toi…`,
          `Je parcours ma collection de ${genreStr}…`,
        ]),

    platformNames
      ? rnd([
          `Je filtre sur ${platformNames} — finis les reco inaccessibles…`,
          `${platformNames} seulement — je garde ce que tu peux regarder ce soir…`,
          `Je me limite à ${platformNames} pour toi…`,
        ])
      : rnd([`Je parcours la base de ${typeStr}s…`, "J'analyse des milliers d'options…"]),

    likedTitle
      ? rnd([
          `Tu as aimé "${likedTitle}" — je cherche ce qui te donnera la même sensation…`,
          `Dans la veine de "${likedTitle}"… voyons ce que j'ai…`,
          `Fan de "${likedTitle}" ? Je cherche quelque chose d'aussi fort…`,
        ])
      : rnd([
          `J'analyse ton empreinte de goût…`,
          `Je croise similarité vectorielle et préférences…`,
          `Je lis entre les lignes de ton profil…`,
        ]),

    topGenres.length >= 3
      ? rnd([
          `${topGenres[0]}, ${topGenres[1]}, ${topGenres[2]}… je croise tout ça…`,
          `Ta passion pour le ${topGenres[0]} & le ${topGenres[1]}… je m'en sers…`,
          `Je pondère ${topGenres[0]}, ${topGenres[1]} et ${topGenres[2]} ensemble…`,
        ])
      : rnd([`Je calibre sur tes genres préférés…`, `J'affine par genre et par note…`]),

    explorationLevel >= 7
      ? rnd([
          "Mode découverte — je cherche une pépite que tu ne connais peut-être pas…",
          "Je prends quelques risques pour te surprendre…",
          "Je dépasse mes sentiers habituels pour toi…",
        ])
      : explorationLevel <= 3
        ? rnd([
            "Tu veux du solide — je cible les valeurs sûres…",
            "Pas d'expérimentation ce soir, je reste dans tes certitudes…",
          ])
        : rnd([
            "J'équilibre valeur sûre et découverte…",
            "Je calibre le niveau de surprise…",
          ]),

    rnd([
      "Je compare les candidats et élimine les doublons de franchise…",
      "Je classe les finalistes par pertinence…",
      "Dernière passe — je trie les meilleures options…",
    ]),

    rnd([
      "L'IA évalue les derniers candidats…",
      "Je finalise le score de correspondance…",
      "Presque là — je peaufine le choix final…",
    ]),

    rnd([
      "Encore un instant — ça va valoir le coup…",
      "C'est presque prêt, promis…",
      "Quelques secondes encore…",
    ]),
  ];
}

const HomeScreen = ({
  onOpenChat,
  onOpenMoodCapture,
  onSurprise,
  onMovieSelect,
  loading,
  openTrainerOnMount,
  forceCloseTrainer,
  onTrainerOpened,
  chatSuggestedMovies,
  chatSuggestedStartIndex = 0,
  chatSuggestedSeenMovieIds,
  onChatSuggestedConsumed,
  activationTrainerMode = false,
  onActivationTrainingComplete,
}: HomeScreenProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [bgImages, setBgImages] = useState<string[]>([]);
  const [findChoiceDuoId, setFindChoiceDuoId] = useState<string | undefined>(undefined);
  const currentDuoOverridesRef = useRef<DuoOverrides | null>(null);
  const handleAutoPickRef = useRef<((duoId?: string, opts?: { genres?: string[]; moodContext?: string }) => Promise<void>) | undefined>(undefined);
  const revealTriggeredRef = useRef(false);
  const pendingRevealRef = useRef<{ context?: string; genres?: string[]; mood?: string } | null>(null);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);

  const [tonightPick, setTonightPick] = useState<MovieDetail | null>(null);
  const [tonightLoading, setTonightLoading] = useState(false);
  const [tonightLoadingMsg, setTonightLoadingMsg] = useState("");
  const [loadingLog, setLoadingLog] = useState<string[]>([]);
  const [tonightUserGenres, setTonightUserGenres] = useState<string[]>([]);
  const loadingLogEndRef = useRef<HTMLDivElement | null>(null);
  const activeMessagesRef = useRef<string[]>([]);
  const [tonightProviders, setTonightProviders] = useState<{ name: string; logo_path: string }[]>([]);

  const [userPlatformIds, setUserPlatformIds] = useState<number[]>([]);
  const [userExcludedPlatformIds, setUserExcludedPlatformIds] = useState<number[]>([]);
  const [userGenres, setUserGenres] = useState<string[]>([]);
  const [userExcludedGenres, setUserExcludedGenres] = useState<string[]>([]);
  const [userMinRating, setUserMinRating] = useState<number>(0);


  const [rejectedIds, setRejectedIds] = useState<number[]>([]);
  const [lastSql100Ids, setLastSql50Ids] = useState<number[]>([]);
  const [, setEngagement] = useState<EngagementData | null>(null);
  const [, setProgressionMsg] = useState<string | null>(null);
  const [historyExcludeIds, setHistoryExcludeIds] = useState<number[]>([]);
  const [showTrainer, setShowTrainer] = useState(false);
  const [showFindChoice, setShowFindChoice] = useState(false);
  const [explorationLevel] = useState<number>(5);
  const [totalEvaluated, setTotalEvaluated] = useState(0);
  const [activeAmbiance, setActiveAmbiance] = useState<AmbianceMood | null>(null);
  const [firstName, setFirstName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [quickRecos, setQuickRecos] = useState<QuickReco[]>([]);
  const [trendingFallback, setTrendingFallback] = useState<QuickReco[]>([]);
  const [loadingMovieId, setLoadingMovieId] = useState<number | null>(null);
  const [showShareNotif, setShowShareNotif] = useState(false);
  const [nextEvent, setNextEvent] = useState<{
    id: string; title: string; event_date: string; event_time: string | null;
    context: string | null; partnerInitial: string; partnerName: string;
  } | null>(null);
  const [shareNotifDismissed, setShareNotifDismissed] = useState(false);
  const [activeWidget, setActiveWidget] = useState<"duo" | "famille" | "amis" | "surprise">("surprise");
  const [findChoiceContext, setFindChoiceContext] = useState<LaunchContext>("solo");

  const [chatMoviesPool, setChatMoviesPool] = useState<MovieDetail[] | null>(null);
  const [movieMatchData, setMovieMatchData] = useState<Record<number, RecommendationMatch>>({});
  const [tonightPickIndex, setTonightPickIndex] = useState(0);
  const [tonightSeenMovieIds, setTonightSeenMovieIds] = useState<Set<number>>(new Set());

  const [flipDetailMovie, setFlipDetailMovie] = useState<MovieDetail | null>(null);
  const [noResultsInfo, setNoResultsInfo] = useState<{
    message: string;
    suggestThreshold?: number;
    suggestRating?: boolean;
  } | null>(null);

  const [quickFilters, setQuickFilters] = useState<QuickFilterState>({
    mediaType: "both",
    maxDuration: null,
    matchThreshold: 80,
    minRating: 0,
    recommendationCount: 3,
  });
  const [profileDefaults, setProfileDefaults] = useState<ProfileDefaults>({
    mediaType: "both",
    maxDuration: null,
    matchThreshold: 80,
    minRating: 0,
    recommendationCount: 3,
  });

  const isMountedRef = useRef(true);
  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const historyExcludeIdsRef = useRef<number[]>([]);
  const generateTonightPickRef = useRef<typeof generateTonightPick | null>(null);
  const activeVoiceFiltersRef = useRef<VoiceSearchFilters | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (msgIntervalRef.current !== null) clearInterval(msgIntervalRef.current);
    };
  }, []);

  // Bridge depuis DuoPage — variable module-level, zéro dépendance React Router state
  useEffect(() => {
    const pendingDuoId = consumePendingDuoPick();
    if (pendingDuoId) {
      setFindChoiceDuoId(pendingDuoId);
      setShowFindChoice(true);
    }
  }, []);

  // Bridge legacy via location.state (autres appelants éventuels)
  useEffect(() => {
    const state = location.state as { openFindChoice?: boolean; duoId?: string } | null;
    if (state?.openFindChoice) {
      setFindChoiceDuoId(state.duoId);
      window.history.replaceState({}, "", "/app");
      setTimeout(() => setShowFindChoice(true), 150);
    }
  }, [location.state]);

  // Étape 1 — détecte le reveal au montage (indépendant du user)
  // Lit le singleton event-reveal en priorité, location.state en fallback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (revealTriggeredRef.current) return;
    const singleton = getRevealEvent();
    const lsState = location.state as {
      revealEventId?: string; revealContext?: string;
      revealGenres?: string[]; revealMood?: string;
    } | null;
    const revealId = singleton?.eventId || lsState?.revealEventId;
    if (!revealId) return;
    pendingRevealRef.current = {
      context: singleton?.context ?? lsState?.revealContext,
      genres:  singleton?.genres  ?? lsState?.revealGenres ?? [],
      mood:    singleton?.mood    ?? lsState?.revealMood   ?? "",
    };
    window.history.replaceState({}, "", "/app");
  }, []); // une seule fois au montage

  // Étape 2 — exécute dès que user est disponible (résout la race condition auth)
  useEffect(() => {
    if (!user || !pendingRevealRef.current || revealTriggeredRef.current) return;
    revealTriggeredRef.current = true;
    const { context, genres, mood } = pendingRevealRef.current;
    pendingRevealRef.current = null;

    const run = async () => {
      let duoId: string | undefined;
      if (context === "duo") {
        try {
          const { data: duo } = await (supabase as any)
            .from("duo_taste_profiles")
            .select("id")
            .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
            .eq("status", "active")
            .maybeSingle();
          duoId = (duo as any)?.id ?? undefined;
        } catch (e) {
          console.error("[Reveal] Duo fetch error:", e);
        }
      }
      const opts: { genres?: string[]; moodContext?: string } = {};
      if (genres?.length) opts.genres = genres;
      if (mood) opts.moodContext = mood;
      handleAutoPickRef.current?.(duoId, Object.keys(opts).length ? opts : undefined);
    };

    void run();
  }, [user]);

  // Écoute le custom event émis par handleVoiceSearchIntent
  // pour router la recherche vocale dans le même pipeline que la recherche standard
  useEffect(() => {
    const handler = (e: Event) => {
      const { filters } = (e as CustomEvent).detail as { filters: VoiceSearchFilters };
      generateTonightPickRef.current?.([], undefined, filters);
    };
    window.addEventListener("pick-voice-search", handler);
    return () => window.removeEventListener("pick-voice-search", handler);
  }, []);

  // Prénom + avatar pour le greeting et la notif
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle().then(({ data }) => {
      const name = (data as any)?.display_name || user.email?.split("@")[0] || "";
      setFirstName(name.split(" ")[0]);
      setAvatarUrl((data as any)?.avatar_url || null);
    });
  }, [user]);

  // Prochaine soirée — charge l'événement le plus proche dans le futur
  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      // Soirées en tant qu'organisateur
      const { data: orgEvents } = await (supabase as any)
        .from("events")
        .select("id, title, event_date, event_time, context, organizer_id")
        .eq("organizer_id", user.id)
        .gte("event_date", today)
        .not("status", "in", '("done","cancelled")')
        .order("event_date", { ascending: true })
        .limit(1);

      // Soirées en tant que participant
      const { data: myEps } = await (supabase as any)
        .from("event_participants")
        .select("event_id")
        .eq("user_id", user.id);
      const participatingIds: string[] = (myEps ?? []).map((e: any) => e.event_id);

      let guestEvent: any = null;
      if (participatingIds.length > 0) {
        const { data } = await (supabase as any)
          .from("events")
          .select("id, title, event_date, event_time, context, organizer_id")
          .in("id", participatingIds)
          .neq("organizer_id", user.id)
          .gte("event_date", today)
          .not("status", "in", '("done","cancelled")')
          .order("event_date", { ascending: true })
          .limit(1);
        guestEvent = data?.[0] ?? null;
      }

      const orgEvent = orgEvents?.[0] ?? null;
      // Choisit le plus proche entre les deux
      let chosen = orgEvent;
      if (guestEvent && (!orgEvent || guestEvent.event_date <= orgEvent.event_date)) {
        chosen = guestEvent;
      }
      if (!chosen) { setNextEvent(null); return; }

      // Récupère les participants pour trouver le partenaire
      const { data: eps } = await (supabase as any)
        .from("event_participants")
        .select("user_id, guest_name")
        .eq("event_id", chosen.id)
        .neq("user_id", user.id)
        .limit(1);
      const partner = eps?.[0];
      let partnerName = "?";
      if (partner?.user_id) {
        const { data: prof } = await supabase
          .from("profiles").select("display_name").eq("id", partner.user_id).maybeSingle();
        partnerName = (prof as any)?.display_name || partner.guest_name || "Invité";
      } else if (partner?.guest_name) {
        partnerName = partner.guest_name;
      }

      setNextEvent({
        id: chosen.id,
        title: chosen.title,
        event_date: chosen.event_date,
        event_time: chosen.event_time,
        context: chosen.context,
        partnerInitial: partnerName.charAt(0).toUpperCase(),
        partnerName,
      });
    })();
  }, [user]);

  // Apparition de la notif partagée après 2.5s
  useEffect(() => {
    if (shareNotifDismissed) return;
    const t = setTimeout(() => setShowShareNotif(true), 2500);
    return () => clearTimeout(t);
  }, [shareNotifDismissed]);

  // Charge les dernières recos depuis le cache localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUICK_RECO_KEY);
      if (raw) setQuickRecos(JSON.parse(raw));
    } catch {}
  }, []);

  // Fallback : 3 films tendance si pas encore de recos en cache
  useEffect(() => {
    getTrendingMovies(20)
      .then((movies: Movie[]) => {
        const picks = movies
          .filter((m) => m.poster_path)
          .slice(0, 3)
          .map((m) => ({
            id: m.id,
            title: m.title || (m as any).name || "",
            poster_path: m.poster_path || null,
            vote_average: m.vote_average,
          }));
        setTrendingFallback(picks);
      })
      .catch(() => {});
  }, []);

  // Sauvegarde les nouvelles recos dès que le pool est rempli
  useEffect(() => {
    if (!chatMoviesPool?.length) return;
    try {
      const toSave: QuickReco[] = chatMoviesPool.slice(0, 3).map((m) => ({
        id: m.id,
        title: (m.title || (m as any).name || ""),
        poster_path: m.poster_path || null,
        vote_average: m.vote_average,
      }));
      localStorage.setItem(QUICK_RECO_KEY, JSON.stringify(toSave));
      setQuickRecos(toSave);
    } catch {}
  }, [chatMoviesPool]);

  const tonightPool = useMemo(() => chatMoviesPool || [], [chatMoviesPool]);
  const canGoPrev = tonightPickIndex > 0;
  const canGoNext = tonightPickIndex < tonightPool.length - 1;
  const tonightAllVisited = tonightSeenMovieIds.size >= tonightPool.length && tonightPool.length > 0;

  const PLATFORM_FAMILIES_CLIENT: Record<number, number[]> = {
    381: [381, 538, 685, 193, 1754, 2285],
    119: [119, 1024, 10, 2100],
    8:   [8, 1796],
    337: [337],
    56:  [56, 531, 582, 2303],
    236: [236, 531, 582, 2303],
    384: [384, 1899, 1825],
    1899: [1899, 1825],
    35:  [35],
    234: [234],
    11:  [11],
    1967: [1967],
    350: [350],
    147: [147],
    415: [415],
    310: [310],
    513: [513],
    300: [300],
    2601: [2601],
    193: [193],
  };

  const PLATFORM_LABELS_CLIENT: Record<number, string> = {
    8: "Netflix", 1796: "Netflix",
    119: "Amazon Prime", 1024: "Amazon Prime", 10: "Amazon Prime", 2100: "Amazon",
    337: "Disney+",
    381: "Canal+", 538: "Canal+ Cinéma", 685: "Canal+ Séries", 193: "Canal+ Box Office", 1754: "myCanal", 2285: "Cine+",
    56: "Paramount+", 236: "Paramount+", 531: "Paramount+", 582: "Paramount+", 2303: "Paramount+",
    384: "Max", 1899: "Max", 1825: "Max",
    350: "Apple TV+",
    35: "Rakuten TV",
    234: "Arte",
    11: "MUBI",
    1967: "Molotov TV",
    147: "M6+",
    415: "ADN",
    310: "LaCinetek",
    513: "Shadowz",
    300: "Pluto TV",
    2601: "Pathé Home",
    2077: "Universciné",
  };

  const PLATFORM_LOGO_PATHS_CLIENT: Record<number, string> = {
    8:    "/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg", 1796: "/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg",
    119:  "/pvske1MyAoymrs5bguRfVqYiM9a.jpg",  1024: "/pvske1MyAoymrs5bguRfVqYiM9a.jpg",
    10:   "/pvske1MyAoymrs5bguRfVqYiM9a.jpg",  2100: "/pvske1MyAoymrs5bguRfVqYiM9a.jpg",
    337:  "/97yvRBw1GzX7fXprcF80er19ot.jpg",
    381:  "/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg",  538: "/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg",
    685:  "/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg",  193: "/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg",
    1754: "/blrBF9R2ONYu04ifGkYEb3k779N.jpg",  2285: "/geOzgeKZWpZC3lymAVEHVIk3X0q.jpg",
    56:   "/h5DcR0J2EESLitnhR8xLG1QymTE.jpg",  236: "/h5DcR0J2EESLitnhR8xLG1QymTE.jpg",
    531:  "/h5DcR0J2EESLitnhR8xLG1QymTE.jpg",  582: "/h5DcR0J2EESLitnhR8xLG1QymTE.jpg",
    2303: "/h5DcR0J2EESLitnhR8xLG1QymTE.jpg",
    350:  "/mcbz1LgtErU9p4UdbZ0rG6RTWHX.jpg",
    384:  "/bZvc9dXrXNly7cA0V4D9pR8yJwm.jpg",  1899: "/bZvc9dXrXNly7cA0V4D9pR8yJwm.jpg",
    1825: "/bZvc9dXrXNly7cA0V4D9pR8yJwm.jpg",
    35:   "/bZvc9dXrXNly7cA0V4D9pR8yJwm.jpg",
    234:  "/vPZrjHe7wvALuwJEXT2kwYLi0gV.jpg",
    11:   "/x570VpH2C9EKDf1riP83rYc5dnL.jpg",
    1967: "/8qSG9LtUhBQIWy2Fr6fzeW7gBdd.jpg",
    147:  "/tmYzlEKeiWStvXwC1QdpXIASpN4.jpg",
    415:  "/w86FOwg0bbgUSHWWnjOTuEjsUvq.jpg",
    310:  "/1syoSwH2yIskHUqeOiK9re8AMJC.jpg",
    513:  "/qwRq7klF8EijYs7XgvxSaYd6v6w.jpg",
    300:  "/dB8G41Q6tSL5NBisrIeqByfepBc.jpg",
    2601: "/yvui9yFtpWHt0ZrsPelItbuTavI.jpg",
  };

  const buildProvidersFromPlatformIds = (platformIds: number[]): { name: string; logo_path: string; provider_id: number }[] => {
    if (!userPlatformIds?.length) return [];
    const expandedUserIds = new Set(userPlatformIds.flatMap((id) => PLATFORM_FAMILIES_CLIENT[id] ?? [id]));
    const matched = platformIds.filter((id) => expandedUserIds.has(id));
    const seenIds = new Set<number>();
    const seenLogos = new Set<string>();
    return matched
      .filter((id) => {
        const logo = PLATFORM_LOGO_PATHS_CLIENT[id] ?? "";
        if (!PLATFORM_LABELS_CLIENT[id] || seenIds.has(id) || (logo && seenLogos.has(logo))) return false;
        seenIds.add(id);
        if (logo) seenLogos.add(logo);
        return true;
      })
      .map((id) => ({ name: PLATFORM_LABELS_CLIENT[id], logo_path: PLATFORM_LOGO_PATHS_CLIENT[id] ?? "", provider_id: id }));
  };

  const filterProvidersByUserPlatforms = (providers: { name: string; logo_path: string; provider_id?: number }[]) => {
    if (!userPlatformIds?.length) return providers;
    const expandedIds = new Set(userPlatformIds.flatMap((id) => PLATFORM_FAMILIES_CLIENT[id] ?? [id]));
    const filtered = providers.filter((p) => p.provider_id != null && expandedIds.has(p.provider_id));
    return filtered.length > 0 ? filtered : providers;
  };

  const loadProviders = async (movie: MovieDetail) => {
    // Priorité 1 : platform_ids depuis movie_embeddings (SQL) — intersection avec plateformes user
    const embeddingPlatformIds = (movie as any).platform_ids as number[] | undefined;
    if (Array.isArray(embeddingPlatformIds) && embeddingPlatformIds.length > 0 && userPlatformIds?.length) {
      const fromEmbedding = buildProvidersFromPlatformIds(embeddingPlatformIds);
      if (fromEmbedding.length > 0) {
        setTonightProviders(fromEmbedding);
        return;
      }
    }
    // Priorité 2 : watchProviders pré-chargés (avec logos TMDB)
    const cached = (movie as any).watchProviders as { name: string; logo_path: string; provider_id?: number }[] | undefined;
    if (cached && Array.isArray(cached)) {
      setTonightProviders(filterProvidersByUserPlatforms(cached));
      return;
    }
    // Priorité 3 : appel TMDB watch/providers
    const mediaType = movie.first_air_date ? "tv" : "movie";
    try {
      const providers = await getWatchProviders(movie.id, mediaType);
      setTonightProviders(filterProvidersByUserPlatforms(providers));
    } catch {
      setTonightProviders([]);
    }
  };

  const setCurrentTonightMovie = async (movie: MovieDetail, index: number, seenIds?: Set<number>) => {
    setTonightPick(movie);
    setTonightPickIndex(index);
    setTonightProviders([]);
    if (seenIds) setTonightSeenMovieIds(seenIds);
    await loadProviders(movie);
  };

  useEffect(() => {
    if (!chatSuggestedMovies?.length) return;

    const startIdx = Math.min(chatSuggestedStartIndex, chatSuggestedMovies.length - 1);
    const targetMovie = chatSuggestedMovies[startIdx];
    const seenIds =
      chatSuggestedSeenMovieIds && chatSuggestedSeenMovieIds.size > 0
        ? new Set(chatSuggestedSeenMovieIds)
        : new Set(targetMovie?.id ? [targetMovie.id] : []);

    const effectiveCount = quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE;
    const poolChat = chatSuggestedMovies.slice(0, effectiveCount);
    setChatMoviesPool(poolChat);
    void setCurrentTonightMovie(poolChat[startIdx] ?? poolChat[0], startIdx < poolChat.length ? startIdx : 0, seenIds);
    onChatSuggestedConsumed?.();
  }, [chatSuggestedMovies, chatSuggestedSeenMovieIds, chatSuggestedStartIndex, onChatSuggestedConsumed]);

  useEffect(() => {
    if (openTrainerOnMount) {
      setShowTrainer(true);
      onTrainerOpened?.();
    }
  }, [openTrainerOnMount, onTrainerOpened]);

  useEffect(() => {
    if (forceCloseTrainer) setShowTrainer(false);
  }, [forceCloseTrainer]);

  useEffect(() => {
    if (!user) return;

    getEngagementData(user.id).then((data) => {
      if (!data) return;
      setEngagement(data);
      setProgressionMsg(getProgressionMessage(data));
    });
  }, [user]);

  // ── Enrichissement background : 3 vagues par jour pour couvrir des genres variés ──
  useEffect(() => {
    if (!user) return;
    // Clé quotidienne — relance une fois par jour même si la session reste ouverte
    const today = new Date().toISOString().slice(0, 10);
    const key = `bg-seed-v5-${today}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    const ALL_COMBOS = [
      // Films streaming FR — pages 1-200 pour aller au-delà du déjà-seedé
      { type: "movie", source: "discover", genreId: 36,    minVoteCount: 20,  minRating: 6   }, // Histoire
      { type: "movie", source: "discover", genreId: 10752, minVoteCount: 20,  minRating: 6   }, // Guerre
      { type: "movie", source: "discover", genreId: 878,   minVoteCount: 30,  minRating: 6.5 }, // Science-Fiction
      { type: "movie", source: "discover", genreId: 14,    minVoteCount: 30,  minRating: 6.5 }, // Fantastique
      { type: "movie", source: "discover", genreId: 53,    minVoteCount: 50,  minRating: 6.5 }, // Thriller
      { type: "movie", source: "discover", genreId: 18,    minVoteCount: 100, minRating: 7   }, // Drame
      { type: "movie", source: "discover", genreId: 35,    minVoteCount: 50,  minRating: 6.5 }, // Comédie
      { type: "movie", source: "discover", genreId: 80,    minVoteCount: 50,  minRating: 6.5 }, // Crime
      { type: "movie", source: "discover", genreId: 27,    minVoteCount: 30,  minRating: 6   }, // Horreur
      { type: "movie", source: "discover", genreId: 10749, minVoteCount: 30,  minRating: 6.5 }, // Romance
      { type: "movie", source: "discover", genreId: 28,    minVoteCount: 50,  minRating: 6.5 }, // Action
      { type: "movie", source: "discover", genreId: 12,    minVoteCount: 50,  minRating: 6.5 }, // Aventure
      { type: "movie", source: "top_rated",                minVoteCount: 200, minRating: 7.5 }, // Top qualité
      // Sorties récentes — peu de votes au moment du seed initial, donc lacunes importantes
      { type: "movie", source: "discover", sortBy: "primary_release_date.desc", noStreamingFilter: true, releaseYearMin: 2024, minVoteCount: 10,  minRating: 6   }, // 2024-2026
      { type: "movie", source: "discover", sortBy: "primary_release_date.desc", noStreamingFilter: true, releaseYearMin: 2022, releaseYearMax: 2023, minVoteCount: 50, minRating: 6.5 }, // 2022-2023
      { type: "tv",    source: "discover", sortBy: "primary_release_date.desc", noStreamingFilter: true, releaseYearMin: 2023, minVoteCount: 20,  minRating: 7   }, // Séries récentes
      // Classiques par décennie — sans filtre streaming (triés par vote_count)
      { type: "movie", source: "discover", sortBy: "vote_count.desc", noStreamingFilter: true, releaseYearMin: 1970, releaseYearMax: 1989, minVoteCount: 500,  minRating: 7 }, // 70s-80s
      { type: "movie", source: "discover", sortBy: "vote_count.desc", noStreamingFilter: true, releaseYearMin: 1990, releaseYearMax: 1999, minVoteCount: 1000, minRating: 7 }, // 90s
      { type: "movie", source: "discover", sortBy: "vote_count.desc", noStreamingFilter: true, releaseYearMin: 2000, releaseYearMax: 2010, minVoteCount: 2000, minRating: 7 }, // 2000s
      { type: "movie", source: "discover", sortBy: "vote_count.desc", noStreamingFilter: true, releaseYearMin: 2010, releaseYearMax: 2018, minVoteCount: 3000, minRating: 7 }, // 2010s
      // Séries
      { type: "tv", source: "discover", genreId: 10765, minVoteCount: 50,  minRating: 7   }, // SF & Fantastique TV
      { type: "tv", source: "discover", genreId: 18,    minVoteCount: 50,  minRating: 7   }, // Drame TV
      { type: "tv", source: "discover", genreId: 80,    minVoteCount: 30,  minRating: 7   }, // Crime TV
      { type: "tv", source: "top_rated",                minVoteCount: 100, minRating: 7.5 }, // Top séries
    ];

    const picks = [...ALL_COMBOS].sort(() => Math.random() - 0.5).slice(0, 3);

    const runSeed = (combo: (typeof picks)[0], delayMs: number) => {
      setTimeout(() => {
        const startPage = Math.floor(Math.random() * 200) + 1;
        supabase.functions.invoke("seed-embeddings", {
          body: { ...combo, pages: 3, startPage, batchSize: 5 },
        }).then(({ data }) => {
          const s = data?.stats;
          console.log(`[BG-SEED] ${combo.type} ${(combo as any).genreId ?? (combo as any).sortBy ?? combo.source} p${startPage}: vérifiés=${s?.fetched ?? 0} déjà_en_base=${s?.already_in_db ?? 0} nouveaux=+${s?.processed ?? 0}`);
        }).catch(() => {});
      }, delayMs);
    };

    runSeed(picks[0], 2000);   // 2s après montage
    runSeed(picks[1], 35000);  // 35s après
    runSeed(picks[2], 90000);  // 90s après

    // 4e vague : rafraîchissement des platform_ids périmés (films déjà en base, pas Gemini)
    setTimeout(() => {
      supabase.functions.invoke("seed-embeddings", {
        body: { mode: "refresh-platforms", refreshLimit: 20 },
      }).then(({ data }) => {
        console.log(`[BG-REFRESH] platform_ids: ${data?.stats?.refreshed ?? 0} mis à jour / ${data?.stats?.stale ?? 0} stales`);
      }).catch(() => {});
    }, 120000);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("profiles")
      .select(
        "preferred_platforms, excluded_platforms, favorite_genres, excluded_genres, min_rating, default_media_type, default_max_duration, match_threshold, default_recommendation_count",
      )
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.preferred_platforms) setUserPlatformIds(data.preferred_platforms);
        if ((data as any)?.excluded_platforms) {
          setUserExcludedPlatformIds((data as any).excluded_platforms);
        }
        if (data?.favorite_genres) setUserGenres(data.favorite_genres);
        if ((data as any)?.excluded_genres) {
          setUserExcludedGenres((data as any).excluded_genres);
        }

        // Merge rejected genres from the preferences system (weight < 0)
        getMyPreferences().then((prefs) => {
          const rejectedLabels = prefs
            .filter((p) => p.tag.category === "genre" && p.weight < 0)
            .map((p) => p.tag.label);
          if (rejectedLabels.length > 0) {
            setUserExcludedGenres((prev) => [...new Set([...prev, ...rejectedLabels])]);
          }
        }).catch(() => {});
        if ((data as any)?.min_rating) {
          setUserMinRating((data as any).min_rating);
        }

        const defaults: ProfileDefaults = {
          mediaType: ((data as any)?.default_media_type as "both" | "movie" | "tv") || "both",
          maxDuration: (data as any)?.default_max_duration ?? null,
          matchThreshold: (data as any)?.match_threshold ?? 80,
          minRating: (data as any)?.min_rating ?? 0,
          recommendationCount: Math.min((data as any)?.default_recommendation_count ?? 3, 3),
        };

        setProfileDefaults(defaults);
        setQuickFilters(defaults);
      });

    loadUnifiedUserFeedbackState().then(({ excludeIds, evaluatedCount }) => {
      setHistoryExcludeIds(excludeIds);
      historyExcludeIdsRef.current = excludeIds;
      setTotalEvaluated(evaluatedCount);
      console.log("[PICK-DEBUG] ✅ Exclusions chargées au démarrage:", excludeIds.length, "IDs", excludeIds.slice(0, 30));
    });
  }, [user]);

  // Refresh exclusion list whenever the user interacts with any movie so that
  // fresh likes / dislikes / not-for-me ratings are excluded from the next batch.
  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      loadUnifiedUserFeedbackState().then(({ excludeIds }) => {
        setHistoryExcludeIds(excludeIds);
        historyExcludeIdsRef.current = excludeIds;
        console.log("[PICK-DEBUG] 🔄 Exclusions mises à jour après interaction:", excludeIds.length, "IDs", excludeIds.slice(0, 30));
      });
    };
    window.addEventListener("pick-feedback-changed", refresh);
    window.addEventListener("pick-watchlist-added", refresh);
    return () => {
      window.removeEventListener("pick-feedback-changed", refresh);
      window.removeEventListener("pick-watchlist-added", refresh);
    };
  }, [user]);

  useEffect(() => {
    const handler = () => {
      setTonightPick(null);
      setTonightLoading(false);
      setFlipDetailMovie(null);
      setActiveAmbiance(null);
      setShowFindChoice(false);
      setFindChoiceDuoId(undefined);
    };
    window.addEventListener("home-reset", handler);
    return () => window.removeEventListener("home-reset", handler);
  }, []);

  // Ouvre la modale depuis le FAB "+" (event ou param URL)
  useEffect(() => {
    const handler = () => setShowFindChoice(true);
    window.addEventListener("open-find-choice", handler);
    return () => window.removeEventListener("open-find-choice", handler);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openFindChoice")) {
      setShowFindChoice(true);
      window.history.replaceState({}, "", "/app");
    }
  }, []);

  useEffect(() => {
    getTrendingMovies(20)
      .then((movies: Movie[]) => {
        const bgs = movies
          .filter((m) => m.backdrop_path)
          .map((m) => getBackdropUrl(m.backdrop_path))
          .filter(Boolean) as string[];
        setBgImages(bgs);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (bgImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBgIndex((i) => (i + 1) % bgImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [bgImages]);

  useEffect(() => {
    loadingLogEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loadingLog]);

  const invokeSurprisePersonalized = async (body: unknown, retries = 2): Promise<any> => {
    const { data, error } = await supabase.functions.invoke("surprise-personalized", { body });

    if (error) {
      const errMsg = typeof error === "object" && error?.message ? error.message : String(error);

      if (retries > 0 && (errMsg.includes("429") || errMsg.includes("Trop de requêtes"))) {
        await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1000));
        return invokeSurprisePersonalized(body, retries - 1);
      }

      throw error;
    }

    return data;
  };

  type DuoOverrides = { topGenres: string[]; excludedGenres: string[]; tasteVector: number[] | null; avoidanceVector: number[] | null; topClusters: string[]; rejectedClusters: string[]; partnerExcludeIds: number[]; user1Name: string | null; user2Name: string | null; user1Id?: string; user2Id?: string };
  const generateTonightPick = async (excludeList: number[] = rejectedIds, rejectionContext?: RejectionContext, voiceFilters?: VoiceSearchFilters | null, duoOverrides?: DuoOverrides, extraMoodContext?: string) => {
    generateTonightPickRef.current = generateTonightPick;
    if (voiceFilters !== undefined) activeVoiceFiltersRef.current = voiceFilters;
    const poolIds = (chatMoviesPool || []).map((m) => m.id).filter(Number.isFinite);
    // En mode duo : on n'utilise pas l'historique solo (trop restrictif), juste les interactions des deux users
    const soloHistory = duoOverrides ? [] : historyExcludeIdsRef.current;
    const allExcludeIds = [...new Set([...excludeList, ...poolIds, ...soloHistory, ...(duoOverrides?.partnerExcludeIds ?? [])])];

    const t0Pick = performance.now();
    let tEdgeStart = t0Pick;
    let tEdgeEnd = t0Pick;
    let tBatchStart = t0Pick;
    console.log("[PICK-DEBUG] ═══ generateTonightPick ═══");
    console.log("[PICK-DEBUG] historyExcludeIds (depuis feedback):", historyExcludeIdsRef.current.length, "IDs", historyExcludeIdsRef.current.slice(0, 20));
    console.log("[PICK-DEBUG] rejectedIds (session):", excludeList.length, "IDs", excludeList);
    console.log("[PICK-DEBUG] poolIds (chat pool):", poolIds.length, "IDs");
    console.log("[PICK-DEBUG] TOTAL allExcludeIds envoyés à l'edge function:", allExcludeIds.length);

    setTonightLoading(true);
    setTonightProviders([]);
    setLoadingLog([]);

    const buildMsgs = (likedTitles: string[] = []) => buildPersonalizedLoadingMessages({
      genres: userGenres,
      mediaType: quickFilters.mediaType,
      explorationLevel,
      ambiance: activeAmbiance ?? null,
      platformIds: userPlatformIds,
      likedTitles,
    });

    activeMessagesRef.current = buildMsgs();
    let msgIndex = 0;
    setTonightLoadingMsg(activeMessagesRef.current[0]);
    setLoadingLog([activeMessagesRef.current[0]]);

    const msgInterval = setInterval(() => {
      if (!isMountedRef.current) return;
      msgIndex = (msgIndex + 1) % activeMessagesRef.current.length;
      const next = activeMessagesRef.current[msgIndex];
      setTonightLoadingMsg(next);
      setLoadingLog((prev) => [...prev, next]);
    }, 2000);
    msgIntervalRef.current = msgInterval;

    try {
      let movies: MovieDetail[] = [];
      let firstMovieShown = false;
      let firstMovieShownId: number | null = null;
      const eagerMoviesGrowing: MovieDetail[] = [];
      let engineMetaResult: any = null;

      if (user) {
        const liked = await getLikedMovies();

        if (liked.length > 0) {
          const likedTitles = liked.slice(0, 8).map((m: any) => m.title).filter(Boolean) as string[];
          if (likedTitles.length > 0) activeMessagesRef.current = buildMsgs(likedTitles);
        }

        if (liked.length >= 2) {
          const [multiProfile, tasteProfile] = await Promise.all([
            computeMultiVectorProfile(user.id),
            getUserTasteProfile(),
          ]);

          const userTasteVector = duoOverrides?.tasteVector ?? (multiProfile?.stableTasteVector || null);

          if (tasteProfile?.topGenres?.length) setTonightUserGenres(tasteProfile.topGenres.slice(0, 8));
          console.group("[PICK-DEBUG] 📤 Paramètres envoyés à surprise-personalized");
          console.log("userTasteVector :", userTasteVector ? `✅ ${userTasteVector.length} dims` : "❌ NULL — SQL sera sauté");
          console.log("mediaType       :", quickFilters.mediaType);
          console.log("platformIds     :", userPlatformIds?.length ? userPlatformIds : "aucune");
          console.log("topGenres       :", tasteProfile?.topGenres?.slice(0, 8) ?? []);
          console.log("excludedGenres  :", userExcludedGenres?.length ? userExcludedGenres : "aucun");
          console.log("maxDuration     :", quickFilters.maxDuration ?? "illimitée");
          console.log("minMatchScore   :", quickFilters.matchThreshold, "%");
          console.log("count demandé   :", quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE);
          console.log("excludeIds      :", allExcludeIds.length, "IDs");
          console.groupEnd();

          const moodCfg = activeAmbiance ? MOOD_CONFIGS[activeAmbiance] : null;

          // Duo prime sur voix qui prime sur ambiance qui prime sur les valeurs par défaut
          const effectiveTopGenres = duoOverrides
            ? duoOverrides.topGenres
            : voiceFilters?.genres?.length
              ? voiceFilters.genres
              : moodCfg?.boostGenres
                ? [...new Set([...(moodCfg.boostGenres), ...(tasteProfile?.topGenres || [])])]
                : tasteProfile?.topGenres;
          const effectiveExcludedGenres = duoOverrides ? duoOverrides.excludedGenres : userExcludedGenres;
          const effectiveAvoidanceVector = duoOverrides?.avoidanceVector ?? (multiProfile?.avoidanceVector || null);
          const effectiveExplorationLevel = moodCfg?.explorationOverride ?? explorationLevel;
          const effectiveMaxDuration = voiceFilters?.maxDuration ?? moodCfg?.maxDurationOverride ?? quickFilters.maxDuration;
          const effectiveMediaType = voiceFilters?.mediaType ?? moodCfg?.mediaTypeOverride ?? (quickFilters.mediaType !== "both" ? quickFilters.mediaType : "both");
          const effectiveMinMatchScore = moodCfg?.minMatchScoreOverride ?? quickFilters.matchThreshold;
          const effectiveMinRating = moodCfg?.minRatingBoost ? (userMinRating ?? 0) + moodCfg.minRatingBoost : userMinRating;

          if (voiceFilters) {
            console.log("[PICK-DEBUG] 🎤 Voice overrides appliqués au pipeline :", {
              genres: voiceFilters.genres,
              originalLanguage: voiceFilters.originalLanguage,
              decade: voiceFilters.decade,
              maxDuration: voiceFilters.maxDuration,
              mediaType: voiceFilters.mediaType,
            });
          }

          tEdgeStart = performance.now();
          const data = await invokeSurprisePersonalized({
            likedMovies: [],
            userTasteVector,
            tasteProfile: {
              ...tasteProfile,
              topGenres: effectiveTopGenres,
              ...(duoOverrides && { tasteClusters: duoOverrides.topClusters, rejectedClusters: duoOverrides.rejectedClusters }),
            },
            recentTasteVector: multiProfile?.recentTasteVector || null,
            avoidanceVector: effectiveAvoidanceVector,
            platformIds: userPlatformIds,
            excludedPlatformIds: userExcludedPlatformIds,
            excludedGenres: effectiveExcludedGenres,
            minRating: effectiveMinRating,
            excludeIds: allExcludeIds,
            rejectionContext,
            explorationLevel: effectiveExplorationLevel,
            mediaType: effectiveMediaType,
            maxDuration: effectiveMaxDuration,
            count: (quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE),
            minMatchScore: effectiveMinMatchScore,
            ...((extraMoodContext || moodCfg?.moodContext) && { moodContext: extraMoodContext ?? moodCfg!.moodContext }),
            ...(moodCfg?.boostGenres && { moodBoostGenres: moodCfg.boostGenres }),
            // Overrides vocaux — priment sur les defaults SQL
            voiceGenres: voiceFilters?.genres ?? null,
            voiceOriginalLanguage: voiceFilters?.originalLanguage ?? null,
            voiceMediaType: voiceFilters?.mediaType ?? null,
            voiceMaxDuration: voiceFilters?.maxDuration ?? null,
            voiceDecade: voiceFilters?.decade ?? null,
            // Duo : fetch server-side des interactions des deux users (plus fiable que le client browser)
            ...(duoOverrides?.user1Id && duoOverrides?.user2Id && {
              duoUserIds: [duoOverrides.user1Id, duoOverrides.user2Id],
            }),
          });
          tEdgeEnd = performance.now();
          engineMetaResult = data?.engineMeta ?? null;
          const dbg = data?.debugData;

          // Mémoriser les 50 candidats SQL évalués pour les exclure au prochain appel
          if (dbg?.sql50?.length) {
            const sql50Ids = (dbg.sql50 as any[]).map((c) => Number(c.id)).filter(Number.isFinite);
            setLastSql50Ids(sql50Ids);
          }

          console.group("[PICK-DEBUG] ═══ Pipeline de recommandation ═══");

          // ── Étape 1 : SQL — toujours affiché même si 0 candidats ──
          if (dbg?.filters || dbg?.sqlCountDiag?.length || dbg?.sql50) {
            const f = dbg.filters;
            const cascadeLevel: number = dbg.sqlCascadeLevel ?? -1;
            const cascadeLabels = ["0 — toutes contraintes", "1 — sans lang/année", "2 — sans liked_genres", "3 — sans liked_genres ni note (excluded_genres conservé)", "4 — sans plateforme (excluded_genres conservé)"];
            const cascadeLabel = cascadeLevel >= 0 ? cascadeLabels[cascadeLevel] ?? `niveau ${cascadeLevel}` : "inconnu";
            const rpc = dbg.sqlRpcParams;
            const cascadeWarn = rpc ? (rpc.excluded_genres || []).length === 0 : false;
            const logFn = cascadeWarn ? console.warn.bind(console) : console.log.bind(console);
            const candidateCount = dbg.sql50?.length ?? 0;
            // Log standalone (toujours visible, hors groupe)
            console.log(`%c[PICK-DEBUG] 🔍 SQL vectoriel 32D → ${candidateCount} candidats | cascade niveau ${cascadeLabel} | ${f?.excludeCount ?? 0} IDs exclus`, "font-weight:bold;color:#6366f1");
            const headerFn = candidateCount === 0 ? console.warn.bind(console) : console.group.bind(console);
            headerFn(`[PICK-DEBUG] 1️⃣ SQL vectoriel 32D — ${candidateCount} candidats triés par similarité (Sim% = score vecteur) | ${f?.excludeCount ?? 0} exclus`);
            logFn(`   Cascade SQL : niveau ${cascadeLabel}${cascadeWarn ? " ⚠️ excluded_genres vide !" : ""}`);
            if (rpc) {
              console.log(`   Paramètres RPC effectifs :`);
              console.log(`     note min         : ${rpc.min_rating ?? 0}`);
              console.log(`     durée max        : ${rpc.max_duration ? `${rpc.max_duration}min` : "illimitée"}`);
              console.log(`     genres aimés     : [${(rpc.liked_genres || []).join(", ") || "—"}]`);
              console.log(`     genres exclus    : [${(rpc.excluded_genres || []).join(", ") || (cascadeLevel >= 3 ? "⚠️ AUCUN (désactivé)" : "—")}]`);
              console.log(`     langues exclues  : [${(rpc.p_excluded_languages || []).join(", ") || "—"}]`);
              console.log(`     popularité min   : ${rpc.p_min_popularity ?? "—"}`);
              console.log(`     plateformes      : [${(rpc.p_platform_ids || []).join(", ") || "—"}]`);
              console.log(`     exclude_ids      : ${rpc.exclude_ids_count} IDs`);
            }
            // COUNT standalone — toujours visible (hors groupe), disponible si SP v20+ déployé
            if (dbg.sqlCountDiag?.length) {
              console.log("%c[PICK-DEBUG] 📊 COUNT SQL — films en base vs disponibles :", "font-weight:bold;color:#10b981");
              console.table(dbg.sqlCountDiag.map((d: any) => ({
                "Niveau": `${d.level} — ${cascadeLabels[d.level] ?? `niveau ${d.level}`}`,
                "Total en base": d.total_in_db,
                "Disponibles (après exclusions)": d.available_after_exclusions,
                "excluded_genres": d.level < 3 ? "✅ actifs" : "⚠️ vérifier snippet",
              })));
            }
            if (dbg.sqlSnippet) {
              console.group(`[PICK-DEBUG] 🔍 Snippet SQL (copier dans l'éditeur SQL Supabase)`);
              console.log(dbg.sqlSnippet);
              console.groupEnd();
            }
            // Liste des candidats — seulement s'il y en a
            if (candidateCount > 0) {
              console.table(dbg.sql50.map((c: any, i: number) => ({
                "#": i + 1,
                "Titre": c.title,
                "Année": c.year,
                "Note /10": c.note ?? "–",
                "Sim% (vecteur 32D)": c.sim ?? "–",
                "Composite": c.composite ?? "–",
                "Genres": (c.genres || []).join(", "),
                "Type": c.type,
              })));
            }
            if (candidateCount > 0) console.groupEnd();

            // Détail par niveau de cascade SQL
            if ((dbg as any)?.sqlLevelDebug?.length) {
              const cascadeLabels = ["0 — toutes contraintes", "1 — sans lang/année", "2 — sans liked_genres", "3 — sans goût restrictif"];
              console.group("[PICK-DEBUG] 📈 Détail par niveau de cascade SQL");
              (dbg as any).sqlLevelDebug.forEach((lvl: any) => {
                const label = cascadeLabels[lvl.level] ?? `niveau ${lvl.level}`;
                console.log(`   Niveau ${label} : +${lvl.newFilms} non-interagis (total: ${lvl.totalNonInteracted}/50)`);
                if (lvl.films?.length) {
                  console.log(`   → ${lvl.films.slice(0, 5).map((f: any) => `"${f.title}" (${f.year}) ⭐${f.note} sim=${f.sim}%`).join(" | ")}`);
                }
              });
              console.groupEnd();
            }

            // Fallback SQL explicite (sans vecteur)
            if ((dbg as any)?.explicitFallbackDebug?.length) {
              console.group("[PICK-DEBUG] 1️⃣⁺ SQL explicite (sans vecteur) — complément si pool vectoriel insuffisant");
              (dbg as any).explicitFallbackDebug.forEach((lvl: any) => {
                console.log(`   liked_genres=${lvl.likedGenres ? "oui" : "non"}, note≥${lvl.minRating}: +${lvl.newFilms} films`);
                if (lvl.films?.length) {
                  console.log(`   → ${lvl.films.slice(0, 5).map((f: any) => `"${f.title}" (${f.year}) ⭐${f.note}`).join(" | ")}`);
                }
              });
              console.groupEnd();
            }
          }

          // ── Profil LLM ──
          if (dbg?.llmProfile) {
            const p = dbg.llmProfile;
            console.log(`[PICK-DEBUG] 🧠 Profil utilisateur → LLM`);
            console.log(`   Paramètres LLM :`);
            console.log(`     genres préférés  : [${(p.genresPrefers || []).join(", ") || "—"}]`);
            console.log(`     genres exclus    : [${(p.genresExclus || []).join(", ") || "—"}]`);
            console.log(`     origines aimées  : [${(p.originesAimees || []).join(", ") || "—"}]`);
            console.log(`     origines exclues : [${(p.originesExclues || []).join(", ") || "—"}]`);
            console.log(`     genres fatigue   : [${(p.genresFatigue || []).join(", ") || "—"}]`);
            console.log(`     clusters favoris : [${(p.clusters || []).join(", ") || "—"}]`);
            console.log(`     clusters rejetés : [${(p.clustersRejetes || []).join(", ") || "—"}]`);
            console.log(`     films aimés      : [${(p.filmsAimes || []).join(", ") || "—"}]`);
            console.log(`     confiance profil : ${p.confianceProfil}/100`);
            console.log(`     type média       : ${p.mediaType}`);
            console.log(`     exploration      : ${p.explorationLevel}/10`);
            console.log(`     score min        : ${p.minMatchScore}%`);
            if (dbg.systemPrompt) {
              console.group(`[PICK-DEBUG] 📄 Prompt système complet envoyé au LLM`);
              console.log(dbg.systemPrompt);
              console.groupEnd();
            }
          }

          // ── Étape 2 : Top 20 triés par score composé ──
          if (dbg?.top20?.length) {
            console.group(`[PICK-DEBUG] 2️⃣ Top ${dbg.top20.length} envoyés au LLM — triés par score composé (sim×100 + note)`);
            console.table(dbg.top20.map((c: any, i: number) => ({
              "#": i + 1,
              "Titre": c.title,
              "Note /10": c.note ?? "–",
              "Sim%": c.sim ?? "–",
              "Composite (sim×100+note)": c.composite ?? "–",
              "Genres": (c.genres || []).join(", "),
              "Type": c.type,
            })));
            console.groupEnd();
          }

          // ── Étape 2.5 : 30 films avec leur plateforme + filtrés envoyés au LLM ──
          if (dbg?.platformPool?.length) {
            const platformMs = dbg.platformFilterMs != null ? dbg.platformFilterMs : "?";
            const llmMs = dbg.llmMs != null ? dbg.llmMs : "?";
            const matched = dbg.platformPool.filter((r: any) => r.match).length;
            const bypassed = dbg.llmFiltered?.length === dbg.top20?.length;
            const label = bypassed
              ? `⚠️ bypass rate limit (${platformMs}ms) — tous les ${dbg.top20?.length} films au LLM`
              : `filtre plateforme (${platformMs}ms) — ${matched}/${dbg.platformPool.length} retenus | LLM: ${llmMs}ms`;
            console.group(`[PICK-DEBUG] 2️⃣⁺ Plateformes des 30 films — ${label}`);
            console.table(dbg.platformPool.map((r: any, i: number) => ({
              "#": i + 1,
              "Titre": r.title,
              "✅ Match": r.match ? "✅ oui" : "❌ non",
              "Plateformes dispo": r.platforms.length ? r.platforms.join(", ") : "—",
            })));
            console.groupEnd();
          } else if (dbg?.llmFiltered) {
            // Fallback si platformPool absent (ancienne version déployée)
            const platformMs = dbg.platformFilterMs != null ? dbg.platformFilterMs : "?";
            const llmMs = dbg.llmMs != null ? dbg.llmMs : "?";
            console.group(`[PICK-DEBUG] 2️⃣⁺ Films envoyés au LLM (${platformMs}ms filtre | LLM: ${llmMs}ms) — ${dbg.llmFiltered.length} films`);
            console.table(dbg.llmFiltered.map((c: any, i: number) => ({
              "#": i + 1, "Titre": c.title, "Note /10": c.note ?? "–", "Sim%": c.sim ?? "–",
            })));
            console.groupEnd();
          }

          // ── Étape 3 : Sélections LLM ──
          if (dbg?.llmSelections?.length) {
            console.group(`[PICK-DEBUG] 3️⃣ Sélections LLM (${dbg.llmSelections.length} films → movie-match va scorer)`);
            console.table(dbg.llmSelections.map((s: any, i: number) => ({
              "#": i + 1,
              "Titre": s.title,
              "Score LLM": `${s.matchScore}%`,
              "Raison": s.reason,
            })));
            console.groupEnd();
          }

          // ── Étape 3.5b : Fallback trace (mode discover-fallback) ──
          if (dbg?.fallbackTrace?.length) {
            console.group(`[PICK-DEBUG] 🔀 Films ajoutés en mode fallback — ${dbg.fallbackTrace.length} film(s) (aucun candidat SQL/LLM disponible)`);
            console.table(dbg.fallbackTrace.map((t: any, i: number) => ({
              "#": i + 1,
              "Titre": t.title,
              "ID TMDB": t.id,
              "Type": t.type,
              "Source": t.stage,
            })));
            console.groupEnd();
          }

          // ── Étape 3.5 : Enrichissement TMDB ──
          if (dbg?.tmdbEnrichment?.length) {
            const failed = dbg.tmdbEnrichment.filter((t: any) => !t.ok);
            const ok = dbg.tmdbEnrichment.filter((t: any) => t.ok);
            console.group(`[PICK-DEBUG] 3️⃣.5 TMDB enrichissement — ✅ ${ok.length} OK / ❌ ${failed.length} échoués`);
            console.table(dbg.tmdbEnrichment.map((t: any, i: number) => ({
              "#": i + 1,
              "Titre": t.title,
              "ID TMDB": t.id,
              "Type": t.type,
              "Statut": t.ok ? "✅ OK" : `❌ ${t.reason || "échec"}`,
            })));
            if (failed.length > 0) {
              console.warn(`[PICK-DEBUG] ⚠️ ${failed.length} film(s) LLM perdus au TMDB lookup → fallback trending activé`);
            }
            console.groupEnd();
          }

          // ── Étape 4 : Films finaux présentés ──
          if ((dbg as any)?.finalMoviesList?.length) {
            console.group(`[PICK-DEBUG] 4️⃣ Films finaux présentés à l'utilisateur (${(dbg as any).finalMoviesList.length})`);
            console.table((dbg as any).finalMoviesList.map((m: any, i: number) => ({
              "#": i + 1,
              "Titre": m.title,
              "Année": m.year,
              "Score": m.matchScore != null ? `${m.matchScore}%` : "—",
              "Raison LLM": m.reason ? m.reason.slice(0, 80) : "—",
            })));
            console.groupEnd();
          }

          console.log("[PICK-DEBUG] engineMeta:", data?.engineMeta);

          // ── Filtre plateforme : diagnostic ──
          const meta = data?.engineMeta;
          if (meta && meta.platformCandidatesCount >= 0) {
            if (meta.platformFallbackTriggered) {
              console.warn(
                `[PICK-DEBUG] ⚠️ Filtre plateforme initial insuffisant (${meta.platformCandidatesCount} candidats avec tous les filtres) → cascade appliquée, plateforme conservée → ${meta.candidatesFound} candidats finaux sur tes plateformes.`,
              );
            } else {
              console.log(
                `[PICK-DEBUG] ✅ Filtre plateforme actif : ${meta.platformCandidatesCount} candidats SQL sur tes plateformes.`,
              );
            }
          }

          // ── Timings par étape ──
          const timings = data?.engineMeta?.timings;
          if (timings) {
            const fmt = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
            const bar = (ms: number, total: number) => {
              const pct = Math.round((ms / total) * 20);
              return "█".repeat(Math.max(1, pct)) + "░".repeat(20 - Math.max(1, pct));
            };
            const tot = timings.total || 1;
            console.group(`[PICK-DEBUG] ⏱️ Timings pipeline — total ${fmt(tot)}`);
            console.log(`  SQL (${dbg?.sql50?.length ?? "?"} candidats)       ${bar(timings.sql, tot)}  ${fmt(timings.sql)}`);
            console.log(`  Enrichissement langue      ${bar(timings.langEnrich, tot)}  ${fmt(timings.langEnrich)}`);
            console.log(`  LLM + filtre plateforme   ${bar(timings.select, tot)}  ${fmt(timings.select)}`);
            console.log(`  TMDB enrichissement batch  ${bar(timings.tmdb, tot)}  ${fmt(timings.tmdb)}`);
            console.log(`  Fallback                   ${bar(timings.fallback, tot)}  ${fmt(timings.fallback)}`);
            console.groupEnd();
          }

          console.groupEnd();
          const extracted = extractRecommendationMovies(data);
          const desiredCount = quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE;

          // Fallback AI confidence scores — shown immediately while movie-match scores load
          const matchMap: Record<number, RecommendationMatch> = {};
          (data?.movies || []).forEach((m: any) => {
            if (!m.movie?.id) return;
            matchMap[m.movie.id] = {
              confidence: m.confidence || 75,
              reason: m.reason || "",
            };
          });
          setMovieMatchData((prev) => ({ ...prev, ...matchMap }));

          // Tout le filtrage est fait dans le SQL — en mode retrieve-rerank le client
          // score uniquement les candidats LLM sans re-filtrer par l'historique.
          tBatchStart = performance.now();
          movies = await ensureRecommendationBatch(extracted, {
            excludeIds: [],
            platformIds: userPlatformIds,
            minRating: 0,
            excludedGenres: [],
            mediaType: undefined,
            size: desiredCount,
            preloadMatchTexts: true,
            preloadProviders: true,
            scoreAllWithMovieMatch: true,
            ...(duoOverrides?.user1Name && { duoContext: { user1Name: duoOverrides.user1Name, user2Name: duoOverrides.user2Name ?? null } }),
            onBatchReady: (batchMovies) => {
              if (!isMountedRef.current || firstMovieShown) return;
              firstMovieShown = true;
              firstMovieShownId = batchMovies[0]?.id ?? null;
              // Afficher les 3 films immédiatement avec le texte LLM (reason) comme teaser
              setTonightPick(batchMovies[0] as MovieDetail);
              setTonightPickIndex(0);
              // Marquer seulement le film 1 comme vu — les autres s'ajouteront à la navigation
              setTonightSeenMovieIds(new Set([batchMovies[0].id]));
              setChatMoviesPool(batchMovies as MovieDetail[]);
              // Charger les plateformes immédiatement pour le film 1
              void loadProviders(batchMovies[0] as MovieDetail);
            },
            onMovieEnriched: (enrichedMovie) => {
              if (!isMountedRef.current) return;
              const isFallbackTexts = !!(enrichedMovie.recommendationTexts as any)?.fallback;
              setChatMoviesPool((prev) =>
                prev.map((m) => {
                  if (m.id !== enrichedMovie.id) return m;
                  // Si movie-match retourne un fallback mais qu'on a déjà un reason LLM, le conserver
                  // tout en injectant whyItMatches pour signaler que movie-match a répondu (débloque le flou).
                  if (isFallbackTexts && ((m as any).recommendationTexts)?.reason) {
                    return {
                      ...m,
                      recommendationTexts: {
                        ...((m as any).recommendationTexts),
                        whyItMatches: (enrichedMovie.recommendationTexts as any)?.whyItMatches ?? "",
                      },
                    } as MovieDetail;
                  }
                  return enrichedMovie as MovieDetail;
                }),
              );
            },
            onFirstMovieReady: (firstMovie) => {
              // Filet de sécurité : si onBatchReady n'a pas pu s'exécuter
              if (!isMountedRef.current || firstMovieShown) return;
              firstMovieShown = true;
              firstMovieShownId = firstMovie.id;
              eagerMoviesGrowing.push(firstMovie as MovieDetail);
              setTonightPick(firstMovie as MovieDetail);
              setTonightPickIndex(0);
              setTonightSeenMovieIds(new Set([firstMovie.id]));
              setChatMoviesPool([firstMovie as MovieDetail]);
            },
            onMovieReady: (movie) => {
              // Filet de sécurité : si onBatchReady/onMovieEnriched ne sont pas actifs
              if (!isMountedRef.current) return;
              eagerMoviesGrowing.push(movie as MovieDetail);
              // Si onBatchReady a déjà montré les films, onMovieEnriched gère les mises à jour
              if (firstMovieShown) return;
              const first = eagerMoviesGrowing.find((m) => m.id === firstMovieShownId);
              const rest = eagerMoviesGrowing.filter((m) => m.id !== firstMovieShownId);
              setChatMoviesPool(first ? [first, ...rest] : [...eagerMoviesGrowing]);
            },
          });

          console.group("[PICK-DEBUG] 4️⃣ Résultat final après movie-match");
          console.table(movies.map((m: any, i: number) => ({
            "#": i + 1,
            "Titre": m.title,
            "Score movie-match": `${getRecommendationScore(m.recommendationTexts) ?? "–"}%`,
            "Rich texts": (m.recommendationTexts as any)?.fallback ? "⚠️ FALLBACK" : m.recommendationTexts?.headline ? "oui" : "non",
          })));
          console.groupEnd();

          // Safety net: if batch processing filtered everything but edge function returned results,
          // display them directly — UNIQUEMENT si aucune plateforme sélectionnée (sinon on risque
          // de montrer des films absents des plateformes de l'utilisateur).
          if (movies.length === 0 && extracted.length > 0 && !userPlatformIds?.length) {
            console.log("[PICK-DEBUG] ⚠️ Safety net activé — films filtrés, fallback sur extracted brut");
            movies = extracted.slice(0, desiredCount) as MovieDetail[];
          }

          // Override with actual movie-match scores now that they're available
          const actualScoreMap: Record<number, RecommendationMatch> = {};
          (movies as any[]).forEach((m: any) => {
            const texts = m.recommendationTexts;
            const score = getRecommendationScore(texts);
            if (m.id && score != null) {
              actualScoreMap[m.id] = {
                confidence: score,
                reason: texts?.reason ?? texts?.whyItMatches ?? texts?.summary ?? matchMap[m.id]?.reason ?? "",
              };
            }
          });
          if (Object.keys(actualScoreMap).length > 0) {
            setMovieMatchData((prev) => ({ ...prev, ...actualScoreMap }));
          }
        } else {
          movies = await ensureRecommendationBatch([], {
            excludeIds: allExcludeIds,
            platformIds: userPlatformIds,
            minRating: userMinRating,
            excludedGenres: userExcludedGenres,
            mediaType: quickFilters.mediaType,
            size: quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE,
            preloadMatchTexts: true,
            preloadProviders: true,
            minMatchScore: quickFilters.matchThreshold,
            ...(duoOverrides?.user1Name && { duoContext: { user1Name: duoOverrides.user1Name, user2Name: duoOverrides.user2Name ?? null } }),
          });
          const scoreMapB: Record<number, RecommendationMatch> = {};
          (movies as any[]).forEach((m: any) => {
            const texts = m.recommendationTexts;
            const score = getRecommendationScore(texts);
            if (m.id && score != null) {
              scoreMapB[m.id] = {
                confidence: score,
                reason: texts?.reason ?? texts?.whyItMatches ?? texts?.summary ?? "",
              };
            }
          });
          if (Object.keys(scoreMapB).length > 0) {
            setMovieMatchData((prev) => ({ ...prev, ...scoreMapB }));
          }
        }
      } else {
        movies = await ensureRecommendationBatch([], {
          excludeIds: allExcludeIds,
          platformIds: userPlatformIds,
          minRating: userMinRating,
          excludedGenres: userExcludedGenres,
          mediaType: quickFilters.mediaType,
          size: quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE,
          preloadMatchTexts: true,
          preloadProviders: true,
          minMatchScore: quickFilters.matchThreshold,
          ...(duoOverrides?.user1Name && { duoContext: { user1Name: duoOverrides.user1Name, user2Name: duoOverrides.user2Name ?? null } }),
        });
        const scoreMapC: Record<number, RecommendationMatch> = {};
        (movies as any[]).forEach((m: any) => {
          const texts = m.recommendationTexts;
          const score = getRecommendationScore(texts);
          if (m.id && score != null) {
            scoreMapC[m.id] = {
              confidence: score,
              reason: texts?.reason ?? texts?.whyItMatches ?? texts?.summary ?? "",
            };
          }
        });
        if (Object.keys(scoreMapC).length > 0) {
          setMovieMatchData((prev) => ({ ...prev, ...scoreMapC }));
        }
      }

      // ── Diagnostic : filtres trop stricts ──────────────────────────────
      if (isMountedRef.current) {
        const engineMeta = engineMetaResult;
        const threshold = quickFilters.matchThreshold;
        const rating = userMinRating;

        if (movies.length === 0) {
          // Aucun film trouvé malgré tous les fallbacks — message explicite
          let message = "Impossible de trouver des films pour le moment.";
          let suggestThreshold: number | undefined;
          let suggestRating: boolean | undefined;
          if (threshold > 70 && rating > 6) {
            message = `Seuil à ${threshold}% et note min ${rating}/10 combinés — aucun film ne correspond. Essaie de baisser l'un des deux.`;
            suggestThreshold = 60;
            suggestRating = true;
          } else if (threshold > 70) {
            message = `Aucun film trouvé à ${threshold}% de correspondance. Essaie de baisser le seuil.`;
            suggestThreshold = 60;
          } else if (rating > 6) {
            message = `Aucun film trouvé avec une note min de ${rating}/10. Essaie d'enlever ou de baisser ce filtre.`;
            suggestRating = true;
          }
          setNoResultsInfo({ message, suggestThreshold, suggestRating });
          return;
        }

        // Films trouvés via fallback nucléaire (tous les filtres levés)
        if (engineMeta?.filtersRelaxed && engineMeta?.mode === "discover-fallback") {
          toast.info(
            "Aucun film trouvé avec tes filtres — voici des suggestions populaires à la place.",
            { duration: 6000 }
          );
        } else if (engineMeta?.filtersRelaxed && threshold > 65) {
          toast.info(
            `Seuil de ${threshold}% trop strict — les suggestions proposées sont les plus proches trouvées`,
            { duration: 5000 }
          );
        }
      }

      if (isMountedRef.current && movies.length > 0) {
        setNoResultsInfo(null);
        const displayCount = quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE;
        // Ne pas re-filtrer par watchProviders : l'edge function a déjà filtré par plateforme.
        // Le TMDB provider check client-side peut manquer des résultats (cache miss / race),
        // ce qui réduirait le pool à 1 film alors que tous sont bien sur la plateforme de l'utilisateur.
        // poolMovies sert uniquement au chemin onFirstMovieReady (pas onBatchReady).
        let poolMovies = movies.slice(0, displayCount);
        // Filet de sécurité onFirstMovieReady : remettre le 1er film affiché en tête si décalé
        if (!firstMovieShown && firstMovieShownId !== null) {
          const idx = poolMovies.findIndex((m) => m.id === firstMovieShownId);
          if (idx > 0) {
            const [first] = poolMovies.splice(idx, 1);
            poolMovies = [first, ...poolMovies];
          }
        }
        const tDisplay = performance.now();
        const fmt = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
        const total = tDisplay - t0Pick;
        const preEdge = tEdgeStart - t0Pick;
        const edge = tEdgeEnd - tEdgeStart;
        const batch = tDisplay - tBatchStart;
        const bar = (ms: number) => { const p = Math.round((ms / total) * 20); return "█".repeat(Math.max(1, p)) + "░".repeat(20 - Math.max(1, p)); };
        const label = firstMovieShown ? "batch complet (1er film affiché plus tôt)" : "clic → premier film affiché";
        console.group(`[PICK-DEBUG] ⏱️ BOUT EN BOUT — ${label} : ${fmt(total)}`);
        console.log(`  Préparation (profil, liked)  ${bar(preEdge)}  ${fmt(preEdge)}`);
        console.log(`  Edge function                ${bar(edge)}  ${fmt(edge)}`);
        console.log(`  Movie-match + batch          ${bar(batch)}  ${fmt(batch)}`);
        console.groupEnd();

        if (firstMovieShown) {
          // onBatchReady a posé les films dans le bon ordre.
          // onMovieEnriched les a enrichis un à un, sans changer les positions.
          // Ne rien faire ici : tout appel à setChatMoviesPool risque de réordonner.
        } else {
          // Chemin normal (onBatchReady n'a pas pu s'exécuter)
          setChatMoviesPool(poolMovies);
          await setCurrentTonightMovie(poolMovies[0], 0, new Set(poolMovies[0] ? [poolMovies[0].id] : []));
        }

        // All films were enriched in parallel above — nothing to do lazily here.

        // ── Seed post-recommandation : enrichir la base après l'affichage des films ──
        // Déclenché 3s après que les films sont montrés — pas d'impact sur l'UX.
        // Priorité aux contenus sous-représentés : récents et classiques sans filtre streaming.
        setTimeout(() => {
          // TMDB genre IDs pour les films français
          const FR_GENRE_IDS = [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37];
          const POST_RECO_COMBOS = [
            { type: "movie", source: "discover", sortBy: "primary_release_date.desc", noStreamingFilter: true, releaseYearMin: 2024, minVoteCount: 10,   minRating: 6   },
            { type: "movie", source: "discover", sortBy: "primary_release_date.desc", noStreamingFilter: true, releaseYearMin: 2022, releaseYearMax: 2023, minVoteCount: 50,  minRating: 6.5 },
            { type: "movie", source: "discover", sortBy: "vote_count.desc",           noStreamingFilter: true, releaseYearMin: 1970, releaseYearMax: 1989, minVoteCount: 500, minRating: 7   },
            { type: "movie", source: "discover", sortBy: "vote_count.desc",           noStreamingFilter: true, releaseYearMin: 1990, releaseYearMax: 1999, minVoteCount: 1000,minRating: 7   },
            { type: "movie", source: "discover", sortBy: "vote_count.desc",           noStreamingFilter: true, releaseYearMin: 2000, releaseYearMax: 2010, minVoteCount: 2000,minRating: 7   },
            { type: "tv",    source: "discover", sortBy: "primary_release_date.desc", noStreamingFilter: true, releaseYearMin: 2023, minVoteCount: 20,     minRating: 7   },
            { type: "movie", source: "top_rated", minVoteCount: 200, minRating: 7.5 },
            // Films français par genre — seed ciblé pour couvrir tous les genres en langue fr
            { type: "movie", source: "discover", sortBy: "vote_count.desc", noStreamingFilter: true, originalLanguage: "fr", genreId: FR_GENRE_IDS[Math.floor(Math.random() * FR_GENRE_IDS.length)], minVoteCount: 50, minRating: 6 },
            { type: "movie", source: "discover", sortBy: "popularity.desc", noStreamingFilter: true, originalLanguage: "fr", minVoteCount: 100, minRating: 6 },
          ];
          const combo = POST_RECO_COMBOS[Math.floor(Math.random() * POST_RECO_COMBOS.length)];
          const startPage = Math.floor(Math.random() * 100) + 1;
          supabase.functions.invoke("seed-embeddings", {
            body: { ...combo, pages: 2, startPage, batchSize: 5 },
          }).then(({ data }) => {
            const s = data?.stats;
            const lang = (combo as any).originalLanguage ? ` [${(combo as any).originalLanguage.toUpperCase()}]` : "";
            const genreTag = (combo as any).genreId ? ` genre#${(combo as any).genreId}` : "";
            console.log(`[POST-RECO-SEED]${lang}${genreTag} ${combo.type} ${(combo as any).sortBy ?? combo.source} p${startPage}: +${s?.processed ?? 0} nouveaux / ${s?.skipped ?? 0} déjà en base / ${s?.failed ?? 0} erreurs`);
            if (s?.processed > 0) {
              toast.success(`+${s.processed} nouveaux films ajoutés à la base${lang}`, { duration: 3000, position: "bottom-center" });
            }
          }).catch(() => {});
        }, 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      clearInterval(msgInterval);
      msgIntervalRef.current = null;
      if (isMountedRef.current) {
        setTonightLoading(false);
        setTonightLoadingMsg("");
      }
    }
  };

  const handleAutoPick = async (duoId?: string, opts?: { genres?: string[]; moodContext?: string }) => {
    setShowFindChoice(false);
    setFindChoiceDuoId(undefined);
    setTonightPick(null);
    setChatMoviesPool(null);
    setTonightPickIndex(0);
    setNoResultsInfo(null);
    activeVoiceFiltersRef.current = null;
    const genreFilter: import("./VoiceChat").VoiceSearchFilters | null = opts?.genres?.length
      ? { genres: opts.genres, originalLanguage: null, mediaType: null, maxDuration: null, decade: null }
      : null;

    if (duoId) {
      try {
        const { data: duo } = await (supabase as any)
          .from("duo_taste_profiles").select("*").eq("id", duoId).single();
        if (duo && duo.user2_id) {
          // Seuls les films explicitement rejetés (rouge) sont exclus — vus/likés/skippés restent dans le pool
          const fetchInteractedIds = async (userId: string): Promise<number[]> => {
            const { data } = await supabase
              .from("user_item_feedback")
              .select("item:item_id(tmdb_id)")
              .eq("user_id", userId)
              .or("action.in.(not_for_me,dislike,seen),feedback_type.in.(not_for_me,dislike,seen)");
            return (data ?? []).map((r: any) => {
              const item = r.item;
              const tmdb = Array.isArray(item) ? item[0]?.tmdb_id : item?.tmdb_id;
              return tmdb;
            }).filter(Number.isFinite) as number[];
          };
          const [[ids1, ids2], { data: vec1 }, { data: vec2 }, { data: prof1 }, { data: prof2 }] = await Promise.all([
            Promise.all([fetchInteractedIds(duo.user1_id), fetchInteractedIds(duo.user2_id)]),
            supabase.from("user_taste_vectors").select("top_clusters, rejected_clusters").eq("user_id", duo.user1_id).maybeSingle(),
            supabase.from("user_taste_vectors").select("top_clusters, rejected_clusters").eq("user_id", duo.user2_id).maybeSingle(),
            supabase.from("profiles").select("excluded_genres").eq("id", duo.user1_id).maybeSingle(),
            supabase.from("profiles").select("excluded_genres").eq("id", duo.user2_id).maybeSingle(),
          ]);
          console.log(`[DUO] IDs interagis: user1=${ids1.length} | user2=${ids2.length} | union=${new Set([...ids1, ...ids2]).size}`);
          const tv = duo.taste_vector ? JSON.parse(duo.taste_vector) : null;
          const av = duo.avoidance_vector ? JSON.parse(duo.avoidance_vector) : null;

          // Union des genres likés + clusters (l'un ou l'autre)
          // Union des exclusions fraîches des deux profils (pas le champ stocké qui peut être périmé)
          const unionTopGenres = [...new Set([...(duo.user1_genres ?? []), ...(duo.user2_genres ?? [])])];
          const unionTopClusters = [...new Set([...(vec1?.top_clusters ?? []), ...(vec2?.top_clusters ?? [])])];
          const unionRejectedClusters = [...new Set([...(vec1?.rejected_clusters ?? []), ...(vec2?.rejected_clusters ?? [])])];
          const unionExcludedGenres = [...new Set([...((prof1 as any)?.excluded_genres ?? []), ...((prof2 as any)?.excluded_genres ?? [])])];

          const duoOverrides: DuoOverrides = {
            topGenres: unionTopGenres,
            excludedGenres: unionExcludedGenres,
            tasteVector: tv,
            avoidanceVector: av,
            topClusters: unionTopClusters,
            rejectedClusters: unionRejectedClusters,
            partnerExcludeIds: [...new Set([...ids1, ...ids2])],
            user1Name: duo.user1_display_name ?? null,
            user2Name: duo.user2_display_name ?? null,
            user1Id: duo.user1_id,
            user2Id: duo.user2_id,
          };
          currentDuoOverridesRef.current = duoOverrides;
          void generateTonightPick([], undefined, genreFilter ?? undefined, duoOverrides, opts?.moodContext);
          return;
        }
      } catch (e) {
        console.error("[Duo] handleAutoPick fetch error:", e);
      }
    }
    currentDuoOverridesRef.current = null;
    void generateTonightPick(rejectedIds, undefined, genreFilter, currentDuoOverridesRef.current ?? undefined, opts?.moodContext);
  };

  // Garde les refs à jour à chaque render pour éviter les stale closures dans les bridges
  handleAutoPickRef.current = handleAutoPick;
  generateTonightPickRef.current = generateTonightPick;

  const handleCloseTonightPick = () => setTonightPick(null);

  const handleNavigateTonightPick = async (direction: "prev" | "next") => {
    const newIndex =
      direction === "next" ? Math.min(tonightPickIndex + 1, tonightPool.length - 1) : Math.max(tonightPickIndex - 1, 0);

    if (newIndex === tonightPickIndex) return;

    const nextSeen = new Set(tonightSeenMovieIds);
    const movieId = tonightPool[newIndex]?.id;
    if (movieId) nextSeen.add(movieId);

    await setCurrentTonightMovie(tonightPool[newIndex], newIndex, nextSeen);
  };

  const handleOpenMovieDetail = () => {
    if (!tonightPick) return;
    setFlipDetailMovie(tonightPick);
  };

  const handleWatchNow = () => {
    if (!tonightPick) return;
    const moviesToPass = chatMoviesPool && chatMoviesPool.length > 0 ? chatMoviesPool : [tonightPick];
    onSurprise(moviesToPass, tonightPickIndex, tonightSeenMovieIds);
  };

  const handleRejectAndRefresh = async (movie: MovieDetail, reason: RejectionContext["reason"]) => {
    const nextRejected = [...rejectedIds, movie.id];
    const rejContext: RejectionContext = {
      reason,
      rejectedGenres: (movie.genres || []).map((g) => g.name),
      rejectedTitle: movie.title || movie.name || "",
    };

    setRejectedIds(nextRejected);
    setTonightPick(null);
    setChatMoviesPool(null);
    setTonightPickIndex(0);
    setTonightSeenMovieIds(new Set());
    setNoResultsInfo(null);

    await generateTonightPick(nextRejected, rejContext, activeVoiceFiltersRef.current, currentDuoOverridesRef.current ?? undefined);
  };

  const handleMovieAction = async (type: "already_seen" | "dislike" | string) => {
    if (!tonightPick) return;
    if (type === "already_seen") return;
    if (type !== "dislike") return;

    const nextRejected = [...rejectedIds, tonightPick.id];
    setRejectedIds(nextRejected);

    // Mark as seen so "X autres suggestions" unlocks when all films are disliked
    const nextSeen = new Set(tonightSeenMovieIds);
    nextSeen.add(tonightPick.id);

    // Navigate within the existing pool — no auto-search, user must press "X autres suggestions"
    if (tonightPool.length > 1 && tonightPickIndex < tonightPool.length - 1) {
      const nextSeen2 = new Set(nextSeen);
      nextSeen2.add(tonightPool[tonightPickIndex + 1]?.id);
      await setCurrentTonightMovie(tonightPool[tonightPickIndex + 1], tonightPickIndex + 1, nextSeen2);
      return;
    }

    if (tonightPickIndex > 0) {
      const nextSeen2 = new Set(nextSeen);
      nextSeen2.add(tonightPool[tonightPickIndex - 1]?.id);
      await setCurrentTonightMovie(tonightPool[tonightPickIndex - 1], tonightPickIndex - 1, nextSeen2);
      return;
    }

    // Last film in pool — update seen so the button unlocks
    setTonightSeenMovieIds(nextSeen);
  };

  const handleMoreSuggestions = async () => {
    if (!tonightPick) return;

    trackInteraction(tonightPick.id, "skipped", {
      reason: "not_my_style",
      genres: (tonightPick.genres || []).map((g) => g.name),
    });

    // Exclure uniquement les 3 films actuellement affichés.
    // Les autres candidats SQL (jusqu'à 267) restent disponibles pour les prochains appels —
    // les ajouter tous ici épuisait inutilement le pool à chaque clic "3 autres propositions".
    const currentPoolIds = (chatMoviesPool || []).map((m) => m.id).filter(Number.isFinite);
    const nextRejected = [...new Set([...rejectedIds, ...currentPoolIds])];
    setRejectedIds(nextRejected);

    const rejContext: RejectionContext = {
      reason: "not_my_style",
      rejectedGenres: (tonightPick.genres || []).map((g) => g.name),
      rejectedTitle: tonightPick.title || tonightPick.name || "",
    };
    setTonightPick(null);
    setChatMoviesPool(null);
    setTonightPickIndex(0);
    setTonightSeenMovieIds(new Set());
    setNoResultsInfo(null);

    await generateTonightPick(nextRejected, rejContext, activeVoiceFiltersRef.current, currentDuoOverridesRef.current ?? undefined);
  };

  return (
    <div className="relative w-full h-full overflow-x-hidden">
      <BrandHeader
        extraActions={
          <QuickFilters filters={quickFilters} onFiltersChange={setQuickFilters} profileDefaults={profileDefaults} />
        }
      />

      <div
        className="absolute inset-0 bg-cover bg-no-repeat"
        style={{ backgroundImage: `url(${homeBackground})`, backgroundPosition: "50% 0%", backgroundSize: "cover" }}
      />

      {/* Dégradé : image visible en haut, fond opaque en bas */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/55 to-background" />

      {/* Greeting flottant juste sous la BrandHeader */}
      <motion.p
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.4 }}
        className="absolute left-5 z-20 text-foreground/55 text-[13px] font-sans"
        style={{ top: "calc(3.6rem + env(safe-area-inset-top))" }}
      >
        {firstName ? `Bonsoir ${firstName} 👋` : "Bonsoir 👋"}
      </motion.p>

      <div className="relative z-10 h-full overflow-y-auto overscroll-y-contain touch-[pan-y_pinch-zoom] scrollbar-hide pb-[calc(9rem+env(safe-area-inset-bottom))]">
        {/* ─── Hero ─── */}
        <section className="relative pt-[calc(13rem+env(safe-area-inset-top))] pb-2 px-5 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
          >
            <h1 className="mt-1.5 font-serif text-foreground text-[24px] leading-[1.15] tracking-tight">
              Créez une soirée cinéma<br />
              <span className="italic text-primary" style={{ textShadow: "0 0 18px hsl(var(--primary)/0.5)" }}>
                et trouvez le film parfait
              </span>
              <span className="not-italic text-foreground"> pour tous !</span>
            </h1>
          </motion.div>

          {/* CTA Créer une soirée */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.30, duration: 0.45 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { setFindChoiceContext("solo"); setShowFindChoice(true); }}
            className="mt-4 w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-sans font-semibold text-[14px] tracking-wide shadow-[0_12px_40px_-10px_hsl(var(--primary)/0.55)]"
          >
            Organiser une soirée ciné !
          </motion.button>

          {/* 4 widgets côte à côte */}
          <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
            {/* Surprise solo */}
            <motion.button
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38, duration: 0.4 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => { setFindChoiceContext("surprise"); setActiveWidget("surprise"); setTimeout(() => setShowFindChoice(true), 150); }}
              className={`flex-1 min-w-0 flex flex-col items-center gap-2 py-3.5 px-2 rounded-2xl backdrop-blur-md transition-all ${activeWidget === "surprise" ? "border border-amber-400/60 bg-amber-400/15 shadow-[0_0_18px_rgba(251,191,36,0.3)]" : "border border-white/12 bg-[hsl(240_18%_7%/0.82)]"}`}
            >
              <span className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <WandSparkles className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.8} />
              </span>
              <p className={`font-sans text-[10.5px] font-semibold leading-tight text-center ${activeWidget === "surprise" ? "text-amber-400" : "text-foreground"}`}>Surprise<br/>solo</p>
            </motion.button>

            {/* Soirée Duo — violet */}
            <motion.button
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.44, duration: 0.4 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => { setFindChoiceContext("duo"); setActiveWidget("duo"); setTimeout(() => setShowFindChoice(true), 150); }}
              className={`flex-1 min-w-0 flex flex-col items-center gap-2 py-3.5 px-2 rounded-2xl backdrop-blur-md transition-all ${activeWidget === "duo" ? "border border-violet-400/60 bg-violet-400/15 shadow-[0_0_18px_rgba(167,139,250,0.35)]" : "border border-white/12 bg-[hsl(240_18%_7%/0.82)]"}`}
            >
              <span className="w-8 h-8 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
                <Heart className="w-3.5 h-3.5 text-violet-400" strokeWidth={1.8} />
              </span>
              <p className={`font-sans text-[10.5px] font-semibold leading-tight text-center ${activeWidget === "duo" ? "text-violet-400" : "text-foreground"}`}>Soirée<br/>Duo</p>
            </motion.button>

            {/* Film en famille — désactivé */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.50, duration: 0.4 }}
              className="flex-1 min-w-0 flex flex-col items-center gap-2 py-3.5 px-2 rounded-2xl border border-white/[0.06] bg-[hsl(240_18%_7%/0.82)] opacity-35 cursor-not-allowed"
            >
              <span className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <Home className="w-3.5 h-3.5 text-rose-400/50" strokeWidth={1.8} />
              </span>
              <p className="font-sans text-[10.5px] font-semibold leading-tight text-center text-foreground/50">Film en<br/>famille</p>
            </motion.div>

            {/* Entre amis — désactivé */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.56, duration: 0.4 }}
              className="flex-1 min-w-0 flex flex-col items-center gap-2 py-3.5 px-2 rounded-2xl border border-white/[0.06] bg-[hsl(240_18%_7%/0.82)] opacity-35 cursor-not-allowed"
            >
              <span className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 text-emerald-400/50" strokeWidth={1.8} />
              </span>
              <p className="font-sans text-[10.5px] font-semibold leading-tight text-center text-foreground/50">Entre<br/>amis</p>
            </motion.div>
          </div>
        </section>

        {/* ─── Prochaine soirée (compact) ─── */}
        {nextEvent && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.54, duration: 0.5 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => navigate(`/app/soirees/${nextEvent.id}`)}
            className="mx-5 mt-4 w-[calc(100%-2.5rem)] flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border border-primary/20 bg-primary/[0.06] text-left"
          >
            {/* Avatars empilés : partenaire (derrière) + utilisateur (devant) */}
            <div className="relative flex-shrink-0 w-11 h-8">
              <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-400 border-2 border-[hsl(240_22%_6%)] flex items-center justify-center">
                <span className="text-[11px] font-bold text-white leading-none">{nextEvent.partnerInitial}</span>
              </div>
              <div className="absolute left-4 top-0 w-8 h-8 rounded-full overflow-hidden border-2 border-[hsl(240_22%_6%)] bg-primary/20 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[11px] font-bold text-primary leading-none">
                    {(firstName || "?").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-sans font-semibold tracking-[0.12em] uppercase text-primary/70 leading-none">Prochaine soirée</p>
              <p className="mt-0.5 font-serif text-foreground text-[13px] leading-tight truncate">{nextEvent.title}</p>
              <p className="text-foreground/40 text-[10px] font-sans capitalize">
                {new Date(nextEvent.event_date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                {nextEvent.event_time ? ` · ${nextEvent.event_time.slice(0, 5)}` : ""}
              </p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-foreground/45 flex-shrink-0" />
          </motion.button>
        )}

        {/* ─── 3 films qui pourraient te plaire ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.62, duration: 0.45 }}
          className="mt-5 pb-4"
        >
          <div className="px-5 flex items-center justify-between mb-3">
            <p className="text-[12px] font-serif text-foreground/80">
              3 films qui pourraient te plaire
            </p>
            {quickRecos.length > 0 && (
              <button
                onClick={() => setShowFindChoice(true)}
                className="text-[10px] font-sans text-primary/70 hover:text-primary transition-colors"
              >
                Actualiser
              </button>
            )}
          </div>
          <div className="px-5 flex items-start justify-center gap-8">
            {(quickRecos.length > 0 ? quickRecos.slice(0, 3) : trendingFallback.length > 0 ? trendingFallback.slice(0, 3) : [null, null, null]).map((item: QuickReco | null, i: number) => (
              <motion.button
                key={item?.id ?? i}
                whileTap={{ scale: 0.95 }}
                disabled={loadingMovieId !== null}
                onClick={async () => {
                  if (!item?.id) { setShowFindChoice(true); return; }
                  setLoadingMovieId(item.id);
                  try {
                    const detail = await getMovieDetails(item.id, "movie");
                    setFlipDetailMovie(detail);
                  } catch {
                    setShowFindChoice(true);
                  } finally {
                    setLoadingMovieId(null);
                  }
                }}
                className="w-[80px] shrink-0 text-left relative"
              >
                <div className="w-full aspect-[2/3] rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.07]">
                  {item?.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <WandSparkles className="w-5 h-5 text-foreground/15" />
                    </div>
                  )}
                  {loadingMovieId === item?.id && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        <DiscoverySection
          onMovieSelect={onMovieSelect}
          platformIds={userPlatformIds}
          favoriteGenres={userGenres}
          minRating={userMinRating}
          excludedGenres={userExcludedGenres}
        />
      </div>

      {/* ─── Notification "Partagé avec vous" ─── */}
      <AnimatePresence>
        {showShareNotif && !shareNotifDismissed && !tonightLoading && !tonightPick && !showFindChoice && (
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50"
          >
            <div
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border border-primary/20 bg-primary/[0.06] backdrop-blur-md"
              onClick={() => { setShowShareNotif(false); setShowFindChoice(true); }}
              role="button"
              tabIndex={0}
            >
              {/* Avatar Sophie */}
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 via-pink-500 to-violet-500 border-2 border-[hsl(240_18%_6%)] flex items-center justify-center shadow-[0_0_14px_hsl(330_70%_60%/0.45)]">
                <span className="text-[15px] leading-none">🌸</span>
              </div>

              {/* Texte */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-sans font-semibold text-foreground leading-tight">
                  Partagé <span className="text-foreground/50 font-normal">avec vous</span>
                </p>
                <p className="text-[10.5px] font-sans text-foreground/50 leading-tight mt-0.5 truncate">
                  <span className="text-foreground/75 font-medium">Sophie</span> pense que tu aimerais ce film
                </p>
              </div>

              {/* CTA */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowShareNotif(false); setShowFindChoice(true); }}
                className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl border border-primary/25 bg-primary/10 text-primary text-[12px] font-sans font-semibold"
              >
                Voir
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <HomeScreenChoiceModal
        open={showFindChoice}
        mediaType={quickFilters.mediaType}
        onClose={() => { setShowFindChoice(false); setFindChoiceDuoId(undefined); setFindChoiceContext("solo"); }}
        onAutoPick={handleAutoPick}
        initialDuoId={findChoiceContext === "duo" ? findChoiceDuoId : undefined}
        initialContext={findChoiceContext}
        onOpenChat={() => {
          setShowFindChoice(false);
          onOpenChat();
        }}
        onOpenMoodCapture={() => {
          setShowFindChoice(false);
          onOpenMoodCapture();
        }}
        onPickAmbiance={(mood) => {
          setShowFindChoice(false);
          setActiveAmbiance(mood);
          if (mood === "surprise") {
            handleAutoPick();
          } else {
            void generateTonightPick();
          }
        }}
      />

      {/* Ancien panneau écureuil remplacé par le stage 1 de TonightPickOverlay */}

      {/* Panneau "aucun résultat" — filtres trop stricts */}
      <AnimatePresence>
        {noResultsInfo && !tonightPick && !tonightLoading && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="absolute inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40"
          >
            <div className="bg-background/96 backdrop-blur-xl border border-border/20 rounded-2xl p-5 shadow-2xl">
              <p className="text-foreground/80 text-[13px] font-sans leading-relaxed mb-4">
                {noResultsInfo.message}
              </p>
              <div className="flex flex-wrap gap-2">
                {noResultsInfo.suggestThreshold && (
                  <button
                    onClick={() => {
                      setQuickFilters((f) => ({ ...f, matchThreshold: noResultsInfo.suggestThreshold! }));
                      setNoResultsInfo(null);
                      void generateTonightPick(rejectedIds, undefined, null, currentDuoOverridesRef.current ?? undefined);
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-primary/15 border border-primary/25 text-primary text-[12px] font-sans font-medium hover:bg-primary/25 transition-colors"
                  >
                    Baisser le seuil à {noResultsInfo.suggestThreshold}%
                  </button>
                )}
                {noResultsInfo.suggestRating && (
                  <button
                    onClick={() => {
                      setUserMinRating(0);
                      setNoResultsInfo(null);
                      void generateTonightPick(rejectedIds, undefined, null, currentDuoOverridesRef.current ?? undefined);
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-foreground/8 border border-border/20 text-foreground/60 text-[12px] font-sans font-medium hover:bg-foreground/12 transition-colors"
                  >
                    Enlever la note min
                  </button>
                )}
                <button
                  onClick={() => {
                    setNoResultsInfo(null);
                    void generateTonightPick(rejectedIds, undefined, null, currentDuoOverridesRef.current ?? undefined);
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-foreground/8 border border-border/20 text-foreground/40 text-[12px] font-sans font-medium hover:bg-foreground/12 transition-colors"
                >
                  Réessayer
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TonightPickOverlay
        open={tonightLoading || !!tonightPick}
        movie={tonightPick}
        tonightPool={tonightPool}
        tonightPickIndex={tonightPickIndex}
        tonightSeenMovieIds={tonightSeenMovieIds}
        tonightProviders={tonightProviders}
        movieMatchData={movieMatchData}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        tonightAllVisited={tonightAllVisited}
        tonightLoading={tonightLoading}
        onClose={handleCloseTonightPick}
        onPrev={() => void handleNavigateTonightPick("prev")}
        onNext={() => void handleNavigateTonightPick("next")}
        onOpenDetail={handleOpenMovieDetail}
        onConfirm={handleWatchNow}
        onInteraction={(type) => void handleMovieAction(type)}
        onMoreSuggestions={() => void handleMoreSuggestions()}
        expectedCount={quickFilters.recommendationCount}
        loadingLog={loadingLog}
        userGenres={tonightUserGenres}
        userName={
          (user?.user_metadata?.full_name as string | undefined) ||
          (user?.user_metadata?.name as string | undefined) ||
          (user?.email?.split("@")[0])
        }
      />

      <FlipCardDetail
        item={flipDetailMovie}
        type="movie"
        isOpen={!!flipDetailMovie}
        onClose={() => setFlipDetailMovie(null)}
        isEnriching={tonightLoading}
        recommendationTextsByMovieId={
          Object.fromEntries(
            (chatMoviesPool ?? [])
              .filter((m): m is RecommendationMovieDetail => !!(m as RecommendationMovieDetail).recommendationTexts)
              .map((m) => [m.id, (m as RecommendationMovieDetail).recommendationTexts])
          )
        }
      />

      <AnimatePresence>
        {showTrainer && (
          <TasteTrainer
            isActivation={activationTrainerMode}
            onActivationComplete={onActivationTrainingComplete}
            onClose={() => {
              setShowTrainer(false);

              if (!user) return;

              loadUnifiedUserFeedbackState().then(({ evaluatedCount, excludeIds }) => {
                setTotalEvaluated(evaluatedCount);
                setHistoryExcludeIds(excludeIds);
              });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default HomeScreen;
