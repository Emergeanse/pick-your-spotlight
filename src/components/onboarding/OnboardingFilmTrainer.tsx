import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDisplayTitle, getPosterUrl, hasMoviePoster, type Movie } from "@/lib/tmdb";
import {
  fetchOnboardingFilmPage,
  fetchMoviesByIds,
  getOnboardingFilmOriginLabel,
  ONBOARDING_FILM_PAGE_SIZE,
  ONBOARDING_FILM_TARGET,
} from "@/lib/onboarding-films";
import { saveOnboardingFilmsProgress } from "@/lib/onboarding-progress";
import { setFeedback } from "@/lib/feedback";
import { recordAcceptedRecommendation } from "@/lib/engagement";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useOnboardingInfiniteScroll } from "@/hooks/use-onboarding-infinite-scroll";
import OnboardingStepLayout from "@/components/onboarding/OnboardingStepLayout";

const POSTER_SIZES = ["w92", "w154", "w185"] as const;

function OnboardingFilmPoster({
  movie,
  onFailed,
}: {
  movie: Movie;
  onFailed: (movie: Movie) => void;
}) {
  const [sizeIndex, setSizeIndex] = useState(0);

  useEffect(() => {
    setSizeIndex(0);
  }, [movie.id, movie.poster_path]);

  if (!hasMoviePoster(movie)) return null;

  const src = getPosterUrl(movie.poster_path, POSTER_SIZES[sizeIndex]);

  return (
    <img
      src={src}
      alt=""
      className="w-full h-full object-cover"
      referrerPolicy="no-referrer"
      onError={() => {
        if (sizeIndex < POSTER_SIZES.length - 1) {
          setSizeIndex((i) => i + 1);
          return;
        }
        onFailed(movie);
      }}
    />
  );
}

interface OnboardingFilmTrainerProps {
  favoriteGenres: string[];
  excludedGenres?: string[];
  initialFilmsLikedIds?: number[];
  initialFilmsProposedIds?: number[];
  onFilmsProgressChange?: (count: number) => void;
  onFilmsLikedIdsChange?: (ids: number[]) => void;
  onFilmsProposedIdsChange?: (ids: number[]) => void;
  onComplete: () => void;
}

export default function OnboardingFilmTrainer({
  favoriteGenres,
  excludedGenres = [],
  initialFilmsLikedIds = [],
  initialFilmsProposedIds = [],
  onFilmsProgressChange,
  onFilmsLikedIdsChange,
  onFilmsProposedIdsChange,
  onComplete,
}: OnboardingFilmTrainerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [likedIds, setLikedIds] = useState<Set<number>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const likedIdsRef = useRef(likedIds);
  likedIdsRef.current = likedIds;
  const replacingPosterRef = useRef<Set<number>>(new Set());

  const initialProposed = useMemo(
    () => [...new Set([...initialFilmsProposedIds, ...initialFilmsLikedIds])],
    [initialFilmsLikedIds.join(","), initialFilmsProposedIds.join(",")],
  );

  const genresKey = favoriteGenres.join(",");
  const excludedKey = excludedGenres.join(",");

  const persistState = useCallback(
    async (liked: Set<number>, proposed: number[]) => {
      const likedArr = [...liked];
      onFilmsProgressChange?.(likedArr.length);
      onFilmsLikedIdsChange?.(likedArr);
      onFilmsProposedIdsChange?.(proposed);
      try {
        await saveOnboardingFilmsProgress(likedArr, proposed);
      } catch (e) {
        console.error("onboarding films progress save failed", e);
      }
    },
    [onFilmsProgressChange, onFilmsLikedIdsChange, onFilmsProposedIdsChange],
  );

  const fetchPage = useCallback(
    async (excludeIds: number[]) => {
      const page = await fetchOnboardingFilmPage(
        favoriteGenres,
        excludedGenres,
        excludeIds,
        ONBOARDING_FILM_PAGE_SIZE,
      );
      return page.filter(hasMoviePoster);
    },
    [genresKey, excludedKey],
  );

  const count = likedIds.size;
  const done = count >= ONBOARDING_FILM_TARGET;

  const handleProposedPersist = useCallback(
    (proposed: number[]) => {
      void saveOnboardingFilmsProgress([...likedIdsRef.current], proposed);
    },
    [],
  );

  const handleLoadError = useCallback(() => {
    toast({
      title: "Chargement impossible",
      description: "Vérifie ta connexion et réessaie.",
      variant: "destructive",
    });
  }, [toast]);

  const {
    items: movies,
    loading,
    loadingMore,
    exhausted,
    sentinelRef,
    getProposedIds,
    replaceItem,
    reload,
  } = useOnboardingInfiniteScroll({
    fetchPage,
    initialProposedIds: initialProposed,
    pageSize: ONBOARDING_FILM_PAGE_SIZE,
    enabled: !done,
    onPersistProposed: handleProposedPersist,
    onLoadError: handleLoadError,
  });

  useEffect(() => {
    const savedLikes = initialFilmsLikedIds.slice(0, ONBOARDING_FILM_TARGET);
    setLikedIds(new Set(savedLikes));
    onFilmsProgressChange?.(savedLikes.length);
  }, [genresKey, excludedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePosterFailed = useCallback(
    async (failed: Movie) => {
      if (replacingPosterRef.current.has(failed.id)) return;
      replacingPosterRef.current.add(failed.id);
      try {
        const visibleIds = movies.map((m) => m.id);
        const [replacement] = await fetchOnboardingFilmPage(
          favoriteGenres,
          excludedGenres,
          [...visibleIds, failed.id],
          1,
        );
        if (replacement && !visibleIds.includes(replacement.id)) {
          replaceItem(failed.id, replacement);
          setLikedIds((prev) => {
            if (!prev.has(failed.id)) return prev;
            const next = new Set(prev);
            next.delete(failed.id);
            return next;
          });
        }
      } finally {
        replacingPosterRef.current.delete(failed.id);
      }
    },
    [movies, favoriteGenres, excludedGenres, replaceItem],
  );

  useEffect(() => {
    movies.filter((m) => !hasMoviePoster(m)).forEach((m) => void handlePosterFailed(m));
  }, [movies, handlePosterFailed]);

  const toggleLike = (movie: Movie) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(movie.id)) next.delete(movie.id);
      else if (next.size < ONBOARDING_FILM_TARGET) next.add(movie.id);
      void persistState(next, getProposedIds());
      onFilmsProposedIdsChange?.(getProposedIds());
      return next;
    });
  };

  const handleComplete = async () => {
    if (!user || likedIds.size < ONBOARDING_FILM_TARGET) return;
    const selectedIds = [...likedIds];
    const byId = new Map(movies.map((m) => [m.id, m]));
    const missingIds = selectedIds.filter((id) => !byId.has(id));
    if (missingIds.length) {
      const fetched = await fetchMoviesByIds(missingIds);
      fetched.forEach((m) => byId.set(m.id, m));
    }
    const selected = selectedIds.map((id) => byId.get(id)).filter((m): m is Movie => !!m);
    if (selected.length < ONBOARDING_FILM_TARGET) {
      toast({
        title: "Sélection incomplète",
        description: "Choisis 10 films en faisant défiler la liste.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        selected.map(async (movie) => {
          await setFeedback(
            movie.id,
            "like",
            { title: movie.title, poster_path: movie.poster_path, media_type: "movie" },
            { context_type: "browse", source: "onboarding" },
          );
          await recordAcceptedRecommendation(user.id).catch(() => {});
        }),
      );
      await persistState(new Set(selectedIds), getProposedIds());
      onComplete();
    } catch (e) {
      console.error("onboarding films save failed", e);
      toast({
        title: "Enregistrement impossible",
        description: "Vérifie ta connexion et réessaie.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingStepLayout>
      <h1 className="text-2xl md:text-3xl font-serif mb-2">Quelques films pour te connaître</h1>
      <p className="text-sm text-muted-foreground font-sans mb-4 leading-relaxed">
        Fais défiler la liste et coche les films que tu aimes. De nouveaux titres apparaissent au fil du scroll — tes choix restent comptés.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <div className="h-1.5 flex-1 rounded-full bg-foreground/10 overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${Math.min(100, (count / ONBOARDING_FILM_TARGET) * 100)}%` }}
          />
        </div>
        <span className="text-xs font-sans tabular-nums text-foreground/50">
          {count}/{ONBOARDING_FILM_TARGET}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {movies.map((movie) => {
            const on = likedIds.has(movie.id);
            const full = !on && count >= ONBOARDING_FILM_TARGET;
            const origin = getOnboardingFilmOriginLabel(movie.id);
            const showPoster = hasMoviePoster(movie);
            return (
              <motion.button
                key={movie.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={full ? undefined : { scale: 0.99 }}
                disabled={full}
                onClick={() => toggleLike(movie)}
                className={`flex items-center gap-3 w-full rounded-xl border p-2 text-left transition-all ${
                  on
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : full
                      ? "border-border/15 opacity-40"
                      : "border-border/25 hover:border-primary/30 hover:bg-foreground/[0.02]"
                }`}
              >
                <div className="relative shrink-0 w-12 h-[4.5rem] rounded-lg overflow-hidden bg-foreground/10">
                  {showPoster ? (
                    <OnboardingFilmPoster movie={movie} onFailed={handlePosterFailed} />
                  ) : null}
                  {origin && (
                    <span className="absolute top-0.5 left-0.5 rounded bg-black/60 px-1 text-[6px] font-sans font-semibold uppercase text-primary/90">
                      {origin === "Cinéma français" ? "FR" : "US"}
                    </span>
                  )}
                </div>
                <p className="flex-1 text-sm font-sans font-medium leading-snug line-clamp-2">
                  {getDisplayTitle(movie)}
                </p>
                <span
                  className={`shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-foreground/20"
                  }`}
                >
                  {on ? <Check className="w-4 h-4" /> : null}
                </span>
              </motion.button>
            );
          })}

          <div ref={sentinelRef} className="h-1" aria-hidden />

          {loadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary/40" />
            </div>
          )}

          {!loadingMore && exhausted && movies.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground font-sans">
                Impossible de charger les films pour le moment.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
                Réessayer
              </Button>
            </div>
          )}

          {!loadingMore && exhausted && movies.length > 0 && (
            <p className="text-center text-[11px] text-muted-foreground font-sans py-2">
              Fin de la liste — tu peux continuer avec tes {count} choix.
            </p>
          )}
        </div>
      )}

      <Button
        variant="hero"
        size="xl"
        className="w-full"
        disabled={!done || saving}
        onClick={() => void handleComplete()}
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…
          </>
        ) : (
          <>
            Continuer <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </OnboardingStepLayout>
  );
}

export { ONBOARDING_FILM_TARGET } from "@/lib/onboarding-films";
