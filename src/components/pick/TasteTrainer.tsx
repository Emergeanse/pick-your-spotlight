import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { ChevronLeft, Loader2, Sparkles, ArrowRight, Eye } from "lucide-react";
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
  { value: 5,   label: "Pas pour moi", color: "from-red-500/20 to-red-600/10 border-red-500/30 text-red-400" },
  { value: 25,  label: "Bof",          color: "from-foreground/10 to-foreground/5 border-foreground/15 text-foreground/50" },
  { value: 50,  label: "Correct",      color: "from-foreground/10 to-foreground/5 border-foreground/15 text-foreground/60" },
  { value: 75,  label: "J'aime bien",  color: "from-primary/15 to-primary/5 border-primary/25 text-primary" },
  { value: 100, label: "Chef-d'œuvre", color: "from-primary/25 to-primary/10 border-primary/40 text-primary" },
];

const getMilestoneMessage = (count: number): string | null => {
  if (count === 3) return "🎬 Ça commence à prendre forme…";
  if (count === 5) return "🧠 Pick apprend vite avec toi !";
  if (count === 8) return "🍿 On y est presque…";
  if (count === THRESHOLDS.minimum) return "🎯 Pick commence à te comprendre";
  if (count === 13) return "✨ Encore quelques-uns pour des recos au top";
  if (count === 15) return "🔮 Tes goûts se dessinent clairement";
  if (count === 18) return "📡 Pick affine son radar…";
  if (count === THRESHOLDS.ideal) return "🎉 Parfait ! Pick est prêt à te recommander";
  if (count === 25) return "💫 Tu formes un duo de choc avec Pick";
  if (count === 30) return "🧠 Pick te connaît par cœur";
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
  const [profileConfidence, setProfileConfidence] = useState(0);
  const [sliderValue, setSliderValue] = useState(50);
  const [milestoneMsg, setMilestoneMsg] = useState<string | null>(null);
  const [showActivationCTA, setShowActivationCTA] = useState(false);
  const [ratingFlash, setRatingFlash] = useState<string | null>(null);
  const milestoneTimeout = useRef<ReturnType<typeof setTimeout>>();

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
        .then(({ count }) => {
          setTotalEvaluated(count || 0);
        });
      supabase.from("profiles")
        .select("profile_confidence")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) setProfileConfidence((data as any).profile_confidence || 0);
        });
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

  const handleRate = async () => {
    if (!currentMovie || !user) return;

    const rating = sliderValue;
    const isPositive = rating > 50;
    const actionType = rating <= 50 ? "skipped" : "liked";

    setSwiping(isPositive ? "right" : "left");

    try {
      const genres = (currentMovie.genre_ids || []).map(gid => GENRE_MAP[gid]).filter(Boolean);
      if (rating > 50) {
        const detail = await fetchMovieDetail(currentMovie.id);
        await likeMovie(detail);
        await trackInteraction(currentMovie.id, actionType, { source: "taste_trainer", genres: genres.join(","), rating });
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
      setRatingFlash(null);
    }, 300);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100) {
      setSliderValue(80);
      setTimeout(handleRate, 50);
    } else if (info.offset.x < -100) {
      setSliderValue(15);
      setTimeout(handleRate, 50);
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
      {/* Ambient glow behind card */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-primary/8 blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-1">
        <button onClick={handleClose} className="w-9 h-9 rounded-full bg-card/60 backdrop-blur-sm border border-border/30 flex items-center justify-center text-foreground/50 hover:text-foreground hover:bg-card transition-all">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <h2 className="text-sm font-serif font-semibold text-foreground tracking-wide">
            {isActivation ? "Apprends-moi tes goûts" : "Entraîne ton Pick"}
          </h2>
        </div>
        <div className="w-9" />
      </div>

      {/* Progress section */}
      <div className="relative z-10 px-5 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Eye className="w-3 h-3 text-primary" />
            </div>
            <span className="text-xs font-sans font-medium text-foreground/70">
              {cumulativeTotal} film{cumulativeTotal > 1 ? "s" : ""} évalué{cumulativeTotal > 1 ? "s" : ""}
            </span>
          </div>
          {sessionTarget > 0 && (
            <span className="text-xs font-sans font-bold text-primary tabular-nums">
              {sessionProgress}/{sessionTarget}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-card border border-border/30 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        {/* Milestone message */}
        <AnimatePresence mode="wait">
          {milestoneMsg ? (
            <motion.div
              key={milestoneMsg}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-2.5 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-center"
            >
              <p className="text-xs font-sans font-medium text-primary">
                {milestoneMsg}
              </p>
            </motion.div>
          ) : (
            <motion.p
              key="default"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              className="text-[10px] font-sans text-foreground/30 text-center mt-2"
            >
              {cumulativeTotal < THRESHOLDS.minimum
                ? "Plus tu évalues, mieux Pick te comprend"
                : cumulativeTotal < THRESHOLDS.ideal
                ? "Encore un peu pour des recos vraiment personnalisées"
                : "Pick te connaît bien — continue pour encore plus de précision"}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Card stack */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6">
        {loading && movies.length === 0 ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-card border border-border/30 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
            <p className="text-foreground/40 text-sm font-sans">Chargement des films…</p>
          </div>
        ) : !currentMovie ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-card border border-border/30 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <p className="text-foreground/60 text-sm font-sans">Plus de films pour le moment !</p>
            <Button variant="outline" onClick={handleClose} className="rounded-full">
              Retour à l'accueil
            </Button>
          </div>
        ) : (
          <>
            {/* Background card (next) */}
            {nextMovie && (
              <div className="absolute inset-x-6">
                <div className="relative w-full aspect-[2/3] max-h-[55vh] rounded-2xl overflow-hidden border border-border/10 opacity-30 scale-[0.92] translate-y-2">
                  <img
                    src={getPosterUrl(nextMovie.poster_path, "w500")}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Current card */}
            <AnimatePresence mode="popLayout">
              <motion.div
                key={currentMovie.id}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={handleDragEnd}
                animate={
                  swiping === "right" ? { x: 400, opacity: 0, rotate: 12 } :
                  swiping === "left" ? { x: -400, opacity: 0, rotate: -12 } :
                  { x: 0, opacity: 1, rotate: 0 }
                }
                initial={{ scale: 0.92, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="relative w-full aspect-[2/3] max-h-[55vh] rounded-2xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing group"
                style={{ touchAction: "none" }}
              >
                {/* Card border glow */}
                <div className="absolute inset-0 rounded-2xl border border-border/40 z-20 pointer-events-none" />
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-white/5 to-transparent z-20 pointer-events-none" />

                <img
                  src={getPosterUrl(currentMovie.poster_path, "w780")}
                  alt={getDisplayTitle(currentMovie)}
                  className="w-full h-full object-contain bg-black/95"
                  draggable={false}
                />

                {/* Bottom gradient with info */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent z-10" />
                
                <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
                  <h3 className="text-lg font-serif text-white font-bold leading-tight mb-1.5 drop-shadow-lg">
                    {getDisplayTitle(currentMovie)}
                  </h3>
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="text-white/80 text-xs font-sans font-medium flex items-center gap-1">
                      <span className="text-yellow-400">★</span> {currentMovie.vote_average?.toFixed(1)}
                    </span>
                    {currentMovie.release_date && (
                      <span className="text-white/40 text-xs font-sans">
                        {currentMovie.release_date.substring(0, 4)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {(currentMovie.genre_ids || []).slice(0, 3).map(gid => (
                      <span key={gid} className="text-[10px] font-sans px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-sm text-white/70 border border-white/10">
                        {GENRE_MAP[gid] || ""}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Swipe indicators */}
                <motion.div
                  className="absolute top-6 left-6 px-5 py-2.5 rounded-2xl bg-red-500/90 backdrop-blur-sm border border-red-400/50 z-30"
                  style={{ opacity: 0 }}
                  whileDrag={{ opacity: 1 }}
                >
                  <span className="text-white font-sans font-bold text-sm tracking-wide">PASSE</span>
                </motion.div>
                <motion.div
                  className="absolute top-6 right-6 px-5 py-2.5 rounded-2xl bg-primary/90 backdrop-blur-sm border border-primary/50 z-30"
                  style={{ opacity: 0 }}
                  whileDrag={{ opacity: 1 }}
                >
                  <span className="text-white font-sans font-bold text-sm tracking-wide">J'AIME</span>
                </motion.div>

                {/* Rating flash overlay */}
                <AnimatePresence>
                  {ratingFlash && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
                    >
                      <span className="text-5xl">{ratingFlash}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Rating buttons */}
      {currentMovie && !showActivationCTA && (
        <div className="relative z-10 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <div className="flex items-stretch justify-center gap-1.5">
            {RATING_BUTTONS.map((btn) => (
              <motion.button
                key={btn.value}
                whileTap={{ scale: 0.88 }}
                whileHover={{ scale: 1.04, y: -2 }}
                onClick={() => {
                  setSliderValue(btn.value);
                  setRatingFlash(btn.emoji);
                  setTimeout(() => handleRate(), 150);
                }}
                className={`flex-1 py-3 px-1 rounded-xl border bg-gradient-to-b transition-all duration-200 ${btn.color}`}
              >
                <span className="text-lg block mb-0.5">{btn.emoji}</span>
                <span className="text-[10px] font-sans font-medium leading-tight block opacity-80">
                  {btn.label}
                </span>
              </motion.button>
            ))}
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setProcessedIds(prev => new Set(prev).add(currentMovie.id));
              setCurrentIndex(i => i + 1);
            }}
            className="w-full mt-3 py-2 text-center group"
          >
            <span className="text-[11px] font-sans text-foreground/25 group-hover:text-foreground/40 transition-colors">
              Je ne connais pas ce film →
            </span>
          </motion.button>

          <p className="text-center text-foreground/15 text-[10px] font-sans mt-1">
            Choisis ton ressenti · ou swipe la carte
          </p>
        </div>
      )}

      {/* Activation complete CTA */}
      <AnimatePresence>
        {showActivationCTA && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4"
          >
            <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-primary/20 p-6 text-center shadow-lg shadow-primary/5">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
              >
                <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
              </motion.div>
              <h3 className="text-xl font-serif mb-1.5">Pick est prêt !</h3>
              <p className="text-foreground/50 text-sm font-sans mb-5 max-w-xs mx-auto leading-relaxed">
                Maintenant qu'on se connaît, trouvons ton film de ce soir.
              </p>
              <div className="flex flex-col gap-2.5">
                <Button
                  variant="hero"
                  size="xl"
                  className="w-full"
                  onClick={handleActivationDone}
                >
                  <Sparkles className="w-4 h-4" />
                  Trouve-moi un film
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <button
                  onClick={() => setShowActivationCTA(false)}
                  className="text-foreground/25 text-xs font-sans hover:text-foreground/40 transition-colors py-1"
                >
                  Je continue à évaluer
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default TasteTrainer;
