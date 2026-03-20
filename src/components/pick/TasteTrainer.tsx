import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { ChevronLeft, Loader2, Sparkles, ArrowRight, SkipForward } from "lucide-react";
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

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

interface TasteTrainerProps {
  onClose: () => void;
  isActivation?: boolean;
  onActivationComplete?: () => void;
}

const GENRE_MAP: Record<number, string> = {
  28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie", 80: "Crime",
  99: "Documentaire", 18: "Drame", 10751: "Famille", 14: "Fantastique",
  36: "Histoire", 27: "Horreur", 10402: "Musique", 9648: "Mystère",
  10749: "Romance", 878: "Science-Fiction", 53: "Thriller", 10752: "Guerre", 37: "Western",
};

async function fetchTrainingMovies(page: number): Promise<Movie[]> {
  const res = await fetch(
    `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&vote_count.gte=500&vote_average.gte=6&page=${page}`
  );
  const data = await res.json();
  return (data.results || []) as Movie[];
}

async function fetchMovieDetail(id: number): Promise<MovieDetail> {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&language=fr-FR`
  );
  return res.json();
}

const RATING_BUTTONS = [
  { value: 5,   label: "Pas pour moi", sentiment: "negative" as const },
  { value: 25,  label: "Bof",          sentiment: "neutral" as const },
  { value: 50,  label: "Correct",      sentiment: "neutral" as const },
  { value: 75,  label: "J'aime bien",  sentiment: "positive" as const },
  { value: 100, label: "Chef-d'œuvre", sentiment: "positive" as const },
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
  const milestoneTimeout = useRef<ReturnType<typeof setTimeout>>();
  const x = useMotionValue(0);

  const loadMovies = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const randomPage = Math.floor(Math.random() * 20) + p;
      const results = await fetchTrainingMovies(randomPage);
      const filtered = results.filter(m => !processedIds.has(m.id) && m.poster_path);
      setMovies(prev => [...prev, ...filtered]);
    } catch (e) {
      console.error("Failed to load training movies:", e);
    } finally {
      setLoading(false);
    }
  }, [processedIds]);

  useEffect(() => {
    loadMovies(1);
    if (user) {
      supabase.from("user_interactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("action_type", ["liked", "skipped", "unsure"])
        .then(({ count }) => setTotalEvaluated(count || 0));
    }
  }, []);

  useEffect(() => {
    if (movies.length - currentIndex < 3 && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadMovies(nextPage);
    }
  }, [currentIndex, movies.length, loading, page]);

  const currentMovie = movies[currentIndex];
  const nextMovie = movies[currentIndex + 1];
  const actionsRef = useRef({ likes: 0, skips: 0 });

  const totalProcessed = likedCount + skippedCount;
  const cumulativeTotal = totalEvaluated + totalProcessed;
  const sessionTarget = Math.max(0, THRESHOLDS.ideal - totalEvaluated);
  const sessionProgress = Math.min(totalProcessed, sessionTarget);

  // Derived motion values for swipe feedback
  const rotate = useTransform(x, [-200, 0, 200], [-8, 0, 8]);
  const likeOpacity = useTransform(x, [0, 80, 200], [0, 0.6, 1]);
  const skipOpacity = useTransform(x, [-200, -80, 0], [1, 0.6, 0]);
  const bgGlow = useTransform(x, [-200, 0, 200], [
    "radial-gradient(circle at 30% 50%, hsl(var(--destructive) / 0.08) 0%, transparent 70%)",
    "radial-gradient(circle at 50% 40%, hsl(var(--primary) / 0.06) 0%, transparent 70%)",
    "radial-gradient(circle at 70% 50%, hsl(var(--primary) / 0.12) 0%, transparent 70%)",
  ]);

  useEffect(() => {
    const msg = getMilestoneMessage(cumulativeTotal);
    if (msg) {
      setMilestoneMsg(msg);
      if (milestoneTimeout.current) clearTimeout(milestoneTimeout.current);
      milestoneTimeout.current = setTimeout(() => setMilestoneMsg(null), 3000);
    }
    if (isActivation && cumulativeTotal >= THRESHOLDS.ideal && !showActivationCTA) {
      setShowActivationCTA(true);
    }
  }, [cumulativeTotal]);

  const handleRate = async (overrideValue?: number) => {
    if (!currentMovie || !user) return;
    const rating = overrideValue ?? sliderValue;
    const isPositive = rating > 50;
    const actionType = rating <= 50 ? "skipped" : "liked";

    setSwiping(isPositive ? "right" : "left");

    try {
      const genres = (currentMovie.genre_ids || []).map(gid => GENRE_MAP[gid]).filter(Boolean);
      if (rating > 50) {
        const detail = await fetchMovieDetail(currentMovie.id);
        await likeMovie(detail);
        await trackInteraction(currentMovie.id, actionType, { source: "taste_trainer", genres, rating });
        await recordAcceptedRecommendation(user.id);
        setLikedCount(c => c + 1);
        actionsRef.current.likes++;
      } else {
        await trackInteraction(currentMovie.id, actionType, { source: "taste_trainer", genres: genres.join(","), rating });
        await recordSkippedRecommendation(user.id);
        setSkippedCount(c => c + 1);
        actionsRef.current.skips++;
      }
    } catch (e) {
      console.error("Failed to rate:", e);
    }

    setProcessedIds(prev => new Set(prev).add(currentMovie.id));
    setTimeout(() => {
      setSwiping(null);
      setSliderValue(50);
      setCurrentIndex(i => i + 1);
      x.set(0);
    }, 300);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100) {
      handleRate(80);
    } else if (info.offset.x < -100) {
      handleRate(15);
    }
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
    onActivationComplete?.();
    onClose();
  };

  const progressPercent = sessionTarget > 0
    ? Math.min(100, Math.round((sessionProgress / sessionTarget) * 100))
    : 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col bg-background overflow-hidden"
    >
      {/* Dynamic ambient background */}
      <motion.div className="absolute inset-0 pointer-events-none" style={{ background: bgGlow }} />

      {/* Header — minimal */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-1">
        <button onClick={handleClose}
          className="w-8 h-8 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/40 hover:text-foreground hover:bg-foreground/10 transition-all active:scale-95">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xs font-sans font-medium text-foreground/40 uppercase tracking-[0.15em]">
          {isActivation ? "Apprends-moi tes goûts" : "Entraîne ton Pick"}
        </h2>
        <div className="w-8" />
      </div>

      {/* Progress — compact inline */}
      <div className="relative z-10 px-5 pt-2 pb-1">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-[3px] rounded-full bg-foreground/[0.06] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary/70"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="text-[11px] font-sans tabular-nums text-foreground/25 shrink-0">
            {cumulativeTotal} évalué{cumulativeTotal > 1 ? "s" : ""}
          </span>
        </div>

        {/* Milestone message */}
        <AnimatePresence mode="wait">
          {milestoneMsg && (
            <motion.p
              key={milestoneMsg}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="text-primary/70 text-[11px] font-sans text-center mt-2 font-medium"
            >
              {milestoneMsg}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Card Stack ─── */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-5">
        {loading && movies.length === 0 ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-6 h-6 text-primary/50 animate-spin" />
            <p className="text-foreground/30 text-sm font-sans">Chargement…</p>
          </div>
        ) : !currentMovie ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <Sparkles className="w-8 h-8 text-primary/40" />
            <p className="text-foreground/50 text-sm font-sans">Plus de films pour le moment</p>
            <Button variant="outline" onClick={handleClose} className="rounded-full text-sm">Retour</Button>
          </div>
        ) : (
          <div className="relative w-full max-w-[320px]">
            {/* Next card preview */}
            {nextMovie && (
              <div className="absolute inset-0 -z-10">
                <div className="w-full aspect-[2/3] rounded-2xl overflow-hidden opacity-20 scale-[0.93] translate-y-3 border border-border/5">
                  <img src={getPosterUrl(nextMovie.poster_path, "w342")} alt="" className="w-full h-full object-cover" />
                </div>
              </div>
            )}

            {/* Active card */}
            <AnimatePresence mode="popLayout">
              <motion.div
                key={currentMovie.id}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragEnd={handleDragEnd}
                animate={
                  swiping === "right" ? { x: 400, opacity: 0, rotate: 15 } :
                  swiping === "left" ? { x: -400, opacity: 0, rotate: -15 } :
                  {}
                }
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={swiping ? { duration: 0.3, ease: "easeOut" } : { type: "spring", stiffness: 260, damping: 24 }}
                className="relative w-full aspect-[2/3] rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing select-none"
                style={{ x, rotate, touchAction: "none" }}
              >
                {/* Image */}
                <img
                  src={getPosterUrl(currentMovie.poster_path, "w780")}
                  alt={getDisplayTitle(currentMovie)}
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />

                {/* Subtle edge highlight */}
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.08] pointer-events-none" />

                {/* Bottom info overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-24 pb-5 px-5">
                  <h3 className="text-white text-lg font-serif font-bold leading-snug mb-1.5 drop-shadow-md">
                    {getDisplayTitle(currentMovie)}
                  </h3>
                  <div className="flex items-center gap-3 text-white/60 text-xs font-sans mb-2.5">
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
                  <div className="flex gap-1.5 flex-wrap">
                    {(currentMovie.genre_ids || []).slice(0, 3).map(gid => GENRE_MAP[gid]).filter(Boolean).map(g => (
                      <span key={g} className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-white/[0.08] text-white/50 backdrop-blur-sm">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Swipe direction labels */}
                <motion.div
                  className="absolute top-5 left-5 px-4 py-2 rounded-xl border-2 border-destructive/60 z-30 -rotate-12"
                  style={{ opacity: skipOpacity }}
                >
                  <span className="text-destructive font-sans font-bold text-sm tracking-wide">PASSE</span>
                </motion.div>
                <motion.div
                  className="absolute top-5 right-5 px-4 py-2 rounded-xl border-2 border-primary/60 z-30 rotate-12"
                  style={{ opacity: likeOpacity }}
                >
                  <span className="text-primary font-sans font-bold text-sm tracking-wide">J'AIME</span>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ─── Rating Buttons ─── */}
      {currentMovie && !showActivationCTA && (
        <div className="relative z-10 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
          <div className="flex items-stretch gap-1.5">
            {RATING_BUTTONS.map((btn) => {
              const isNeg = btn.sentiment === "negative";
              const isPos = btn.sentiment === "positive";
              return (
                <motion.button
                  key={btn.value}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setSliderValue(btn.value);
                    setTimeout(() => handleRate(btn.value), 100);
                  }}
                  className={`flex-1 py-3 rounded-xl border font-sans text-[11px] font-medium transition-all active:scale-95 ${
                    isNeg
                      ? "bg-destructive/[0.06] border-destructive/15 text-destructive/70 hover:bg-destructive/10"
                      : isPos
                        ? "bg-primary/[0.06] border-primary/15 text-primary hover:bg-primary/10"
                        : "bg-foreground/[0.03] border-border/10 text-foreground/40 hover:bg-foreground/[0.06]"
                  }`}
                >
                  {btn.label}
                </motion.button>
              );
            })}
          </div>

          <button
            onClick={() => {
              setProcessedIds(prev => new Set(prev).add(currentMovie.id));
              setCurrentIndex(i => i + 1);
              x.set(0);
            }}
            className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 text-foreground/20 hover:text-foreground/35 transition-colors"
          >
            <SkipForward className="w-3 h-3" />
            <span className="text-[11px] font-sans">Je ne connais pas</span>
          </button>
        </div>
      )}

      {/* ─── Activation Complete CTA ─── */}
      <AnimatePresence>
        {showActivationCTA && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4"
          >
            <div className="rounded-2xl border border-primary/15 bg-card/60 backdrop-blur-xl p-6 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
                <Sparkles className="w-7 h-7 text-primary mx-auto mb-3" />
              </motion.div>
              <h3 className="text-xl font-serif mb-1.5">Pick est prêt</h3>
              <p className="text-foreground/40 text-sm font-sans mb-5 leading-relaxed">
                Maintenant qu'on se connaît, trouvons ton film.
              </p>
              <Button variant="hero" size="xl" className="w-full mb-2" onClick={handleActivationDone}>
                <Sparkles className="w-4 h-4" />
                Trouve-moi un film
                <ArrowRight className="w-4 h-4" />
              </Button>
              <button onClick={() => setShowActivationCTA(false)}
                className="text-foreground/20 text-xs font-sans hover:text-foreground/35 transition-colors py-1">
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