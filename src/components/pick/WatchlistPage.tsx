import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Bookmark, Loader2, Sparkles, X, Tv, Star, Clock, Play } from "lucide-react";
import { getWatchlist, removeFromWatchlist } from "@/lib/watchlist";
import { getPosterUrl, getBackdropUrl, getMovieDetails, getDisplayTitle, getYear, getWatchProviders } from "@/lib/tmdb";
import type { MovieDetail } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import PickCharacter from "./PickCharacter";

interface WatchlistPageProps {
  onMovieSelect: (movie: MovieDetail) => void;
}

type MediaFilter = "all" | "movie" | "tv";


const PICK_COMMENTS = [
  "Tu l'as sauvegardé, c'est qu'il te fait de l'œil.",
  "Parfait pour un soir de semaine.",
  "Un classique à ne pas rater.",
  "Celui-ci attend son moment depuis un petit bout de temps.",
  "Idéal pour une soirée tranquille.",
];

const getPickBubbleMessage = (count: number, hour: number): string => {
  if (count === 0) return "";
  if (hour >= 18 || hour < 4) {
    return `${count} film${count > 1 ? "s" : ""} t'attend${count > 1 ? "ent" : ""}. Lequel ce soir ?`;
  }
  if (hour >= 12) {
    return `Tu as ${count} film${count > 1 ? "s" : ""} en attente. Prépare ta soirée !`;
  }
  return `${count} film${count > 1 ? "s" : ""} dans ta liste. On en parle ce soir ?`;
};

const SwipeableCard = ({
  item,
  index,
  onSelect,
  onRemove,
}: {
  item: any;
  index: number;
  onSelect: () => void;
  onRemove: () => void;
}) => {
  const x = useMotionValue(0);
  const removeBgOpacity = useTransform(x, [-120, 0], [1, 0]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -100) {
      onRemove();
    }
  };

  const comment = PICK_COMMENTS[index % PICK_COMMENTS.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="relative overflow-hidden rounded-xl"
    >
      <motion.div
        style={{ opacity: removeBgOpacity }}
        className="absolute inset-0 bg-destructive/20 flex items-center justify-end pr-5 rounded-xl"
      >
        <span className="text-destructive text-xs font-sans font-medium">Retirer</span>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative flex items-start gap-3 p-3 bg-card/40 rounded-xl border border-border/10 hover:bg-card/60 transition-colors"
      >
        <button onClick={onSelect} className="flex items-start gap-3 flex-1 min-w-0 text-left">
          {item.poster_path ? (
            <img
              src={getPosterUrl(item.poster_path, "w185")}
              alt={item.title}
              className="w-14 h-[84px] rounded-lg object-cover border border-border/20 shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="w-14 h-[84px] rounded-lg bg-foreground/5 shrink-0" />
          )}
          <div className="flex-1 min-w-0 py-0.5">
            <p className="text-sm font-sans font-medium text-foreground line-clamp-1 mb-0.5">
              {item.title}
            </p>
            <p className="text-[11px] text-foreground/40 font-sans capitalize mb-1.5">
              {item.media_type === "tv" ? "Série" : "Film"}
            </p>
            <p className="text-[10px] text-primary/50 font-sans italic line-clamp-1">
              💬 {comment}
            </p>
          </div>
        </button>
      </motion.div>
    </motion.div>
  );
};

/* ── Movie Preview Sheet ── */
const MoviePreviewSheet = ({
  movie,
  providers,
  onWatch,
  onClose,
}: {
  movie: MovieDetail;
  providers: { name: string; logo_path: string }[];
  onWatch: () => void;
  onClose: () => void;
}) => {
  const title = getDisplayTitle(movie);
  const year = getYear(movie);
  const runtime = movie.runtime || movie.episode_run_time?.[0] || 0;
  const rating = movie.vote_average || 0;
  const backdrop = getBackdropUrl(movie.backdrop_path);
  const poster = getPosterUrl(movie.poster_path, "w342");

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[56] max-h-[88vh] rounded-t-3xl bg-card overflow-hidden flex flex-col"
      >
        {/* Backdrop header */}
        <div className="relative h-44 shrink-0 overflow-hidden">
          {backdrop ? (
            <img src={backdrop} alt="" className="w-full h-full object-cover" />
          ) : poster ? (
            <img src={poster} alt="" className="w-full h-full object-cover blur-sm scale-110" />
          ) : (
            <div className="w-full h-full bg-foreground/5" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Poster + title overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 flex items-end gap-4">
            {poster && (
              <img
                src={poster}
                alt={title}
                className="w-20 h-[120px] rounded-xl object-cover border border-border/20 shadow-xl shrink-0 -mb-2"
              />
            )}
            <div className="flex-1 min-w-0 pb-1">
              <h2 className="text-xl font-serif text-foreground leading-tight line-clamp-2">{title}</h2>
              <div className="flex items-center gap-3 mt-1 text-foreground/50 text-[11px] font-sans">
                {year && <span>{year}</span>}
                {runtime > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {runtime} min
                  </span>
                )}
                {rating > 0 && (
                  <span className="flex items-center gap-0.5 text-primary">
                    <Star className="w-3 h-3 fill-primary" />
                    {rating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Genres */}
          {movie.genres && movie.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {movie.genres.map((g) => (
                <span
                  key={g.id}
                  className="px-2.5 py-1 rounded-full bg-primary/8 border border-primary/15 text-primary/70 text-[11px] font-sans"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {/* Overview */}
          {movie.overview && (
            <p className="text-foreground/55 text-sm font-sans leading-relaxed mb-5">
              {movie.overview}
            </p>
          )}

          {/* Providers */}
          {providers.length > 0 && (
            <div className="flex items-center gap-2 mb-5">
              <span className="text-foreground/30 text-[11px] font-sans">Dispo sur</span>
              <div className="flex gap-1.5">
                {providers.map((p) => (
                  <img
                    key={p.name}
                    src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                    alt={p.name}
                    className="w-6 h-6 rounded-md object-cover border border-border/20"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="shrink-0 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 border-t border-border/10 bg-card">
          <Button
            size="lg"
            className="w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold h-13 gap-2.5 text-base neon-glow transition-all active:scale-[0.97]"
            onClick={onWatch}
          >
            <Play className="w-4 h-4 fill-current" />
            Voir la fiche complète
          </Button>
        </div>
      </motion.div>
    </>
  );
};

const WatchlistPage = ({ onMovieSelect }: WatchlistPageProps) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [previewMovie, setPreviewMovie] = useState<MovieDetail | null>(null);
  const [previewMovie, setPreviewMovie] = useState<MovieDetail | null>(null);
  const [previewProviders, setPreviewProviders] = useState<{ name: string; logo_path: string }[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    setLoading(true);
    try {
      const data = await getWatchlist();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  const filteredItems = items.filter((item: any) => {
    if (mediaFilter !== "all" && item.media_type !== mediaFilter) return false;
    return true;
  });

  const mediaFilters: { id: MediaFilter; label: string }[] = [
    { id: "all", label: "Tout" },
    { id: "movie", label: "Films" },
    { id: "tv", label: "Séries" },
  ];

  const handleRemove = async (tmdbId: number) => {
    try {
      await removeFromWatchlist(tmdbId);
      setItems(prev => prev.filter(i => i.tmdb_id !== tmdbId));
      toast.success("Retiré de ta watchlist");
    } catch {
      toast.error("Erreur");
    }
  };

  const handlePreview = async (item: any) => {
    setPreviewLoading(true);
    try {
      const mediaType = item.media_type || "movie";
      const movie = await getMovieDetails(item.tmdb_id, mediaType);
      setPreviewMovie(movie);
      getWatchProviders(movie.id, mediaType).then(setPreviewProviders).catch(() => setPreviewProviders([]));
    } catch (e) {
      console.error(e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleWatchFromPreview = () => {
    if (previewMovie) {
      onMovieSelect(previewMovie);
      setPreviewMovie(null);
    }
  };

  const hour = new Date().getHours();
  const bubbleMessage = getPickBubbleMessage(items.length, hour);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-24">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-baseline gap-3 mb-1">
          <h1 className="text-2xl font-serif">Ta Watchlist</h1>
          <span className="text-[12px] font-sans text-primary/60 font-medium px-2 py-0.5 rounded-full bg-primary/8 border border-primary/15">
            {filteredItems.length}/{items.length}
          </span>
        </div>
      </motion.div>

      {/* Pick's contextual comment */}
      {items.length > 0 && bubbleMessage && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-start gap-2.5 mt-3 mb-4"
        >
          <div className="shrink-0 w-8 h-8">
            <PickCharacter mood="default" size="sm" animate={false} />
          </div>
          <div className="px-3.5 py-2.5 rounded-2xl bg-card/60 border border-border/15 flex-1">
            <p className="text-foreground/60 text-[12px] font-sans leading-relaxed">
              {bubbleMessage}
            </p>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="space-y-2.5 mb-5"
        >
          {/* Type filter */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {mediaFilters.map(f => (
              <button
                key={f.id}
                onClick={() => setMediaFilter(f.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-sans font-medium border transition-all ${
                  mediaFilter === f.id
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-card/40 border-border/15 text-foreground/40 hover:text-foreground/60"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Duration filter */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {durationFilters.map(f => (
              <button
                key={f.id}
                onClick={() => setDurationFilter(f.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-sans font-medium border transition-all ${
                  durationFilter === f.id
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-card/40 border-border/15 text-foreground/40 hover:text-foreground/60"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Genre filter */}
          {allGenres.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setGenreFilter("all")}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-sans font-medium border transition-all ${
                  genreFilter === "all"
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-card/40 border-border/15 text-foreground/40 hover:text-foreground/60"
                }`}
              >
                Tous genres
              </button>
              {allGenres.map(g => (
                <button
                  key={g}
                  onClick={() => setGenreFilter(g)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-sans font-medium border transition-all ${
                    genreFilter === g
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-card/40 border-border/15 text-foreground/40 hover:text-foreground/60"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <PickCharacter mood="wave" message="Sauvegarde des films et retrouve-les ici !" size="md" animate />
          <p className="text-foreground/25 text-xs font-sans mt-4">Ta watchlist est vide</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-foreground/30 text-sm font-sans">Aucun résultat avec ces filtres</p>
          <button
            onClick={() => { setMediaFilter("all"); setDurationFilter("all"); setGenreFilter("all"); }}
            className="mt-3 text-primary text-xs font-sans underline"
          >
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
              onRemove={() => handleRemove(item.tmdb_id)}
            />
          ))}
        </div>
      )}

      {/* Loading overlay for preview */}
      <AnimatePresence>
        {previewLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
          >
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview sheet */}
      <AnimatePresence>
        {previewMovie && (
          <MoviePreviewSheet
            movie={previewMovie}
            providers={previewProviders}
            onWatch={handleWatchFromPreview}
            onClose={() => { setPreviewMovie(null); setPreviewProviders([]); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default WatchlistPage;
