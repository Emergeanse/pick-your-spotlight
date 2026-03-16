import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Bookmark, Loader2, Sparkles } from "lucide-react";
import { getWatchlist, removeFromWatchlist } from "@/lib/watchlist";
import { getPosterUrl, getMovieDetails, getDisplayTitle } from "@/lib/tmdb";
import type { MovieDetail } from "@/lib/tmdb";
import { toast } from "sonner";
import PickCharacter from "./PickCharacter";

interface WatchlistPageProps {
  onMovieSelect: (movie: MovieDetail) => void;
}

type FilterChip = "ce-soir" | "court" | "en-couple";

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
  const bgOpacity = useTransform(x, [-120, 0, 120], [1, 0, 0]);
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
      {/* Swipe background - remove */}
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

const WatchlistPage = ({ onMovieSelect }: WatchlistPageProps) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterChip>("ce-soir");

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

  const handleRemove = async (tmdbId: number) => {
    try {
      await removeFromWatchlist(tmdbId);
      setItems(prev => prev.filter(i => i.tmdb_id !== tmdbId));
      toast.success("Retiré de ta watchlist");
    } catch {
      toast.error("Erreur");
    }
  };

  const handleSelect = async (item: any) => {
    try {
      const movie = await getMovieDetails(item.tmdb_id, item.media_type || "movie");
      onMovieSelect(movie);
    } catch (e) {
      console.error(e);
    }
  };

  const filters: { id: FilterChip; label: string }[] = [
    { id: "ce-soir", label: "Ce soir" },
    { id: "court", label: "Court (< 1h30)" },
    { id: "en-couple", label: "En couple" },
  ];

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
            {items.length} film{items.length !== 1 ? "s" : ""}
          </span>
        </div>
      </motion.div>

      {/* Pick's contextual comment */}
      {items.length > 0 && bubbleMessage && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-start gap-2.5 mt-3 mb-5"
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

      {/* Filter chips */}
      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide"
        >
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-sans font-medium border transition-all ${
                activeFilter === f.id
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-card/40 border-border/15 text-foreground/40 hover:text-foreground/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </motion.div>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <PickCharacter mood="wave" message="Sauvegarde des films et retrouve-les ici !" size="md" animate />
          <p className="text-foreground/25 text-xs font-sans mt-4">Ta watchlist est vide</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <SwipeableCard
              key={item.id}
              item={item}
              index={i}
              onSelect={() => handleSelect(item)}
              onRemove={() => handleRemove(item.tmdb_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default WatchlistPage;
