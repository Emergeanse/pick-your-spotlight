import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { consumePendingDuoPick } from "@/lib/duo-pending";
import { clearRevealIntent, type RevealIntent, peekForReveal, consumeForReveal, queueForReveal, _pipelineFns, getRevealEvent, clearRevealEvent } from "@/lib/event-reveal";
import { programFilmForEvent } from "@/lib/event-program";
import { toast } from "sonner";
import { Sparkles, WandSparkles, Clapperboard, ChevronRight, Flame, Eye, Coffee, Heart, Shuffle, Home, Users, Crown, Star } from "lucide-react";

import { formatPlatformNamesForLoading, resolveProviders } from "@/lib/platforms";
import type { Movie, MovieDetail } from "@/lib/tmdb";
import type { VoiceSearchFilters } from "./VoiceChat";
import { getTrendingMovies, getBackdropUrl, getMovieDetails, getDisplayTitle } from "@/lib/tmdb";
import { getLikedMovies } from "@/lib/liked-movies";
import { trackInteraction, getUserTasteProfile } from "@/lib/interactions";
import { useAuth } from "@/hooks/use-auth";
import { usePickPlus } from "@/hooks/use-pick-plus";
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
import { resolveEffectiveExclusions } from "@/lib/recommendation-pipeline";
import { getEngagementData, getProgressionMessage, type EngagementData } from "@/lib/engagement";
import { listFeedbackByType } from "@/lib/feedback";
import { getMyPreferences, sanitizeGenreLabels } from "@/lib/preferences";
import { consumeOnboardingAutoSurprise } from "@/lib/onboarding-progress";

import BrandHeader from "./BrandHeader";
import QuickFilters, { type QuickFilterState, type ProfileDefaults } from "./QuickFilters";
import TasteTrainer from "./TasteTrainer";
import DiscoverySection from "./DiscoverySection";
import HomeScreenChoiceModal, { type LaunchContext } from "./HomeScreenChoiceModal";
import TonightPickOverlay, { preloadPosterWallCache } from "./TonightPickOverlay";
import FlipCardDetail from "./FlipCardDetail";
import PostSoireeFlow, { type PostSoireeEvent } from "./PostSoireeFlow";
import { type AmbianceMood } from "./HomeAmbianceSection";
import homeBackground from "@/assets/home-background.webp";

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

type QuickReco = { id: number; title: string; poster_path: string | null; vote_average?: number; media_type?: string; detail?: MovieDetail; matchData?: RecommendationMatch; recommendedBy?: string };
const QUICK_RECO_KEY = "pick_last_reco_v2";

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
  const platformNames = formatPlatformNamesForLoading(platformIds);
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

type PipelineStageDebug = {
  id: string;
  name: string;
  params: Record<string, unknown>;
  fallbackTriggered: boolean;
  fallbackReason?: string | null;
  inputCount?: number | null;
  outputCount?: number | null;
};

function logPipelineStagesTable(stages: PipelineStageDebug[], clientStage?: PipelineStageDebug) {
  const all = clientStage ? [clientStage, ...stages] : stages;
  if (all.length === 0) return;
  console.group("[PICK-DEBUG] 📋 Paramètres par étape");
  console.table(all.map((s, i) => ({
    "#": i + 1,
    "Étape": s.name,
    "Entrée": s.inputCount ?? "—",
    "Sortie": s.outputCount ?? "—",
    "Fallback": s.fallbackTriggered ? "⚠️ oui" : "—",
    "Raison fallback": s.fallbackReason ?? "—",
  })));
  all.forEach((s) => {
    if (Object.keys(s.params).length > 0) {
      console.log(`   ${s.id} — params:`, s.params);
    }
  });
  console.groupEnd();
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
  const profileLoadedRef = useRef(false);
  const revealIntentPendingRef = useRef<RevealIntent | null>(null);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);

  const [revealPendingIntent, setRevealPendingIntent] = useState<RevealIntent | null>(null);
  const [autoSurprisePending, setAutoSurprisePending] = useState(false);
  const [revealEventId, setRevealEventId] = useState<string | null>(() => getRevealEvent()?.eventId ?? null);
  const [programmingEvent, setProgrammingEvent] = useState(false);
  const [tonightPick, setTonightPick] = useState<MovieDetail | null>(null);
  // Initialisation synchrone : si on arrive depuis EventDetailPage avec revealPending=true
  // ET qu'un intent est queué, l'overlay s'ouvre dès le premier rendu → zéro flash.
  const [tonightLoading, setTonightLoading] = useState<boolean>(() => {
    const st = location.state as { revealPending?: boolean } | null;
    return !!(st?.revealPending && peekForReveal());
  });
  const [tonightLoadingMsg, setTonightLoadingMsg] = useState("");
  const [loadingLog, setLoadingLog] = useState<string[]>([]);
  const [tonightUserGenres, setTonightUserGenres] = useState<string[]>(() => {
    const st = location.state as { revealPending?: boolean } | null;
    if (st?.revealPending) return peekForReveal()?.genres ?? [];
    return [];
  });
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
  // Initialisation depuis cache localStorage pour affichage instantané au refresh
  const [firstName, setFirstName] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem("pys_greeting") || "{}").firstName || ""; } catch { return ""; }
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    try { return JSON.parse(localStorage.getItem("pys_greeting") || "{}").avatarUrl || null; } catch { return null; }
  });
  const [interactionCount, setInteractionCount] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem("pys_greeting") || "{}").interactionCount || 0; } catch { return 0; }
  });
  const { isPremium } = usePickPlus();
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
  const [flipDetailFromBrowse, setFlipDetailFromBrowse] = useState(false);
  const [homeBrowseOpen, setHomeBrowseOpen] = useState(false);
  const [homeBrowsePool, setHomeBrowsePool] = useState<MovieDetail[]>([]);
  const [homeBrowseIndex, setHomeBrowseIndex] = useState(0);
  const [homeBrowseSeenIds, setHomeBrowseSeenIds] = useState<Set<number>>(new Set());
  const [homeBrowseProviders, setHomeBrowseProviders] = useState<{ name: string; logo_path: string }[]>([]);
  const [pendingFeedbackEvent, setPendingFeedbackEvent] = useState<PostSoireeEvent | null>(null);
  const [showPostSoiree, setShowPostSoiree] = useState(false);
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
  // Clé de génération : incrémentée à chaque home-reset pour invalider les requêtes en cours
  const generationKeyRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (msgIntervalRef.current !== null) clearInterval(msgIntervalRef.current);
    };
  }, []);

  // Précharge le mur d'affiches TMDB pour l'effet « waouh » dès l'accueil
  useEffect(() => {
    if (user) void preloadPosterWallCache();
  }, [user]);

  // Détection événements passés sans feedback → carte persistante + auto-modal
  // La demande d'évaluation n'apparaît que le lendemain de la soirée (24h après date+heure du visionnage)
  useEffect(() => {
    if (!user) return;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    (async () => {
      const { data: events } = await supabase
        .from("events" as any)
        .select("id, title, event_date, event_time, context, final_pick_title, final_pick_poster, final_pick_tmdb_id")
        .eq("status", "done")
        .gte("event_date", sevenDaysAgo)
        .lte("event_date", yesterday)
        .or(`organizer_id.eq.${user.id}`)
        .not("final_pick_title", "is", null)
        .order("event_date", { ascending: false })
        .limit(5);
      if (!events?.length) return;

      // Trouve le premier événement dont les 24h sont écoulées et sans feedback
      let ev: any = null;
      for (const candidate of events as any[]) {
        if (candidate.event_time) {
          const watchedAt = new Date(`${candidate.event_date}T${candidate.event_time}`);
          if (Date.now() < watchedAt.getTime() + 24 * 60 * 60 * 1000) continue;
        }
        const { data: fb } = await supabase
          .from("event_film_feedback" as any)
          .select("id")
          .eq("event_id", candidate.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!fb) { ev = candidate; break; }
      }
      if (!ev) return;

      // Récupère les participants confirmés
      const { data: parts } = await supabase
        .from("event_participants" as any)
        .select("user_id, guest_name, status")
        .eq("event_id", ev.id)
        .eq("status", "confirmed")
        .neq("user_id", user.id);

      const postEv: PostSoireeEvent = {
        eventId:      ev.id,
        eventTitle:   ev.title,
        eventDate:    ev.event_date,
        context:      ev.context ?? "solo",
        filmTitle:    ev.final_pick_title ?? "",
        filmPoster:   ev.final_pick_poster,
        filmTmdbId:   ev.final_pick_tmdb_id,
        participants: (parts ?? [])
          .filter((p: any) => p.user_id)
          .map((p: any) => ({ id: p.user_id, name: p.guest_name ?? "Participant" })),
      };
      setPendingFeedbackEvent(postEv);
      setShowPostSoiree(true);
    })().catch(console.error);
  }, [user?.id]);

  // Recommandations reçues d'amis → injectées en tête des quickRecos
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: recos } = await supabase
        .from("shared_recommendations" as any)
        .select("id, tmdb_id, title, poster_path, sender_id")
        .eq("receiver_id", user.id)
        .eq("seen", false)
        .order("created_at", { ascending: false })
        .limit(3);
      if (!recos?.length) return;

      // Récupère les noms des expéditeurs
      const senderIds = [...new Set((recos as any[]).map((r: any) => r.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles" as any)
        .select("id, display_name")
        .in("id", senderIds);
      const nameById = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.display_name ?? "Un ami"]));

      const friendRecos: QuickReco[] = (recos as any[]).map((r: any) => ({
        id:            r.tmdb_id,
        title:         r.title,
        poster_path:   r.poster_path,
        recommendedBy: nameById[r.sender_id] ?? "Un ami",
      }));

      // Injecte en tête, max 3 au total
      setQuickRecos((prev) => {
        const merged = [...friendRecos, ...prev.filter((q) => !friendRecos.find((f) => f.id === q.id))].slice(0, 3);
        return merged;
      });

      // Marque comme vues
      const ids = (recos as any[]).map((r: any) => r.id);
      await supabase.from("shared_recommendations" as any).update({ seen: true } as any).in("id", ids);
    })().catch(console.error);
  }, [user?.id]);

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
    const state = location.state as {
      openFindChoice?: boolean;
      duoId?: string;
      onboardingFirstPick?: boolean;
      genres?: string[];
      moodContext?: string;
    } | null;
    if (state?.onboardingFirstPick) {
      window.history.replaceState({}, "", "/app");
      const opts: { genres?: string[]; moodContext?: string } = {};
      if (state.genres?.length) opts.genres = state.genres;
      if (state.moodContext) opts.moodContext = state.moodContext;
      setTimeout(() => void (handleAutoPickRef.current)?.(undefined, opts), 450);
      return;
    }
    if (state?.openFindChoice) {
      setFindChoiceDuoId(state.duoId);
      window.history.replaceState({}, "", "/app");
      setTimeout(() => setShowFindChoice(true), 150);
    }
  }, [location.state]);

  // Bridge soirée — mécanisme dual :
  // 1) Singleton (lu au montage) : mécanisme principal, résout le problème de timing du concurrent rendering
  // 2) CustomEvent "pick-reveal-event" : backup si HomeScreen est déjà monté
  const runRevealPipeline = useRef<((intent: RevealIntent) => Promise<void>) | null>(null);
  runRevealPipeline.current = async (intent: RevealIntent) => {
    if (revealTriggeredRef.current) { console.log("[REVEAL] ⛔ déjà déclenché, abandon"); return; }
    revealTriggeredRef.current = true;
    clearRevealIntent();

    const reveal = getRevealEvent();
    if (reveal?.eventId) setRevealEventId(reveal.eventId);

    const { context, genres, mood, participantIds, mediaType } = intent;
    console.log("[REVEAL] 🏃 runRevealPipeline — context:", context, "| genres:", genres, "| mood:", mood, "| mediaType:", mediaType, "| participantIds:", participantIds);

    setTonightLoading(true);
    if (genres?.length) setTonightUserGenres(genres);

    const genreFilter: VoiceSearchFilters | null =
      genres?.length || mood || mediaType
        ? {
            genres: genres ?? [],
            originalLanguage: null,
            mediaType: mediaType && mediaType !== "both" ? mediaType : null,
            maxDuration: null,
            decade: null,
          }
        : null;

    if (!context || context === "solo") {
      const pick = generateTonightPickRef.current ?? _pipelineFns.generateTonightPick;
      console.log("[REVEAL] → solo, generateTonightPick set:", !!pick);
      pick?.([], undefined, genreFilter, undefined, mood || undefined);
      return;
    }

    let duoId: string | undefined;
    const ids = (participantIds ?? []).filter(Boolean);
    try {
      if (ids.length >= 2) {
        const [id1, id2] = ids;
        const { data } = await (supabase as any)
          .from("duo_taste_profiles").select("id")
          .or(`and(user1_id.eq.${id1},user2_id.eq.${id2}),and(user1_id.eq.${id2},user2_id.eq.${id1})`)
          .eq("status", "active").maybeSingle();
        duoId = (data as any)?.id ?? undefined;
      }
      if (!duoId && user) {
        const { data } = await (supabase as any)
          .from("duo_taste_profiles").select("id")
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
          .eq("status", "active").maybeSingle();
        duoId = (data as any)?.id ?? undefined;
      }
    } catch (err) { console.error("[Reveal] duo fetch:", err); }

    const duoOpts =
      genres?.length || mood || (mediaType && mediaType !== "both")
        ? {
            ...(genres?.length && { genres }),
            ...(mood && { moodContext: mood }),
            ...(mediaType && mediaType !== "both" && { mediaType }),
          }
        : undefined;

    console.log("[REVEAL] 🔍 duo fetch résultat — duoId:", duoId, "| handleAutoPick set:", !!_pipelineFns.handleAutoPick);
    void (handleAutoPickRef.current ?? _pipelineFns.handleAutoPick)?.(duoId, duoOpts);
  };

  // Mécanisme 1 : au montage, s'assurer que le singleton module est alimenté.
  // Le singleton survit aux remontages multiples (double-mount React/v7_startTransition).
  // La window global sert de backup si le module est dans un chunk différent.
  useEffect(() => {
    const intentFromWindow = (window as any).__pickRevealIntent as RevealIntent | undefined;
    if (intentFromWindow) {
      delete (window as any).__pickRevealIntent;
      queueForReveal(intentFromWindow); // alimente le singleton (idempotent)
    }
    console.log("[REVEAL] 🎯 Montage HomeScreen — singleton pending:", !!peekForReveal());

    // Effacer le state revealPending pour ne pas retrigger si l'utilisateur revient en arrière
    const state = location.state as { revealPending?: boolean } | null;
    if (state?.revealPending) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mécanisme 2 : CustomEvent (backup si HomeScreen déjà monté au moment du dispatch)
  useEffect(() => {
    const handler = (e: Event) => {
      const intent = (e as CustomEvent<RevealIntent>).detail;
      if (intent) void runRevealPipeline.current?.(intent);
    };
    window.addEventListener("pick-reveal-event", handler);
    return () => window.removeEventListener("pick-reveal-event", handler);
  }, []);

  // Mécanisme 3 : déclenché après re-render post-profil (userPlatformIds chargé).
  // consumeForReveal() est le verrou atomique : un seul montage (même s'il y en a deux)
  // obtient l'intent et lance le pipeline. Le second trouve null et s'arrête.
  useEffect(() => {
    if (!revealPendingIntent) return;
    const locked = consumeForReveal();
    if (!locked) { console.log("[REVEAL] ⛔ Singleton déjà consommé par un autre montage"); setRevealPendingIntent(null); return; }
    console.log("[REVEAL] 🚀 Lancement pipeline — context:", locked.context, "| platformIds:", userPlatformIds);
    setRevealPendingIntent(null);
    void runRevealPipeline.current?.(locked);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealPendingIntent]);

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

  // Prénom + avatar + compteur pour le greeting
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
      supabase.from("user_item_feedback").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(([{ data }, { count }]) => {
      const name = (data as any)?.display_name || user.email?.split("@")[0] || "";
      const fn = name.split(" ")[0];
      const av = (data as any)?.avatar_url || null;
      const ic = count || 0;
      setFirstName(fn);
      setAvatarUrl(av);
      setInteractionCount(ic);
      try { localStorage.setItem("pys_greeting", JSON.stringify({ firstName: fn, avatarUrl: av, interactionCount: ic })); } catch {}
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

  useEffect(() => {
    if (tonightLoading || tonightPick) {
      setHomeBrowseOpen(false);
    }
  }, [tonightLoading, tonightPick]);

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
        media_type: m.media_type || (m.first_air_date ? "tv" : "movie"),
        detail: m,
        matchData: movieMatchData[m.id] ?? undefined,
      }));
      localStorage.setItem(QUICK_RECO_KEY, JSON.stringify(toSave));
      setQuickRecos(toSave);
    } catch {}
  }, [chatMoviesPool, movieMatchData]);

  const tonightPool = useMemo(() => chatMoviesPool || [], [chatMoviesPool]);
  const canGoPrev = tonightPickIndex > 0;
  const canGoNext = tonightPickIndex < tonightPool.length - 1;
  const tonightAllVisited = tonightSeenMovieIds.size >= tonightPool.length && tonightPool.length > 0;


  const loadProviders = async (movie: MovieDetail) => {
    setTonightProviders(await resolveProviders(movie, userPlatformIds));
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
        if (data?.favorite_genres) setUserGenres(sanitizeGenreLabels(data.favorite_genres));
        if ((data as any)?.excluded_genres) {
          setUserExcludedGenres(sanitizeGenreLabels((data as any).excluded_genres));
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
        // Profil chargé → déclencher le pipeline si un intent est en attente dans le singleton.
        // peekForReveal() lit sans consommer (consumeForReveal est appelé dans useEffect, verrou atomique).
        // setState force un re-render : userPlatformIds est dans la closure de generateTonightPick.
        profileLoadedRef.current = true;
        const pendingReveal = peekForReveal();
        console.log("[REVEAL] ✅ Profil chargé — platformIds:", (data as any)?.preferred_platforms ?? [], "| intent en attente:", !!pendingReveal);
        if (pendingReveal) {
          setRevealPendingIntent(pendingReveal);
        }
        // Sortie d'onboarding — le profil (genres/plateformes/note min) est maintenant chargé
        // dans le state, donc la recherche automatique verra les bonnes valeurs et non celles
        // du tout premier render. consumeOnboardingAutoSurprise() est atomique (sessionStorage) :
        // un seul montage gagnera, même en cas de double-montage React.
        if (consumeOnboardingAutoSurprise()) {
          console.log("[REVEAL] 🎬 Auto-surprise post-onboarding — profil prêt, déclenchement.");
          setAutoSurprisePending(true);
        }
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
      generationKeyRef.current += 1; // invalide toutes les requêtes en cours
      setTonightPick(null);
      setTonightLoading(false);
      setFlipDetailMovie(null);
      setActiveAmbiance(null);
      setShowFindChoice(false);
      setFindChoiceDuoId(undefined);
      setHomeBrowseOpen(false);
      setShowTrainer(false);
      setShowPostSoiree(false);
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
    // Ouvrir l'overlay immédiatement — avant tout await, dans le même batch que l'appelant
    const genKey = ++generationKeyRef.current;
    const isStale = () => generationKeyRef.current !== genKey;
    setTonightLoading(true);
    if (voiceFilters !== undefined) activeVoiceFiltersRef.current = voiceFilters;
    const poolIds = (chatMoviesPool || []).map((m) => m.id).filter(Number.isFinite);
    // En mode duo : on n'utilise pas l'historique solo (trop restrictif), juste les interactions des deux users
    const soloHistory = duoOverrides ? [] : historyExcludeIdsRef.current;
    const allExcludeIds = [...new Set([...excludeList, ...poolIds, ...soloHistory, ...(duoOverrides?.partnerExcludeIds ?? [])])];

    const t0Pick = performance.now();
    let tEdgeStart = t0Pick;
    let tEdgeEnd = t0Pick;
    let tBatchStart = t0Pick;
    console.log(`[PICK-DEBUG] 🚀 ════ DÉBUT PIPELINE ════ | ${allExcludeIds.length} IDs exclus (session: ${excludeList.length} | historique: ${historyExcludeIdsRef.current.length} | pool: ${poolIds.length})`);

    setTonightProviders([]);
    setLoadingLog([]);

    const buildMsgs = (likedTitles: string[] = []) => buildPersonalizedLoadingMessages({
      genres: voiceFilters?.genres?.length ? voiceFilters.genres : userGenres,
      mediaType: voiceFilters?.mediaType ?? quickFilters.mediaType,
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
        console.log("[REVEAL] 🎬 generateTonightPick — user:", user.id.slice(0, 8), "| liked.length:", liked.length, "| platformIds:", userPlatformIds);

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

          const moodCfg = activeAmbiance ? MOOD_CONFIGS[activeAmbiance] : null;

          // Duo prime sur voix qui prime sur ambiance qui prime sur les valeurs par défaut
          const effectiveTopGenres = duoOverrides
            ? duoOverrides.topGenres
            : voiceFilters?.genres?.length
              ? voiceFilters.genres
              : moodCfg?.boostGenres
                ? [...new Set([...(moodCfg.boostGenres), ...(tasteProfile?.topGenres || [])])]
                : tasteProfile?.topGenres;
          const baseExcludedGenres = duoOverrides ? duoOverrides.excludedGenres : userExcludedGenres;
          const { effectiveExcludedGenres, removedFromExclusions } = resolveEffectiveExclusions(
            baseExcludedGenres,
            voiceFilters?.genres,
            moodCfg?.boostGenres,
          );
          for (const g of removedFromExclusions) {
            console.log(`[PICK-DEBUG] 🎯 Thème ce soir : ${g} retiré des exclusions`);
          }
          const effectiveAvoidanceVector = duoOverrides?.avoidanceVector ?? (multiProfile?.avoidanceVector || null);
          const effectiveExplorationLevel = moodCfg?.explorationOverride ?? explorationLevel;
          const effectiveMaxDuration = voiceFilters?.maxDuration ?? moodCfg?.maxDurationOverride ?? quickFilters.maxDuration;
          const effectiveMediaType = voiceFilters?.mediaType ?? moodCfg?.mediaTypeOverride ?? (quickFilters.mediaType !== "both" ? quickFilters.mediaType : "both");
          const effectiveMinMatchScore = moodCfg?.minMatchScoreOverride ?? quickFilters.matchThreshold;
          const effectiveMinRating = moodCfg?.minRatingBoost ? (userMinRating ?? 0) + moodCfg.minRatingBoost : userMinRating;

          const clientPipelineStage: PipelineStageDebug = {
            id: "0-client-request",
            name: "Paramètres client → surprise-personalized",
            params: {
              userTasteVector: userTasteVector ? `${userTasteVector.length} dims` : null,
              mediaType: effectiveMediaType,
              topGenres: effectiveTopGenres ?? [],
              excludedGenres: effectiveExcludedGenres ?? [],
              maxDuration: effectiveMaxDuration ?? null,
              minRating: effectiveMinRating ?? null,
              minMatchScore: effectiveMinMatchScore,
              explorationLevel: effectiveExplorationLevel,
              platformIds: userPlatformIds,
              count: quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE,
              excludeIdsCount: allExcludeIds.length,
              moodContext: extraMoodContext ?? moodCfg?.moodContext ?? null,
              moodBoostGenres: moodCfg?.boostGenres ?? null,
              voiceOverrides: voiceFilters ? {
                genres: voiceFilters.genres ?? null,
                decade: voiceFilters.decade ?? null,
                originalLanguage: voiceFilters.originalLanguage ?? null,
                mediaType: voiceFilters.mediaType ?? null,
                maxDuration: voiceFilters.maxDuration ?? null,
              } : null,
              duoMode: !!duoOverrides,
            },
            fallbackTriggered: !userTasteVector,
            fallbackReason: !userTasteVector ? "Vecteur NULL — SQL vectoriel sera sauté côté edge" : null,
            inputCount: null,
            outputCount: null,
          };

          logPipelineStagesTable([], clientPipelineStage);

          // Log des paramètres EFFECTIFS (après tous les overrides voix/ambiance/duo)
          console.groupCollapsed("[PICK-DEBUG] 📤 Paramètres effectifs envoyés à surprise-personalized");
          console.log("vecteur de goût  :", userTasteVector ? `✅ ${userTasteVector.length} dims` : "❌ NULL — SQL vectoriel sera sauté");
          console.log("type média       :", effectiveMediaType);
          console.log("genres effectifs :", effectiveTopGenres?.length ? effectiveTopGenres : "aucun (profile vide ?)");
          console.log("genres exclus    :", effectiveExcludedGenres?.length ? effectiveExcludedGenres : "aucun");
          console.log("durée max        :", effectiveMaxDuration ? `${effectiveMaxDuration}min` : "illimitée");
          console.log("note min         :", effectiveMinRating ?? "aucune");
          console.log("score min        :", effectiveMinMatchScore, "%");
          console.log("plateformes      :", userPlatformIds?.length ? userPlatformIds : "aucune");
          console.log("count demandé    :", quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE);
          console.log("excludeIds       :", allExcludeIds.length, "IDs");
          if (voiceFilters) {
            console.group("🎤 Overrides vocaux");
            console.log("  genres         :", voiceFilters.genres?.length ? voiceFilters.genres : "—");
            console.log("  décennie       :", voiceFilters.decade ? `${voiceFilters.decade}s (${voiceFilters.decade}–${voiceFilters.decade + 9})` : "—");
            console.log("  langue orig.   :", voiceFilters.originalLanguage ?? "—");
            console.log("  durée max      :", voiceFilters.maxDuration ? `${voiceFilters.maxDuration}min` : "—");
            console.log("  type média     :", voiceFilters.mediaType ?? "—");
            console.groupEnd();
          }
          if (activeAmbiance) {
            console.log("🎭 Ambiance      :", activeAmbiance, moodCfg ? `(boostGenres: ${moodCfg.boostGenres?.join(", ") ?? "—"})` : "");
          }
          if (duoOverrides) {
            console.log("👥 Mode duo      : actif (", duoOverrides.user1Id?.slice(0,8), "/", duoOverrides.user2Id?.slice(0,8), ")");
          }
          console.groupEnd();

          console.log(`[PICK-DEBUG] 📡 ÉTAPE 0 — Requête → surprise-personalized | type: ${effectiveMediaType} | plateformes: [${userPlatformIds?.join(", ") ?? "—"}] | minScore: ${effectiveMinMatchScore}% | vecteur: ${userTasteVector ? `✅ ${userTasteVector.length}D` : "❌ NULL"}`);
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
            debug: true,
          });
          tEdgeEnd = performance.now();
          engineMetaResult = data?.engineMeta ?? null;
          if (data?.excludeCandidateIds?.length) {
            setLastSql50Ids(data.excludeCandidateIds);
          }
          const dbg = data?.debugData;
          const edgeMs = Math.round(tEdgeEnd - tEdgeStart);
          console.log(`[PICK-DEBUG] 📥 Réponse reçue (${edgeMs}ms) — SQL: ${dbg?.sqlCandidates?.length ?? 0} candidats | top: ${dbg?.top50?.length ?? "?"}→LLM | LLM sélectionne: ${dbg?.llmSelections?.length ?? "?"}`);

          // ── ÉTAPE 1 : SQL vectoriel 32D ──
          if (dbg?.filters || dbg?.sqlCandidates) {
            const f = dbg.filters;
            const cascadeLevel: number = dbg.sqlCascadeLevel ?? -1;
            const cascadeLabels = [
              "0 — toutes contraintes",
              "1 — sans lang/année",
              "2 — sans liked_genres",
              "3 — sans liked_genres ni note (excluded_genres conservé)",
              "4 — sans plateforme (excluded_genres conservé)",
            ];
            const cascadeLabel = cascadeLevel >= 0 ? cascadeLabels[cascadeLevel] ?? `niveau ${cascadeLevel}` : "inconnu";
            const rpc = dbg.sqlRpcParams;
            const cascadeWarn = rpc ? (rpc.excluded_genres || []).length === 0 : false;
            const candidateCount = dbg.sqlCandidates?.length ?? 0;

            console.log(`[PICK-DEBUG] 1️⃣  ÉTAPE 1 — SQL 32D → ${candidateCount} candidats | cascade: ${cascadeLabel}${cascadeWarn ? " ⚠️ excluded_genres VIDE" : ""} | ${f?.excludeCount ?? 0} IDs exclus`);
            console.groupCollapsed(`  ↳ Détail ÉTAPE 1 (${candidateCount} candidats SQL)`);
            if (cascadeWarn) console.warn(`  ⚠️ excluded_genres VIDE — cascade niveau ${cascadeLevel}`);

            if (rpc) {
              console.log(
                `  note min: ${rpc.min_rating ?? 0}` +
                ` | durée max: ${rpc.max_duration ? `${rpc.max_duration}min` : "∞"}` +
                ` | genres aimés: [${(rpc.liked_genres || []).join(", ") || "—"}]` +
                ` | genres exclus: [${(rpc.excluded_genres || []).join(", ") || (cascadeLevel >= 3 ? "⚠️ AUCUN" : "—")}]` +
                ` | plateformes: [${(rpc.p_platform_ids || []).join(", ") || "—"}]` +
                ` | exclude_ids: ${rpc.exclude_ids_count}`
              );
            }

            if (f?.voiceOverrides) {
              const vo = f.voiceOverrides;
              const hasVoice = vo.genres?.length || vo.decade != null || vo.language || vo.mediaType || vo.maxDuration;
              if (hasVoice) {
                console.log(
                  `  🎤 voix:` +
                  (vo.genres?.length ? ` genres=[${vo.genres.join(", ")}]` : "") +
                  (vo.decade != null  ? ` décennie=${vo.decade}s` : "") +
                  (vo.language        ? ` langue=${vo.language}` : "") +
                  (vo.mediaType       ? ` type=${vo.mediaType}` : "") +
                  (vo.maxDuration     ? ` durée≤${vo.maxDuration}min` : "")
                );
              }
            }

            if (dbg.sqlCountDiag?.length) {
              console.groupCollapsed(`  📊 COUNT SQL par niveau de cascade`);
              console.table(dbg.sqlCountDiag.map((d: any) => ({
                "Niveau": `${d.level} — ${cascadeLabels[d.level] ?? `niveau ${d.level}`}`,
                "Total en base": d.total_in_db,
                "Disponibles": d.available_after_exclusions,
                "excluded_genres": d.level < 3 ? "✅" : "⚠️",
              })));
              console.groupEnd();
            }

            if (candidateCount > 0) {
              console.groupCollapsed(`  📋 ${candidateCount} candidats SQL (triés par similarité)`);
              console.table(dbg.sqlCandidates.map((c: any, i: number) => ({
                "#": i + 1,
                "Titre": c.title,
                "Année": c.year,
                "Note /10": c.note ?? "–",
                "Sim%": c.sim ?? "–",
                "Composite": c.composite ?? "–",
                "Genres": (c.genres || []).join(", "),
                "Type": c.type,
              })));
              console.groupEnd();
            } else {
              console.warn(`  ⚠️ SQL : 0 candidats — vérifier les filtres`);
            }

            if (dbg.sqlSnippet) {
              console.groupCollapsed(`  🔍 Snippet SQL`);
              console.log(dbg.sqlSnippet);
              console.groupEnd();
            }

            if ((dbg as any)?.sqlLevelDebug?.length) {
              console.groupCollapsed(`  📈 Détail cascade niveau par niveau`);
              (dbg as any).sqlLevelDebug.forEach((lvl: any) => {
                const label = cascadeLabels[lvl.level] ?? `niveau ${lvl.level}`;
                console.log(`  Niveau ${label} : +${lvl.newFilms} non-interagis (total: ${lvl.totalNonInteracted}/100)`);
                if (lvl.films?.length) {
                  console.log(`  → ${lvl.films.slice(0, 5).map((f: any) => `"${f.title}" (${f.year}) ⭐${f.note} sim=${f.sim}%`).join(" | ")}`);
                }
              });
              console.groupEnd();
            }

            if ((dbg as any)?.explicitFallbackDebug?.length) {
              console.groupCollapsed(`  1️⃣⁺ SQL explicite (sans vecteur) — complément`);
              (dbg as any).explicitFallbackDebug.forEach((lvl: any) => {
                console.log(`  liked_genres=${lvl.likedGenres ? "oui" : "non"}, note≥${lvl.minRating}: +${lvl.newFilms} films`);
                if (lvl.films?.length) {
                  console.log(`  → ${lvl.films.slice(0, 5).map((f: any) => `"${f.title}" (${f.year}) ⭐${f.note}`).join(" | ")}`);
                }
              });
              console.groupEnd();
            }

            console.groupEnd(); // ÉTAPE 1
          }

          // ── PROFIL LLM ──
          if (dbg?.llmProfile) {
            const p = dbg.llmProfile;
            console.log(`[PICK-DEBUG] 🧠  PROFIL → LLM | confiance: ${p.confianceProfil}/100 | exploration: ${p.explorationLevel}/10 | score min: ${p.minMatchScore}% | genres: [${(p.genresPrefers || []).slice(0, 3).join(", ") || "—"}]`);
            console.groupCollapsed(`  ↳ Détail profil LLM`);
            console.log(`  genres préférés : [${(p.genresPrefers || []).join(", ") || "—"}]`);
            console.log(`  genres exclus   : [${(p.genresExclus || []).join(", ") || "—"}]`);
            console.log(`  clusters        : [${(p.clusters || []).join(", ") || "—"}]`);
            console.log(`  origines aimées : [${(p.originesAimees || []).join(", ") || "—"}]`);
            console.log(`  fatigue genres  : [${(p.genresFatigue || []).join(", ") || "—"}]`);
            if (dbg.systemPrompt) {
              console.groupCollapsed(`  📄 Prompt système LLM`);
              console.log(dbg.systemPrompt);
              console.groupEnd();
            }
            console.groupEnd();
          }

          // ── ÉTAPE 2 : Top N par score composé ──
          if (dbg?.top50?.length) {
            console.log(`[PICK-DEBUG] 2️⃣  ÉTAPE 2 — Score composé → ${dbg.top50.length} films → LLM (depuis ${dbg.sqlCandidates?.length ?? "?"} candidats SQL)`);
            console.groupCollapsed(`  ↳ Détail ÉTAPE 2 (top ${dbg.top50.length} par score composé)`);
            console.table(dbg.top50.map((c: any, i: number) => ({
              "#": i + 1,
              "Titre": c.title,
              "Note /10": c.note ?? "–",
              "Sim%": c.sim ?? "–",
              "Composite": c.composite ?? "–",
              "Genres": (c.genres || []).join(", "),
              "Type": c.type,
            })));
            console.groupEnd();
          }

          // ── ÉTAPE 2.5 : Filtre plateforme → LLM ──
          if (dbg?.platformPool?.length) {
            const platformMs = dbg.platformFilterMs ?? "?";
            const llmMs = dbg.llmMs ?? "?";
            const matched = dbg.platformPool.filter((r: any) => r.match).length;
            const bypassed = dbg.llmFiltered?.length === dbg.top50?.length;
            console.log(`[PICK-DEBUG] 2️⃣⁺ ÉTAPE 2.5 — Filtre plateforme${bypassed ? " ⚠️ BYPASS" : ""} → ${bypassed ? `⚠️ bypass ${dbg.top50?.length} films` : `${matched} retenus`} → LLM | ${platformMs}ms`);
            console.groupCollapsed(`  ↳ Détail ÉTAPE 2.5 (filtre plateforme)`);
            console.table(dbg.platformPool.map((r: any, i: number) => ({
              "#": i + 1,
              "Titre": r.title,
              "✅ Match": r.match ? "✅" : "❌",
              "Plateformes": r.platforms.length ? r.platforms.join(", ") : "—",
            })));
            console.groupEnd();
          } else if (dbg?.llmFiltered) {
            const platformMs = dbg.platformFilterMs ?? "?";
            const llmMs = dbg.llmMs ?? "?";
            console.log(`[PICK-DEBUG] 2️⃣⁺ ÉTAPE 2.5 — Films → LLM → ${dbg.llmFiltered.length} films | ${platformMs}ms filtre | ${llmMs}ms LLM`);
            console.groupCollapsed(`  ↳ Détail ÉTAPE 2.5 (${dbg.llmFiltered.length} films → LLM)`);
            console.table(dbg.llmFiltered.map((c: any, i: number) => ({
              "#": i + 1, "Titre": c.title, "Note /10": c.note ?? "–", "Sim%": c.sim ?? "–",
            })));
            console.groupEnd();
          }

          // ── ÉTAPE 3 : Sélections LLM ──
          if (dbg?.llmSelections?.length) {
            console.log(`[PICK-DEBUG] 3️⃣  ÉTAPE 3 — LLM sélectionne → ${dbg.llmSelections.length} films → movie-match`);
            console.groupCollapsed(`  ↳ Détail ÉTAPE 3 (${dbg.llmSelections.length} sélections LLM)`);
            console.table(dbg.llmSelections.map((s: any, i: number) => ({
              "#": i + 1,
              "Titre": s.title,
              "Score LLM": `${s.matchScore}%`,
              "Raison": s.reason,
            })));
            console.groupEnd();
          }

          // ── Fallback trace ──
          if (dbg?.fallbackTrace?.length) {
            console.log(`[PICK-DEBUG] ▶ FALLBACK — ${dbg.fallbackTrace.length} film(s) ajoutés (aucun candidat SQL/LLM disponible)`);
            console.groupCollapsed(`[PICK-DEBUG]   📋 Films fallback`);
            console.table(dbg.fallbackTrace.map((t: any, i: number) => ({
              "#": i + 1, "Titre": t.title, "ID TMDB": t.id, "Type": t.type, "Source": t.stage,
            })));
            console.groupEnd();
          }

          // ── ÉTAPE 3.5 : Enrichissement TMDB ──
          if (dbg?.tmdbEnrichment?.length) {
            const failed = dbg.tmdbEnrichment.filter((t: any) => !t.ok);
            const ok = dbg.tmdbEnrichment.filter((t: any) => t.ok);
            console.log(`[PICK-DEBUG] 3️⃣⁺ ÉTAPE 3.5 — TMDB enrichissement → ✅ ${ok.length}/${dbg.tmdbEnrichment.length} OK${failed.length > 0 ? ` | ❌ ${failed.length} échoués → fallback` : ""}`);
            console.groupCollapsed(`  ↳ Détail ÉTAPE 3.5 (TMDB, ${dbg.tmdbEnrichment.length} films)`);
            console.table(dbg.tmdbEnrichment.map((t: any, i: number) => ({
              "#": i + 1,
              "Titre": t.title,
              "ID TMDB": t.id,
              "Type": t.type,
              "Statut": t.ok ? "✅ OK" : `❌ ${t.reason || "échec"}`,
            })));
            console.groupEnd();
          }

          // ── ÉTAPE 4 : Films finaux ──
          if ((dbg as any)?.finalMoviesList?.length) {
            const finals = (dbg as any).finalMoviesList;
            console.log(`[PICK-DEBUG] 4️⃣  ÉTAPE 4 — Films finaux edge → ${finals.length} films`);
            console.groupCollapsed(`  ↳ Détail ÉTAPE 4 (${finals.length} films finaux edge)`);
            console.table(finals.map((m: any, i: number) => ({
              "#": i + 1,
              "Titre": m.title,
              "Année": m.year,
              "Score": m.matchScore != null ? `${m.matchScore}%` : "—",
              "Raison LLM": m.reason ? m.reason.slice(0, 80) : "—",
            })));
            console.groupEnd();
          }

          // ── engineMeta + diagnostic pool ──
          console.log("[PICK-DEBUG] engineMeta:", data?.engineMeta);

          const meta = data?.engineMeta;
          if (meta && meta.sqlCandidatesCount >= 0) {
            const sqlCount = meta.candidatesFound ?? meta.sqlCandidatesCount;
            const llmCount = meta.llmPoolCount ?? dbg?.top50?.length ?? "?";
            if (meta.tasteCascadeTriggered) {
              console.warn(`[PICK-DEBUG] ⚠️ Cascade goût appliquée (relâchement contraintes, plateforme conservée) — ${sqlCount} candidats SQL → ${llmCount} envoyés au LLM.`);
            } else {
              console.log(`[PICK-DEBUG] ✅ Pool SQL : ${sqlCount} candidats sur tes plateformes → ${llmCount} envoyés au LLM.`);
            }
          }

          // ── Timings ──
          const timings = data?.engineMeta?.timings;
          if (timings) {
            const fmt = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
            const bar = (ms: number, total: number) => {
              const pct = Math.round((ms / total) * 20);
              return "█".repeat(Math.max(1, pct)) + "░".repeat(20 - Math.max(1, pct));
            };
            const tot = timings.total || 1;
            console.log(
              `[PICK-DEBUG] ⏱️ Timings pipeline — total ${fmt(tot)}` +
              `\n  SQL (${dbg?.sqlCandidates?.length ?? "?"} candidats)       ${bar(timings.sql, tot)}  ${fmt(timings.sql)}` +
              `\n  Enrichissement langue      ${bar(timings.langEnrich, tot)}  ${fmt(timings.langEnrich)}` +
              `\n  LLM + filtre plateforme   ${bar(timings.select, tot)}  ${fmt(timings.select)}` +
              `\n  TMDB enrichissement batch  ${bar(timings.tmdb, tot)}  ${fmt(timings.tmdb)}` +
              `\n  Fallback                   ${bar(timings.fallback, tot)}  ${fmt(timings.fallback)}`
            );
          }
          const extracted = extractRecommendationMovies(data);
          const desiredCount = quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE;
          if (extracted.length < desiredCount) {
            console.warn(
              `[PICK-DEBUG] ⚠️ Edge a renvoyé ${extracted.length}/${desiredCount} film(s) — ` +
                `filet sécurité ou exclusions (voir preTmdbDropTrace / safetyDropTrace / poolBackfillAdded)`,
            );
            const dbgDrops = data?.debugData as any;
            if (dbgDrops?.preTmdbDropTrace?.length) {
              console.table(dbgDrops.preTmdbDropTrace);
            }
            if (dbgDrops?.safetyDropTrace?.length) {
              console.table(dbgDrops.safetyDropTrace);
            }
            if (dbgDrops?.poolBackfillAdded) {
              console.log(`[PICK-DEBUG] Pool backfill edge: +${dbgDrops.poolBackfillAdded} film(s)`);
            }
          }

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

          // Le filtrage historique/genres est fait dans le SQL — en mode retrieve-rerank le client
          // score les candidats LLM sans re-filtrer par l'historique. La note minimale, elle, est
          // relâchée côté SQL quand le pool est trop maigre (cascade de repêchage) : on la
          // réapplique donc ici comme filet de sécurité (ensureRecommendationBatch, minRating).
          tBatchStart = performance.now();
          movies = await ensureRecommendationBatch(extracted, {
            excludeIds: [],
            platformIds: userPlatformIds,
            minRating: effectiveMinRating,
            excludedGenres: [],
            mediaType: undefined,
            size: desiredCount,
            preloadMatchTexts: true,
            preloadProviders: true,
            scoreAllWithMovieMatch: true,
            ...(duoOverrides?.user1Name && { duoContext: { user1Name: duoOverrides.user1Name, user2Name: duoOverrides.user2Name ?? null } }),
            onBatchReady: (batchMovies) => {
              if (!isMountedRef.current || firstMovieShown || isStale()) return;
              firstMovieShown = true;
              firstMovieShownId = batchMovies[0]?.id ?? null;
              const visibleBatch = batchMovies.slice(0, desiredCount);
              // Afficher les films immédiatement avec le texte LLM (reason) comme teaser
              setTonightPick(visibleBatch[0] as MovieDetail);
              setTonightPickIndex(0);
              // Marquer seulement le film 1 comme vu — les autres s'ajouteront à la navigation
              setTonightSeenMovieIds(new Set([visibleBatch[0].id]));
              setChatMoviesPool(visibleBatch as MovieDetail[]);
              // Charger les plateformes immédiatement pour le film 1
              void loadProviders(visibleBatch[0] as MovieDetail);
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
              if (!isMountedRef.current || firstMovieShown || isStale()) return;
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

          const mmFallbackCount = movies.filter((m: any) => (m.recommendationTexts as any)?.fallback).length;
          console.log(`[PICK-DEBUG] 5️⃣  ÉTAPE 5 — movie-match → ${movies.length} film(s) enrichis${mmFallbackCount > 0 ? ` | ⚠️ ${mmFallbackCount} fallback(s)` : " | ✅ tous riches"}`);
          console.groupCollapsed(`  ↳ Détail ÉTAPE 5 (résultat final movie-match)`);
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
          console.log(`[PICK-DEBUG] 🏁 ════ FIN PIPELINE ════ | ${movies.length} film(s) présenté(s)`);

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

      if (isMountedRef.current && !isStale() && movies.length > 0) {
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
        console.log(`[PICK-DEBUG] ⏱️ BOUT EN BOUT — ${label} : ${fmt(total)} | prép: ${fmt(preEdge)} | edge: ${fmt(edge)} | batch: ${fmt(batch)}`);

        if (firstMovieShown) {
          // onBatchReady a posé les films dans le bon ordre.
          // Si le batch final est plus grand (backfill edge / movie-match), compléter le pool.
          const displayMovies = movies.slice(0, displayCount);
          if (displayMovies.length > 0) {
            setChatMoviesPool((prev) => {
              if (prev.length >= displayMovies.length) return prev;
              const byId = new Map(prev.map((m) => [m.id, m]));
              return displayMovies.map((m) => byId.get(m.id) ?? m);
            });
          }
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
      if (isMountedRef.current && !isStale()) {
        const errMsg = e instanceof Error ? e.message : String(e);
        const isRateLimit = errMsg.includes("429") || errMsg.includes("Trop de requêtes");
        toast.error(
          isRateLimit
            ? "Trop de requêtes — réessaie dans quelques secondes."
            : "Impossible de charger des recommandations. Vérifie ta connexion et réessaie.",
          { duration: 6000 }
        );
      }
    } finally {
      clearInterval(msgInterval);
      msgIntervalRef.current = null;
      if (isMountedRef.current && !isStale()) {
        setTonightLoading(false);
        setTonightLoadingMsg("");
      }
    }
  };

  const handleAutoPick = async (duoId?: string, opts?: { genres?: string[]; moodContext?: string; mediaType?: "movie" | "tv" }) => {
    console.log("[REVEAL] 🎭 handleAutoPick — duoId:", duoId, "| opts:", opts);
    // Ouvrir l'overlay en premier — dans le même batch React que setShowFindChoice(false)
    // → pas de frame où le fond est visible entre la fermeture du modal et l'ouverture de l'overlay
    setTonightLoading(true);
    setShowFindChoice(false);
    setFindChoiceDuoId(undefined);
    setTonightPick(null);
    setChatMoviesPool(null);
    setTonightPickIndex(0);
    setNoResultsInfo(null);
    activeVoiceFiltersRef.current = null;
    const genreFilter: import("./VoiceChat").VoiceSearchFilters | null =
      opts?.genres?.length || opts?.mediaType
        ? {
            genres: opts.genres ?? [],
            originalLanguage: null,
            mediaType: opts.mediaType ?? null,
            maxDuration: null,
            decade: null,
          }
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
  // Met à jour les singletons module-level pour que le code async de Mount 1
  // appelle les fonctions de Mount 2 (composant vivant) et non de Mount 1 (démonté)
  _pipelineFns.handleAutoPick = handleAutoPick;
  _pipelineFns.generateTonightPick = generateTonightPick as unknown as (excludeList?: number[], ctx?: unknown, filters?: unknown, overrides?: unknown, mood?: string) => void;

  // Sortie de l'onboarding — lance la même recherche solo que le bouton "Surprise-moi",
  // en une seule fois, pour un premier résultat immédiat. Le déclenchement effectif est
  // armé plus haut (setAutoSurprisePending) une fois le profil chargé — pas ici au montage —
  // pour que la closure de handleAutoPick voie déjà les vrais genres/plateformes/note min
  // et non les valeurs par défaut du tout premier render. On passe par le ref (comme le
  // pipeline reveal) pour être certain d'appeler la version la plus fraîche de la fonction.
  useEffect(() => {
    if (!autoSurprisePending) return;
    setAutoSurprisePending(false);
    void handleAutoPickRef.current?.();
  }, [autoSurprisePending]);

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
    setFlipDetailFromBrowse(true);
    setFlipDetailMovie(tonightPick);
  };

  const handleOpenHomeBrowseDetail = () => {
    const movie = homeBrowsePool[homeBrowseIndex];
    if (!movie) return;
    setFlipDetailFromBrowse(true);
    setFlipDetailMovie(movie);
  };

  const handleCloseFlipDetail = () => {
    setFlipDetailMovie(null);
    if (!homeBrowseOpen && !tonightPick && !tonightLoading) {
      setFlipDetailFromBrowse(false);
    }
  };

  const openHomeBrowseAt = async (items: QuickReco[], startIndex: number) => {
    const slice = items.filter((q) => q?.id).slice(0, 3);
    if (slice.length === 0) {
      setShowFindChoice(true);
      return;
    }
    setLoadingMovieId(slice[startIndex]?.id ?? null);
    try {
      const pool: MovieDetail[] = [];
      for (const q of slice) {
        const cached = q.detail ?? chatMoviesPool?.find((m) => m.id === q.id);
        if (cached) pool.push(cached);
        else pool.push(await getMovieDetails(q.id, q.media_type || "movie"));
      }
      const safeIndex = Math.min(startIndex, pool.length - 1);
      // Restaurer les raisons de reco depuis le cache localStorage
      const restoredMatchData: Record<number, RecommendationMatch> = {};
      for (const q of slice) {
        if (q.matchData) restoredMatchData[q.id] = q.matchData;
      }
      if (Object.keys(restoredMatchData).length > 0) {
        setMovieMatchData((prev) => ({ ...prev, ...restoredMatchData }));
      }
      setHomeBrowsePool(pool);
      setHomeBrowseIndex(safeIndex);
      setHomeBrowseSeenIds(new Set([pool[safeIndex]?.id].filter(Boolean) as number[]));
      setHomeBrowseProviders([]);
      setHomeBrowseOpen(true);
      if (pool[safeIndex]) resolveProviders(pool[safeIndex], userPlatformIds).then(setHomeBrowseProviders).catch(() => {});
    } catch {
      setShowFindChoice(true);
    } finally {
      setLoadingMovieId(null);
    }
  };

  const handleNavigateHomeBrowse = (direction: "prev" | "next") => {
    const nextIndex = direction === "next" ? homeBrowseIndex + 1 : homeBrowseIndex - 1;
    if (nextIndex < 0 || nextIndex >= homeBrowsePool.length) return;
    const currentId = homeBrowsePool[homeBrowseIndex]?.id;
    if (currentId) {
      setHomeBrowseSeenIds((prev) => new Set(prev).add(currentId));
    }
    setHomeBrowseIndex(nextIndex);
    const nextMovie = homeBrowsePool[nextIndex];
    if (nextMovie) {
      setHomeBrowseProviders([]);
      resolveProviders(nextMovie, userPlatformIds).then(setHomeBrowseProviders).catch(() => {});
    }
  };

  const handleCloseHomeBrowse = () => {
    setHomeBrowseOpen(false);
    setHomeBrowsePool([]);
    setHomeBrowseIndex(0);
    setHomeBrowseSeenIds(new Set());
    setHomeBrowseProviders([]);
    setFlipDetailFromBrowse(false);
  };

  const handleWatchNow = () => {
    if (!tonightPick) return;
    const moviesToPass = chatMoviesPool && chatMoviesPool.length > 0 ? chatMoviesPool : [tonightPick];
    onSurprise(moviesToPass, tonightPickIndex, tonightSeenMovieIds);
  };

  const handleProgramForEvent = async () => {
    if (!revealEventId || !tonightPick || programmingEvent) return;
    setProgrammingEvent(true);
    try {
      await programFilmForEvent(revealEventId, tonightPick);
      toast.success("Film programmé pour la soirée !", { description: getDisplayTitle(tonightPick) });
      clearRevealEvent();
      setRevealEventId(null);
      setTonightPick(null);
      setTonightLoading(false);
      navigate(`/app/soirees/${revealEventId}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Impossible de programmer le film";
      toast.error(message);
      setProgrammingEvent(false);
    }
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

  const hideHomeDuringReveal = tonightLoading && !tonightPick;

  return (
    <div className="relative w-full h-full overflow-x-hidden">
      <div className={hideHomeDuringReveal ? "invisible" : undefined}>
      <BrandHeader
        extraActions={
          <QuickFilters filters={quickFilters} onFiltersChange={setQuickFilters} profileDefaults={profileDefaults} />
        }
        avatarUrl={avatarUrl}
        firstName={firstName}
        isPremium={isPremium}
        interactionCount={interactionCount}
      />

      <div
        className="absolute inset-0 bg-cover bg-no-repeat"
        style={{ backgroundImage: `url(${homeBackground})`, backgroundPosition: "50% 0%", backgroundSize: "cover" }}
      />

      {/* Dégradé : image visible en haut, fond opaque en bas */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/55 to-background" />

      {/* Greeting flottant juste sous la BrandHeader */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.4 }}
        className="absolute left-5 z-20"
        style={{ top: "calc(3.4rem + env(safe-area-inset-top))" }}
      >
        <p className="text-foreground/55 text-[13px] font-sans">
          {firstName ? `Bonsoir ${firstName} 👋` : "Bonsoir 👋"}
        </p>
      </motion.div>

      <div className="relative z-10 h-full overflow-y-auto overscroll-y-contain touch-[pan-y_pinch-zoom] scrollbar-hide pb-[calc(6rem+env(safe-area-inset-bottom))]">
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

        {/* ─── Carte post-soirée persistante ─── */}
        {pendingFeedbackEvent && !showPostSoiree && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setShowPostSoiree(true)}
            className="mx-5 mt-4 w-[calc(100%-2.5rem)] flex items-center gap-3 p-3.5 rounded-2xl bg-primary/[0.07] border border-primary/20 hover:bg-primary/[0.11] transition-all text-left"
          >
            <span className="text-xl shrink-0">🌟</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-sans font-semibold text-foreground leading-tight">
                Comment s'est passée la soirée ?
              </p>
              <p className="text-[10.5px] font-sans text-foreground/45 mt-0.5 truncate">
                {pendingFeedbackEvent.filmTitle} · En attente de ton avis
              </p>
            </div>
            <span className="text-[11px] font-sans font-semibold text-primary shrink-0">Évaluer →</span>
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
                  const list = quickRecos.length > 0 ? quickRecos.slice(0, 3) : trendingFallback.slice(0, 3);
                  await openHomeBrowseAt(list, i);
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
                  {item?.recommendedBy && (
                    <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm">
                      <span className="text-[8px] leading-none">💌</span>
                      <span className="text-[8px] font-sans text-white/80 truncate leading-tight">{item.recommendedBy}</span>
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

        {/* ─── Notification "Partagé avec vous" — dans le flow scrollable ─── */}
        <AnimatePresence>
          {showShareNotif && !shareNotifDismissed && !tonightLoading && !tonightPick && !showFindChoice && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              className="mx-5 mt-3"
            >
              <div
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border border-primary/20 bg-primary/[0.06] backdrop-blur-md"
                onClick={() => { setShowShareNotif(false); setShowFindChoice(true); }}
                role="button"
                tabIndex={0}
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 via-pink-500 to-violet-500 border-2 border-[hsl(240_18%_6%)] flex items-center justify-center shadow-[0_0_14px_hsl(330_70%_60%/0.45)]">
                  <span className="text-[15px] leading-none">🌸</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-sans font-semibold text-foreground leading-tight">
                    Partagé <span className="text-foreground/50 font-normal">avec vous</span>
                  </p>
                  <p className="text-[10.5px] font-sans text-foreground/50 leading-tight mt-0.5 truncate">
                    <span className="text-foreground/75 font-medium">Sophie</span> pense que tu aimerais ce film
                  </p>
                </div>
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
      </div>

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
      </div>

      <TonightPickOverlay
        open={homeBrowseOpen && !tonightLoading && !tonightPick}
        detailOpen={!!flipDetailMovie}
        movie={homeBrowsePool[homeBrowseIndex] ?? null}
        tonightPool={homeBrowsePool}
        tonightPickIndex={homeBrowseIndex}
        tonightSeenMovieIds={homeBrowseSeenIds}
        tonightProviders={homeBrowseProviders}
        movieMatchData={movieMatchData}
        canGoPrev={homeBrowseIndex > 0}
        canGoNext={homeBrowseIndex < homeBrowsePool.length - 1}
        tonightAllVisited={homeBrowseSeenIds.size >= homeBrowsePool.length}
        tonightLoading={false}
        onClose={handleCloseHomeBrowse}
        onPrev={() => handleNavigateHomeBrowse("prev")}
        onNext={() => handleNavigateHomeBrowse("next")}
        onOpenDetail={handleOpenHomeBrowseDetail}
        onConfirm={handleOpenHomeBrowseDetail}
        onInteraction={() => {}}
        onMoreSuggestions={() => setShowFindChoice(true)}
        expectedCount={homeBrowsePool.length}
        userGenres={userGenres}
        userName={
          (user?.user_metadata?.full_name as string | undefined) ||
          (user?.user_metadata?.name as string | undefined) ||
          (user?.email?.split("@")[0])
        }
      />

      <TonightPickOverlay
        open={tonightLoading || !!tonightPick}
        detailOpen={!!flipDetailMovie}
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
        onConfirm={revealEventId ? () => void handleProgramForEvent() : handleWatchNow}
        onInteraction={(type) => void handleMovieAction(type)}
        onMoreSuggestions={() => void handleMoreSuggestions()}
        expectedCount={quickFilters.recommendationCount}
        loadingLog={loadingLog}
        userGenres={tonightUserGenres}
        revealEventId={revealEventId}
        confirmLoading={programmingEvent}
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
        onClose={handleCloseFlipDetail}
        onPosterClick={flipDetailFromBrowse ? handleCloseFlipDetail : undefined}
        isEnriching={tonightLoading}
        recommendationTextsByMovieId={
          Object.fromEntries(
            [...(chatMoviesPool ?? []), ...homeBrowsePool]
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

      {/* ── Post-soirée flow ── */}
      {showPostSoiree && pendingFeedbackEvent && (
        <PostSoireeFlow
          event={pendingFeedbackEvent}
          onClose={() => setShowPostSoiree(false)}
          onComplete={() => {
            setShowPostSoiree(false);
            setPendingFeedbackEvent(null);
          }}
        />
      )}
    </div>
  );
};

export default HomeScreen;
