import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { recordAcceptedRecommendation } from "@/lib/engagement";
import { Bookmark, Heart, Eye, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import type { InteractionContext } from "@/lib/interactions";
import { clearFeedbackType, setFeedback, type FeedbackLabel } from "@/lib/feedback";
import type { MovieDetail } from "@/lib/tmdb";
import { ensureMovieEmbedding } from "@/lib/taste-engine";
import { useMovieInteraction } from "@/hooks/use-movie-interactions";
import { inferCatalogMediaType } from "@/lib/catalog";


interface MovieActionBarProps {
  movie: MovieDetail;
  /** xs = fiche complète / barre fixe compacte (~50 % de md) */
  size?: "xs" | "sm" | "md";
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

  const thumbsUp = interaction.primaryStatus === "like";
  const loved = interaction.primaryStatus === "love";
  const bookmarked = interaction.watchlist;
  const seenActive = interaction.seen;
  const activeFeedback = interaction.primaryStatus;

  const [loading, setLoading] = useState(false);
  // Mémorise les films déjà comptés comme "acceptés" pour ne pas doubler-compter
  const acceptedMovieIds = useRef(new Set<number>());

  const recordAccepted = useCallback(() => {
    if (!user || contextType !== "solo_session") return;
    if (acceptedMovieIds.current.has(movie.id)) return;
    acceptedMovieIds.current.add(movie.id);
    recordAcceptedRecommendation(user.id, false).catch(() => {});
  }, [user, movie.id, contextType]);

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
      thumbsUp,
      loved,
      bookmarked,
      seenActive,
      activeFeedback,
      initialFeedback,
    });
  }, [movie.id, mediaType, interaction, thumbsUp, loved, bookmarked, seenActive, activeFeedback, initialFeedback]);

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

  const interactionMeta = useMemo<InteractionContext>(
    () => ({
      title: movie.title || movie.name || undefined,
      genres: (movie.genres || []).map((g) => g.name),
      runtime: movie.runtime ?? undefined,
      session_id: sessionId ?? undefined,
    }),
    [movie.id, movie.title, movie.name, movie.runtime, movie.genres, sessionId],
  );

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
          interaction: interactionMeta,
        },
      );

      debugLog("persistFeedback:done", {
        movieId: movie.id,
        label,
      });
    },
    [movie.id, movieMeta, sessionId, contextType, mediaType, user?.id, interactionMeta],
  );

  const clearLabel = useCallback(
    (label: FeedbackLabel) =>
      clearFeedbackType(movie.id, [label], mediaType, {
        context_type: contextType ?? (sessionId ? "solo_session" : "browse"),
        context_id: sessionId ?? null,
        interaction: interactionMeta,
      }),
    [movie.id, mediaType, contextType, sessionId, interactionMeta],
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
          await clearLabel("seen");
        }
      } else {
        await clearLabel(label);

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

    setLoading(true);

    try {
      if (isSeenActive) {
        await clearLabel("seen");
      } else {
        await persistFeedback("seen");
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
        await clearLabel("watchlist");
        toast.success("Retiré de ta watchlist");
      } else {
        await persistFeedback("watchlist");
        recordAccepted();
        toast.success("Ajouté à ta watchlist !");
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
    setLoading(true);
    try {
      if (thumbsUp) {
        await clearLabel("like");
        toast.success("Like retiré");
      } else {
        await persistFeedback("like");
        recordAccepted();
        ensureMovieEmbedding(
          movie.id,
          movie.title || (movie as any).name || "",
          movie.overview || "",
          (movie.genres || []).map((g) => g.name),
        );
        toast.success("👍 Noté !");
      }
      onInteraction?.("like");
    } catch (error) {
      debugLog("handleToggleLike:error", error);
      toast.error("Erreur");
    } finally {
      if (isCurrentMovie(movieId)) setLoading(false);
    }
  };

  const handleToggleLove = async () => {
    if (!requireAuth()) return;
    const movieId = movie.id;
    setLoading(true);
    try {
      if (loved) {
        await clearLabel("love");
        toast.success("Coup de cœur retiré");
      } else {
        await persistFeedback("love");
        recordAccepted();
        ensureMovieEmbedding(
          movie.id,
          movie.title || (movie as any).name || "",
          movie.overview || "",
          (movie.genres || []).map((g) => g.name),
        );
        toast.success("❤️ Coup de cœur !");
      }
      onInteraction?.("love");
    } catch (error) {
      debugLog("handleToggleLove:error", error);
      toast.error("Erreur");
    } finally {
      if (isCurrentMovie(movieId)) setLoading(false);
    }
  };

  const iconSize =
    size === "xs" ? "w-3.5 h-3.5" : size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const btnSize =
    size === "xs" ? "w-7 h-7" : size === "sm" ? "w-9 h-9" : "w-10 h-10";
  const rowGap = size === "xs" ? "gap-1.5" : "gap-2";

  const inactiveClass = "bg-transparent border-white/25 text-white/50 hover:text-white/80 hover:border-white/40";

  const likeFilledClass =
    "bg-primary border-primary/80 text-primary-foreground ring-1 ring-white/15 shadow-[0_0_24px_hsl(var(--primary)/0.45)]";

  const loveFilledClass =
    "bg-rose-500 border-rose-300/70 text-white ring-1 ring-white/15 shadow-[0_0_24px_rgba(244,63,94,0.55)]";

  const watchlistFilledClass =
    "bg-sky-500 border-sky-300/70 text-white ring-1 ring-white/15 shadow-[0_0_24px_rgba(14,165,233,0.45)]";

  const seenFilledClass =
    "bg-emerald-500 border-emerald-300/70 text-white ring-1 ring-white/15 shadow-[0_0_24px_rgba(16,185,129,0.45)]";

  const notForMeFilledClass =
    "bg-rose-600 border-rose-300/70 text-white ring-1 ring-white/10 shadow-[0_0_24px_rgba(225,29,72,0.45)]";

  return (
    <div className={`flex items-center justify-center ${rowGap} ${className}`}>
      <button
        type="button"
        disabled={loading}
        onClick={handleToggleLike}
        className={`${btnSize} rounded-full border transition-all flex items-center justify-center ${
          thumbsUp ? likeFilledClass : inactiveClass
        }`}
        title="J'aime"
        aria-label="J'aime"
        aria-pressed={thumbsUp}
      >
        <ThumbsUp className={`${iconSize} ${thumbsUp ? "fill-current" : ""}`} />
      </button>

      <button
        type="button"
        disabled={loading}
        onClick={handleToggleLove}
        className={`${btnSize} rounded-full border transition-all flex items-center justify-center ${
          loved ? loveFilledClass : inactiveClass
        }`}
        title="Coup de cœur"
        aria-label="Coup de cœur"
        aria-pressed={loved}
      >
        <Heart className={`${iconSize} ${loved ? "fill-current" : ""}`} />
      </button>

      <button
        type="button"
        disabled={loading}
        onClick={handleToggleBookmark}
        className={`${btnSize} rounded-full border transition-all flex items-center justify-center ${
          bookmarked ? watchlistFilledClass : inactiveClass
        }`}
        title="À voir"
        aria-label="Ajouter à ma liste À voir"
        aria-pressed={bookmarked}
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
        aria-label="Déjà vu"
        aria-pressed={seenActive}
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
        aria-label="Pas pour moi"
        aria-pressed={activeFeedback === "not_for_me"}
      >
        <ThumbsDown className={iconSize} />
      </button>
    </div>
  );
};

export default MovieActionBar;
