import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Heart, X, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPosterUrl, getDisplayTitle } from "@/lib/tmdb";
import { likeMovie } from "@/lib/liked-movies";
import { trackInteraction } from "@/lib/interactions";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { Movie, MovieDetail } from "@/lib/tmdb";

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

interface TasteTrainerProps {
  onClose: () => void;
}

// Genre ID to French name
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

  const loadMovies = useCallback(async (p: number) => {
    setLoading(true);
    try {
      // Load from multiple random pages for diversity
      const randomPage = Math.floor(Math.random() * 20) + p;
      const results = await fetchTrainingMovies(randomPage);
      // Filter out already processed
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
  }, []);

  // Load more when running low
  useEffect(() => {
    if (movies.length - currentIndex < 3 && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadMovies(nextPage);
    }
  }, [currentIndex, movies.length, loading, page]);

  const currentMovie = movies[currentIndex];
  const nextMovie = movies[currentIndex + 1];

  const handleLike = async () => {
    if (!currentMovie || !user) return;
    setSwiping("right");
    
    try {
      const detail = await fetchMovieDetail(currentMovie.id);
      await likeMovie(detail);
      setLikedCount(c => c + 1);
    } catch (e) {
      console.error("Failed to like:", e);
    }

    setProcessedIds(prev => new Set(prev).add(currentMovie.id));
    setTimeout(() => {
      setSwiping(null);
      setCurrentIndex(i => i + 1);
    }, 300);
  };

  const handleSkip = async () => {
    if (!currentMovie || !user) return;
    setSwiping("left");
    
    try {
      await trackInteraction(currentMovie.id, "skipped", { source: "taste_trainer" });
      setSkippedCount(c => c + 1);
    } catch (e) {
      console.error("Failed to track skip:", e);
    }

    setProcessedIds(prev => new Set(prev).add(currentMovie.id));
    setTimeout(() => {
      setSwiping(null);
      setCurrentIndex(i => i + 1);
    }, 300);
  };

  const handleUnsure = async () => {
    if (!currentMovie || !user) return;
    
    try {
      await trackInteraction(currentMovie.id, "unsure", { source: "taste_trainer" });
    } catch (e) {
      console.error("Failed to track:", e);
    }

    setProcessedIds(prev => new Set(prev).add(currentMovie.id));
    setCurrentIndex(i => i + 1);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100) {
      handleLike();
    } else if (info.offset.x < -100) {
      handleSkip();
    }
  };

  const totalProcessed = likedCount + skippedCount;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-3">
        <button onClick={onClose} className="text-foreground/50 hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="text-sm font-sans font-semibold text-foreground">Entraîne ton Pick</h2>
          <p className="text-[11px] font-sans text-foreground/40">
            {totalProcessed > 0 ? `${likedCount} aimé${likedCount > 1 ? "s" : ""} · ${skippedCount} passé${skippedCount > 1 ? "s" : ""}` : "Swipe pour affiner tes recommandations"}
          </p>
        </div>
        <div className="w-5" />
      </div>

      {/* Progress bar */}
      <div className="px-5 mb-4">
        <div className="h-1 rounded-full bg-foreground/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${Math.min(100, totalProcessed * 5)}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <p className="text-[10px] font-sans text-foreground/30 mt-1 text-center">
          {totalProcessed < 10 ? `Encore ${10 - totalProcessed} pour de meilleures recos` : totalProcessed < 20 ? "Continue, Pick apprend tes goûts !" : "🎯 Ton profil est bien entraîné !"}
        </p>
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
            {/* Next card (behind) */}
            {nextMovie && (
              <div className="absolute inset-x-8">
                <div className="relative w-full aspect-[2/3] max-h-[55vh] rounded-2xl overflow-hidden border border-border/20 opacity-40 scale-95">
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
                  swiping === "right" ? { x: 400, opacity: 0, rotate: 15 } :
                  swiping === "left" ? { x: -400, opacity: 0, rotate: -15 } :
                  { x: 0, opacity: 1, rotate: 0 }
                }
                initial={{ scale: 0.95, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="relative w-full aspect-[2/3] max-h-[55vh] rounded-2xl overflow-hidden border-2 border-border/30 shadow-2xl cursor-grab active:cursor-grabbing"
                style={{ touchAction: "none" }}
              >
                <img
                  src={getPosterUrl(currentMovie.poster_path, "w780")}
                  alt={getDisplayTitle(currentMovie)}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                {/* Movie info */}
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
                  className="absolute top-6 left-6 px-4 py-2 rounded-xl bg-red-500/90 border-2 border-red-400"
                  style={{ opacity: 0 }}
                  whileDrag={{ opacity: 1 }}
                >
                  <span className="text-white font-sans font-bold text-sm">PASSE</span>
                </motion.div>
                <motion.div
                  className="absolute top-6 right-6 px-4 py-2 rounded-xl bg-green-500/90 border-2 border-green-400"
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

      {/* Action buttons */}
      {currentMovie && (
        <div className="px-8 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4">
          <div className="flex items-center justify-center gap-5">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={handleSkip}
              className="w-14 h-14 rounded-full bg-foreground/5 border-2 border-foreground/15 flex items-center justify-center hover:border-red-400/50 hover:bg-red-500/10 transition-colors"
            >
              <X className="w-6 h-6 text-foreground/50" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleUnsure}
              className="w-10 h-10 rounded-full bg-foreground/5 border border-foreground/10 flex items-center justify-center hover:border-foreground/30 transition-colors"
            >
              <span className="text-foreground/40 text-xs font-sans font-medium">?</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={handleLike}
              className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center hover:border-primary/60 hover:bg-primary/20 transition-colors"
            >
              <Heart className="w-6 h-6 text-primary" />
            </motion.button>
          </div>

          <p className="text-center text-foreground/25 text-[10px] font-sans mt-3">
            Swipe ← passer · ? je sais pas · Swipe → j'aime
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default TasteTrainer;
