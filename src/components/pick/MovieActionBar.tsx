import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Bookmark, Heart, Eye, ThumbsDown, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { trackInteraction } from "@/lib/interactions";
import { clearFeedbackType, setFeedback, type FeedbackLabel } from "@/lib/feedback";
import type { MovieDetail } from "@/lib/tmdb";
import { ensureMovieEmbedding } from "@/lib/taste-engine";
import { useMovieInteraction } from "@/hooks/use-movie-interactions";
import { inferCatalogMediaType } from "@/lib/catalog";

interface MovieActionBarProps {
  movie: MovieDetail;
  size?: "sm" | "md";
  className?: string;
  onInteraction?: (type: string) => void;
  initialFeedback?: FeedbackLabel | null;
  sessionId?: string | null;
  contextType?: "solo_session" | "group_session" | "browse";
}

const MovieActionBar = ({
  movie,
  size = "md",
  className = "",
  onInteraction,
  initialFeedback,
  sessionId,
  contextType,
}: MovieActionBarProps) => {
  const { user } = useAuth();
  const currentMovieIdRef = useRef(movie.id);
  const mediaType = inferCatalogMediaType(movie);
  const interaction = useMovieInteraction(movie.id, mediaType);

  const liked = interaction.liked;
  const bookmarked = interaction.watchlist;
  const activeFeedback = interaction.primaryStatus;
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    currentMovieIdRef.current = movie.id;
    setLoading(false);
  }, [movie.id]);

  const requireAuth = () => {
    if (!user) {
      toast.info("Connecte-toi pour enrichir ton profil !");
      return false;
    }
    return true;
  };

  const movieMeta = useMemo(
    () => ({
      title: movie.title || movie.name || "Sans titre",
      poster_path: movie.poster_path || undefined,
      media_type: mediaType,
    }),
    [mediaType, movie.name, movie.poster_path, movie.title],
  );

  const isCurrentMovie = useCallback((movieId: number) => currentMovieIdRef.current === movieId, []);

  const persistFeedback = useCallback(
    async (label: FeedbackLabel) => {
      await setFeedback(
        movie.id,
        label,
        {
          ...movieMeta,
          media_type: (movieMeta?.media_type as "movie" | "tv") ?? "movie",
        },
        {
          context_type: contextType ?? (sessionId ? "solo_session" : "browse"),
          context_id: sessionId ?? null,
        },
      );
    },
    [movie.id, movieMeta, sessionId, contextType],
  );

  const handleExclusiveToggle = async (label: FeedbackLabel) => {
    if (!requireAuth()) return;

    const movieId = movie.id;
    const isCurrentlyActive = activeFeedback === label;
    const newLabel = isCurrentlyActive ? null : label;

    setLoading(true);

    try {
      if (newLabel) await persistFeedback(newLabel);
      else await clearFeedbackType(movie.id, [label], mediaType);
      if (!isCurrentMovie(movieId)) return;

      if (newLabel) {
        trackInteraction(
          movie.id,
          label === "seen" ? "already_seen" : label === "not_for_me" ? "skipped" : "unknown",
          {},
        );
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
      onInteraction?.(label === "seen" ? "already_seen" : label === "not_for_me" ? "dislike" : label);
    } catch {
      if (!isCurrentMovie(movieId)) return;
      toast.error("Erreur");
    } finally {
      if (isCurrentMovie(movieId)) {
        setLoading(false);
      }
    }
  };

  const handleToggleBookmark = async () => {
    if (!requireAuth()) return;
    setLoading(true);
    try {
      if (bookmarked) {
        await clearFeedbackType(movie.id, ["watchlist"], mediaType);
        toast.success("Retiré de ta watchlist");
        trackInteraction(movie.id, "unsaved");
      } else {
        await persistFeedback("watchlist");
        toast.success("Ajouté à ta watchlist !");
        trackInteraction(movie.id, "saved");
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLike = async () => {
    if (!requireAuth()) return;
    const movieId = movie.id;
    const previousFeedback = activeFeedback;

    setLoading(true);
    try {
      if (liked) {
        await clearFeedbackType(movie.id, ["like", "love"], mediaType);
        if (!isCurrentMovie(movieId)) return;

        toast.success("Retiré des favoris");
        trackInteraction(movie.id, "unliked");
      } else {
        await persistFeedback("like");
        ensureMovieEmbedding(
          movie.id,
          movie.title || (movie as any).name || "",
          movie.overview || "",
          (movie.genres || []).map((g) => g.name),
        );
        if (!isCurrentMovie(movieId)) return;

        toast.success("Ajouté aux favoris !");
        trackInteraction(movie.id, "liked");

        if (!bookmarked && previousFeedback !== "seen") {
          try {
            await persistFeedback("watchlist");
            if (!isCurrentMovie(movieId)) return;
          } catch {
            // already in watchlist
          }
        }
      }
    } catch {
      toast.error("Erreur");
    } finally {
      if (isCurrentMovie(movieId)) {
        setLoading(false);
      }
    }
  };

  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const btnSize = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const fontSize = size === "sm" ? "text-[8px]" : "text-[9px]";

  const isExclusiveActive = (label: FeedbackLabel) => activeFeedback === label;

  const inactiveClass = "bg-transparent border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25";

  const likeFilledClass =
    "bg-primary border-primary/80 text-primary-foreground ring-1 ring-white/15 shadow-[0_0_24px_hsl(var(--primary)/0.45)]";

  const watchlistFilledClass =
    "bg-sky-500 border-sky-300/70 text-white ring-1 ring-white/15 shadow-[0_0_24px_rgba(14,165,233,0.45)]";

  const seenFilledClass =
    "bg-emerald-500 border-emerald-300/70 text-white ring-1 ring-white/15 shadow-[0_0_24px_rgba(16,185,129,0.42)]";

  const unknownFilledClass = "bg-zinc-600 border-zinc-300/30 text-white shadow-[0_0_18px_rgba(255,255,255,0.08)]";

  const notForMeFilledClass =
    "bg-destructive border-destructive/80 text-destructive-foreground ring-1 ring-white/10 shadow-[0_0_24px_hsl(var(--destructive)/0.45)]";

  const exclusiveClass = (label: FeedbackLabel) => {
    if (!isExclusiveActive(label)) {
      return label === "not_for_me"
        ? "bg-transparent border-border/25 text-foreground/40 hover:text-destructive hover:border-destructive/25"
        : inactiveClass;
    }

    if (label === "seen") return seenFilledClass;
    if (label === "not_for_me") return notForMeFilledClass;
    if (label === "unknown") return unknownFilledClass;

    return inactiveClass;
  };

  return (
    <div className={`flex items-center justify-center gap-3 sm:gap-4 ${className}`}>
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={handleToggleBookmark}
          disabled={loading}
          className={`${btnSize} rounded-full border flex items-center justify-center transition-all active:scale-90 ${
            bookmarked ? watchlistFilledClass : inactiveClass
          }`}
          title="Watchlist"
        >
          <Bookmark className={`${iconSize} ${bookmarked ? "fill-current" : ""}`} />
        </button>
        <span className={`${fontSize} text-foreground/30 font-sans`}>Watchlist</span>
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={handleToggleLike}
          disabled={loading}
          className={`${btnSize} rounded-full border flex items-center justify-center transition-all active:scale-90 ${
            liked ? likeFilledClass : inactiveClass
          }`}
          title="J'aime"
        >
          <Heart className={`${iconSize} ${liked ? "fill-current" : ""}`} />
        </button>
        <span className={`${fontSize} text-foreground/30 font-sans`}>J'aime</span>
      </div>

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

      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={() => handleExclusiveToggle("not_for_me")}
          disabled={loading}
          className={`${btnSize} rounded-full border flex items-center justify-center transition-all active:scale-90 ${exclusiveClass("not_for_me")}`}
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
