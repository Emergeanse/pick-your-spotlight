import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Loader2, SkipForward, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMovieDetails, type Movie, type MovieDetail } from "@/lib/tmdb";
import { fetchFromTMDB } from "@/lib/tmdb-proxy-client";
import { recordAcceptedRecommendation, recordSkippedRecommendation } from "@/lib/engagement";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import RecommendationMovieCard from "@/components/pick/RecommendationMovieCard";
import MovieActionBar from "@/components/pick/MovieActionBar";
import { useMovieInteractions } from "@/hooks/use-movie-interactions";

const ONBOARDING_FILM_TARGET = 10;

const GENRE_NAME_TO_ID: Record<string, number> = {
  Action: 28, Aventure: 12, Animation: 16, Comédie: 35, Crime: 80,
  Drame: 18, Famille: 10751, Fantastique: 14, Histoire: 36, Horreur: 27,
  Mystère: 9648, Romance: 10749, "Science-Fiction": 878, Thriller: 53,
};

async function fetchOnboardingMovies(page: number, genreNames: string[]): Promise<Movie[]> {
  const genreIds = genreNames.map((g) => GENRE_NAME_TO_ID[g]).filter(Boolean);
  const params: Record<string, string> = {
    sort_by: "popularity.desc",
    "vote_count.gte": "200",
    "vote_average.gte": "6",
    page: String(page),
  };
  if (genreIds.length > 0) params.with_genres = genreIds.slice(0, 3).join(",");
  const data = await fetchFromTMDB("/discover/movie", params);
  return (data.results || []) as Movie[];
}

interface OnboardingFilmTrainerProps {
  favoriteGenres: string[];
  onComplete: () => void;
  onBack: () => void;
}

export default function OnboardingFilmTrainer({
  favoriteGenres,
  onComplete,
  onBack,
}: OnboardingFilmTrainerProps) {
  const { user } = useAuth();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionCount, setSessionCount] = useState(0);
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const seenIds = useRef<Set<number>>(new Set());
  const advancedIds = useRef<Set<number>>(new Set());

  const currentMovie = movies[currentIndex];
  const interactions = useMovieInteractions(
    movies.map((m) => ({ tmdbId: m.id, mediaType: "movie" as const })),
  );
  const currentInteraction = currentMovie ? interactions[currentMovie.id] : undefined;
  const done = sessionCount >= ONBOARDING_FILM_TARGET;
  const progress = Math.min(100, Math.round((sessionCount / ONBOARDING_FILM_TARGET) * 100));

  const loadMore = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const results = await fetchOnboardingMovies(p, favoriteGenres);
      const fresh = results.filter((m) => m.poster_path && !seenIds.current.has(m.id));
      fresh.forEach((m) => seenIds.current.add(m.id));
      setMovies((prev) => [...prev, ...fresh]);
    } catch (e) {
      console.error("onboarding films load failed", e);
    } finally {
      setLoading(false);
    }
  }, [favoriteGenres]);

  useEffect(() => {
    void loadMore(1);
  }, [loadMore]);

  useEffect(() => {
    if (movies.length - currentIndex < 3 && !loading) {
      const next = page + 1;
      setPage(next);
      void loadMore(next);
    }
  }, [currentIndex, movies.length, loading, page, loadMore]);

  useEffect(() => {
    if (!currentMovie) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setCardLoading(true);
    getMovieDetails(currentMovie.id, "movie")
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch(() => { if (!cancelled) setDetail(currentMovie as unknown as MovieDetail); })
      .finally(() => { if (!cancelled) setCardLoading(false); });
    return () => { cancelled = true; };
  }, [currentMovie?.id]);

  const advance = useCallback(async (mode: "liked" | "skipped") => {
    if (!currentMovie || !user || advancedIds.current.has(currentMovie.id)) return;
    advancedIds.current.add(currentMovie.id);
    if (mode === "liked") await recordAcceptedRecommendation(user.id).catch(() => {});
    else await recordSkippedRecommendation(user.id).catch(() => {});
    setSessionCount((c) => c + 1);
    setHistory((h) => [...h, currentIndex]);
    setCurrentIndex((i) => i + 1);
  }, [currentMovie, currentIndex, user]);

  const handleInteraction = async (type: string) => {
    if (type === "like" || type === "love" || type === "watchlist") await advance("liked");
    else if (type === "dislike" || type === "skip" || type === "already_seen") await advance("skipped");
    else await advance("skipped");
  };

  const skipMovie = () => void advance("skipped");

  const goBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setCurrentIndex(prev);
    setSessionCount((c) => Math.max(0, c - 1));
    if (currentMovie) advancedIds.current.delete(currentMovie.id);
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="w-full max-w-xl mx-auto pt-[env(safe-area-inset-top)] px-5">
        <div className="flex items-center gap-3 mb-2 mt-4">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-serif">Quelques films pour te connaître</h1>
            <p className="text-muted-foreground text-xs font-sans mt-0.5">
              Like, passe ou « déjà vu » — {ONBOARDING_FILM_TARGET} suffisent
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-1.5 flex-1 rounded-full bg-foreground/10 overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <span className="text-xs font-sans tabular-nums text-foreground/50">
            {Math.min(sessionCount, ONBOARDING_FILM_TARGET)}/{ONBOARDING_FILM_TARGET}
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-2 min-h-[320px]">
        {loading && movies.length === 0 ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
        ) : !currentMovie || !detail ? (
          cardLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
          ) : (
            <p className="text-sm text-foreground/50 font-sans">Chargement des films…</p>
          )
        ) : (
          <div className="w-full max-w-md">
            <RecommendationMovieCard
              movie={detail}
              contextType="browse"
              showPrimaryAction={false}
              showActionBar={false}
              className="min-h-0"
            />
          </div>
        )}
      </div>

      {currentMovie && detail && !done && (
        <div className="px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] border-t border-border/20 bg-background/90 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-3 pt-3">
            <button
              type="button"
              onClick={goBack}
              disabled={history.length === 0}
              className="rounded-full bg-foreground/5 p-2 disabled:opacity-20"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {currentInteraction?.hasInteraction && (
              <span className="text-[10px] font-sans text-primary/70">Déjà noté</span>
            )}
            <button type="button" onClick={skipMovie} className="rounded-full bg-foreground/5 p-2">
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
          <MovieActionBar
            key={`${detail.id}-${currentIndex}`}
            movie={detail}
            size="md"
            onInteraction={handleInteraction}
          />
          <button
            type="button"
            onClick={skipMovie}
            className="mt-3 w-full py-2 text-[11px] font-sans text-foreground/45 flex items-center justify-center gap-1"
          >
            <SkipForward className="w-3 h-3" /> Je ne connais pas ce film
          </button>
        </div>
      )}

      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <div className="rounded-2xl border border-primary/20 bg-card/60 p-5 text-center">
              <Sparkles className="w-7 h-7 text-primary mx-auto mb-2" />
              <p className="font-serif text-lg mb-1">Parfait, je commence à te cerner</p>
              <p className="text-sm text-foreground/50 font-sans mb-4">Découvrons comment lancer une recherche Solo.</p>
              <Button variant="hero" size="xl" className="w-full" onClick={onComplete}>
                Continuer <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { ONBOARDING_FILM_TARGET };
