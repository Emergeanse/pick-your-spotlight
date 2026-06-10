import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, Mic, Flame, Eye, Coffee, Heart, Shuffle } from "lucide-react";

import { ALL_PLATFORMS } from "@/lib/platforms";
import type { Movie, MovieDetail } from "@/lib/tmdb";
import type { VoiceSearchFilters } from "./VoiceChat";
import { getTrendingMovies, getBackdropUrl, getWatchProviders } from "@/lib/tmdb";
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

import BrandHeader from "./BrandHeader";
import PickCharacter from "./PickCharacter";
import pickDefault from "@/assets/pick-squirrel.png";
import QuickFilters, { type QuickFilterState, type ProfileDefaults } from "./QuickFilters";
import TasteTrainer from "./TasteTrainer";
import DiscoverySection from "./DiscoverySection";
import HomeScreenChoiceModal from "./HomeScreenChoiceModal";
import TonightPickOverlay from "./TonightPickOverlay";
import FlipCardDetail from "./FlipCardDetail";
import HomeAmbianceSection, { type AmbianceMood } from "./HomeAmbianceSection";
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
    ...extractTmdbIdsFromFeedbackRows(watchlistRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(notForMeRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(dislikeRows as any[]),
    ...extractTmdbIdsFromFeedbackRows(skipRows as any[]),
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
  const [currentBgIndex, setCurrentBgIndex] = useState(0);

  const [tonightPick, setTonightPick] = useState<MovieDetail | null>(null);
  const [tonightLoading, setTonightLoading] = useState(false);
  const [tonightLoadingMsg, setTonightLoadingMsg] = useState("");
  const [loadingLog, setLoadingLog] = useState<string[]>([]);
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

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (msgIntervalRef.current !== null) clearInterval(msgIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    // Bridge depuis DuoPage ("Trouve-nous un film !") via sessionStorage
    const duoIdFromSession = sessionStorage.getItem("pick_open_find_choice_duo_id");
    if (duoIdFromSession) {
      sessionStorage.removeItem("pick_open_find_choice_duo_id");
      setFindChoiceDuoId(duoIdFromSession);
      // Délai pour éviter le bleed-through du tap depuis DuoPage
      setTimeout(() => setShowFindChoice(true), 300);
      return;
    }
    // Bridge legacy via location.state (autres appelants)
    const state = location.state as { openFindChoice?: boolean; duoId?: string } | null;
    if (state?.openFindChoice) {
      setFindChoiceDuoId(state.duoId);
      setTimeout(() => setShowFindChoice(true), 300);
      navigate("/app", { replace: true, state: {} });
    }
  }, [location.state]);

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
    };
    window.addEventListener("home-reset", handler);
    return () => window.removeEventListener("home-reset", handler);
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

  type DuoOverrides = { topGenres: string[]; excludedGenres: string[]; tasteVector: number[] | null; avoidanceVector: number[] | null; topClusters: string[]; rejectedClusters: string[]; partnerExcludeIds: number[]; user1Name: string | null; user2Name: string | null };
  const generateTonightPick = async (excludeList: number[] = rejectedIds, rejectionContext?: RejectionContext, voiceFilters?: VoiceSearchFilters | null, duoOverrides?: DuoOverrides) => {
    generateTonightPickRef.current = generateTonightPick;
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
            likedMovies: liked,
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
            count: (quickFilters.recommendationCount || RECOMMENDATION_BATCH_SIZE) * 3,
            minMatchScore: effectiveMinMatchScore,
            ...(moodCfg?.moodContext && { moodContext: moodCfg.moodContext }),
            ...(moodCfg?.boostGenres && { moodBoostGenres: moodCfg.boostGenres }),
            // Overrides vocaux — priment sur les defaults SQL
            voiceGenres: voiceFilters?.genres ?? null,
            voiceOriginalLanguage: voiceFilters?.originalLanguage ?? null,
            voiceMediaType: voiceFilters?.mediaType ?? null,
            voiceMaxDuration: voiceFilters?.maxDuration ?? null,
            voiceDecade: voiceFilters?.decade ?? null,
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
            const headerFn = candidateCount === 0 ? console.warn.bind(console) : console.group.bind(console);
            headerFn(`[PICK-DEBUG] 1️⃣ SQL — ${candidateCount} candidats (${f?.excludeCount ?? 0} exclus — déjà vus)${candidateCount === 0 ? " ⚠️ POOL ÉPUISÉ" : ""}`);
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
            // COUNT toujours affiché en premier — même quand sql50 = []
            if (dbg.sqlCountDiag?.length) {
              console.group(`[PICK-DEBUG] 📊 COUNT par niveau de contrainte`);
              console.table(dbg.sqlCountDiag.map((d: any) => ({
                "Niveau": `${d.level} — ${cascadeLabels[d.level] ?? `niveau ${d.level}`}`,
                "Total en base": d.total_in_db,
                "Disponibles (après exclusions)": d.available_after_exclusions,
                "excluded_genres": d.level < 3 ? "✅ actifs" : "⚠️ vérifier snippet",
              })));
              console.groupEnd();
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
                "Sim%": c.sim ?? "–",
                "Composite": c.composite ?? "–",
                "Genres": (c.genres || []).join(", "),
                "Type": c.type,
              })));
            }
            if (candidateCount > 0) console.groupEnd();
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
              setTonightSeenMovieIds(new Set(batchMovies.map((m) => m.id)));
              setChatMoviesPool(batchMovies as MovieDetail[]);
            },
            onMovieEnriched: (enrichedMovie) => {
              if (!isMountedRef.current) return;
              // Mettre à jour le film dans le pool avec les rich texts dès que Gemini répond
              setChatMoviesPool((prev) =>
                prev.map((m) => m.id === enrichedMovie.id ? (enrichedMovie as MovieDetail) : m),
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
        let poolMovies = movies.slice(0, displayCount);
        // Si un film a déjà été affiché via onFirstMovieReady, on s'assure qu'il reste en 1ère position
        if (firstMovieShownId !== null) {
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

        // Mettre à jour le pool et garantir que poolMovies[0] est toujours le film affiché
        setChatMoviesPool(poolMovies);
        // On appelle toujours setCurrentTonightMovie avec poolMovies[0] pour éviter tout flicker
        // Si firstMovieShown=true et poolMovies[0] === film déjà affiché → aucun changement visuel
        await setCurrentTonightMovie(poolMovies[0], 0, new Set(poolMovies[0] ? [poolMovies[0].id] : []));

        // All films were enriched in parallel above — nothing to do lazily here.
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

  const handleAutoPick = async (duoId?: string) => {
    setShowFindChoice(false);
    setFindChoiceDuoId(undefined);
    setTonightPick(null);
    setChatMoviesPool(null);
    setTonightPickIndex(0);
    setNoResultsInfo(null);

    if (duoId) {
      try {
        const { data: duo } = await (supabase as any)
          .from("duo_taste_profiles").select("*").eq("id", duoId).single();
        if (duo && duo.user2_id) {
          // Interactions des deux users à exclure — cohérent avec loadUnifiedUserFeedbackState solo
          const fetchInteractedIds = async (userId: string): Promise<number[]> => {
            const { data } = await supabase
              .from("user_item_feedback")
              .select("item:item_id(tmdb_id)")
              .eq("user_id", userId)
              .or("feedback_type.in.(like,love,seen,skip,dislike,not_for_me,unknown),and(feedback_type.is.null,label.in.(like,love,seen,skip,dislike,not_for_me,unknown))");
            return (data ?? []).map((r: any) => {
              const item = r.item;
              const tmdb = Array.isArray(item) ? item[0]?.tmdb_id : item?.tmdb_id;
              return tmdb;
            }).filter(Number.isFinite) as number[];
          };
          const [ids1, ids2] = await Promise.all([
            fetchInteractedIds(duo.user1_id),
            fetchInteractedIds(duo.user2_id),
          ]);
          const tv = duo.taste_vector ? JSON.parse(duo.taste_vector) : null;
          const av = duo.avoidance_vector ? JSON.parse(duo.avoidance_vector) : null;

          // Utilise le profil stocké du duo directement (comme un profil solo)
          void generateTonightPick([], undefined, undefined, {
            topGenres: duo.common_genres ?? [],
            excludedGenres: duo.excluded_genres ?? [],
            tasteVector: tv,
            avoidanceVector: av,
            topClusters: duo.top_clusters ?? [],
            rejectedClusters: duo.rejected_clusters ?? [],
            partnerExcludeIds: [...new Set([...ids1, ...ids2])],
            user1Name: duo.user1_display_name ?? null,
            user2Name: duo.user2_display_name ?? null,
          });
          return;
        }
      } catch (e) {
        console.error("[Duo] handleAutoPick fetch error:", e);
      }
    }
    void generateTonightPick(rejectedIds);
  };

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

    await generateTonightPick(nextRejected, rejContext);
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

    await generateTonightPick(nextRejected, rejContext);
  };

  return (
    <div className="relative w-full h-full overflow-x-hidden">
      <BrandHeader
        extraActions={
          <QuickFilters filters={quickFilters} onFiltersChange={setQuickFilters} profileDefaults={profileDefaults} />
        }
      />

      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${homeBackground})` }}
      />

      {/* Midnight Curator: cinematic fade — backdrop kept atmospheric, never noisy */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/40 to-background" />
      <div className="absolute inset-0 bg-background/20" />

      <div className="relative z-10 h-full overflow-y-auto overscroll-y-contain touch-[pan-y_pinch-zoom] scrollbar-hide">
        {/* ─── Cinematic Hero ─── */}
        <section className="relative pt-14 pb-2 px-5 md:px-8">
          {/* Mascot floating on the right with violet halo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, x: 12 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute right-0 top-12 w-[55%] max-w-[280px] flex justify-end pr-1"
          >
            <div className="relative">
              <div
                className="absolute inset-0 -z-10 blur-3xl opacity-70"
                style={{
                  background:
                    "radial-gradient(ellipse at center, hsl(var(--primary) / 0.32), transparent 70%)",
                }}
              />
              <PickCharacter mood="wave" size="lg" animate />
            </div>
          </motion.div>

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative flex items-center gap-2 mb-1 mt-6"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-[8px] font-sans font-semibold tracking-[0.15em] uppercase text-primary">
              Pick comprend tes envies
            </span>
          </motion.div>

          {/* Hero serif headline */}
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="relative font-serif text-foreground text-[34px] sm:text-[40px] leading-[1] tracking-tight max-w-[64%]"
            translate="no"
          >
            Ce soir,
            <br />
            quelque chose
            <br />
            d
            <span className="italic bg-gradient-to-br from-primary via-accent to-primary bg-clip-text text-transparent">
              ’intense
            </span>
            <span className="text-foreground">.</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.5 }}
            className="relative mt-2 text-foreground/75 text-[11px] leading-snug font-sans max-w-[62%]"
          >
            <span className="italic font-bold">
              « Je t’ai préparé une sélection brutale et visuelle ! »
            </span>
            <span className="mt-1 flex items-center gap-1.5 text-foreground/60 not-italic font-normal">
              <span>— Pick</span>
              <img
                src={pickDefault}
                alt="Pick"
                className="w-7 h-7 object-contain drop-shadow-sm"
              />
            </span>
          </motion.p>

          {/* Primary CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            className="relative mt-16 flex justify-center"
          >
            <motion.button
              data-tour="pick-ce-soir"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowFindChoice(true)}
              disabled={loading}
              className="fab-pulse inline-flex items-center justify-center gap-2.5 w-full max-w-[260px] py-[18px] px-7 rounded-full bg-gradient-to-b from-primary to-accent text-primary-foreground font-sans font-semibold text-[15px] tracking-wide shadow-[0_20px_55px_-12px_hsl(var(--primary)/0.65)] hover:shadow-[0_24px_65px_-10px_hsl(var(--primary)/0.8)] transition-shadow disabled:opacity-50"
            >
              <Sparkles className="w-[18px] h-[18px]" />
              Trouve-moi 1 film
            </motion.button>
          </motion.div>

          {/* Voice card — same premium surface family as cards below */}
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.55 }}
            whileTap={{ scale: 0.985 }}
            onClick={onOpenChat}
            className="relative mt-4 w-full flex items-center py-1.5 px-2.5 pr-4 text-left transition-all gap-[16px] rounded-2xl border border-white/10 bg-white/[0.06] hover:bg-white/[0.10] hover:border-white/20"
          >
            <span className="relative flex-shrink-0">
              <span className="absolute inset-0 rounded-full bg-primary/20 blur-md animate-subtle-pulse" />
              <span className="relative flex items-center justify-center w-9 h-9 rounded-full bg-primary/12 border border-primary/40">
                <Mic className="w-[14px] h-[14px] text-primary" />
              </span>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-serif text-foreground text-[13px] leading-tight">
                Parle-moi…
              </span>
              <span className="block text-foreground/45 text-[10px] font-sans mt-0.5">
                Dis ce que tu as envie de voir
              </span>
            </span>
            <span className="flex items-end gap-[2px] h-4" aria-hidden="true">
              {[6, 14, 9, 18, 12, 20, 8, 15, 7].map((h, i) => (
                <motion.span
                  key={i}
                  className="w-[2px] rounded-full bg-primary/70"
                  animate={{ height: [`${h * 0.35}px`, `${h * 0.85}px`, `${h * 0.45}px`] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.08,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </span>
          </motion.button>

          {/* Ambiance chips — compact single row, directly under "Parle-moi" */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="mt-4 w-full rounded-2xl border border-white/10 bg-white/[0.06] hover:bg-white/[0.10] hover:border-white/20 transition-all py-1.5 px-2.5"
          >
            <div className="flex items-baseline justify-between mb-1.5 px-0.5">
              <h3 className="font-serif text-foreground text-[13px] leading-tight">
                Choisis ton ambiance
              </h3>
              <span className="text-[10px] font-sans font-semibold tracking-[0.18em] uppercase text-foreground/40">
                Filtre rapide
              </span>
            </div>
            <div className="flex gap-[3px] w-full">
              {AMBIANCES.map(({ id, label, Icon }, i) => {
                const active = activeAmbiance === id;
                return (
                  <motion.button
                    key={id}
                    type="button"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.85 + i * 0.04, duration: 0.35 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      setActiveAmbiance(id);
                      if (id === "surprise") {
                        handleAutoPick();
                      } else {
                        setShowFindChoice(true);
                      }
                    }}
                    className={`inline-flex items-center justify-center gap-0.5 h-7 px-[3px] rounded-full font-sans text-[9px] font-medium transition-all duration-300 min-w-0 ${
                      active
                        ? "bg-white/[0.10] text-primary border border-primary/55"
                        : "bg-white/[0.04] text-foreground/70 border border-white/10 hover:bg-white/[0.10] hover:border-white/20 hover:text-foreground/90"
                    }`}
                  >
                    <Icon
                      className={`w-2.5 h-2.5 flex-shrink-0 transition-colors ${
                        active ? "text-primary" : "text-foreground/45"
                      }`}
                      strokeWidth={2.5}
                    />
                    <span className="truncate">{label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>


        </section>

        <div className="mt-4">
          <HomeAmbianceSection
            activeAmbiance={activeAmbiance}
            onPickAmbiance={(mood) => {
              setActiveAmbiance(mood);
              if (mood === "surprise") {
                handleAutoPick();
              } else {
                setShowFindChoice(true);
              }
            }}
          />

        </div>

        <DiscoverySection
          onMovieSelect={onMovieSelect}
          platformIds={userPlatformIds}
          favoriteGenres={userGenres}
          minRating={userMinRating}
          excludedGenres={userExcludedGenres}
        />
      </div>

      <HomeScreenChoiceModal
        open={showFindChoice}
        mediaType={quickFilters.mediaType}
        onClose={() => { setShowFindChoice(false); setFindChoiceDuoId(undefined); }}
        onAutoPick={handleAutoPick}
        initialDuoId={findChoiceDuoId}
        onOpenChat={() => {
          setShowFindChoice(false);
          onOpenChat();
        }}
        onOpenMoodCapture={() => {
          setShowFindChoice(false);
          onOpenMoodCapture();
        }}
      />

      <AnimatePresence>
        {tonightLoading && !tonightPick && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center"
          >
            <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${loadingBackground})` }} />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
            <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm px-6">
              <div className="w-full max-h-48 overflow-y-auto scrollbar-hide flex flex-col gap-1.5 scroll-smooth">
                <AnimatePresence initial={false}>
                  {loadingLog.map((line, i) => (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: i === loadingLog.length - 1 ? 1 : 0.35, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="text-sm text-center leading-snug"
                      style={{ color: i === loadingLog.length - 1 ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}
                    >
                      {line}
                    </motion.p>
                  ))}
                </AnimatePresence>
                <div ref={loadingLogEndRef} />
              </div>
              <PickCharacter mood="think" size="md" animate />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                      void generateTonightPick(rejectedIds);
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
                      void generateTonightPick(rejectedIds);
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-foreground/8 border border-border/20 text-foreground/60 text-[12px] font-sans font-medium hover:bg-foreground/12 transition-colors"
                  >
                    Enlever la note min
                  </button>
                )}
                <button
                  onClick={() => {
                    setNoResultsInfo(null);
                    void generateTonightPick(rejectedIds);
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
        open={!!tonightPick && !flipDetailMovie}
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
