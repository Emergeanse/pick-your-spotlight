import { useState, useEffect, useCallback } from "react";
import { Bookmark, Heart, Eye, ThumbsDown, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { likeMovie, unlikeMovie, isMovieLiked } from "@/lib/liked-movies";
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from "@/lib/watchlist";
import { trackInteraction } from "@/lib/interactions";
import { getFeedback, setFeedback, type FeedbackLabel } from "@/lib/feedback";
import type { MovieDetail } from "@/lib/tmdb";

interface MovieActionBarProps {
  movie: MovieDetail;
  size?: "sm" | "md";
  className?: string;
  onInteraction?: (type: string) => void;
  /** Externally provided feedback label (from batch load) */
  initialFeedback?: FeedbackLabel | null;
}

const MovieActionBar = ({ movie, size = "md", className = "", onInteraction, initialFeedback }: MovieActionBarProps) => {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState<FeedbackLabel | null>(null);

  // Load persisted feedback on mount
  useEffect(() => {
    if (!user) return;

    if (initialFeedback !== undefined && initialFeedback !== null) {
      setActiveFeedback(initialFeedback);
      if (initialFeedback === "like" || initialFeedback === "love") setLiked(true);
      return;
    }

    // Load from DB
    getFeedback(movie.id).then(fb => {
      if (fb) {
        setActiveFeedback(fb.label);
        if (fb.label === "like" || fb.label === "love") setLiked(true);
      }
    }).catch(() => {});
  }, [movie.id, user, initialFeedback]);

  useEffect(() => {
    if (!user) return;
    isMovieLiked(movie.id).then(setLiked).catch(() => {});
    isInWatchlist(movie.id).then(setBookmarked).catch(() => {});
  }, [movie.id, user]);

  const requireAuth = () => {
    if (!user) { toast.info("Connecte-toi pour enrichir ton profil !"); return false; }
    return true;
  };

  const movieMeta = {
    title: movie.title || movie.name || "Sans titre",
    poster_path: movie.poster_path || undefined,
    media_type: movie.first_air_date ? "tv" : "movie",
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
        setActiveFeedback(null);
        toast.success("Retiré des favoris");
        trackInteraction(movie.id, "unliked");
      } else {
        await likeMovie(movie);
        setLiked(true);
        setActiveFeedback("like");
        toast.success("Ajouté aux favoris !");
        trackInteraction(movie.id, "liked");
        // Persist feedback
        setFeedback(movie.id, "like", movieMeta);
        // Auto-add to watchlist if not already bookmarked and not marked seen
        if (!bookmarked && activeFeedback !== "seen") {
          try {
            await addToWatchlist(movie);
            setBookmarked(true);
            window.dispatchEvent(new CustomEvent("pick-watchlist-added"));
          } catch { /* already in watchlist */ }
        }
      }
    } catch { toast.error("Erreur"); }
    finally { setLikeLoading(false); }
  };

  const handleAlreadySeen = async () => {
    if (!requireAuth()) return;
    setActiveFeedback("seen");
    trackInteraction(movie.id, "already_seen", {});
    await setFeedback(movie.id, "seen", movieMeta);
    // Remove from watchlist if present
    if (bookmarked) {
      try {
        await removeFromWatchlist(movie.id);
        setBookmarked(false);
      } catch {}
    }
    toast.success("Marqué comme déjà vu");
    onInteraction?.("already_seen");
  };

  const handleDislike = async () => {
    if (!requireAuth()) return;
    setActiveFeedback("not_for_me");
    trackInteraction(movie.id, "skipped", {
      reason: "dislike",
      genres: (movie.genres || []).map(g => g.name),
    });
    await setFeedback(movie.id, "not_for_me", movieMeta);
    toast.success("Noté — Pick en tiendra compte");
    onInteraction?.("dislike");
  };

  const handleUnknown = async () => {
    if (!requireAuth()) return;
    setActiveFeedback("unknown");
    trackInteraction(movie.id, "unknown", {});
    await setFeedback(movie.id, "unknown", movieMeta);
    toast.success("Noté — on en tiendra compte");
    onInteraction?.("unknown");
  };

  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const btnSize = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const fontSize = size === "sm" ? "text-[8px]" : "text-[9px]";

  const activeClass = (label: FeedbackLabel) =>
    activeFeedback === label
      ? "bg-primary/15 border-primary/30 text-primary"
      : "border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25";

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
            liked || activeFeedback === "like"
              ? "bg-primary/15 border-primary/30 text-primary"
              : "border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25"
          }`}
          title="J'aime"
        >
          <Heart className={`${iconSize} ${liked || activeFeedback === "like" ? "fill-primary" : ""}`} />
        </button>
        <span className={`${fontSize} text-foreground/30 font-sans`}>J'aime</span>
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={handleUnknown}
          className={`${btnSize} rounded-full border flex items-center justify-center transition-all active:scale-90 ${activeClass("unknown")}`}
          title="Je ne connais pas"
        >
          <HelpCircle className={iconSize} />
        </button>
        <span className={`${fontSize} text-foreground/30 font-sans`}>Inconnu</span>
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={handleAlreadySeen}
          className={`${btnSize} rounded-full border flex items-center justify-center transition-all active:scale-90 ${activeClass("seen")}`}
          title="Déjà vu"
        >
          <Eye className={iconSize} />
        </button>
        <span className={`${fontSize} text-foreground/30 font-sans`}>Déjà vu</span>
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={handleDislike}
          className={`${btnSize} rounded-full border flex items-center justify-center transition-all active:scale-90 ${
            activeFeedback === "not_for_me"
              ? "bg-destructive/15 border-destructive/30 text-destructive"
              : "border-border/25 text-foreground/40 hover:text-destructive hover:border-destructive/25"
          }`}
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
