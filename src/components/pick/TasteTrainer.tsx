import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Loader2, Sparkles, ArrowRight, SkipForward, Film, Users, Tv, Clapperboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDisplayTitle } from "@/lib/tmdb";
import { recordAcceptedRecommendation, recordSkippedRecommendation } from "@/lib/engagement";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { Movie, MovieDetail } from "@/lib/tmdb";
import { THRESHOLDS } from "./TrainingProgress";
import PeopleTrainer from "./PeopleTrainer";
import FeedbackBadge from "./FeedbackBadge";
import FlipCardDetail from "./FlipCardDetail";
import RecommendationMovieCard from "./RecommendationMovieCard";
import MovieActionBar from "./MovieActionBar";
import { useMovieInteractions } from "@/hooks/use-movie-interactions";

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

interface TasteTrainerProps {
  onClose: () => void;
  isActivation?: boolean;
  onActivationComplete?: () => void;
}

type SelectedCategory = null | "movies" | "series" | "actors" | "directors";

async function fetchTrainingMovies(page: number): Promise<Movie[]> {
  const res = await fetch(
    `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&vote_count.gte=500&vote_average.gte=6&page=${page}&region=FR`,
  );
  const data = await res.json();
  return (data.results || []) as Movie[];
}

async function fetchTrainingSeries(page: number): Promise<Movie[]> {
  const res = await fetch(
    `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&vote_count.gte=200&vote_average.gte=6&page=${page}&watch_region=FR`,
  );
  const data = await res.json();
  return (data.results || []).map((s: any) => ({
    ...s,
    title: s.name,
    release_date: s.first_air_date,
    media_type: "tv",
  })) as Movie[];
}

async function fetchMovieDetail(id: number): Promise<MovieDetail> {
  const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&language=fr-FR`);
  return res.json();
}

async function fetchSeriesDetail(id: number): Promise<MovieDetail> {
  const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}&language=fr-FR`);
  const data = await res.json();
  return {
    ...data,
    title: data.name,
    release_date: data.first_air_date,
    media_type: "tv",
  } as MovieDetail;
}

const CATEGORIES = [
  {
    id: "movies" as const,
    label: "Films",
    icon: Film,
    desc: "Évalue des films pour affiner tes recommandations",
    gradient: "from-primary/20 to-primary/5",
  },
  {
    id: "series" as const,
    label: "Séries TV",
    icon: Tv,
    desc: "Dis-nous quelles séries te plaisent",
    gradient: "from-[hsl(var(--train)/0.20)] to-[hsl(var(--train)/0.05)]",
  },
  {
    id: "actors" as const,
    label: "Acteurs",
    icon: Users,
    desc: "Indique tes acteurs et actrices préférés",
    gradient: "from-[hsl(var(--gold)/0.20)] to-[hsl(var(--gold)/0.05)]",
  },
  {
    id: "directors" as const,
    label: "Réalisateurs",
    icon: Clapperboard,
    desc: "Partage tes réalisateurs favoris",
    gradient: "from-[hsl(var(--surprise)/0.20)] to-[hsl(var(--surprise)/0.05)]",
  },
];

const getPickLevelLabel = (count: number): string => {
  if (count < 5) return "Pick Novice";
  if (count < 12) return "Pick Confirmé";
  if (count < 20) return "Pick Expert";
  return "Pick Maître";
};

const getMilestoneMessage = (count: number): string | null => {
  if (count === 3) return "Ça commence à prendre forme…";
  if (count === 5) return "Pick apprend vite avec toi !";
  if (count === 8) return "On y est presque…";
  if (count === THRESHOLDS.minimum) return "Pick commence à te comprendre";
  if (count === 13) return "Encore quelques-uns pour des recos au top";
  if (count === 15) return "Tes goûts se dessinent clairement";
  if (count === 18) return "Pick affine son radar…";
  if (count === THRESHOLDS.ideal) return "Parfait ! Pick est prêt à te recommander";
  if (count === 25) return "Tu formes un duo de choc avec Pick";
  if (count === 30) return "Pick te connaît par cœur";
  return null;
};

const TasteTrainer = ({ onClose, isActivation = false, onActivationComplete }: TasteTrainerProps) => {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory>(isActivation ? "movies" : null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processedIds, setProcessedIds] = useState<Set<number>>(new Set());
  const allInteractedIds = useRef<Set<number>>(new Set());
  const [likedCount, setLikedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalEvaluated, setTotalEvaluated] = useState(0);
  const [totalPeopleEvaluated, setTotalPeopleEvaluated] = useState(0);
  const [milestoneMsg, setMilestoneMsg] = useState<string | null>(null);
  const [showActivationCTA, setShowActivationCTA] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const [detailMovie, setDetailMovie] = useState<MovieDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [currentMovieDetail, setCurrentMovieDetail] = useState<MovieDetail | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const milestoneTimeout = useRef<ReturnType<typeof setTimeout>>();
  const advancedMovieIdsRef = useRef<Set<number>>(new Set());
  const actionsRef = useRef({ likes: 0, skips: 0 });

  const isSeries = selectedCategory === "series";
  const isMediaCategory = selectedCategory === "movies" || selectedCategory === "series";
  const trainerMediaType: "movie" | "tv" = isSeries ? "tv" : "movie";

  const interactions = useMovieInteractions(
    isMediaCategory
      ? movies.map((movie) => ({
          tmdbId: movie.id,
          mediaType: trainerMediaType,
        }))
      : [],
  );

  const loadMovies = useCallback(
    async (p: number, mode?: string) => {
      const m = mode || selectedCategory;
      setLoading(true);
      try {
        const randomPage = Math.floor(Math.random() * 20) + p;
        const results = m === "series" ? await fetchTrainingSeries(randomPage) : await fetchTrainingMovies(randomPage);
        const filtered = results.filter((mv) => !processedIds.has(mv.id) && !allInteractedIds.current.has(mv.id) && mv.poster_path);
        setMovies((prev) => [...prev, ...filtered]);
      } catch (e) {
        console.error("Failed to load training content:", e);
      } finally {
        setLoading(false);
      }
    },
    [processedIds, selectedCategory],
  );

  useEffect(() => {
    if (!isMediaCategory) return;
    setMovies([]);
    setCurrentIndex(0);
    setHistory([]);
    setPage(1);
    setCurrentMovieDetail(null);
    advancedMovieIdsRef.current = new Set();
    loadMovies(1, selectedCategory!);
  }, [selectedCategory]);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      supabase
        .from("user_interactions")
        .select("tmdb_id")
        .eq("user_id", user.id)
        .in("action_type", ["liked", "skipped", "unsure", "dislike", "already_seen", "unknown"]),
      supabase.from("user_people_preferences").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(async ([movieResult, peopleResult]) => {
      const interactionIds = (movieResult.data || []).map((r: any) => Number(r.tmdb_id)).filter(Boolean);

      // Also exclude items liked/seen via the recommendation flow (user_item_feedback → catalog_items)
      let feedbackTmdbIds: number[] = [];
      try {
        const { data: feedbackData } = await (supabase
          .from("user_item_feedback")
          .select("catalog_items!inner(tmdb_id)")
          .eq("user_id", user.id) as any);
        feedbackTmdbIds = (feedbackData || [])
          .flatMap((r: any) => r.catalog_items ? [Number(r.catalog_items.tmdb_id)] : [])
          .filter(Boolean);
      } catch {}

      const ids = new Set<number>([...interactionIds, ...feedbackTmdbIds]);
      allInteractedIds.current = ids;
      setProcessedIds(new Set(ids));
      setTotalEvaluated(movieResult.data?.length || 0);
      setTotalPeopleEvaluated(peopleResult.count || 0);
    });
  }, [user]);

  useEffect(() => {
    if (!isMediaCategory) return;
    if (movies.length - currentIndex < 3 && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadMovies(nextPage);
    }
  }, [currentIndex, movies.length, loading, page, isMediaCategory]);

  const currentMovie = movies[currentIndex];
  const currentInteraction = currentMovie ? interactions[currentMovie.id] : undefined;
  const totalProcessed = likedCount + skippedCount;
  const baselinePersonalizationCount = totalEvaluated + totalPeopleEvaluated;
  const cumulativeTotal = baselinePersonalizationCount + totalProcessed;
  const sessionTarget = Math.max(0, THRESHOLDS.ideal - baselinePersonalizationCount);
  const sessionProgress = Math.min(totalProcessed, sessionTarget);
  const progressPercent = sessionTarget > 0 ? Math.min(100, Math.round((sessionProgress / sessionTarget) * 100)) : 100;

  useEffect(() => {
    const msg = getMilestoneMessage(cumulativeTotal);
    if (msg) {
      setMilestoneMsg(msg);
      if (milestoneTimeout.current) clearTimeout(milestoneTimeout.current);
      milestoneTimeout.current = setTimeout(() => setMilestoneMsg(null), 3000);
    }
    if (isActivation && cumulativeTotal >= THRESHOLDS.ideal && !showActivationCTA) {
      setShowActivationCTA(true);
      window.dispatchEvent(new Event("pick-activation-refresh"));
    }
  }, [cumulativeTotal, isActivation, showActivationCTA]);

  useEffect(() => {
    if (!currentMovie || !isMediaCategory) {
      setCurrentMovieDetail(null);
      return;
    }

    let cancelled = false;
    setCardLoading(true);

    const loader = async () => {
      try {
        const detail = isSeries ? await fetchSeriesDetail(currentMovie.id) : await fetchMovieDetail(currentMovie.id);
        if (!cancelled) setCurrentMovieDetail(detail);
      } catch (e) {
        console.error("Failed to load current training detail:", e);
        if (!cancelled) setCurrentMovieDetail(currentMovie as unknown as MovieDetail);
      } finally {
        if (!cancelled) setCardLoading(false);
      }
    };

    loader();
    return () => {
      cancelled = true;
    };
  }, [currentMovie?.id, isSeries, isMediaCategory]);

  const advanceAfterTrainingInteraction = useCallback(
    async (mode: "liked" | "skipped") => {
      if (!currentMovie || !user) return;
      if (advancedMovieIdsRef.current.has(currentMovie.id)) return;

      advancedMovieIdsRef.current.add(currentMovie.id);

      if (mode === "liked") {
        setLikedCount((c) => c + 1);
        actionsRef.current.likes += 1;
        await recordAcceptedRecommendation(user.id).catch(() => {});
      } else {
        setSkippedCount((c) => c + 1);
        actionsRef.current.skips += 1;
        await recordSkippedRecommendation(user.id).catch(() => {});
      }

      allInteractedIds.current.add(currentMovie.id);
      setHistory((prev) => [...prev, currentIndex]);
      setProcessedIds((prev) => new Set(prev).add(currentMovie.id));
      setCurrentIndex((i) => i + 1);
    },
    [currentMovie, currentIndex, user],
  );

  const handleTrainerInteraction = useCallback(
    async (type: string) => {
      if (!currentMovie) return;

      if (type === "like") {
        await advanceAfterTrainingInteraction("liked");
        return;
      }

      if (type === "already_seen" || type === "dislike" || type === "unknown") {
        await advanceAfterTrainingInteraction("skipped");
      }
    },
    [currentMovie, advanceAfterTrainingInteraction],
  );

  const handleClose = () => {
    const { likes, skips } = actionsRef.current;
    if (likes + skips > 0) {
      toast.success(`Profil mis à jour ! ${likes} aimé${likes > 1 ? "s" : ""}, ${skips} passé${skips > 1 ? "s" : ""}`);
    }
    onClose();
  };

  const handleActivationDone = () => {
    const { likes, skips } = actionsRef.current;
    if (likes + skips > 0) {
      toast.success(`Pick te connaît maintenant ! ${likes} film${likes > 1 ? "s" : ""} aimé${likes > 1 ? "s" : ""}`);
    }
    window.dispatchEvent(new Event("pick-activation-refresh"));
    onActivationComplete?.();
    onClose();
  };

  const goBack = () => {
    if (history.length === 0) return;
    const prevIndex = history[history.length - 1];
    const prevMovie = movies[prevIndex];
    if (prevMovie) {
      advancedMovieIdsRef.current.delete(prevMovie.id);
    }
    setHistory((prev) => prev.slice(0, -1));
    setCurrentIndex(prevIndex);
  };

  const skipMovie = async () => {
    if (!currentMovie) return;
    await advanceAfterTrainingInteraction("skipped");
  };

  const openMovieDetail = async () => {
    if (!currentMovie) return;
    if (currentMovieDetail) {
      setDetailMovie(currentMovieDetail);
      setDetailOpen(true);
      return;
    }
    try {
      const detail = isSeries ? await fetchSeriesDetail(currentMovie.id) : await fetchMovieDetail(currentMovie.id);
      setCurrentMovieDetail(detail);
      setDetailMovie(detail);
      setDetailOpen(true);
    } catch (e) {
      console.error("Failed to open detail:", e);
    }
  };

  if (selectedCategory === null) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background"
        style={{ minHeight: "100dvh" }}
      >
        <div className="relative z-10 flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-1">
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 text-foreground/40 transition-all hover:bg-foreground/10 hover:text-foreground active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-center text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-foreground/40">
            Entraîne ton Pick
          </h2>
          <div className="w-8" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-5 pb-10">
          <Sparkles className="mb-3 h-7 w-7 text-primary/60" />
          <h3 className="mb-1 text-center text-lg font-serif font-bold text-foreground">Que veux-tu évaluer ?</h3>
          <p className="mb-8 text-center text-[12px] font-sans text-foreground/35 max-w-[260px]">
            Plus tu évalues, plus Pick te comprend et affine ses recommandations.
          </p>

          <div className="grid w-full max-w-[340px] grid-cols-2 gap-3">
            {CATEGORIES.map((cat) => (
              <motion.button
                key={cat.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex flex-col items-center gap-2 rounded-2xl border border-border/20 bg-gradient-to-b ${cat.gradient} p-5 text-center transition-all hover:border-primary/20 active:scale-95`}
              >
                <cat.icon className="h-6 w-6 text-foreground/70" />
                <span className="text-sm font-sans font-semibold text-foreground/90">{cat.label}</span>
                <span className="text-[10px] font-sans leading-snug text-foreground/35">{cat.desc}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  if (selectedCategory === "actors" || selectedCategory === "directors") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background"
        style={{ minHeight: "100dvh" }}
      >
        <div className="relative z-10 flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-1">
          <button
            onClick={() => setSelectedCategory(null)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 text-foreground/40 transition-all hover:bg-foreground/10 hover:text-foreground active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-center text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-foreground/40">
            {selectedCategory === "actors" ? "Acteurs & Actrices" : "Réalisateurs"}
          </h2>
          <button
            onClick={() => setSelectedCategory(null)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 text-foreground/40 transition-all hover:bg-foreground/10 hover:text-foreground active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <PeopleTrainer
          filterDepartment={selectedCategory === "actors" ? "Acting" : "Directing"}
          onBack={() => setSelectedCategory(null)}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background"
      style={{ height: "100dvh" }}
    >
      <div className="relative z-10 flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-1">
        <button
          onClick={() => setSelectedCategory(null)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 text-foreground/40 transition-all hover:bg-foreground/10 hover:text-foreground active:scale-95"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-center text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-foreground/40">
          {isActivation ? "Apprends-moi tes goûts" : isSeries ? "Séries TV" : "Films"}
        </h2>
        <button
          onClick={() => setSelectedCategory(null)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 text-foreground/40 transition-all hover:bg-foreground/10 hover:text-foreground active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative z-10 px-4 pt-1 pb-2">
        <div className="flex items-center gap-3">
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
            <motion.div
              className="h-full rounded-full bg-primary/70"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-sans tabular-nums text-foreground/25">
            {cumulativeTotal} signaux
          </span>
        </div>

        <p className="mt-2 text-center text-[11px] font-sans font-medium text-primary/70">
          {getPickLevelLabel(cumulativeTotal)}
        </p>

        <AnimatePresence mode="wait">
          {milestoneMsg && (
            <motion.p
              key={milestoneMsg}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-2 text-center text-[11px] font-sans font-medium text-primary/70"
            >
              {milestoneMsg}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-3">
        {loading && movies.length === 0 ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
            <p className="text-sm font-sans text-foreground/30">Chargement…</p>
          </div>
        ) : !currentMovie || !currentMovieDetail ? (
          <div className="flex flex-col items-center gap-4 text-center">
            {cardLoading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
                <p className="text-sm font-sans text-foreground/30">Préparation de la vignette…</p>
              </>
            ) : (
              <>
                <Sparkles className="h-8 w-8 text-primary/40" />
                <p className="text-sm font-sans text-foreground/50">
                  {isSeries ? "Plus de séries pour le moment" : "Plus de films pour le moment"}
                </p>
                <Button variant="outline" onClick={() => setSelectedCategory(null)} className="rounded-full text-sm">
                  Retour
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="w-full max-w-3xl">
            <RecommendationMovieCard
              movie={currentMovieDetail}
              contextType="browse"
              showPrimaryAction={false}
              onOpenDetails={openMovieDetail}
              className="min-h-0"
            />
          </div>
        )}
      </div>

      {currentMovie && !showActivationCTA && (
        <div className="relative z-20 border-t border-border/20 bg-background/84 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl shadow-[0_-18px_40px_hsl(var(--background)/0.32)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              onClick={goBack}
              disabled={history.length === 0}
              className="rounded-full bg-foreground/5 p-2 text-foreground/30 transition-all hover:bg-foreground/10 disabled:opacity-20"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-center">
              {currentInteraction?.hasInteraction && (
                <FeedbackBadge
                  type={currentInteraction.primaryStatus}
                  inWatchlist={currentInteraction.watchlist}
                  seen={currentInteraction.seen}
                  size="sm"
                />
              )}
            </div>

            <button
              onClick={skipMovie}
              className="rounded-full bg-foreground/5 p-2 text-foreground/30 transition-all hover:bg-foreground/10"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>

          {currentMovieDetail && (
            <div className="flex items-center justify-center">
              <MovieActionBar
                key={`${currentMovieDetail.id}-${currentIndex}`}
                movie={currentMovieDetail}
                size="md"
                onInteraction={handleTrainerInteraction}
              />
            </div>
          )}

          <button
            onClick={skipMovie}
            className="mt-3 flex w-full items-center justify-center gap-1.5 py-2 text-foreground/30 transition-colors hover:text-foreground/45"
          >
            <SkipForward className="h-3 w-3" />
            <span className="text-[11px] font-sans">Je ne connais pas</span>
          </button>
        </div>
      )}

      <AnimatePresence>
        {showActivationCTA && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 px-5 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))]"
          >
            <div className="rounded-2xl border border-primary/15 bg-card/60 p-6 text-center backdrop-blur-xl">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
                <Sparkles className="mx-auto mb-3 h-7 w-7 text-primary" />
              </motion.div>
              <h3 className="mb-1.5 text-xl font-serif">Pick est prêt</h3>
              <p className="mb-5 text-sm font-sans leading-relaxed text-foreground/40">
                Maintenant qu'on se connaît, trouvons ton film.
              </p>
              <Button variant="hero" size="xl" className="mb-2 w-full" onClick={handleActivationDone}>
                <Sparkles className="h-4 w-4" />
                Trouve-moi un film
                <ArrowRight className="h-4 w-4" />
              </Button>
              <button
                onClick={() => setShowActivationCTA(false)}
                className="py-1 text-xs font-sans text-foreground/20 transition-colors hover:text-foreground/35"
              >
                Continuer à évaluer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <FlipCardDetail
        item={detailMovie}
        type="movie"
        isOpen={detailOpen && !!detailMovie}
        onClose={() => setDetailOpen(false)}
      />
    </motion.div>
  );
};

export default TasteTrainer;
