import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Heart, Check, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { likeMovie } from "@/lib/liked-movies";
import { getPopularMoviesForOnboarding, searchMovies, getPosterUrl, getDisplayTitle, getMovieDetails } from "@/lib/tmdb";
import type { Movie } from "@/lib/tmdb";
import type { StreamingPlatform } from "@/components/pick/PlatformStep";

const MIN_SELECTIONS = 5;

const platforms: StreamingPlatform[] = [
  { id: 8, label: "Netflix", logo: "https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg" },
  { id: 337, label: "Disney+", logo: "https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg" },
  { id: 119, label: "Amazon Prime", logo: "https://image.tmdb.org/t/p/original/dQeAar5H991VYporEjUspolDarG.jpg" },
  { id: 350, label: "Apple TV+", logo: "https://image.tmdb.org/t/p/original/6uhKBfmtzFqOcLousHwZuzcrScK.jpg" },
  { id: 381, label: "Canal+", logo: "https://image.tmdb.org/t/p/original/dVMVBMOlOUPFfbkSKNnTGg3JX5b.jpg" },
  { id: 56, label: "OCS", logo: "https://image.tmdb.org/t/p/original/3E0RkIEQrrGYazs63NMsn3XONT6.jpg" },
  { id: 236, label: "Paramount+", logo: "https://image.tmdb.org/t/p/original/fi83B1ozBIOCEo7cWoevSYS0tXi.jpg" },
  { id: 1899, label: "Max", logo: "https://image.tmdb.org/t/p/original/6Q3YKUNA60A4DxOrPaUTDOE4BrU.jpg" },
];

type OnboardingStep = "movies" | "platforms";

const Onboarding = () => {
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("movies");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Movie[] | null>(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<number[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    getPopularMoviesForOnboarding(1).then(setMovies).catch(console.error);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      searchMovies(searchQuery).then(setSearchResults).catch(console.error);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const more = await getPopularMoviesForOnboarding(nextPage);
      setMovies(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        return [...prev, ...more.filter(m => !existingIds.has(m.id))];
      });
      setPage(nextPage);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }, [page, loadingMore]);

  const toggleSelect = (movie: Movie) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(movie.id)) next.delete(movie.id);
      else next.add(movie.id);
      return next;
    });
  };

  const togglePlatform = (id: number) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleMoviesContinue = () => {
    setOnboardingStep("platforms");
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const allMovies = searchResults || movies;
      const selectedMovies = allMovies.filter(m => selectedIds.has(m.id));
      const selectedFromGrid = movies.filter(m => selectedIds.has(m.id));
      const allSelected = [...new Map([...selectedMovies, ...selectedFromGrid].map(m => [m.id, m])).values()];

      for (const movie of allSelected) {
        try {
          const detail = await getMovieDetails(movie.id, "movie");
          await likeMovie(detail);
        } catch (e) {
          console.error("Failed to like movie:", movie.id, e);
        }
      }

      const genres = new Set<string>();
      const genreMap: Record<number, string> = {
        28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie",
        80: "Crime", 99: "Documentaire", 18: "Drame", 10751: "Famille",
        14: "Fantastique", 36: "Histoire", 27: "Horreur", 10402: "Musique",
        9648: "Mystère", 10749: "Romance", 878: "Science-Fiction",
        10770: "Téléfilm", 53: "Thriller", 10752: "Guerre", 37: "Western",
      };
      for (const movie of allSelected) {
        movie.genre_ids?.forEach(id => {
          if (genreMap[id]) genres.add(genreMap[id]);
        });
      }

      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (userId) {
        await supabase.from("profiles").update({
          onboarding_completed: true,
          favorite_genres: Array.from(genres).slice(0, 8),
          preferred_platforms: selectedPlatforms,
        }).eq("id", userId);
      }

      navigate("/");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const displayMovies = searchResults || movies;
  const selectionCount = selectedIds.size;
  const canFinish = selectionCount >= MIN_SELECTIONS;

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <AnimatePresence mode="wait">
        {onboardingStep === "movies" ? (
          <motion.div
            key="movies"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col h-full"
          >
            {/* Step indicator */}
            <div className="flex-shrink-0 px-5 pt-[calc(1rem+env(safe-area-inset-top))]">
              <div className="max-w-2xl mx-auto flex items-center gap-2 mb-2">
                <div className="h-1 flex-1 rounded-full bg-primary" />
                <div className="h-1 flex-1 rounded-full bg-muted" />
              </div>
              <p className="max-w-2xl mx-auto text-muted-foreground text-xs font-sans">Étape 1/2</p>
            </div>

            {/* Header */}
            <div className="flex-shrink-0 px-5 pt-3 pb-4">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
              >
                <h1 className="text-2xl md:text-4xl font-serif mb-2">
                  Quels films as-tu aimés ?
                </h1>
                <p className="text-muted-foreground text-sm font-sans mb-4">
                  Choisis au moins {MIN_SELECTIONS} films pour qu'on apprenne tes goûts
                </p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un film…"
                    className="w-full bg-card border border-border/30 rounded-xl px-10 py-2.5 text-sm font-sans text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </motion.div>
            </div>

            {/* Movie grid */}
            <div className="flex-1 overflow-y-auto px-5 pb-28">
              <div className="max-w-2xl mx-auto">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-3">
                  {displayMovies.map((movie, i) => {
                    const isSelected = selectedIds.has(movie.id);
                    return (
                      <motion.button
                        key={movie.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: Math.min(i * 0.02, 0.5) }}
                        onClick={() => toggleSelect(movie)}
                        className="relative group aspect-[2/3] rounded-xl overflow-hidden cursor-pointer"
                      >
                        <img
                          src={getPosterUrl(movie.poster_path, "w342")}
                          alt={getDisplayTitle(movie)}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className={`absolute inset-0 transition-all duration-200 ${
                          isSelected
                            ? "bg-primary/30 border-2 border-primary rounded-xl"
                            : "bg-transparent hover:bg-foreground/10"
                        }`} />
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg"
                            >
                              <Heart className="w-3.5 h-3.5 text-primary-foreground fill-primary-foreground" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[10px] font-sans text-foreground/90 line-clamp-2 leading-tight">
                            {getDisplayTitle(movie)}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
                {!searchResults && (
                  <div className="flex justify-center py-6">
                    <Button
                      variant="ghost"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="text-muted-foreground text-sm font-sans"
                    >
                      {loadingMore && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Voir plus de films
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom CTA */}
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/20 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            >
              <div className="max-w-2xl mx-auto flex items-center justify-between">
                <div className="text-sm font-sans">
                  <span className={`font-semibold ${canFinish ? "text-primary" : "text-foreground"}`}>
                    {selectionCount}
                  </span>
                  <span className="text-muted-foreground"> / {MIN_SELECTIONS} sélectionnés</span>
                </div>
                <Button
                  variant="hero"
                  size="xl"
                  onClick={handleMoviesContinue}
                  disabled={!canFinish}
                  className="text-sm"
                >
                  Continuer
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="platforms"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-start md:justify-center min-h-full px-4 md:px-6 py-6 md:py-0"
          >
            {/* Step indicator */}
            <div className="w-full max-w-xl mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-1 flex-1 rounded-full bg-primary" />
                <div className="h-1 flex-1 rounded-full bg-primary" />
              </div>
              <p className="text-muted-foreground text-xs font-sans">Étape 2/2</p>
            </div>

            <motion.h2
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-2xl md:text-4xl font-serif mb-2 text-center"
            >
              Tes plateformes de streaming
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="text-muted-foreground text-xs md:text-sm font-sans mb-8 md:mb-10 text-center"
            >
              Sélectionne tes abonnements pour des recommandations adaptées
            </motion.p>

            <div className="grid grid-cols-4 gap-2 md:gap-4 max-w-xl w-full mb-8 md:mb-10">
              {platforms.map((platform, i) => {
                const isSelected = selectedPlatforms.includes(platform.id);
                return (
                  <motion.button
                    key={platform.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ delay: i * 0.04, duration: 0.3, ease: "easeOut" }}
                    onClick={() => togglePlatform(platform.id)}
                    className={`relative bg-card rounded-xl md:rounded-2xl p-2.5 md:p-5 flex flex-col items-center gap-1.5 md:gap-2.5 transition-all duration-200 hover:scale-[1.02] cursor-pointer border ${
                      isSelected
                        ? "border-primary neon-glow"
                        : "border-transparent hover:border-primary/30"
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-1 right-1 md:top-2 md:right-2 w-4 h-4 md:w-5 md:h-5 rounded-full bg-primary flex items-center justify-center"
                      >
                        <Check className="w-2.5 h-2.5 md:w-3 md:h-3 text-primary-foreground" />
                      </motion.div>
                    )}
                    <img
                      src={platform.logo}
                      alt={platform.label}
                      className="w-8 h-8 md:w-12 md:h-12 rounded-lg object-cover"
                    />
                    <span className="font-sans text-[10px] md:text-sm tracking-wide text-foreground/90 leading-tight text-center">
                      {platform.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 items-center"
            >
              <Button
                variant="hero"
                size="xl"
                onClick={handleFinish}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {selectedPlatforms.length === 0 ? "Passer" : "Terminer"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
              <button
                onClick={() => setOnboardingStep("movies")}
                className="text-muted-foreground text-sm font-sans hover:text-foreground transition-colors"
              >
                Retour
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Onboarding;
