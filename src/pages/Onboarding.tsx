import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Heart, Check, ArrowRight, Loader2, Sun, Moon, User, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { likeMovie } from "@/lib/liked-movies";
import { getPopularMoviesForOnboarding, searchMovies, getPosterUrl, getDisplayTitle, getMovieDetails } from "@/lib/tmdb";
import type { Movie } from "@/lib/tmdb";
import type { StreamingPlatform } from "@/components/pick/PlatformStep";
import pickLogo from "@/assets/pick-logo.png";

const MIN_MOVIE_SELECTIONS = 5;

const ALL_GENRES = [
  "Action", "Aventure", "Animation", "Comédie", "Crime", "Documentaire",
  "Drame", "Famille", "Fantastique", "Histoire", "Horreur", "Musique",
  "Mystère", "Romance", "Science-Fiction", "Thriller", "Guerre", "Western",
];

const VIEWING_HABITS = [
  { id: "evening", label: "Le soir", icon: Moon, desc: "Après le boulot" },
  { id: "daytime", label: "En journée", icon: Sun, desc: "Weekend / jours off" },
  { id: "alone", label: "Seul·e", icon: User, desc: "Mon moment à moi" },
  { id: "together", label: "À plusieurs", icon: Users, desc: "En couple ou entre amis" },
];

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

type OnboardingStep = "genres" | "habits" | "movies" | "platforms";
const STEPS: OnboardingStep[] = ["genres", "habits", "movies", "platforms"];

const Onboarding = () => {
  const [step, setStep] = useState<OnboardingStep>("genres");
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [selectedHabits, setSelectedHabits] = useState<Set<string>>(new Set());
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Movie[] | null>(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<number[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const navigate = useNavigate();

  const stepIndex = STEPS.indexOf(step) + 1;
  const totalSteps = STEPS.length;

  const getMovieKey = (movie: Pick<Movie, "id" | "media_type" | "first_air_date">) => {
    const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");
    return `${mediaType}-${movie.id}`;
  };

  useEffect(() => {
    getPopularMoviesForOnboarding(1).then(setMovies).catch(console.error);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    const timer = setTimeout(() => {
      searchMovies(searchQuery).then(setSearchResults).catch(console.error);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const more = await getPopularMoviesForOnboarding(nextPage);
      setMovies(prev => {
        const existingKeys = new Set(prev.map(getMovieKey));
        return [...prev, ...more.filter(m => !existingKeys.has(getMovieKey(m)))];
      });
      setPage(nextPage);
    } catch (e) { console.error("loadMore error:", e); }
    finally { setLoadingMore(false); }
  }, [page, loadingMore]);

  const toggleGenre = (g: string) => {
    setSelectedGenres(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  const toggleHabit = (id: string) => {
    setSelectedHabits(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelect = (movie: Movie) => {
    const movieKey = getMovieKey(movie);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(movieKey)) next.delete(movieKey); else next.add(movieKey);
      return next;
    });
  };

  const togglePlatform = (id: number) => {
    setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const allMovies = searchResults || movies;
      const selectedMovies = allMovies.filter(m => selectedIds.has(getMovieKey(m)));
      const selectedFromGrid = movies.filter(m => selectedIds.has(getMovieKey(m)));
      const allSelected = [...new Map([...selectedMovies, ...selectedFromGrid].map(m => [getMovieKey(m), m])).values()];

      for (const movie of allSelected) {
        try {
          const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");
          const detail = await getMovieDetails(movie.id, mediaType);
          await likeMovie(detail);
        } catch (e) { console.error("Failed to like movie:", movie.id, e); }
      }

      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (userId) {
        await supabase.from("profiles").update({
          onboarding_completed: true,
          favorite_genres: Array.from(selectedGenres).slice(0, 8),
          preferred_platforms: selectedPlatforms,
        }).eq("id", userId);
      }

      navigate("/app");
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const displayMovies = (searchResults || movies).filter((movie): movie is Movie => Boolean(movie && typeof movie.id === "number"));
  const canContinueGenres = selectedGenres.size >= 2;
  const canContinueMovies = selectedIds.size >= MIN_MOVIE_SELECTIONS;

  const renderStepIndicator = () => (
    <div className="w-full max-w-2xl mx-auto mb-2">
      <div className="flex items-center gap-2 mb-2">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < stepIndex ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>
      <p className="text-muted-foreground text-xs font-sans">Étape {stepIndex}/{totalSteps}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <AnimatePresence mode="wait">
        {/* ── Step 1: Genres ── */}
        {step === "genres" && (
          <motion.div
            key="genres"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-start md:justify-center min-h-full px-5 py-6 md:py-0"
          >
            <div className="w-full max-w-xl pt-[env(safe-area-inset-top)]">
              {renderStepIndicator()}
            </div>

            <div className="flex items-center gap-3 mb-2 mt-4">
              <img src={pickLogo} alt="Pick" className="w-10 h-10 object-contain" />
              <h1 className="text-2xl md:text-4xl font-serif">Qu'est-ce qui te plaît ?</h1>
            </div>
            <p className="text-muted-foreground text-sm font-sans mb-8 text-center">
              Choisis au moins 2 genres que tu aimes
            </p>

            <div className="flex flex-wrap gap-2 justify-center max-w-xl mb-10">
              {ALL_GENRES.map((genre) => {
                const isSelected = selectedGenres.has(genre);
                return (
                  <motion.button
                    key={genre}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleGenre(genre)}
                    className={`px-4 py-2.5 rounded-full text-sm font-sans font-medium transition-all duration-200 cursor-pointer border ${
                      isSelected
                        ? "bg-primary/15 border-primary/30 text-primary"
                        : "bg-card border-transparent text-foreground/60 hover:border-primary/20 hover:text-foreground"
                    }`}
                  >
                    {genre}
                  </motion.button>
                );
              })}
            </div>

            <Button
              variant="hero"
              size="xl"
              onClick={() => setStep("habits")}
              disabled={!canContinueGenres}
            >
              Continuer
              <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        )}

        {/* ── Step 2: Habits ── */}
        {step === "habits" && (
          <motion.div
            key="habits"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-start md:justify-center min-h-full px-5 py-6 md:py-0"
          >
            <div className="w-full max-w-xl pt-[env(safe-area-inset-top)]">
              {renderStepIndicator()}
            </div>

            <h1 className="text-2xl md:text-4xl font-serif mb-2 mt-4 text-center">Comment tu regardes ?</h1>
            <p className="text-muted-foreground text-sm font-sans mb-8 text-center">
              Dis-nous tes habitudes pour mieux te connaître
            </p>

            <div className="grid grid-cols-2 gap-3 max-w-md w-full mb-10">
              {VIEWING_HABITS.map((habit) => {
                const isSelected = selectedHabits.has(habit.id);
                const Icon = habit.icon;
                return (
                  <motion.button
                    key={habit.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleHabit(habit.id)}
                    className={`relative rounded-xl p-4 flex flex-col items-center gap-2 transition-all duration-200 cursor-pointer border ${
                      isSelected
                        ? "bg-primary/10 border-primary/30"
                        : "bg-card border-transparent hover:border-primary/20"
                    }`}
                  >
                    {isSelected && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                      </motion.div>
                    )}
                    <Icon className={`w-6 h-6 ${isSelected ? "text-primary" : "text-foreground/50"}`} />
                    <span className={`font-sans text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground/80"}`}>{habit.label}</span>
                    <span className="text-[10px] text-muted-foreground font-sans">{habit.desc}</span>
                  </motion.button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <Button variant="hero" size="xl" onClick={() => setStep("movies")}>
                Continuer
                <ArrowRight className="w-4 h-4" />
              </Button>
              <button onClick={() => setStep("genres")} className="text-muted-foreground text-sm font-sans hover:text-foreground transition-colors">
                Retour
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 3: Movies (5 minimum) ── */}
        {step === "movies" && (
          <motion.div
            key="movies"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col h-full"
          >
            <div className="flex-shrink-0 px-5 pt-[calc(1rem+env(safe-area-inset-top))]">
              {renderStepIndicator()}
            </div>

            <div className="flex-shrink-0 px-5 pt-3 pb-4">
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
                <h1 className="text-2xl md:text-4xl font-serif mb-2">Qu'as-tu apprécié récemment ?</h1>
                <p className="text-muted-foreground text-sm font-sans mb-4">
                  Sélectionne au moins {MIN_MOVIE_SELECTIONS} films ou séries — on apprend vite !
                </p>
                {/* Search — secondary, collapsed by default */}
                {!showSearch ? (
                  <button
                    onClick={() => setShowSearch(true)}
                    className="flex items-center gap-2 text-muted-foreground/60 text-xs font-sans hover:text-primary transition-colors"
                  >
                    <Search className="w-3.5 h-3.5" />
                    Tu ne trouves pas ? Rechercher un titre
                  </button>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Rechercher un film ou une série…"
                      className="w-full bg-card border border-border/30 rounded-xl px-10 py-2.5 text-sm font-sans text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                      autoFocus
                    />
                    <button
                      onClick={() => { setSearchQuery(""); setShowSearch(false); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </motion.div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-28">
              <div className="max-w-2xl mx-auto">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-3">
                  {displayMovies.map((movie, i) => {
                    const movieKey = getMovieKey(movie);
                    const isSelected = selectedIds.has(movieKey);
                    return (
                      <motion.button
                        key={movieKey}
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
                          isSelected ? "bg-primary/30 border-2 border-primary rounded-xl" : "bg-transparent hover:bg-foreground/10"
                        }`} />
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg">
                              <Heart className="w-3.5 h-3.5 text-primary-foreground fill-primary-foreground" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[10px] font-sans text-foreground/90 line-clamp-2 leading-tight">{getDisplayTitle(movie)}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
                {!searchResults && (
                  <div className="flex justify-center py-6">
                    <Button variant="ghost" onClick={loadMore} disabled={loadingMore} className="text-muted-foreground text-sm font-sans">
                      {loadingMore && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Voir plus
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/20 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="max-w-2xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => setStep("habits")} className="text-muted-foreground text-sm font-sans hover:text-foreground transition-colors">
                    Retour
                  </button>
                  <div className="text-sm font-sans">
                    <span className={`font-semibold ${canContinueMovies ? "text-primary" : "text-foreground"}`}>{selectedIds.size}</span>
                    <span className="text-muted-foreground"> / {MIN_MOVIE_SELECTIONS} sélectionnés</span>
                  </div>
                </div>
                <Button variant="hero" size="xl" onClick={() => setStep("platforms")} disabled={!canContinueMovies} className="text-sm">
                  Continuer
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ── Step 4: Platforms ── */}
        {step === "platforms" && (
          <motion.div
            key="platforms"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-start md:justify-center min-h-full px-4 md:px-6 py-6 md:py-0"
          >
            <div className="w-full max-w-xl pt-[env(safe-area-inset-top)]">
              {renderStepIndicator()}
            </div>

            <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl md:text-4xl font-serif mb-2 text-center mt-4">
              Tes plateformes de streaming
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="text-muted-foreground text-xs md:text-sm font-sans mb-8 md:mb-10 text-center">
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
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    onClick={() => togglePlatform(platform.id)}
                    className={`relative bg-card rounded-xl md:rounded-2xl p-2.5 md:p-5 flex flex-col items-center gap-1.5 md:gap-2.5 transition-all duration-200 hover:scale-[1.02] cursor-pointer border ${
                      isSelected ? "border-primary neon-glow" : "border-transparent hover:border-primary/30"
                    }`}
                  >
                    {isSelected && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-1 right-1 md:top-2 md:right-2 w-4 h-4 md:w-5 md:h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 md:w-3 md:h-3 text-primary-foreground" />
                      </motion.div>
                    )}
                    <img src={platform.logo} alt={platform.label} className="w-8 h-8 md:w-12 md:h-12 rounded-lg object-cover" />
                    <span className="font-sans text-[10px] md:text-sm tracking-wide text-foreground/90 leading-tight text-center">{platform.label}</span>
                  </motion.button>
                );
              })}
            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex flex-col sm:flex-row gap-3 items-center">
              <Button variant="hero" size="xl" onClick={handleFinish} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>{selectedPlatforms.length === 0 ? "Passer" : "C'est parti !"}<ArrowRight className="w-4 h-4" /></>
                )}
              </Button>
              <button onClick={() => setStep("movies")} className="text-muted-foreground text-sm font-sans hover:text-foreground transition-colors">
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
