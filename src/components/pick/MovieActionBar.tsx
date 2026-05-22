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

const DEBUG = true;
const debugLog = (...args: unknown[]) => {
  if (DEBUG) console.log("[MovieActionBar]", ...args);
};

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
  const seenActive = interaction.seen;
  const activeFeedback = interaction.primaryStatus;
  const unknownActive = activeFeedback === "unknown";

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    currentMovieIdRef.current = movie.id;
    setLoading(false);
    debugLog("movie changed", {
      movieId: movie.id,
      title: movie.title || movie.name,
      mediaType,
    });
  }, [movie.id, movie.title, movie.name, mediaType]);

  useEffect(() => {
    debugLog("interaction state updated", {
      movieId: movie.id,
      mediaType,
      interaction,
      liked,
      bookmarked,
      seenActive,
      activeFeedback,
      initialFeedback,
    });
  }, [movie.id, mediaType, interaction, liked, bookmarked, seenActive, activeFeedback, initialFeedback]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      debugLog("pick-feedback-changed event received", detail);
    };
    window.addEventListener("pick-feedback-changed", handler);
    return () => window.removeEventListener("pick-feedback-changed", handler);
  }, []);

  const requireAuth = () => {
    const hasUser = !!user;
    debugLog("requireAuth", {
      hasUser,
      userId: user?.id ?? null,
      email: user?.email ?? null,
    });

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
      debugLog("persistFeedback:start", {
        movieId: movie.id,
        label,
        mediaType,
        movieMeta,
        sessionId,
        contextType,
        userId: user?.id ?? null,
      });

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

      debugLog("persistFeedback:done", {
        movieId: movie.id,
        label,
      });
    },
    [movie.id, movieMeta, sessionId, contextType, mediaType, user?.id],
  );

  const handlePrimaryToggle = async (label: Exclude<FeedbackLabel, "watchlist" | "seen">) => {
    if (!requireAuth()) return;

    const movieId = movie.id;
    const isCurrentlyActive = activeFeedback === label;
    const newLabel = isCurrentlyActive ? null : label;

    debugLog("handlePrimaryToggle", {
      movieId,
      label,
      activeFeedback,
      isCurrentlyActive,
      newLabel,
    });

    setLoading(true);

    try {
      if (newLabel) {
        await persistFeedback(newLabel);

        if (newLabel === "unknown" && seenActive) {
          await clearFeedbackType(movie.id, ["seen"], mediaType);
        }
      } else {
        await clearFeedbackType(movie.id, [label], mediaType);
      }

      if (!isCurrentMovie(movieId)) return;

      const toastMap: Partial<Record<FeedbackLabel, string>> = {
        unknown: isCurrentlyActive ? "Statut retiré" : "Noté — on en tiendra compte",
        not_for_me: isCurrentlyActive ? "Statut retiré" : "Noté — Pick en tiendra compte",
      };

      toast.success(toastMap[label] || "Mis à jour");
      onInteraction?.(label === "not_for_me" ? "dislike" : label);
    } catch (error) {
      debugLog("handlePrimaryToggle:error", error);
      if (!isCurrentMovie(movieId)) return;
      toast.error("Erreur");
    } finally {
      if (isCurrentMovie(movieId)) {
        setLoading(false);
      }
    }
  };

  const handleToggleSeen = async () => {
    if (!requireAuth()) return;

    const movieId = movie.id;
    const isSeenActive = seenActive;

    debugLog("handleToggleSeen", {
      movieId,
      seenActive: isSeenActive,
      unknownActive,
      activeFeedback,
    });

    setLoading(true);

    try {
      if (isSeenActive) {
        await clearFeedbackType(movie.id, ["seen"], mediaType);
      } else {
        await persistFeedback("seen");

        if (unknownActive) {
          await clearFeedbackType(movie.id, ["unknown"], mediaType);
        }

        trackInteraction(movie.id, "already_seen", {});
      }

      if (!isCurrentMovie(movieId)) return;

      toast.success(isSeenActive ? "Statut retiré" : "Marqué comme déjà vu");
      onInteraction?.("already_seen");
    } catch (error) {
      debugLog("handleToggleSeen:error", error);
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

    debugLog("handleToggleBookmark", {
      movieId: movie.id,
      bookmarkedBefore: bookmarked,
      activeFeedback,
    });

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
    } catch (error) {
      debugLog("handleToggleBookmark:error", error);
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLike = async () => {
    if (!requireAuth()) return;

    const movieId = movie.id;

    debugLog("handleToggleLike", {
      movieId,
      likedBefore: liked,
      bookmarkedBefore: bookmarked,
      activeFeedback,
      seenActive,
    });

    setLoading(true);
    try {
      if (liked) {
        // setFeedback("skip") deletes exclusive types (like, love) internally before inserting skip,
        // so the movie is excluded from future recommendations.
        await setFeedback(movie.id, "skip", {
          title: movie.title || (movie as any).name || ".",
          media_type: mediaType,
          poster_path: movie.poster_path ?? null,
          year: null,
          overview: movie.overview ?? null,
          vote_average: movie.vote_average ?? null,
          popularity: (movie as any).popularity ?? null,
          runtime: movie.runtime ?? null,
        });

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
      }
    } catch (error) {
      debugLog("handleToggleLike:error", error);
      toast.error("Erreur");
    } finally {
      if (isCurrentMovie(movieId)) {
        setLoading(false);
      }
    }
  };

  const iconSize = size === "sm" ? "w-3 h-3" : "w-5 h-5";
  const btnSize = size === "sm" ? "w-7 h-7" : "w-10 h-10";

  const inactiveClass = "bg-transparent border-border/25 text-foreground/40 hover:text-primary hover:border-primary/25";

  const likeFilledClass =
    "bg-primary border-primary/80 text-primary-foreground ring-1 ring-white/15 shadow-[0_0_24px_hsl(var(--primary)/0.45)]";

  const watchlistFilledClass =
    "bg-sky-500 border-sky-300/70 text-white ring-1 ring-white/15 shadow-[0_0_24px_rgba(14,165,233,0.45)]";

  const seenFilledClass =
    "bg-emerald-500 border-emerald-300/70 text-white ring-1 ring-white/15 shadow-[0_0_24px_rgba(16,185,129,0.45)]";

  const notForMeFilledClass =
    "bg-rose-600 border-rose-300/70 text-white ring-1 ring-white/10 shadow-[0_0_24px_rgba(225,29,72,0.45)]";

  const unknownFilledClass =
    "bg-foreground/85 border-white/15 text-background shadow-[0_0_18px_rgba(255,255,255,0.12)]";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        disabled={loading}
        onClick={handleToggleLike}
        className={`${btnSize} rounded-full border transition-all flex items-center justify-center ${
          liked ? likeFilledClass : inactiveClass
        }`}
        title="Aimé"
      >
        <Heart className={`${iconSize} ${liked ? "fill-current" : ""}`} />
      </button>

      <button
        type="button"
        disabled={loading}
        onClick={handleToggleBookmark}
        className={`${btnSize} rounded-full border transition-all flex items-center justify-center ${
          bookmarked ? watchlistFilledClass : inactiveClass
        }`}
        title="À voir"
      >
        <Bookmark className={`${iconSize} ${bookmarked ? "fill-current" : ""}`} />
      </button>

      <button
        type="button"
        disabled={loading}
        onClick={handleToggleSeen}
        className={`${btnSize} rounded-full border transition-all flex items-center justify-center ${
          seenActive ? seenFilledClass : inactiveClass
        }`}
        title="Déjà vu"
      >
        <Eye className={iconSize} />
      </button>

      <button
        type="button"
        disabled={loading}
        onClick={() => handlePrimaryToggle("not_for_me")}
        className={`${btnSize} rounded-full border transition-all flex items-center justify-center ${
          activeFeedback === "not_for_me" ? notForMeFilledClass : inactiveClass
        }`}
        title="Pas pour moi"
      >
        <ThumbsDown className={iconSize} />
      </button>

      <button
        type="button"
        disabled={loading}
        onClick={() => handlePrimaryToggle("unknown")}
        className={`${btnSize} rounded-full border transition-all flex items-center justify-center ${
          unknownActive ? unknownFilledClass : inactiveClass
        }`}
        title="Inconnu"
      >
        <HelpCircle className={iconSize} />
      </button>
    </div>
  );
};

export default MovieActionBar;
