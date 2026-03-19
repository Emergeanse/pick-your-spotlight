import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { ChevronLeft, Loader2, Sparkles, ArrowRight } from "lucide-react";
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
  isActivation?: boolean; // True when opened from onboarding activation
  onActivationComplete?: () => void; // Called when user reaches threshold during activation
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
  { value: 5,   label: "Pas pour moi", style: "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10" },
  { value: 25,  label: "Bof",          style: "border-foreground/10 bg-foreground/5 text-muted-foreground hover:bg-foreground/10" },
  { value: 50,  label: "Correct",      style: "border-foreground/10 bg-foreground/5 text-foreground/60 hover:bg-foreground/10" },
  { value: 75,  label: "J'aime bien",  style: "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10" },
  { value: 100, label: "Chef-d'œuvre", style: "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20" },
];

// Milestone messages that feel cinematic
const getMilestoneMessage = (count: number, total: number): string | null => {
  if (count === 3) return "Ça commence à prendre forme…";
  if (count === 5) return "Pick apprend vite avec toi !";
  if (count === 8) return "On y est presque…";
  if (count === THRESHOLDS.minimum) return "Pick commence à te comprendre 🎯";
  if (count === 13) return "Encore quelques-uns pour des recos au top";
  if (count === 15) return "Tes goûts se dessinent clairement";
  if (count === 18) return "Pick affine son radar…";
  if (count === THRESHOLDS.ideal) return "Parfait ! Pick est prêt à te recommander ✨";
  if (count === 25) return "Tu formes un duo de choc avec Pick";
  if (count === 30) return "Pick te connaît par cœur 🧠";
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

  // Show milestone messages
  useEffect(() => {
    const msg = getMilestoneMessage(cumulativeTotal, totalProcessed);
    if (msg) {
      setMilestoneMsg(msg);
      if (milestoneTimeout.current) clearTimeout(milestoneTimeout.current);
      milestoneTimeout.current = setTimeout(() => setMilestoneMsg(null), 3000);
    }

    // Show activation CTA after reaching ideal threshold during activation
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
        await trackInteraction(currentMovie.id, actionType, {
          source: "taste_trainer",
          genres: genres.join(","),
          rating: rating,
        });
        await recordAcceptedRecommendation(user.id);
        setLikedCount(c => c + 1);
        actionsRef.current.likes++;
      } else {
        await trackInteraction(currentMovie.id, actionType, {
          source: "taste_trainer",
          genres: genres.join(","),
          rating: rating,
        });
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

  const liveConfidence = Math.min(100, profileConfidence + totalProcessed * 2);
  const progressPercent = sessionTarget > 0
    ? Math.min(100, Math.round((sessionProgress / sessionTarget) * 100))
    : 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-2">
        <button onClick={handleClose} className="text-foreground/50 hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="text-sm font-sans font-semibold text-foreground">
            {isActivation ? "Apprends-moi tes goûts" : "Entraîne ton Pick"}
          </h2>
        </div>
        <div className="w-5" />
      </div>

      {/* Progress section */}
      <div className="px-5 mb-3">
        {/* Counter */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-sans text-foreground/50">
            {cumulativeTotal} film{cumulativeTotal > 1 ? "s" : ""} évalué{cumulativeTotal > 1 ? "s" : ""}
          </span>
          {sessionTarget > 0 && (
            <span className="text-[11px] font-sans font-semibold text-primary">
              {sessionProgress} / {sessionTarget}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-foreground/10 overflow-hidden mb-1">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Milestone message or default label */}
        <AnimatePresence mode="wait">
          {milestoneMsg ? (
            <motion.p
              key={milestoneMsg}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-[11px] font-sans text-primary text-center font-medium"
            >
              {milestoneMsg}
            </motion.p>
          ) : (
            <motion.p
              key="default"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] font-sans text-foreground/30 text-center"
            >
              {cumulativeTotal < THRESHOLDS.minimum
                ? "Plus tu swipes, mieux Pick te comprend"
                : cumulativeTotal < THRESHOLDS.ideal
                ? "Encore un peu pour des recos vraiment personnalisées"
                : "Pick te connaît bien — continue pour encore plus de précision"}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Card stack */}
      <div className="flex-1 flex items-center justify-center px-8 relative">
        {loading && movies.length === 0 ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-foreground/40 text-sm font-sans">Chargement des films…</p>
          </div>
        ) : !currentMovie ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-foreground/60 text-sm font-sans">Plus de films pour le moment !</p>
            <Button variant="outline" onClick={handleClose} className="rounded-full">
              Retour à l'accueil
            </Button>
          </div>
        ) : (
          <>
            {nextMovie && (
              <div className="absolute inset-x-8">
                <div className="relative w-full aspect-[2/3] max-h-[65vh] rounded-2xl overflow-hidden border border-border/20 opacity-40 scale-95">
                  <img
                    src={getPosterUrl(nextMovie.poster_path, "w500")}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            <AnimatePresence mode="popLayout">
              <motion.div
                key={currentMovie.id}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={handleDragEnd}
                animate={
                  swiping === "right" ? { x: 400, opacity: 0, rotate: 15 } :
                  swiping === "left" ? { x: -400, opacity: 0, rotate: -15 } :
                  { x: 0, opacity: 1, rotate: 0 }
                }
                initial={{ scale: 0.95, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="relative w-full aspect-[2/3] max-h-[65vh] rounded-2xl overflow-hidden border-2 border-border/30 shadow-2xl cursor-grab active:cursor-grabbing"
                style={{ touchAction: "none" }}
              >
                <img
                  src={getPosterUrl(currentMovie.poster_path, "w780")}
                  alt={getDisplayTitle(currentMovie)}
                  className="w-full h-full object-contain bg-black/90"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="text-lg font-serif text-white font-bold leading-tight mb-1">
                    {getDisplayTitle(currentMovie)}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-white/60 text-xs font-sans">
                      ⭐ {currentMovie.vote_average?.toFixed(1)}
                    </span>
                    {currentMovie.release_date && (
                      <span className="text-white/40 text-xs font-sans">
                        {currentMovie.release_date.substring(0, 4)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {(currentMovie.genre_ids || []).slice(0, 3).map(gid => (
                      <span key={gid} className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-white/15 text-white/70">
                        {GENRE_MAP[gid] || ""}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Swipe indicators */}
                <motion.div
                  className="absolute top-6 left-6 px-4 py-2 rounded-xl bg-destructive/90 border-2 border-destructive"
                  style={{ opacity: 0 }}
                  whileDrag={{ opacity: 1 }}
                >
                  <span className="text-white font-sans font-bold text-sm">PASSE</span>
                </motion.div>
                <motion.div
                  className="absolute top-6 right-6 px-4 py-2 rounded-xl bg-primary/90 border-2 border-primary"
                  style={{ opacity: 0 }}
                  whileDrag={{ opacity: 1 }}
                >
                  <span className="text-white font-sans font-bold text-sm">J'AIME</span>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Rating buttons */}
      {currentMovie && !showActivationCTA && (
        <div className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
          <div className="flex items-center justify-center gap-2">
            {RATING_BUTTONS.map((btn) => (
              <motion.button
                key={btn.value}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setSliderValue(btn.value);
                  setTimeout(() => handleRate(), 50);
                }}
                className={`flex-1 py-2.5 px-1 rounded-xl border text-center transition-all duration-200 ${btn.style}`}
              >
                <span className="text-[11px] font-sans font-medium leading-tight block">
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
            className="w-full mt-2.5 py-2 text-center"
          >
            <span className="text-[11px] font-sans text-foreground/30 hover:text-foreground/50 transition-colors">
              Je ne connais pas ce film
            </span>
          </motion.button>

          <p className="text-center text-foreground/25 text-[10px] font-sans mt-1">
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
            className="px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4"
          >
            <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-primary/20 p-5 text-center">
              <Sparkles className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="text-lg font-serif mb-1">Pick est prêt !</h3>
              <p className="text-foreground/50 text-sm font-sans mb-4">
                Maintenant qu'on se connaît, trouvons ton film de ce soir.
              </p>
              <div className="flex flex-col gap-2">
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
                  className="text-foreground/30 text-xs font-sans hover:text-foreground/50 transition-colors"
                >
                  Je continue à swiper
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
