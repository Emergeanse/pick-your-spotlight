import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mic, Dices, Tv, Sparkles, Loader2, Target, ChevronLeft, ChevronRight } from "lucide-react";

import { getTrendingMovies, getBackdropUrl, getPosterUrl, getDisplayTitle, getWatchProviders } from "@/lib/tmdb";
import { getLikedMovies } from "@/lib/liked-movies";
import { trackInteraction, getUserTasteProfile } from "@/lib/interactions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { computeMultiVectorProfile } from "@/lib/taste-engine";
import {
  extractRecommendationMovies,
  ensureRecommendationBatch,
  RECOMMENDATION_BATCH_SIZE,
} from "@/lib/recommendation-batch";
import { getEngagementData, getProgressionMessage, type EngagementData } from "@/lib/engagement";
import type { Movie, MovieDetail } from "@/lib/tmdb";
import BrandHeader from "./BrandHeader";
import PickCharacter from "./PickCharacter";
import QuickFilters, { type QuickFilterState, type ProfileDefaults } from "./QuickFilters";
import TasteTrainer from "./TasteTrainer";
import DiscoverySection from "./DiscoverySection";
import MovieActionBar from "./MovieActionBar";
import FeedbackBadge from "./FeedbackBadge";
import { getMainCTALabel, getMainCTASubtitle, getAutoPickSubtitle, getTonightPickLabel } from "@/lib/time-context";
import { useMovieInteraction } from "@/hooks/use-movie-interactions";

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

const SURPRISE_MESSAGES = [
  "Je fouille dans mes classiques…",
  "Attends, j'ai un truc en tête…",
  "Tu vas voir, celui-là est dingue.",
  "Presque… je peaufine mon choix.",
  "Hmm, voyons voir…",
  "Laisse-moi une seconde, je tiens quelque chose.",
  "Ooh, j'ai peut-être LA pépite.",
  "Je fais le tri dans mes coups de cœur…",
  "Celui-ci pourrait bien te scotcher.",
  "Patience, la magie opère…",
  "Je consulte ma mémoire cinématographique…",
  "Accroche-toi, ça arrive !",
];

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
  const [isSurprising, setIsSurprising] = useState(false);
  const [surpriseMsg, setSurpriseMsg] = useState("");
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

  const [rejectedIds, setRejectedIds] = useState<number[]>([]);
  const [, setEngagement] = useState<EngagementData | null>(null);
  const [, setProgressionMsg] = useState<string | null>(null);
  const [historyExcludeIds, setHistoryExcludeIds] = useState<number[]>([]);
  const [showTrainer, setShowTrainer] = useState(false);
  const [showFindChoice, setShowFindChoice] = useState(false);
  const [explorationLevel] = useState<number>(5);
  const [totalEvaluated, setTotalEvaluated] = useState(0);
  const [chatMoviesPool, setChatMoviesPool] = useState<MovieDetail[] | null>(null);
  const [movieMatchData, setMovieMatchData] = useState<Record<number, { confidence: number; reason: string }>>({});
  const [tonightPickIndex, setTonightPickIndex] = useState(0);
  const [tonightSeenMovieIds, setTonightSeenMovieIds] = useState<Set<number>>(new Set());
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

  const tonightPool: MovieDetail[] = chatMoviesPool || [];
  const tonightInteraction = useMovieInteraction(tonightPick?.id);
  const canGoPrev = tonightPickIndex > 0;
  const canGoNext = tonightPickIndex < tonightPool.length - 1;
  const tonightAllVisited = tonightSeenMovieIds.size >= tonightPool.length && tonightPool.length > 0;

  const { user } = useAuth();

  const navigateTonightPick = (direction: "prev" | "next") => {
    const newIndex =
      direction === "next" ? Math.min(tonightPickIndex + 1, tonightPool.length - 1) : Math.max(tonightPickIndex - 1, 0);

    if (newIndex === tonightPickIndex) return;

    setTonightPickIndex(newIndex);
    setTonightSeenMovieIds((prev) => {
      const next = new Set(prev);
      const movieId = tonightPool[newIndex]?.id;
      if (movieId) next.add(movieId);
      return next;
    });

    const movie = tonightPool[newIndex];
    setTonightPick(movie);
    setTonightProviders([]);
    const mediaType = movie.first_air_date ? "tv" : "movie";
    getWatchProviders(movie.id, mediaType)
      .then(setTonightProviders)
      .catch(() => {});
  };

  useEffect(() => {
    if (chatSuggestedMovies && chatSuggestedMovies.length > 0) {
      const startIdx = Math.min(chatSuggestedStartIndex, chatSuggestedMovies.length - 1);
      const targetMovie = chatSuggestedMovies[startIdx];

      setChatMoviesPool(chatSuggestedMovies.slice(0, RECOMMENDATION_BATCH_SIZE));
      setTonightPickIndex(startIdx);
      setTonightSeenMovieIds(
        chatSuggestedSeenMovieIds && chatSuggestedSeenMovieIds.size > 0
          ? new Set(chatSuggestedSeenMovieIds)
          : new Set(targetMovie?.id ? [targetMovie.id] : []),
      );
      setTonightPick(targetMovie);
      setTonightProviders([]);

      const mediaType = targetMovie.first_air_date ? "tv" : "movie";
      getWatchProviders(targetMovie.id, mediaType)
        .then(setTonightProviders)
        .catch(() => {});

      onChatSuggestedConsumed?.();
    }
  }, [chatSuggestedMovies, chatSuggestedSeenMovieIds, chatSuggestedStartIndex, onChatSuggestedConsumed]);

  useEffect(() => {
    if (openTrainerOnMount) {
      setShowTrainer(true);
      onTrainerOpened?.();
    }
  }, [openTrainerOnMount, onTrainerOpened]);

  useEffect(() => {
    if (forceCloseTrainer) {
      setShowTrainer(false);
    }
  }, [forceCloseTrainer]);

  useEffect(() => {
    if (!user) return;

    getEngagementData(user.id).then((data) => {
      if (data) {
        setEngagement(data);
        setProgressionMsg(getProgressionMessage(data));
      }
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("profiles")
      .select(
        "preferred_platforms, excluded_platforms, favorite_genres, excluded_genres, min_rating, default_media_type, default_max_duration, match_threshold",
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
        if ((data as any)?.min_rating) setUserMinRating((data as any).min_rating);

        const mt = ((data as any)?.default_media_type as "both" | "movie" | "tv") || "both";
        const md = (data as any)?.default_max_duration ?? null;
        const mth = (data as any)?.match_threshold ?? 80;
        const mr = (data as any)?.min_rating ?? 0;

        setProfileDefaults({
          mediaType: mt,
          maxDuration: md,
          matchThreshold: mth,
          minRating: mr,
        });
        setQuickFilters({
          mediaType: mt,
          maxDuration: md,
          matchThreshold: mth,
          minRating: mr,
        });
      });

    Promise.all([
      supabase
        .from("user_interactions")
        .select("tmdb_id")
        .eq("user_id", user.id)
        .in("action_type", ["watched", "skipped", "already_seen", "liked", "unsure"])
        .limit(500),
      supabase.from("liked_movies").select("tmdb_id").eq("user_id", user.id).limit(500),
      supabase.from("watchlist").select("tmdb_id").eq("user_id", user.id).limit(500),
    ]).then(([interactionsRes, likedRes, watchlistRes]) => {
      const ids = [
        ...(interactionsRes.data || []).map((d) => d.tmdb_id),
        ...(likedRes.data || []).map((d) => d.tmdb_id),
        ...(watchlistRes.data || []).map((d) => d.tmdb_id),
      ];
      const uniqueIds = [...new Set(ids)];
      setHistoryExcludeIds(uniqueIds);
      setTotalEvaluated(uniqueIds.length);
    });
  }, [user]);

  const invokeSurprisePersonalized = async (body: any, retries = 2): Promise<any> => {
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

  const handleSurprise = async () => {
    setIsSurprising(true);

    let msgIndex = 0;
    setSurpriseMsg(SURPRISE_MESSAGES[0]);

    const msgInterval = setInterval(() => {
      msgIndex++;
      if (msgIndex < SURPRISE_MESSAGES.length) {
        setSurpriseMsg(SURPRISE_MESSAGES[msgIndex]);
      }
    }, 500);

    try {
      let batch: MovieDetail[] = [];

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
            outOfComfortZone: true,
            excludeIds: historyExcludeIds,
            count: RECOMMENDATION_BATCH_SIZE,
            minMatchScore: quickFilters.matchThreshold,
          });

          batch = await ensureRecommendationBatch(extractRecommendationMovies(data), {
            excludeIds: historyExcludeIds,
            platformIds: userPlatformIds,
            minRating: userMinRating,
            excludedGenres: userExcludedGenres,
            size: RECOMMENDATION_BATCH_SIZE,
          });

          batch.forEach((movie) => {
            (movie as any)._surpriseComfortZone = true;
          });
        } else {
          batch = await ensureRecommendationBatch([], {
            excludeIds: historyExcludeIds,
            platformIds: userPlatformIds,
            minRating: userMinRating,
            excludedGenres: userExcludedGenres,
            size: RECOMMENDATION_BATCH_SIZE,
          });
        }
      } else {
        batch = await ensureRecommendationBatch([], {
          platformIds: userPlatformIds,
          minRating: userMinRating,
          excludedGenres: userExcludedGenres,
          size: RECOMMENDATION_BATCH_SIZE,
        });
      }

      clearInterval(msgInterval);
      setSurpriseMsg("✨ Trouvé !");
      await new Promise((r) => setTimeout(r, 400));
      onSurprise(batch);
    } catch (e) {
      console.error(e);
    } finally {
      clearInterval(msgInterval);
      setIsSurprising(false);
      setSurpriseMsg("");
    }
  };

  const generateTonightPick = async (
    excludeList: number[] = rejectedIds,
    rejectionContext?: {
      reason: string;
      rejectedGenres: string[];
      rejectedTitle: string;
    },
  ) => {
    const allExcludeIds = [...new Set([...excludeList, ...historyExcludeIds])];
    setTonightLoading(true);
    setTonightProviders([]);

    let msgIndex = 0;
    setTonightLoadingMsg(LOADING_MESSAGES[0]);

    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
      setTonightLoadingMsg(LOADING_MESSAGES[msgIndex]);
    }, 2000);

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
            count: RECOMMENDATION_BATCH_SIZE,
            minMatchScore: quickFilters.matchThreshold,
          });

          movies = await ensureRecommendationBatch(extractRecommendationMovies(data), {
            excludeIds: allExcludeIds,
            platformIds: userPlatformIds,
            minRating: userMinRating,
            excludedGenres: userExcludedGenres,
            size: RECOMMENDATION_BATCH_SIZE,
          });

          const matchMap: Record<number, { confidence: number; reason: string }> = {};
          (data?.movies || []).forEach((m: any) => {
            if (m.movie?.id) {
              matchMap[m.movie.id] = {
                confidence: m.confidence || 75,
                reason: m.reason || "",
              };
            }
          });
          setMovieMatchData((prev) => ({ ...prev, ...matchMap }));
        } else {
          movies = await ensureRecommendationBatch([], {
            excludeIds: allExcludeIds,
            platformIds: userPlatformIds,
            minRating: userMinRating,
            excludedGenres: userExcludedGenres,
            size: RECOMMENDATION_BATCH_SIZE,
          });
        }
      } else {
        movies = await ensureRecommendationBatch([], {
          excludeIds: allExcludeIds,
          platformIds: userPlatformIds,
          minRating: userMinRating,
          excludedGenres: userExcludedGenres,
          size: RECOMMENDATION_BATCH_SIZE,
        });
      }

      clearInterval(msgInterval);

      if (movies.length > 0) {
        setChatMoviesPool(movies);
        setTonightPickIndex(0);
        setTonightSeenMovieIds(new Set(movies[0] ? [movies[0].id] : []));
        setTonightPick(movies[0]);

        const mediaType = movies[0].first_air_date ? "tv" : "movie";
        getWatchProviders(movies[0].id, mediaType)
          .then(setTonightProviders)
          .catch(() => {});
      }
    } catch (e) {
      console.error(e);
      clearInterval(msgInterval);
    } finally {
      setTonightLoading(false);
      setTonightLoadingMsg("");
    }
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
          {!isSurprising && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mb-6 md:mb-8"
            >
              <PickCharacter mood="wave" showGreeting size="md" animate />
            </motion.div>
          )}

          {isSurprising ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <PickCharacter mood="think" message={surpriseMsg} size="md" animate={false} />
            </motion.div>
          ) : (
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
                  disabled={loading || isSurprising}
                  className="group w-full text-left rounded-2xl p-6 bg-gradient-to-br from-primary/20 via-primary/15 to-accent/10 border-2 border-primary/50 hover:border-primary/70 hover:from-primary/25 transition-all disabled:opacity-50 relative overflow-hidden shadow-[0_0_30px_-8px_hsl(var(--primary)/0.35)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-primary/30 border border-primary/50 flex items-center justify-center shrink-0 group-hover:bg-primary/40 transition-colors shadow-[0_0_25px_-5px_hsl(var(--primary)/0.4)]">
                      <span className="text-2xl">🎬</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-sans font-bold text-foreground mb-0.5">{getMainCTALabel()}</h3>
                      <p className="text-foreground/50 text-[13px] font-sans leading-relaxed">{getMainCTASubtitle()}</p>
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

              <AnimatePresence>
                {showFindChoice && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
                    onClick={() => setShowFindChoice(false)}
                  >
                    <motion.div
                      initial={{ y: 100, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 100, opacity: 0 }}
                      transition={{
                        type: "spring",
                        damping: 28,
                        stiffness: 300,
                      }}
                      className="w-full max-w-lg mx-4 mb-8 rounded-2xl bg-card border border-border/50 shadow-2xl p-5 flex flex-col gap-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="text-center text-base font-sans font-semibold text-foreground mb-1">
                        {quickFilters.mediaType === "movie"
                          ? "Tu veux regarder un film ?"
                          : quickFilters.mediaType === "tv"
                            ? "Tu veux regarder une série ?"
                            : "Tu veux regarder quelque chose ?"}
                      </h3>

                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          setShowFindChoice(false);
                          setTonightPick(null);
                          setChatMoviesPool(null);
                          setTonightPickIndex(0);
                          generateTonightPick(rejectedIds);
                        }}
                        className="group w-full text-left rounded-xl p-4 bg-primary/10 border border-primary/30 hover:border-primary/50 hover:bg-primary/15 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/25 border border-primary/40 flex items-center justify-center shrink-0">
                            <span className="text-lg">🍿</span>
                          </div>
                          <div>
                            <h4 className="text-sm font-sans font-semibold text-foreground">
                              Laisse-moi choisir pour toi !
                            </h4>
                            <p className="text-foreground/45 text-xs font-sans">{getAutoPickSubtitle()}</p>
                          </div>
                        </div>
                      </motion.button>

                      <motion.button
                        data-tour="parle-a-pick"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          setShowFindChoice(false);
                          onOpenChat();
                        }}
                        className="group w-full text-left rounded-xl p-4 bg-primary/10 border border-primary/30 hover:border-primary/50 hover:bg-primary/15 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/25 border border-primary/40 flex items-center justify-center shrink-0">
                            <Mic className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="text-sm font-sans font-semibold text-foreground">
                              Décris-moi ce que tu voudrais !
                            </h4>
                            <p className="text-foreground/45 text-xs font-sans">
                              Dis-moi ce que tu veux ou comment tu te sens.
                            </p>
                          </div>
                        </div>
                      </motion.button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

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
          )}
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

      <AnimatePresence>
        {tonightPick && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col"
          >
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: `url(${
                  getBackdropUrl(tonightPick.backdrop_path) || getPosterUrl(tonightPick.poster_path, "w780")
                })`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/50" />

            <div className="relative z-10 flex justify-between items-center px-5 pt-[calc(1rem+env(safe-area-inset-top))]">
              <button
                onClick={() => setTonightPick(null)}
                className="text-foreground/50 hover:text-foreground text-xs font-sans transition-colors"
              >
                ← Retour
              </button>
            </div>

            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-[calc(5rem+env(safe-area-inset-bottom))]">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col items-center text-center max-w-sm"
              >
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/25 mb-3">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-primary text-[11px] font-sans font-semibold">{getTonightPickLabel()}</span>
                </div>

                {tonightPick.poster_path && (
                  <div className="relative flex items-center gap-3 mb-3">
                    <button
                      onClick={() => navigateTonightPick("prev")}
                      disabled={!canGoPrev}
                      className="w-10 h-10 rounded-full bg-card/60 backdrop-blur-md border border-border/30 flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                    >
                      <ChevronLeft className="w-5 h-5 text-foreground" />
                    </button>

                    <motion.img
                      key={tonightPick.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        duration: 0.3,
                        type: "spring",
                        stiffness: 200,
                      }}
                      src={getPosterUrl(tonightPick.poster_path, "w342") || ""}
                      alt={getDisplayTitle(tonightPick)}
                      className="w-32 h-48 md:w-40 md:h-56 rounded-xl object-cover shadow-2xl border border-border/20 cursor-pointer active:scale-95 transition-transform"
                      onClick={() => {
                        const moviesToPass =
                          chatMoviesPool && chatMoviesPool.length > 0 ? chatMoviesPool : [tonightPick];
                        onSurprise(moviesToPass, tonightPickIndex, tonightSeenMovieIds);
                      }}
                    />

                    {tonightInteraction.hasInteraction && (
                      <div className="absolute top-2 left-14 md:left-16">
                        <FeedbackBadge
                          type={tonightInteraction.primaryStatus}
                          inWatchlist={tonightInteraction.watchlist}
                          size="sm"
                        />
                      </div>
                    )}

                    <button
                      onClick={() => navigateTonightPick("next")}
                      disabled={!canGoNext}
                      className="w-10 h-10 rounded-full bg-card/60 backdrop-blur-md border border-border/30 flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                    >
                      <ChevronRight className="w-5 h-5 text-foreground" />
                    </button>
                  </div>
                )}

                <p className="text-foreground text-sm font-sans font-semibold tabular-nums px-3 py-1 rounded-full bg-card/60 backdrop-blur-md border border-border/30 shadow-lg mb-2">
                  {tonightPickIndex + 1} / {tonightPool.length || RECOMMENDATION_BATCH_SIZE}
                </p>

                <h2 className="text-lg md:text-xl font-serif text-foreground mb-0.5">{getDisplayTitle(tonightPick)}</h2>

                {tonightPick.genres && (
                  <p className="text-primary/60 text-[10px] tracking-[0.12em] uppercase font-sans font-medium mb-2">
                    {tonightPick.genres.map((g) => g.name).join(" · ")}
                  </p>
                )}

                {tonightProviders.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-foreground/30 text-[10px] font-sans">Dispo sur</span>
                    <div className="flex gap-1.5">
                      {tonightProviders.map((p) => (
                        <img
                          key={p.name}
                          src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                          alt={p.name}
                          className="w-5 h-5 rounded-md object-cover border border-border/20"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {(() => {
                  const matchInfo = movieMatchData[tonightPick.id];

                  if (matchInfo?.confidence) {
                    return (
                      <div className="flex flex-col items-center gap-1.5 mb-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                          <Target className="w-3 h-3 text-primary/70" />
                          <span className="text-primary/90 text-[12px] font-sans font-semibold">
                            {matchInfo.confidence}% match
                          </span>
                        </div>
                        {matchInfo.reason && (
                          <p className="text-foreground/50 text-[11px] font-sans text-center leading-snug max-w-[260px]">
                            {matchInfo.reason}
                          </p>
                        )}
                      </div>
                    );
                  }

                  return (
                    <p className="text-foreground/40 text-[12px] font-sans italic mb-3">
                      Pick pense que {tonightPick.first_air_date ? "cette série est parfaite" : "ce film est parfait"}{" "}
                      pour toi.
                    </p>
                  );
                })()}

                <div className="flex flex-col items-center gap-4 w-full">
                  <Button
                    size="lg"
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold px-8 h-12 gap-2 text-base neon-glow transition-all active:scale-[0.97] w-full max-w-xs"
                    onClick={() => {
                      const moviesToPass = chatMoviesPool && chatMoviesPool.length > 0 ? chatMoviesPool : [tonightPick];
                      onSurprise(moviesToPass, tonightPickIndex, tonightSeenMovieIds);
                    }}
                  >
                    <Tv className="w-5 h-5" />
                    On regarde ?
                  </Button>

                  <MovieActionBar
                    key={tonightPick.id}
                    movie={tonightPick}
                    onInteraction={(type) => {
                      if (!tonightPick) return;

                      if (type === "already_seen" || type === "dislike") {
                        const nextRejected = [...rejectedIds, tonightPick.id];
                        setRejectedIds(nextRejected);

                        const allRejected = tonightPool.every((m) => nextRejected.includes(m.id));

                        if (allRejected) {
                          const rejContext = {
                            reason: type === "already_seen" ? "seen" : "not_my_style",
                            rejectedGenres: (tonightPick.genres || []).map((g) => g.name),
                            rejectedTitle: getDisplayTitle(tonightPick),
                          };
                          setTonightPick(null);
                          setChatMoviesPool(null);
                          setTonightPickIndex(0);
                          generateTonightPick(nextRejected, rejContext);
                          return;
                        }

                        if (tonightPool.length > 1 && tonightPickIndex < tonightPool.length - 1) {
                          const newIndex = tonightPickIndex + 1;
                          setTonightPickIndex(newIndex);
                          const nextMovie = tonightPool[newIndex];
                          setTonightPick(nextMovie);
                          setTonightProviders([]);
                          const mediaType = nextMovie.first_air_date ? "tv" : "movie";
                          getWatchProviders(nextMovie.id, mediaType)
                            .then(setTonightProviders)
                            .catch(() => {});
                        } else if (tonightPickIndex > 0) {
                          const newIndex = tonightPickIndex - 1;
                          setTonightPickIndex(newIndex);
                          const prevMovie = tonightPool[newIndex];
                          setTonightPick(prevMovie);
                          setTonightProviders([]);
                          const mediaType = prevMovie.first_air_date ? "tv" : "movie";
                          getWatchProviders(prevMovie.id, mediaType)
                            .then(setTonightProviders)
                            .catch(() => {});
                        }
                      }
                    }}
                  />

                  <div className="flex flex-col items-center gap-1.5 mt-2">
                    <button
                      onClick={() => {
                        if (!tonightPick) return;

                        trackInteraction(tonightPick.id, "skipped", {
                          reason: "not_my_style",
                          genres: (tonightPick.genres || []).map((g) => g.name),
                        });

                        const nextRejected = [...rejectedIds, tonightPick.id];
                        const rejContext = {
                          reason: "not_my_style",
                          rejectedGenres: (tonightPick.genres || []).map((g) => g.name),
                          rejectedTitle: getDisplayTitle(tonightPick),
                        };

                        setRejectedIds(nextRejected);
                        setTonightPick(null);
                        setChatMoviesPool(null);
                        setTonightPickIndex(0);
                        setTonightSeenMovieIds(new Set());
                        generateTonightPick(nextRejected, rejContext);
                      }}
                      disabled={tonightLoading || !tonightAllVisited}
                      className={`text-[12px] font-sans transition-all flex items-center gap-1.5 ${
                        tonightAllVisited
                          ? "text-foreground/40 hover:text-foreground/60"
                          : "text-foreground/20 cursor-not-allowed"
                      } disabled:opacity-50`}
                    >
                      {tonightLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Dices className="w-3 h-3" />}5
                      autres suggestions
                    </button>

                    {!tonightAllVisited && tonightPool.length > 0 && (
                      <p className="text-foreground/25 text-[10px] font-sans text-center">
                        Parcourez les {tonightPool.length} films pour débloquer ({tonightSeenMovieIds.size}/
                        {tonightPool.length})
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTrainer && (
          <TasteTrainer
            isActivation={activationTrainerMode}
            onActivationComplete={onActivationTrainingComplete}
            onClose={() => {
              setShowTrainer(false);

              if (user) {
                supabase
                  .from("user_interactions")
                  .select("tmdb_id")
                  .eq("user_id", user.id)
                  .in("action_type", ["watched", "skipped", "already_seen", "liked", "unsure"])
                  .limit(500)
                  .then(({ data }) => {
                    if (data) {
                      setTotalEvaluated([...new Set(data.map((d) => d.tmdb_id))].length);
                    }
                  });
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default HomeScreen;
