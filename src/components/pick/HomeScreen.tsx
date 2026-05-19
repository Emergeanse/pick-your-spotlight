import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import type { Movie, MovieDetail } from "@/lib/tmdb";
import { getTrendingMovies, getBackdropUrl, getWatchProviders } from "@/lib/tmdb";
import { getLikedMovies } from "@/lib/liked-movies";
import { trackInteraction, getUserTasteProfile } from "@/lib/interactions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { computeMultiVectorProfile } from "@/lib/taste-engine";
import {
  extractRecommendationMovies,
  ensureRecommendationBatch,
  enrichRecommendationBatchWithTexts,
  getRecommendationScore,
  RECOMMENDATION_BATCH_SIZE,
  type RecommendationMovieDetail,
} from "@/lib/recommendation-batch";
import { getEngagementData, getProgressionMessage, type EngagementData } from "@/lib/engagement";
import { listFeedbackByType } from "@/lib/feedback";

import BrandHeader from "./BrandHeader";
import PickCharacter from "./PickCharacter";
import QuickFilters, { type QuickFilterState, type ProfileDefaults } from "./QuickFilters";
import TasteTrainer from "./TasteTrainer";
import DiscoverySection from "./DiscoverySection";
import HomeScreenChoiceModal from "./HomeScreenChoiceModal";
import TonightPickOverlay from "./TonightPickOverlay";
import FlipCardDetail from "./FlipCardDetail";

interface HomeScreenProps {
  onStart: () => void;
  onOpenChat: () => void;
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

const HomeScreen = ({
  onOpenChat,
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

  const [bgImages, setBgImages] = useState<string[]>([]);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);

  const [tonightPick, setTonightPick] = useState<MovieDetail | null>(null);
  const [tonightLoading, setTonightLoading] = useState(false);
  const [tonightLoadingMsg, setTonightLoadingMsg] = useState("");
  const [tonightProviders, setTonightProviders] = useState<{ name: string; logo_path: string }[]>([]);

  const [userPlatformIds, setUserPlatformIds] = useState<number[]>([]);
  const [userExcludedPlatformIds, setUserExcludedPlatformIds] = useState<number[]>([]);
  const [userGenres, setUserGenres] = useState<string[]>([]);
  const [userExcludedGenres, setUserExcludedGenres] = useState<string[]>([]);
  const [userMinRating, setUserMinRating] = useState<number>(0);
  const [userRecommendationCount, setUserRecommendationCount] = useState<number>(RECOMMENDATION_BATCH_SIZE);

  const [rejectedIds, setRejectedIds] = useState<number[]>([]);
  const [, setEngagement] = useState<EngagementData | null>(null);
  const [, setProgressionMsg] = useState<string | null>(null);
  const [historyExcludeIds, setHistoryExcludeIds] = useState<number[]>([]);
  const [showTrainer, setShowTrainer] = useState(false);
  const [showFindChoice, setShowFindChoice] = useState(false);
  const [explorationLevel] = useState<number>(5);
  const [totalEvaluated, setTotalEvaluated] = useState(0);

  const [chatMoviesPool, setChatMoviesPool] = useState<MovieDetail[] | null>(null);
  const [movieMatchData, setMovieMatchData] = useState<Record<number, RecommendationMatch>>({});
  const [tonightPickIndex, setTonightPickIndex] = useState(0);
  const [tonightSeenMovieIds, setTonightSeenMovieIds] = useState<Set<number>>(new Set());

  const [flipDetailMovie, setFlipDetailMovie] = useState<MovieDetail | null>(null);

  const [quickFilters, setQuickFilters] = useState<QuickFilterState>({
    mediaType: "both",
    maxDuration: null,
    matchThreshold: 80,
    minRating: 0,
  });
  const [profileDefaults, setProfileDefaults] = useState<ProfileDefaults>({
    mediaType: "both",
    maxDuration: null,
    matchThreshold: 80,
    minRating: 0,
  });

  const isMountedRef = useRef(true);
  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (msgIntervalRef.current !== null) clearInterval(msgIntervalRef.current);
    };
  }, []);

  const tonightPool = useMemo(() => chatMoviesPool || [], [chatMoviesPool]);
  const canGoPrev = tonightPickIndex > 0;
  const canGoNext = tonightPickIndex < tonightPool.length - 1;
  const tonightAllVisited = tonightSeenMovieIds.size >= tonightPool.length && tonightPool.length > 0;

  const loadProviders = async (movie: MovieDetail) => {
    const cached = (movie as any).watchProviders as { name: string; logo_path: string; provider_id?: number }[] | undefined;
    if (cached && Array.isArray(cached)) {
      setTonightProviders(cached);
      return;
    }
    const mediaType = movie.first_air_date ? "tv" : "movie";
    try {
      const providers = await getWatchProviders(movie.id, mediaType);
      setTonightProviders(providers);
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

    const effectiveCount = userRecommendationCount || RECOMMENDATION_BATCH_SIZE;
    setChatMoviesPool(chatSuggestedMovies.slice(0, effectiveCount));
    void setCurrentTonightMovie(targetMovie, startIdx, seenIds);
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
        if ((data as any)?.min_rating) {
          setUserMinRating((data as any).min_rating);
        }

        const defaults: ProfileDefaults = {
          mediaType: ((data as any)?.default_media_type as "both" | "movie" | "tv") || "both",
          maxDuration: (data as any)?.default_max_duration ?? null,
          matchThreshold: (data as any)?.match_threshold ?? 80,
          minRating: (data as any)?.min_rating ?? 0,
        };
        setUserRecommendationCount((data as any)?.default_recommendation_count ?? RECOMMENDATION_BATCH_SIZE);

        setProfileDefaults(defaults);
        setQuickFilters(defaults);
      });

    loadUnifiedUserFeedbackState().then(({ excludeIds, evaluatedCount }) => {
      setHistoryExcludeIds(excludeIds);
      setTotalEvaluated(evaluatedCount);
    });
  }, [user]);

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

  const generateTonightPick = async (excludeList: number[] = rejectedIds, rejectionContext?: RejectionContext) => {
    const allExcludeIds = [...new Set([...excludeList, ...historyExcludeIds])];

    setTonightLoading(true);
    setTonightProviders([]);

    let msgIndex = 0;
    setTonightLoadingMsg(LOADING_MESSAGES[0]);

    const msgInterval = setInterval(() => {
      if (!isMountedRef.current) return;
      msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
      setTonightLoadingMsg(LOADING_MESSAGES[msgIndex]);
    }, 2000);
    msgIntervalRef.current = msgInterval;

    try {
      let movies: MovieDetail[] = [];

      if (user) {
        const liked = await getLikedMovies();

        if (liked.length >= 2) {
          const [multiProfile, tasteProfile] = await Promise.all([
            computeMultiVectorProfile(user.id),
            getUserTasteProfile(),
          ]);

          const userTasteVector = multiProfile?.stableTasteVector || null;

          const data = await invokeSurprisePersonalized({
            likedMovies: liked,
            userTasteVector,
            tasteProfile,
            recentTasteVector: multiProfile?.recentTasteVector || null,
            avoidanceVector: multiProfile?.avoidanceVector || null,
            platformIds: userPlatformIds,
            excludedPlatformIds: userExcludedPlatformIds,
            excludedGenres: userExcludedGenres,
            minRating: userMinRating,
            excludeIds: allExcludeIds,
            rejectionContext,
            explorationLevel,
            mediaType: quickFilters.mediaType !== "both" ? quickFilters.mediaType : "both",
            maxDuration: quickFilters.maxDuration,
            count: userRecommendationCount || RECOMMENDATION_BATCH_SIZE,
            minMatchScore: quickFilters.matchThreshold,
          });
          const extracted = extractRecommendationMovies(data);
          const desiredCount = userRecommendationCount || RECOMMENDATION_BATCH_SIZE;

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

          // Single call: fills to desiredCount, scores, filters by threshold
          movies = await ensureRecommendationBatch(extracted, {
            excludeIds: allExcludeIds,
            platformIds: userPlatformIds,
            minRating: userMinRating,
            excludedGenres: userExcludedGenres,
            size: desiredCount,
            preloadMatchTexts: true,
            preloadProviders: true,
            minMatchScore: quickFilters.matchThreshold,
          });

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
            size: userRecommendationCount || RECOMMENDATION_BATCH_SIZE,
            preloadMatchTexts: true,
            preloadProviders: true,
            minMatchScore: quickFilters.matchThreshold,
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
          size: userRecommendationCount || RECOMMENDATION_BATCH_SIZE,
          preloadMatchTexts: true,
          preloadProviders: true,
          minMatchScore: quickFilters.matchThreshold,
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

      if (isMountedRef.current && movies.length > 0) {
        setChatMoviesPool(movies);
        await setCurrentTonightMovie(movies[0], 0, new Set(movies[0] ? [movies[0].id] : []));

        // Background enrichment: call movie-match to get rich personalized teasers.
        // Runs after display so the overlay appears immediately, text updates when ready.
        const moviesToEnrich = movies as RecommendationMovieDetail[];
        const enrichmentThreshold = quickFilters.matchThreshold;
        void (async () => {
          try {
            const enriched = await enrichRecommendationBatchWithTexts(moviesToEnrich, {
              forceRescore: true,
              preloadMatchTexts: true,
            });
            if (!isMountedRef.current) return;

            // Re-filter by threshold now that we have accurate movie-match scores.
            const qualified =
              enrichmentThreshold > 0
                ? enriched.filter((m) => {
                    const score = getRecommendationScore((m as RecommendationMovieDetail).recommendationTexts);
                    return score == null || score >= enrichmentThreshold;
                  })
                : enriched;
            const finalPool = qualified.length > 0 ? qualified : enriched;
            setChatMoviesPool(finalPool);

            // Update movieMatchData with richer text for the overlay's matchInfo fallback
            const richMap: Record<number, RecommendationMatch> = {};
            enriched.forEach((m: any) => {
              const t = m.recommendationTexts;
              const score = getRecommendationScore(t);
              if (m.id && score != null) {
                richMap[m.id] = {
                  confidence: score,
                  reason: t?.summary ?? t?.whyItMatches ?? t?.detailedExplanation ?? t?.reason ?? "",
                };
              }
            });
            if (Object.keys(richMap).length > 0) {
              setMovieMatchData((prev) => ({ ...prev, ...richMap }));
            }
          } catch {
            // Silent fail — keep original text
          }
        })();
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

  const handleAutoPick = () => {
    setShowFindChoice(false);
    setTonightPick(null);
    setChatMoviesPool(null);
    setTonightPickIndex(0);
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

    await handleRejectAndRefresh(tonightPick, "not_my_style");
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      <BrandHeader
        extraActions={
          <QuickFilters filters={quickFilters} onFiltersChange={setQuickFilters} profileDefaults={profileDefaults} />
        }
      />

      {bgImages.map((bg, i) => (
        <motion.div
          key={bg}
          initial={{ opacity: 0 }}
          animate={{ opacity: i === currentBgIndex ? 1 : 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${bg})` }}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/50" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/50 via-transparent to-background/50" />
      <div className="absolute inset-0 bg-background/30" />

      <div className="relative z-10 h-full overflow-y-auto">
        <div className="min-h-[85vh] md:min-h-[80vh] flex flex-col items-center justify-center text-center px-5 pt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-6 md:mb-8"
          >
            <PickCharacter mood="wave" showGreeting size="md" animate />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="w-full max-w-lg px-2"
          >
            <div className="flex flex-col items-center gap-4">
              <motion.button
                data-tour="pick-ce-soir"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setShowFindChoice(true)}
                disabled={loading}
                className="group w-full text-left rounded-2xl p-6 bg-gradient-to-br from-primary/20 via-primary/15 to-accent/10 border-2 border-primary/50 hover:border-primary/70 hover:from-primary/25 transition-all disabled:opacity-50 relative overflow-hidden shadow-[0_0_30px_-8px_hsl(var(--primary)/0.35)]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/30 border border-primary/50 flex items-center justify-center shrink-0 group-hover:bg-primary/40 transition-colors shadow-[0_0_25px_-5px_hsl(var(--primary)/0.4)]">
                    <span className="text-2xl">🎬</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-sans font-bold text-foreground mb-0.5">Trouver mon film</h3>
                    <p className="text-foreground/50 text-[13px] font-sans leading-relaxed">
                      Dis-moi ton mood ou laisse Pick choisir pour ce soir.
                    </p>
                  </div>
                </div>
              </motion.button>

              <a
                href="/app/plan"
                className="text-[12px] font-sans text-foreground/50 hover:text-foreground/80 transition-colors flex items-center gap-1.5"
              >
                📅 Planifier une séance pour plus tard
              </a>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-6 flex flex-col items-center gap-2.5"
            >
              <div className="flex items-center gap-2">
                {[
                  {
                    logo: "https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg",
                    name: "Netflix",
                  },
                  {
                    logo: "https://image.tmdb.org/t/p/original/dQeAar5H991VYporEjUspolDarG.jpg",
                    name: "Prime",
                  },
                  {
                    logo: "https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg",
                    name: "Disney+",
                  },
                  {
                    logo: "https://image.tmdb.org/t/p/original/6uhKBfmtzFqOcLousHwZuzcrScK.jpg",
                    name: "Apple TV+",
                  },
                  {
                    logo: "https://image.tmdb.org/t/p/original/6Q3YKUNA60A4DxOrPaUTDOE4BrU.jpg",
                    name: "Max",
                  },
                ].map((p) => (
                  <img
                    key={p.name}
                    src={p.logo}
                    alt={p.name}
                    className="w-5 h-5 md:w-6 md:h-6 rounded-md object-cover opacity-50"
                    loading="lazy"
                  />
                ))}
              </div>
              <p className="text-muted-foreground/40 text-[10px] md:text-[11px] font-sans">
                Compatible avec toutes les plateformes
              </p>
            </motion.div>
          </motion.div>
        </div>

        <div className="px-5 md:px-12 pb-32">
          <DiscoverySection
            onMovieSelect={onMovieSelect}
            platformIds={userPlatformIds}
            favoriteGenres={userGenres}
            minRating={userMinRating}
            excludedGenres={userExcludedGenres}
          />
        </div>
      </div>

      <HomeScreenChoiceModal
        open={showFindChoice}
        mediaType={quickFilters.mediaType}
        onClose={() => setShowFindChoice(false)}
        onAutoPick={handleAutoPick}
        onOpenChat={() => {
          setShowFindChoice(false);
          onOpenChat();
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
            <div className="absolute inset-0 bg-background/90 backdrop-blur-md" />
            <div className="relative z-10 flex flex-col items-center">
              <PickCharacter mood="think" message={tonightLoadingMsg} size="md" animate />
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
        expectedCount={userRecommendationCount}
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
