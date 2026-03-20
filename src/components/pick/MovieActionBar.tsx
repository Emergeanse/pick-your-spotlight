import { useState, useEffect } from "react";
import { Bookmark, Heart, Eye, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { likeMovie, unlikeMovie, isMovieLiked } from "@/lib/liked-movies";
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from "@/lib/watchlist";
import { trackInteraction } from "@/lib/interactions";
import type { MovieDetail } from "@/lib/tmdb";

interface MovieActionBarProps {
  movie: MovieDetail;
  size?: "sm" | "md";
  className?: string;
  onInteraction?: (type: string) => void;
}

const MovieActionBar = ({ movie, size = "md", className = "", onInteraction }: MovieActionBarProps) => {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    isMovieLiked(movie.id).then(setLiked).catch(() => {});
    isInWatchlist(movie.id).then(setBookmarked).catch(() => {});
  }, [movie.id, user]);

  const requireAuth = () => {
    if (!user) { toast.info("Connecte-toi pour enrichir ton profil !"); return false; }
    return true;
  };

  const handleToggleBookmark = async () => {
    if (!requireAuth()) return;
    setBookmarkLoading(true);
    try {
      if (bookmarked) {
        await removeFromWatchlist(movie.id);
        setBookmarked(false);
        toast.success("Retiré de ta watchlist");
        trackInteraction(movie.id, "unsaved");
      } else {
        await addToWatchlist(movie);
        setBookmarked(true);
        toast.success("Ajouté à ta watchlist !");
        trackInteraction(movie.id, "saved");
        window.dispatchEvent(new CustomEvent("pick-watchlist-added"));
      }
    } catch { toast.error("Erreur"); }
    finally { setBookmarkLoading(false); }
  };

  const handleToggleLike = async () => {
    if (!requireAuth()) return;
    setLikeLoading(true);
    try {
      if (liked) {
        await unlikeMovie(movie.id);
        setLiked(false);
        toast.success("Retiré des favoris");
        trackInteraction(movie.id, "unliked");
      } else {
        await likeMovie(movie);
        setLiked(true);
        toast.success("Ajouté aux favoris !");
        trackInteraction(movie.id, "liked");
      }
    } catch { toast.error("Erreur"); }
    finally { setLikeLoading(false); }
  };

  const handleAlreadySeen = () => {
    if (!requireAuth()) return;
    trackInteraction(movie.id, "already_seen", {});
    toast.success("Marqué comme déjà vu");
    onInteraction?.("already_seen");
  };

  const handleDislike = () => {
    if (!requireAuth()) return;
    trackInteraction(movie.id, "skipped", {
      reason: "dislike",
      genres: (movie.genres || []).map(g => g.name),
    });
    toast.success("Noté — Pick en tiendra compte");
    onInteraction?.("dislike");
  };

  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const btnSize = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const fontSize = size === "sm" ? "text-[8px]" : "text-[9px]";

  return (
    <div className={`flex items-center justify-center gap-3 sm:gap-4 ${className}`}>
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={handleToggleBookmark}
          disabled={bookmarkLoading}
          className={`${btnSize} rounded-full border flex items-center justify-center transition-all active:scale-90 ${
            bookmarked
              ? "bg-primary/15 border-primary/30 text-primary"
              : "border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25"
          }`}
          title="Watchlist"
        >
          <Bookmark className={`${iconSize} ${bookmarked ? "fill-primary" : ""}`} />
        </button>
        <span className={`${fontSize} text-foreground/30 font-sans`}>Watchlist</span>
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={handleToggleLike}
          disabled={likeLoading}
          className={`${btnSize} rounded-full border flex items-center justify-center transition-all active:scale-90 ${
            liked
              ? "bg-primary/15 border-primary/30 text-primary"
              : "border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25"
          }`}
          title="J'aime"
        >
          <Heart className={`${iconSize} ${liked ? "fill-primary" : ""}`} />
        </button>
        <span className={`${fontSize} text-foreground/30 font-sans`}>J'aime</span>
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={handleAlreadySeen}
          className={`${btnSize} rounded-full border border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25 flex items-center justify-center transition-all active:scale-90`}
          title="Déjà vu"
        >
          <Eye className={iconSize} />
        </button>
        <span className={`${fontSize} text-foreground/30 font-sans`}>Déjà vu</span>
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={handleDislike}
          className={`${btnSize} rounded-full border border-border/25 text-foreground/40 hover:text-destructive hover:border-destructive/25 flex items-center justify-center transition-all active:scale-90`}
          title="J'aime pas"
        >
          <ThumbsDown className={iconSize} />
        </button>
        <span className={`${fontSize} text-foreground/30 font-sans`}>Pas pour moi</span>
      </div>
    </div>
  );
};

export default MovieActionBar;
