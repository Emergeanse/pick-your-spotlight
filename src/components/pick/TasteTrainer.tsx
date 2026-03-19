import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { ChevronLeft, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPosterUrl, getDisplayTitle } from "@/lib/tmdb";
import { likeMovie } from "@/lib/liked-movies";
import { trackInteraction } from "@/lib/interactions";
import { recordAcceptedRecommendation, recordSkippedRecommendation } from "@/lib/engagement";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { Movie, MovieDetail } from "@/lib/tmdb";

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

interface TasteTrainerProps {
  onClose: () => void;
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

// Rating system
const RATING_LABELS = [
  { value: 0, label: "Pas pour moi" },
  { value: 25, label: "Bof" },
  { value: 50, label: "Correct" },
  { value: 75, label: "J'aime bien" },
  { value: 100, label: "Chef-d'œuvre" },
];

const getRatingInfo = (value: number) => {
  if (value <= 12) return { label: "Pas pour moi", sentiment: "negative" as const };
  if (value <= 37) return { label: "Bof", sentiment: "low" as const };
  if (value <= 62) return { label: "Correct", sentiment: "neutral" as const };
  if (value <= 87) return { label: "J'aime bien", sentiment: "positive" as const };
  return { label: "Chef-d'œuvre", sentiment: "love" as const };
};

const getSliderColor = (value: number) => {
  if (value <= 12) return "bg-destructive";
  if (value <= 37) return "bg-muted-foreground";
  if (value <= 62) return "bg-foreground/50";
  if (value <= 87) return "bg-primary";
  return "bg-primary";
};

const getSliderGlow = (value: number) => {
  if (value <= 37) return "";
  if (value <= 62) return "";
  if (value <= 87) return "shadow-[0_0_12px_hsl(var(--primary)/0.3)]";
  return "shadow-[0_0_20px_hsl(var(--primary)/0.5)]";
};

const TasteTrainer = ({ onClose }: TasteTrainerProps) => {
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

  const totalProcessed = likedCount + skippedCount;
  const cumulativeTotal = totalEvaluated + totalProcessed;
  const liveConfidence = Math.min(100, profileConfidence + totalProcessed * 2);

  const getConfidenceLabel = (c: number) => {
    if (c < 20) return "Débutant";
    if (c < 40) return "En apprentissage";
    if (c < 60) return "Prometteur";
    if (c < 80) return "Fiable";
    return "Expert";
  };

  const ratingInfo = getRatingInfo(sliderValue);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-3">
        <button onClick={() => {
          const { likes, skips } = actionsRef.current;
          if (likes + skips > 0) {
            toast.success(`Profil mis à jour ! ${likes} aimé${likes > 1 ? "s" : ""}, ${skips} passé${skips > 1 ? "s" : ""}`);
          }
          onClose();
        }} className="text-foreground/50 hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="text-sm font-sans font-semibold text-foreground">Entraîne ton Pick</h2>
          <p className="text-[11px] font-sans text-foreground/40">
            {cumulativeTotal} film{cumulativeTotal > 1 ? "s" : ""} évalué{cumulativeTotal > 1 ? "s" : ""} au total
          </p>
        </div>
        <div className="w-5" />
      </div>

      {/* Confidence indicator */}
      <div className="px-5 mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-sans text-foreground/40">Fiabilité des recos</span>
          <span className="text-[10px] font-sans font-semibold text-primary">
            {getConfidenceLabel(liveConfidence)} · {liveConfidence}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: `${profileConfidence}%` }}
            animate={{ width: `${liveConfidence}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        {totalProcessed > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] font-sans text-primary/60 mt-1 text-center"
          >
            +{totalProcessed * 2}% cette session
          </motion.p>
        )}
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
            <Button variant="outline" onClick={onClose} className="rounded-full">
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
      {currentMovie && (
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

          <p className="text-center text-foreground/25 text-[10px] font-sans mt-3">
            Choisis ton ressenti · ou swipe la carte
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default TasteTrainer;
