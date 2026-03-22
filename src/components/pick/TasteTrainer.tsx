import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, Sparkles, ArrowRight, SkipForward, Film, Users, Tv, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPosterUrl, getDisplayTitle } from "@/lib/tmdb";
import { likeMovie } from "@/lib/liked-movies";
import { trackInteraction } from "@/lib/interactions";
import { recordAcceptedRecommendation, recordSkippedRecommendation } from "@/lib/engagement";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { Movie, MovieDetail } from "@/lib/tmdb";
import { THRESHOLDS } from "./TrainingProgress";
import FlipCardBack from "./FlipCardBack";
import PeopleTrainer from "./PeopleTrainer";

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

interface TasteTrainerProps {
  onClose: () => void;
  isActivation?: boolean;
  onActivationComplete?: () => void;
}

type SelectedCategory = null | "movies" | "series" | "actors" | "directors";

const GENRE_MAP: Record<number, string> = {
  28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie", 80: "Crime",
  99: "Documentaire", 18: "Drame", 10751: "Famille", 14: "Fantastique",
  36: "Histoire", 27: "Horreur", 10402: "Musique", 9648: "Mystère",
  10749: "Romance", 878: "Science-Fiction", 53: "Thriller", 10752: "Guerre", 37: "Western",
};

const TV_GENRE_MAP: Record<number, string> = {
  10759: "Action", 16: "Animation", 35: "Comédie", 80: "Crime",
  99: "Documentaire", 18: "Drame", 10751: "Famille", 10762: "Enfants",
  9648: "Mystère", 10763: "Actualités", 10764: "Téléréalité",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "Guerre & Politique", 37: "Western",
};

async function fetchTrainingMovies(page: number): Promise<Movie[]> {
  const res = await fetch(
    `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&vote_count.gte=500&vote_average.gte=6&page=${page}&region=FR`
  );
  const data = await res.json();
  return (data.results || []) as Movie[];
}

async function fetchTrainingSeries(page: number): Promise<Movie[]> {
  const res = await fetch(
    `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&vote_count.gte=200&vote_average.gte=6&page=${page}&watch_region=FR`
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
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&language=fr-FR`
  );
  return res.json();
}

const RATING_BUTTONS = [
  { value: 5, label: "Pas pour moi",
    toneClass: "bg-[hsl(var(--destructive)/0.18)] border-[hsl(var(--destructive)/0.34)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.28)] shadow-[0_12px_32px_hsl(var(--destructive)/0.12)]" },
  { value: 25, label: "Bof",
    toneClass: "bg-[hsl(var(--surprise)/0.18)] border-[hsl(var(--surprise)/0.32)] text-[hsl(var(--surprise))] hover:bg-[hsl(var(--surprise)/0.28)] shadow-[0_12px_32px_hsl(var(--surprise)/0.10)]" },
  { value: 50, label: "Correct",
    toneClass: "bg-[hsl(var(--gold)/0.16)] border-[hsl(var(--gold)/0.30)] text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold)/0.24)] shadow-[0_12px_32px_hsl(var(--gold)/0.10)]" },
  { value: 75, label: "J'aime bien",
    toneClass: "bg-[hsl(var(--train)/0.18)] border-[hsl(var(--train)/0.30)] text-[hsl(var(--train))] hover:bg-[hsl(var(--train)/0.26)] shadow-[0_12px_32px_hsl(var(--train)/0.10)]" },
  { value: 100, label: "Chef-d'œuvre",
    toneClass: "bg-[hsl(var(--primary)/0.18)] border-[hsl(var(--primary)/0.30)] text-primary hover:bg-[hsl(var(--primary)/0.26)] shadow-[0_12px_32px_hsl(var(--primary)/0.14)]" },
];

const CATEGORIES = [
  { id: "movies" as const, label: "Films", icon: Film, desc: "Évalue des films pour affiner tes recommandations", gradient: "from-primary/20 to-primary/5" },
  { id: "series" as const, label: "Séries TV", icon: Tv, desc: "Dis-nous quelles séries te plaisent", gradient: "from-[hsl(var(--train)/0.20)] to-[hsl(var(--train)/0.05)]" },
  { id: "actors" as const, label: "Acteurs", icon: Users, desc: "Indique tes acteurs et actrices préférés", gradient: "from-[hsl(var(--gold)/0.20)] to-[hsl(var(--gold)/0.05)]" },
  { id: "directors" as const, label: "Réalisateurs", icon: Clapperboard, desc: "Partage tes réalisateurs favoris", gradient: "from-[hsl(var(--surprise)/0.20)] to-[hsl(var(--surprise)/0.05)]" },
];

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
  const [swiping, setSwiping] = useState<"left" | "right" | null>(null);
  const [processedIds, setProcessedIds] = useState<Set<number>>(new Set());
  const [likedCount, setLikedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalEvaluated, setTotalEvaluated] = useState(0);
  const [sliderValue, setSliderValue] = useState(50);
  const [milestoneMsg, setMilestoneMsg] = useState<string | null>(null);
  const [showActivationCTA, setShowActivationCTA] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const [flipped, setFlipped] = useState(false);
  const milestoneTimeout = useRef<ReturnType<typeof setTimeout>>();
  const x = useMotionValue(0);

  const isSeries = selectedCategory === "series";
  const genreMap = isSeries ? TV_GENRE_MAP : GENRE_MAP;
  const isMediaCategory = selectedCategory === "movies" || selectedCategory === "series";

  const loadMovies = useCallback(async (p: number, mode?: string) => {
    const m = mode || selectedCategory;
    setLoading(true);
    try {
      const randomPage = Math.floor(Math.random() * 20) + p;
      const results = m === "series"
        ? await fetchTrainingSeries(randomPage)
        : await fetchTrainingMovies(randomPage);
      const filtered = results.filter(mv => !processedIds.has(mv.id) && mv.poster_path);
      setMovies(prev => [...prev, ...filtered]);
    } catch (e) {
      console.error("Failed to load training content:", e);
    } finally {
      setLoading(false);
    }
  }, [processedIds, selectedCategory]);

  useEffect(() => {
    if (!isMediaCategory) return;
    setMovies([]);
    setCurrentIndex(0);
    setHistory([]);
    setFlipped(false);
    setPage(1);
    loadMovies(1, selectedCategory!);
  }, [selectedCategory]);

  useEffect(() => {
    if (user) {
      supabase.from("user_interactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("action_type", ["liked", "skipped", "unsure"])
        .then(({ count }) => setTotalEvaluated(count || 0));
    }
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
  const nextMovie = movies[currentIndex + 1];
  const actionsRef = useRef({ likes: 0, skips: 0 });

  const totalProcessed = likedCount + skippedCount;
  const cumulativeTotal = totalEvaluated + totalProcessed;
  const sessionTarget = Math.max(0, THRESHOLDS.ideal - totalEvaluated);
  const sessionProgress = Math.min(totalProcessed, sessionTarget);

  const rotate = useTransform(x, [-200, 0, 200], [-8, 0, 8]);
  const likeOpacity = useTransform(x, [0, 80, 200], [0, 0.6, 1]);
  const skipOpacity = useTransform(x, [-200, -80, 0], [1, 0.6, 0]);

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

  const handleRate = async (overrideValue?: number) => {
    if (!currentMovie || !user) return;
    const rating = overrideValue ?? sliderValue;
    const isPositive = rating > 50;
    const actionType = rating <= 50 ? "skipped" : "liked";

    setSwiping(isPositive ? "right" : "left");

    try {
      const genres = (currentMovie.genre_ids || []).map(gid => genreMap[gid]).filter(Boolean);
      const source = isSeries ? "taste_trainer_series" : "taste_trainer";
      if (rating > 50) {
        if (!isSeries) {
          const detail = await fetchMovieDetail(currentMovie.id);
          await likeMovie(detail);
        }
        await trackInteraction(currentMovie.id, actionType, { source, genres, rating, media_type: isSeries ? "tv" : "movie" });
        await recordAcceptedRecommendation(user.id);
        setLikedCount(c => c + 1);
        actionsRef.current.likes++;
      } else {
        await trackInteraction(currentMovie.id, actionType, { source, genres, rating, media_type: isSeries ? "tv" : "movie" });
        await recordSkippedRecommendation(user.id);
        setSkippedCount(c => c + 1);
        actionsRef.current.skips++;
      }
    } catch (e) {
      console.error("Failed to rate:", e);
    }

    setHistory(prev => [...prev, currentIndex]);
    setProcessedIds(prev => new Set(prev).add(currentMovie.id));
    setTimeout(() => {
      setSwiping(null);
      setSliderValue(50);
      setFlipped(false);
      setCurrentIndex(i => i + 1);
      x.set(0);
    }, 300);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100) handleRate(80);
    else if (info.offset.x < -100) handleRate(15);
  };

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
    setHistory(prev => prev.slice(0, -1));
    setCurrentIndex(prevIndex);
    setFlipped(false);
    x.set(0);
  };

  const skipMovie = () => {
    if (!currentMovie) return;
    setHistory(prev => [...prev, currentIndex]);
    setProcessedIds(prev => new Set(prev).add(currentMovie.id));
    setCurrentIndex(i => i + 1);
    setFlipped(false);
    x.set(0);
  };

  const progressPercent = sessionTarget > 0
    ? Math.min(100, Math.round((sessionProgress / sessionTarget) * 100))
    : 100;

  // Landing menu when no category selected
  if (selectedCategory === null) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col overflow-y-auto overscroll-contain bg-background"
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
          <h3 className="mb-1 text-center text-lg font-serif font-bold text-foreground">
            Que veux-tu évaluer ?
          </h3>
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

  // People categories (actors or directors)
  if (selectedCategory === "actors" || selectedCategory === "directors") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col overflow-y-auto overscroll-contain bg-background"
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
          <div className="w-8" />
        </div>
        <PeopleTrainer
          filterDepartment={selectedCategory === "actors" ? "Acting" : "Directing"}
          onBack={() => setSelectedCategory(null)}
        />
      </motion.div>
    );
  }

  // Movies / Series swipe flow
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col overflow-y-auto overscroll-contain bg-background"
      style={{ minHeight: "100dvh" }}
    >
      {/* Header */}
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
        <div className="w-8" />
      </div>

      {/* Progress bar */}
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
            {cumulativeTotal} évalué{cumulativeTotal > 1 ? "s" : ""}
          </span>
        </div>

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

      {/* Movie card area */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 py-3">
        {loading && movies.length === 0 ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
            <p className="text-sm font-sans text-foreground/30">Chargement…</p>
          </div>
        ) : !currentMovie ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <Sparkles className="h-8 w-8 text-primary/40" />
            <p className="text-sm font-sans text-foreground/50">{isSeries ? "Plus de séries pour le moment" : "Plus de films pour le moment"}</p>
            <Button variant="outline" onClick={() => setSelectedCategory(null)} className="rounded-full text-sm">Retour</Button>
          </div>
        ) : (
          <div className="relative mx-auto w-full max-w-[320px]" style={{ width: "min(72vw, 34vh, 320px)", perspective: "1200px" }}>
            {nextMovie && !flipped && (
              <div className="absolute inset-0 -z-10">
                <div className="h-full w-full translate-y-3 scale-[0.94] overflow-hidden rounded-[1.75rem] border border-white/10 opacity-50 aspect-[2/3]">
                  <img src={getPosterUrl(nextMovie.poster_path, "w342")} alt="" className="h-full w-full object-cover brightness-[1.2] saturate-[1.2]" />
                </div>
              </div>
            )}

            <AnimatePresence mode="popLayout">
              <motion.div
                key={currentMovie.id}
                drag={flipped ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragEnd={handleDragEnd}
                animate={
                  swiping === "right" ? { x: 400, opacity: 0, rotate: 15 } :
                  swiping === "left" ? { x: -400, opacity: 0, rotate: -15 } : {}
                }
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={swiping ? { duration: 0.3, ease: "easeOut" } : { type: "spring", stiffness: 260, damping: 24 }}
                className="relative aspect-[2/3] w-full select-none"
                style={{ x, rotate: flipped ? 0 : rotate, touchAction: "none" }}
                onClick={() => !swiping && setFlipped(f => !f)}
              >
                {!flipped ? (
                  <div className="absolute inset-0 rounded-[1.75rem] overflow-hidden shadow-[0_24px_80px_hsl(var(--background)/0.72)] cursor-pointer">
                    <img
                      src={getPosterUrl(currentMovie.poster_path, "w780")}
                      alt={getDisplayTitle(currentMovie)}
                      className="absolute inset-0 h-full w-full object-cover brightness-[1.3] contrast-[1.08] saturate-[1.3]"
                      draggable={false}
                    />
                    <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-white/10" />

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/38 to-transparent px-5 pt-24 pb-5">
                      <h3 className="mb-1.5 text-xl font-serif font-bold leading-[1.05] text-white drop-shadow-md">
                        {getDisplayTitle(currentMovie)}
                      </h3>
                      <div className="mb-2.5 flex items-center gap-3 text-xs font-sans text-white/70">
                        {currentMovie.vote_average > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="text-primary">★</span>
                            {currentMovie.vote_average.toFixed(1)}
                          </span>
                        )}
                        {currentMovie.release_date && (
                          <span>{currentMovie.release_date.substring(0, 4)}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(currentMovie.genre_ids || []).slice(0, 3).map(gid => genreMap[gid]).filter(Boolean).map(g => (
                          <span key={g} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-sans text-white/70 backdrop-blur-sm">{g}</span>
                        ))}
                      </div>
                    </div>

                    <div className="absolute top-3 right-3 rounded-full bg-background/30 px-2 py-1 backdrop-blur-sm">
                      <span className="text-[9px] font-sans text-white/50">Tap pour détails</span>
                    </div>

                    <motion.div className="absolute top-5 left-5 z-30 rounded-xl border-2 border-[hsl(var(--destructive)/0.6)] px-4 py-2 -rotate-12" style={{ opacity: skipOpacity }}>
                      <span className="text-sm font-sans font-bold tracking-wide text-[hsl(var(--destructive))]">PASSE</span>
                    </motion.div>
                    <motion.div className="absolute top-5 right-5 z-30 rounded-xl border-2 border-[hsl(var(--train)/0.6)] px-4 py-2 rotate-12" style={{ opacity: likeOpacity }}>
                      <span className="text-sm font-sans font-bold tracking-wide text-[hsl(var(--train))]">J'AIME</span>
                    </motion.div>
                  </div>
                ) : (
                  <div className="absolute inset-0 rounded-[1.75rem] overflow-hidden border border-border/20 bg-background shadow-[0_24px_80px_hsl(var(--background)/0.72)]">
                    <FlipCardBack item={currentMovie} type={isSeries ? "tv" : "movie"} />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation arrows */}
            {!flipped && (
              <>
                <div className="absolute inset-y-0 -left-10 flex items-center">
                  <button
                    onClick={goBack}
                    disabled={history.length === 0}
                    className="rounded-full bg-foreground/5 p-1.5 text-foreground/30 transition-all hover:bg-foreground/10 disabled:opacity-20"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                </div>
                <div className="absolute inset-y-0 -right-10 flex items-center">
                  <button
                    onClick={skipMovie}
                    className="rounded-full bg-foreground/5 p-1.5 text-foreground/30 transition-all hover:bg-foreground/10"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Rating buttons */}
      {currentMovie && !showActivationCTA && (
        <div className="relative z-20 border-t border-border/20 bg-background/84 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl shadow-[0_-18px_40px_hsl(var(--background)/0.32)]">
          <div className="grid grid-cols-5 gap-1.5">
            {RATING_BUTTONS.map((btn) => (
              <motion.button
                key={btn.value}
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  setSliderValue(btn.value);
                  setTimeout(() => handleRate(btn.value), 100);
                }}
                className={`min-h-11 rounded-xl border px-1 py-3 text-center font-sans text-[11px] font-medium leading-tight transition-all active:scale-95 ${btn.toneClass}`}
              >
                {btn.label}
              </motion.button>
            ))}
          </div>

          <button
            onClick={skipMovie}
            className="mt-3 flex w-full items-center justify-center gap-1.5 py-2 text-foreground/30 transition-colors hover:text-foreground/45"
          >
            <SkipForward className="h-3 w-3" />
            <span className="text-[11px] font-sans">Je ne connais pas</span>
          </button>
        </div>
      )}

      {/* Activation CTA */}
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
    </motion.div>
  );
};

export default TasteTrainer;
