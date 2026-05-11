import { useState, useEffect, useCallback, useRef } from "react";
import { Bookmark, Heart, Eye, ThumbsDown, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { likeMovie, unlikeMovie } from "@/lib/liked-movies";
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from "@/lib/watchlist";
import { trackInteraction } from "@/lib/interactions";
import { clearFeedback, getFeedback, setFeedback, type FeedbackLabel } from "@/lib/feedback";
import type { MovieDetail } from "@/lib/tmdb";

interface MovieActionBarProps {
  movie: MovieDetail;
  size?: "sm" | "md";
  className?: string;
  onInteraction?: (type: string) => void;
  initialFeedback?: FeedbackLabel | null;
  /** V1: link feedback to a recommendation/group session */
  sessionId?: string | null;
  contextType?: "solo_session" | "group_session" | "browse";
}

const MovieActionBar = ({ movie, size = "md", className = "", onInteraction, initialFeedback, sessionId, contextType }: MovieActionBarProps) => {
  const { user } = useAuth();
  const currentMovieIdRef = useRef(movie.id);

  // Per-item state — keyed internally to movie.id via React key prop
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState<FeedbackLabel | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    currentMovieIdRef.current = movie.id;
    setLiked(false);
    setBookmarked(false);
    setActiveFeedback(null);
    setLoading(false);
  }, [movie.id]);

  // Load persisted state on mount (runs once per movie thanks to key={movie.id})
  useEffect(() => {
    if (!user) {
      setLiked(false);
      setBookmarked(false);
      setActiveFeedback(null);
      return;
    }

    let cancelled = false;
    const movieId = movie.id;

    const load = async () => {
      try {
        const [fb, inWl] = await Promise.all([
          initialFeedback !== undefined && initialFeedback !== null
            ? Promise.resolve({ label: initialFeedback, score: 0 })
            : getFeedback(movie.id),
          isInWatchlist(movie.id),
        ]);

        if (cancelled || currentMovieIdRef.current !== movieId) return;

        setBookmarked(inWl);
        setActiveFeedback(fb?.label ?? null);
        setLiked(fb?.label === "like" || fb?.label === "love");
      } catch {
        // ignore
      }
    };
    load();
    return () => { cancelled = true; };
  }, [movie.id, user, initialFeedback]);

  const requireAuth = () => {
    if (!user) { toast.info("Connecte-toi pour enrichir ton profil !"); return false; }
    return true;
  };

  const movieMeta = {
    title: movie.title || movie.name || "Sans titre",
    poster_path: movie.poster_path || undefined,
    media_type: movie.first_air_date ? "tv" : "movie",
  };

  const isCurrentMovie = useCallback((movieId: number) => currentMovieIdRef.current === movieId, []);

  // ── Toggle helpers ──

  const persistFeedback = useCallback(async (label: FeedbackLabel | null) => {
    if (!label) {
      await clearFeedback(movie.id);
      return;
    }
    await setFeedback(
      movie.id,
      label,
      { ...movieMeta, media_type: (movieMeta?.media_type as "movie" | "tv") ?? "movie" },
      { context_type: contextType ?? (sessionId ? "solo_session" : "browse"), context_id: sessionId ?? null }
    );
  }, [movie.id, movieMeta, sessionId, contextType]);

  /**
   * Toggle an exclusive feedback (seen / not_for_me / unknown).
   * If already active → deactivate. Otherwise activate and deactivate peers.
   */
  const handleExclusiveToggle = async (label: FeedbackLabel) => {
    if (!requireAuth()) return;

    const movieId = movie.id;
    const isCurrentlyActive = activeFeedback === label;
    const newLabel = isCurrentlyActive ? null : label;
    const previousFeedback = activeFeedback;
    const previousLiked = liked;
    const previousBookmarked = bookmarked;

    setLoading(true);
    setActiveFeedback(newLabel);
    setLiked(false);
    if (newLabel === "seen") setBookmarked(false);

    try {
      await persistFeedback(newLabel);
      if (!isCurrentMovie(movieId)) return;

      if (newLabel) {
        trackInteraction(movie.id, label === "seen" ? "already_seen" : label === "not_for_me" ? "skipped" : "unknown", {});
      }

      const toastMap: Record<FeedbackLabel, string> = {
        seen: isCurrentlyActive ? "Statut retiré" : "Marqué comme déjà vu",
        not_for_me: isCurrentlyActive ? "Statut retiré" : "Noté — Pick en tiendra compte",
        unknown: isCurrentlyActive ? "Statut retiré" : "Noté — on en tiendra compte",
        like: "",
        love: "",
        dislike: "",
        skip: "",
        watchlist: "",
      };
      toast.success(toastMap[label] || "Mis à jour");
      onInteraction?.(label);
    } catch {
      if (!isCurrentMovie(movieId)) return;
      setActiveFeedback(previousFeedback);
      setLiked(previousLiked);
      setBookmarked(previousBookmarked);
      toast.error("Erreur");
    } finally {
      if (isCurrentMovie(movieId)) {
        setLoading(false);
      }
    }
  };

  // ── Watchlist toggle ──

  const handleToggleBookmark = async () => {
    if (!requireAuth()) return;
    setLoading(true);
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
    finally { setLoading(false); }
  };

  // ── Like toggle ──

  const handleToggleLike = async () => {
    if (!requireAuth()) return;
    const movieId = movie.id;
    const previousLiked = liked;
    const previousFeedback = activeFeedback;
    const previousBookmarked = bookmarked;

    setLoading(true);
    try {
      if (liked) {
        await unlikeMovie(movie.id);
        await persistFeedback(null);
        if (!isCurrentMovie(movieId)) return;

        setLiked(false);
        setActiveFeedback(null);
        toast.success("Retiré des favoris");
        trackInteraction(movie.id, "unliked");
      } else {
        await likeMovie(movie);
        await persistFeedback("like");
        if (!isCurrentMovie(movieId)) return;

        setLiked(true);
        setActiveFeedback("like");
        toast.success("Ajouté aux favoris !");
        trackInteraction(movie.id, "liked");
        // Auto-add to watchlist if not bookmarked and not seen
        if (!previousBookmarked && previousFeedback !== "seen") {
          try {
            await addToWatchlist(movie);
            if (!isCurrentMovie(movieId)) return;
            setBookmarked(true);
            window.dispatchEvent(new CustomEvent("pick-watchlist-added"));
          } catch { /* already in watchlist */ }
        }
      }
    } catch {
      if (isCurrentMovie(movieId)) {
        setLiked(previousLiked);
        setActiveFeedback(previousFeedback);
        setBookmarked(previousBookmarked);
      }
      toast.error("Erreur");
    } finally {
      if (isCurrentMovie(movieId)) {
        setLoading(false);
      }
    }
  };

  // ── Render ──

  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const btnSize = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const fontSize = size === "sm" ? "text-[8px]" : "text-[9px]";

  const isExclusiveActive = (label: FeedbackLabel) => activeFeedback === label;

  const exclusiveClass = (label: FeedbackLabel) =>
    isExclusiveActive(label)
      ? "bg-primary/15 border-primary/30 text-primary"
      : "border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25";

  return (
    <div className={`flex items-center justify-center gap-3 sm:gap-4 ${className}`}>
      {/* Watchlist */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={handleToggleBookmark}
          disabled={loading}
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

      {/* Like */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={handleToggleLike}
          disabled={loading}
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

      {/* Unknown */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={() => handleExclusiveToggle("unknown")}
          disabled={loading}
          className={`${btnSize} rounded-full border flex items-center justify-center transition-all active:scale-90 ${exclusiveClass("unknown")}`}
          title="Je ne connais pas"
        >
          <HelpCircle className={iconSize} />
        </button>
        <span className={`${fontSize} text-foreground/30 font-sans`}>Inconnu</span>
      </div>

      {/* Seen */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={() => handleExclusiveToggle("seen")}
          disabled={loading}
          className={`${btnSize} rounded-full border flex items-center justify-center transition-all active:scale-90 ${exclusiveClass("seen")}`}
          title="Déjà vu"
        >
          <Eye className={iconSize} />
        </button>
        <span className={`${fontSize} text-foreground/30 font-sans`}>Déjà vu</span>
      </div>

      {/* Not for me */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={() => handleExclusiveToggle("not_for_me")}
          disabled={loading}
          className={`${btnSize} rounded-full border flex items-center justify-center transition-all active:scale-90 ${
            isExclusiveActive("not_for_me")
              ? "bg-destructive/15 border-destructive/30 text-destructive"
              : "border-border/25 text-foreground/40 hover:text-destructive hover:border-destructive/25"
          }`}
          title="Pas pour moi"
        >
          <ThumbsDown className={iconSize} />
        </button>
        <span className={`${fontSize} text-foreground/30 font-sans`}>Pas pour moi</span>
      </div>
    </div>
  );
};

export default MovieActionBar;
