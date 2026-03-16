import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bookmark, Loader2, Trash2 } from "lucide-react";
import { getWatchlist, removeFromWatchlist } from "@/lib/watchlist";
import { getPosterUrl, getMovieDetails, getDisplayTitle } from "@/lib/tmdb";
import type { MovieDetail } from "@/lib/tmdb";
import { toast } from "sonner";

interface WatchlistPageProps {
  onMovieSelect: (movie: MovieDetail) => void;
}

const WatchlistPage = ({ onMovieSelect }: WatchlistPageProps) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-serif mb-1">Ma watchlist</h1>
        <p className="text-muted-foreground text-sm font-sans mb-6">
          {items.length} {items.length > 1 ? "titres" : "titre"} à regarder
        </p>
      </motion.div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bookmark className="w-10 h-10 text-foreground/15 mb-4" />
          <p className="text-foreground/40 text-sm font-sans mb-1">Ta watchlist est vide</p>
          <p className="text-foreground/25 text-xs font-sans">Sauvegarde des films pour les retrouver ici</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-card/60 transition-colors group"
            >
              <button onClick={() => handleSelect(item)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                {item.poster_path ? (
                  <img
                    src={getPosterUrl(item.poster_path, "w185")}
                    alt={item.title}
                    className="w-12 h-[72px] rounded-lg object-cover border border-border/20 shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-12 h-[72px] rounded-lg bg-foreground/5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-sans font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-foreground/40 font-sans capitalize">
                    {item.media_type === "tv" ? "Série" : "Film"}
                  </p>
                </div>
              </button>
              <button
                onClick={() => handleRemove(item.tmdb_id)}
                className="p-2 rounded-full text-foreground/20 hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WatchlistPage;
