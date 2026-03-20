import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Bookmark, Heart, Loader2, Sparkles, X, Tv, Star, Clock, Play, Search, Filter, Timer, Trash2 } from "lucide-react";
import { getWatchlist, removeFromWatchlist } from "@/lib/watchlist";
import { getPosterUrl, getBackdropUrl, getMovieDetails, getDisplayTitle, getYear, getWatchProviders } from "@/lib/tmdb";
import { getLikedMovies, unlikeMovie } from "@/lib/liked-movies";
import type { MovieDetail } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import PickCharacter from "./PickCharacter";

interface WatchlistPageProps {
  onMovieSelect: (movie: MovieDetail) => void;
}

type MediaFilter = "all" | "movie" | "tv";
type ActiveTab = "watchlist" | "liked";

const PICK_COMMENTS = [
  "Tu l'as sauvegardé, c'est qu'il te fait de l'œil.",
  "Parfait pour un soir de semaine.",
  "Un classique à ne pas rater.",
  "Celui-ci attend son moment depuis un petit bout de temps.",
  "Idéal pour une soirée tranquille.",
];

const LIKED_COMMENTS = [
  "Un de tes coups de cœur.",
  "Tu as adoré celui-là !",
  "Un favori confirmé.",
  "Dans tes classiques personnels.",
  "Un titre qui t'a marqué.",
];

const ALL_GENRES = [
  "Action", "Aventure", "Animation", "Comédie", "Crime", "Documentaire",
  "Drame", "Familial", "Fantastique", "Histoire", "Horreur", "Musique",
  "Mystère", "Romance", "Science-Fiction", "Thriller", "Guerre", "Western",
];

const getPickBubbleMessage = (tab: ActiveTab, count: number, hour: number): string => {
  if (count === 0) return "";
  if (tab === "liked") {
    return `${count} titre${count > 1 ? "s" : ""} dans tes coups de cœur. Tes goûts parlent d'eux-mêmes !`;
  }
  if (hour >= 18 || hour < 4) {
    return `${count} titre${count > 1 ? "s" : ""} t'attend${count > 1 ? "ent" : ""}. Lequel ce soir ?`;
  }
  if (hour >= 12) {
    return `Tu as ${count} titre${count > 1 ? "s" : ""} en attente. Prépare ta soirée !`;
  }
  return `${count} titre${count > 1 ? "s" : ""} dans ta liste. On en parle ce soir ?`;
};

const SwipeableCard = ({
  item, index, onSelect, onRemove, comments,
}: {
  item: any; index: number; onSelect: () => void; onRemove: () => void; comments: string[];
}) => {
  const x = useMotionValue(0);
  const removeBgOpacity = useTransform(x, [-120, 0], [1, 0]);
  const handleDragEnd = (_: any, info: PanInfo) => { if (info.offset.x < -100) onRemove(); };
  const comment = comments[index % comments.length];
  const mediaType = item.media_type || (item.first_air_date ? "tv" : "movie");

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="relative overflow-hidden rounded-xl">
      <motion.div style={{ opacity: removeBgOpacity }} className="absolute inset-0 bg-destructive/20 flex items-center justify-end pr-5 rounded-xl">
        <span className="text-destructive text-xs font-sans font-medium">Retirer</span>
      </motion.div>
      <motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.3} onDragEnd={handleDragEnd} style={{ x }}
        className="relative flex items-start gap-3 p-3 bg-card/40 rounded-xl border border-border/10 hover:bg-card/60 transition-colors">
        <button onClick={onSelect} className="flex items-start gap-3 flex-1 min-w-0 text-left">
          {item.poster_path ? (
            <img src={getPosterUrl(item.poster_path, "w185")} alt={item.title} className="w-14 h-[84px] rounded-lg object-cover border border-border/20 shrink-0" loading="lazy" />
          ) : (
            <div className="w-14 h-[84px] rounded-lg bg-foreground/5 shrink-0" />
          )}
          <div className="flex-1 min-w-0 py-0.5">
            <p className="text-sm font-sans font-medium text-foreground line-clamp-1 mb-0.5">{item.title}</p>
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-[11px] text-foreground/40 font-sans capitalize">{mediaType === "tv" ? "Série" : "Film"}</p>
              {item.runtime && <span className="text-[10px] text-foreground/30 font-sans flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{item.runtime} min</span>}
            </div>
            {item.genres && item.genres.length > 0 && (
              <div className="flex gap-1 flex-wrap mb-1">
                {item.genres.slice(0, 2).map((g: string) => (
                  <span key={g} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/8 text-primary/60 font-sans">{g}</span>
                ))}
              </div>
            )}
            <p className="text-[10px] text-primary/50 font-sans italic line-clamp-1">💬 {comment}</p>
          </div>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="shrink-0 self-center w-8 h-8 rounded-full flex items-center justify-center text-foreground/25 hover:text-destructive hover:bg-destructive/10 transition-all active:scale-90"
          aria-label="Supprimer">
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </motion.div>
  );
};

/* ── Movie Preview Sheet ── */
const MoviePreviewSheet = ({
  movie, providers, personalNote, onWatch, onClose,
}: {
  movie: MovieDetail; providers: { name: string; logo_path: string }[]; personalNote: string; onWatch: () => void; onClose: () => void;
}) => {
  const title = getDisplayTitle(movie);
  const year = getYear(movie);
  const runtime = movie.runtime || movie.episode_run_time?.[0] || 0;
  const rating = movie.vote_average || 0;
  const backdrop = getBackdropUrl(movie.backdrop_path);
  const poster = getPosterUrl(movie.poster_path, "w342");

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm" />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[56] max-h-[85vh] rounded-t-3xl bg-card overflow-hidden flex flex-col pb-safe">
        <div className="relative h-44 shrink-0 overflow-hidden">
          {backdrop ? <img src={backdrop} alt="" className="w-full h-full object-cover" /> :
           poster ? <img src={poster} alt="" className="w-full h-full object-cover blur-sm scale-110" /> :
           <div className="w-full h-full bg-foreground/5" />}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 flex items-end gap-4">
            {poster && <img src={poster} alt={title} className="w-20 h-[120px] rounded-xl object-cover border border-border/20 shadow-xl shrink-0 -mb-2" />}
            <div className="flex-1 min-w-0 pb-1">
              <h2 className="text-xl font-serif text-foreground leading-tight line-clamp-2">{title}</h2>
              <div className="flex items-center gap-3 mt-1 text-foreground/50 text-[11px] font-sans">
                {year && <span>{year}</span>}
                {runtime > 0 && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{runtime} min</span>}
                {rating > 0 && <span className="flex items-center gap-0.5 text-primary"><Star className="w-3 h-3 fill-primary" />{rating.toFixed(1)}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {movie.genres && movie.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {movie.genres.map((g) => <span key={g.id} className="px-2.5 py-1 rounded-full bg-primary/8 border border-primary/15 text-primary/70 text-[11px] font-sans">{g.name}</span>)}
            </div>
          )}
          {personalNote && (
            <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/15">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-primary/70 text-[12px] font-sans leading-relaxed italic">{personalNote}</p>
            </div>
          )}
          {movie.overview && <p className="text-foreground/55 text-sm font-sans leading-relaxed mb-5">{movie.overview}</p>}
          {providers.length > 0 && (
            <div className="flex items-center gap-2 mb-5">
              <span className="text-foreground/30 text-[11px] font-sans">Dispo sur</span>
              <div className="flex gap-1.5">
                {providers.map((p) => <img key={p.name} src={`https://image.tmdb.org/t/p/w92${p.logo_path}`} alt={p.name} className="w-6 h-6 rounded-md object-cover border border-border/20" />)}
              </div>
            </div>
          )}
        </div>
        <div className="shrink-0 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 border-t border-border/10 bg-card">
          <Button size="lg" className="w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold h-12 gap-2.5 text-base neon-glow transition-all active:scale-[0.97]" onClick={onWatch}>
            <Tv className="w-4 h-4" />
            Je regarde
          </Button>
        </div>
      </motion.div>
    </>
  );
};

const WatchlistPage = ({ onMovieSelect }: WatchlistPageProps) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("watchlist");
  const [watchlistItems, setWatchlistItems] = useState<any[]>([]);
  const [likedItems, setLikedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [showGenreFilter, setShowGenreFilter] = useState(false);
  const [previewMovie, setPreviewMovie] = useState<MovieDetail | null>(null);
  const [previewProviders, setPreviewProviders] = useState<{ name: string; logo_path: string }[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewNote, setPreviewNote] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [watchlist, liked] = await Promise.all([getWatchlist(), getLikedMovies()]);
      setWatchlistItems(watchlist);
      setLikedItems(liked);
    } catch { setWatchlistItems([]); setLikedItems([]); }
    finally { setLoading(false); }
  };

  const currentItems = activeTab === "watchlist" ? watchlistItems : likedItems;

  // Compute available genres from current items
  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    currentItems.forEach((item: any) => {
      (item.genres || []).forEach((g: string) => genres.add(g));
    });
    return Array.from(genres).sort();
  }, [currentItems]);

  // Compute total watch time
  const totalWatchTime = useMemo(() => {
    return currentItems.reduce((acc: number, item: any) => acc + (item.runtime || 0), 0);
  }, [currentItems]);

  const filteredItems = useMemo(() => {
    return currentItems.filter((item: any) => {
      // Media type filter
      if (mediaFilter !== "all") {
        const mt = item.media_type || (item.first_air_date ? "tv" : "movie");
        if (mt !== mediaFilter) return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!item.title?.toLowerCase().includes(q)) return false;
      }
      // Genre filter
      if (genreFilter) {
        if (!item.genres || !item.genres.includes(genreFilter)) return false;
      }
      return true;
    });
  }, [currentItems, mediaFilter, searchQuery, genreFilter]);

  const mediaFilters: { id: MediaFilter; label: string }[] = [
    { id: "all", label: "Tout" },
    { id: "movie", label: "Films" },
    { id: "tv", label: "Séries" },
  ];

  const handleRemoveWatchlist = async (tmdbId: number) => {
    try { await removeFromWatchlist(tmdbId); setWatchlistItems(prev => prev.filter(i => i.tmdb_id !== tmdbId)); toast.success("Retiré de ta watchlist"); }
    catch { toast.error("Erreur"); }
  };

  const handleRemoveLiked = async (tmdbId: number) => {
    try { await unlikeMovie(tmdbId); setLikedItems(prev => prev.filter(i => i.tmdb_id !== tmdbId)); toast.success("Retiré de tes coups de cœur"); }
    catch { toast.error("Erreur"); }
  };

  const generatePersonalNote = async (movie: MovieDetail): Promise<string> => {
    try {
      const liked = likedItems.length > 0 ? likedItems : await getLikedMovies();
      const likedGenres = liked.flatMap((m: any) => m.genres || []);
      const genreCounts: Record<string, number> = {};
      likedGenres.forEach((g: string) => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
      const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
      const movieGenres = movie.genres?.map(g => g.name) || [];
      const matchingGenres = movieGenres.filter(g => topGenres.includes(g));
      if (matchingGenres.length > 0) {
        const genreStr = matchingGenres.join(" et ");
        const templates = [
          `Tu adores le ${genreStr} — ce titre est pile dans tes goûts.`,
          `Vu ton amour pour le ${genreStr}, celui-ci devrait te plaire.`,
          `Le ${genreStr}, c'est ton truc.`,
        ];
        return templates[Math.floor(Math.random() * templates.length)];
      }
      if (movie.vote_average && movie.vote_average >= 7.5) {
        return `Noté ${movie.vote_average.toFixed(1)}/10 — un titre très apprécié qui mérite le détour.`;
      }
      return activeTab === "liked"
        ? "Un de tes coups de cœur. Tu as du goût !"
        : "Tu l'as sauvegardé, c'est qu'il t'a tapé dans l'œil. Fais-toi confiance !";
    } catch { return ""; }
  };

  const handlePreview = async (item: any) => {
    setPreviewLoading(true); setPreviewNote("");
    try {
      const mediaType = item.media_type || (item.first_air_date ? "tv" : "movie");
      const movie = await getMovieDetails(item.tmdb_id, mediaType);
      setPreviewMovie(movie);
      getWatchProviders(movie.id, mediaType).then(setPreviewProviders).catch(() => setPreviewProviders([]));
      generatePersonalNote(movie).then(setPreviewNote);
    } catch (e) { console.error(e); }
    finally { setPreviewLoading(false); }
  };

  const handleWatchFromPreview = () => {
    if (previewMovie) { onMovieSelect(previewMovie); setPreviewMovie(null); }
  };

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
  };

  const hour = new Date().getHours();
  const bubbleMessage = getPickBubbleMessage(activeTab, currentItems.length, hour);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;
  }

  return (
    <div className="h-full overflow-y-auto px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-24">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-serif mb-3">Ma Collection</h1>
      </motion.div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
        className="flex gap-1 p-1 rounded-xl bg-muted/30 border border-border/15 mb-4">
        <button onClick={() => { setActiveTab("watchlist"); setMediaFilter("all"); setSearchQuery(""); setGenreFilter(null); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-sans font-medium transition-all ${activeTab === "watchlist" ? "bg-card shadow-sm text-foreground border border-border/20" : "text-foreground/40 hover:text-foreground/60"}`}>
          <Bookmark className="w-3.5 h-3.5" />
          Watchlist
          {watchlistItems.length > 0 && <span className="text-[10px] font-sans text-primary/60 font-medium px-1.5 py-0.5 rounded-full bg-primary/8">{watchlistItems.length}</span>}
        </button>
        <button onClick={() => { setActiveTab("liked"); setMediaFilter("all"); setSearchQuery(""); setGenreFilter(null); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-sans font-medium transition-all ${activeTab === "liked" ? "bg-card shadow-sm text-foreground border border-border/20" : "text-foreground/40 hover:text-foreground/60"}`}>
          <Heart className="w-3.5 h-3.5" />
          Coups de cœur
          {likedItems.length > 0 && <span className="text-[10px] font-sans text-primary/60 font-medium px-1.5 py-0.5 rounded-full bg-primary/8">{likedItems.length}</span>}
        </button>
      </motion.div>

      {/* Pick comment + time estimation */}
      {currentItems.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-4" key={activeTab}>
          <div className="flex items-start gap-2.5 mb-2">
            <div className="shrink-0 w-8 h-8"><PickCharacter mood="default" size="sm" animate={false} /></div>
            <div className="px-3.5 py-2.5 rounded-2xl bg-card/60 border border-border/15 flex-1">
              <p className="text-foreground/60 text-[12px] font-sans leading-relaxed">{bubbleMessage}</p>
            </div>
          </div>
          {totalWatchTime > 0 && activeTab === "watchlist" && (
            <div className="flex items-center gap-1.5 ml-10 text-foreground/30 text-[11px] font-sans">
              <Timer className="w-3 h-3" />
              <span>{formatTime(totalWatchTime)} de contenu dans ta watchlist</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Search + Filters */}
      {currentItems.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="space-y-2.5 mb-5">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/25" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un titre…"
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-card/40 border border-border/15 text-sm font-sans text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-primary/30 transition-colors"
            />
          </div>

          {/* Media + Genre filters row */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {mediaFilters.map(f => (
              <button key={f.id} onClick={() => setMediaFilter(f.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-sans font-medium border transition-all ${
                  mediaFilter === f.id ? "bg-primary/15 border-primary/30 text-primary" : "bg-card/40 border-border/15 text-foreground/40 hover:text-foreground/60"
                }`}>
                {f.label}
              </button>
            ))}
            <button onClick={() => setShowGenreFilter(!showGenreFilter)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-sans font-medium border transition-all flex items-center gap-1 ${
                genreFilter ? "bg-primary/15 border-primary/30 text-primary" : "bg-card/40 border-border/15 text-foreground/40 hover:text-foreground/60"
              }`}>
              <Filter className="w-3 h-3" />
              {genreFilter || "Genre"}
            </button>
          </div>

          {/* Genre dropdown */}
          <AnimatePresence>
            {showGenreFilter && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex flex-wrap gap-1.5 py-2">
                  <button onClick={() => { setGenreFilter(null); setShowGenreFilter(false); }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-sans font-medium border transition-all ${!genreFilter ? "bg-primary/15 border-primary/30 text-primary" : "bg-card/40 border-border/15 text-foreground/40"}`}>
                    Tous
                  </button>
                  {availableGenres.map(g => (
                    <button key={g} onClick={() => { setGenreFilter(g); setShowGenreFilter(false); }}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-sans font-medium border transition-all ${genreFilter === g ? "bg-primary/15 border-primary/30 text-primary" : "bg-card/40 border-border/15 text-foreground/40"}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* List */}
      {currentItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <PickCharacter
            mood="wave"
            message={activeTab === "watchlist"
              ? "Sauvegarde des titres et retrouve-les ici !"
              : "Like des films et séries pour construire tes goûts !"}
            size="md"
            animate
          />
          <p className="text-foreground/25 text-xs font-sans mt-4">
            {activeTab === "watchlist" ? "Ta watchlist est vide" : "Aucun coup de cœur pour l'instant"}
          </p>
          <Button
            onClick={() => window.dispatchEvent(new CustomEvent("pick-navigate-home"))}
            className="mt-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-sm px-5 gap-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Trouve-moi un film
          </Button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-foreground/30 text-sm font-sans">Aucun résultat{searchQuery ? ` pour "${searchQuery}"` : " avec ces filtres"}</p>
          <button onClick={() => { setMediaFilter("all"); setSearchQuery(""); setGenreFilter(null); }} className="mt-3 text-primary text-xs font-sans underline">
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item, i) => (
            <SwipeableCard
              key={item.id}
              item={item}
              index={i}
              onSelect={() => handlePreview(item)}
              onRemove={() => activeTab === "watchlist" ? handleRemoveWatchlist(item.tmdb_id) : handleRemoveLiked(item.tmdb_id)}
              comments={activeTab === "watchlist" ? PICK_COMMENTS : LIKED_COMMENTS}
            />
          ))}
        </div>
      )}

      {/* Loading overlay */}
      <AnimatePresence>
        {previewLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview sheet */}
      <AnimatePresence>
        {previewMovie && (
          <MoviePreviewSheet movie={previewMovie} providers={previewProviders} personalNote={previewNote}
            onWatch={handleWatchFromPreview} onClose={() => { setPreviewMovie(null); setPreviewProviders([]); setPreviewNote(""); }} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default WatchlistPage;
