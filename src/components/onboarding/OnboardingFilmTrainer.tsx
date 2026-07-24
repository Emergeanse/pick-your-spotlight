import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
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
import OnboardingStickyFooter from "@/components/onboarding/OnboardingStickyFooter";
import OnboardingValidateButton from "@/components/onboarding/OnboardingValidateButton";

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
    enabled: true,
    onPersistProposed: handleProposedPersist,
    onLoadError: handleLoadError,
  });

  useEffect(() => {
    setLikedIds(new Set(initialFilmsLikedIds));
    onFilmsProgressChange?.(initialFilmsLikedIds.length);
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
    const next = new Set(likedIds);
    if (next.has(movie.id)) next.delete(movie.id);
    else next.add(movie.id);
    setLikedIds(next);
    void persistState(next, getProposedIds());
    onFilmsProposedIdsChange?.(getProposedIds());
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
        description: `Choisis au moins ${ONBOARDING_FILM_TARGET} films en faisant défiler la liste.`,
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
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
    <OnboardingStepLayout>
      <h1 className="text-2xl md:text-3xl font-serif mb-2">Quelques films pour te connaître</h1>
      <p className="text-sm text-muted-foreground font-sans mb-4 leading-relaxed">
        Touche les films que tu aimes, au moins {ONBOARDING_FILM_TARGET}. De nouveaux titres apparaissent au fil du scroll.
      </p>

      <div className={`flex items-center gap-3 ${done ? "mb-2" : "mb-4"}`}>
        <div className="h-1.5 flex-1 rounded-full bg-foreground/10 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${done ? "bg-emerald-500" : "bg-primary"}`}
            animate={{ width: `${Math.min(100, (count / ONBOARDING_FILM_TARGET) * 100)}%` }}
          />
        </div>
        <span className={`text-xs font-sans tabular-nums ${done ? "text-emerald-500" : "text-foreground/50"}`}>
          {count}/{ONBOARDING_FILM_TARGET}
        </span>
      </div>

      <AnimatePresence>
        {done && (
          <motion.p
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="flex items-center gap-1.5 text-emerald-500 text-xs font-sans font-medium mb-4"
          >
            <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5" strokeWidth={3} />
            </span>
            C&apos;est bon, tu peux continuer !
          </motion.p>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
        </div>
      ) : (
        <div className="mb-4">
          <div className="grid grid-cols-3 gap-2">
            {movies.map((movie) => {
              const on = likedIds.has(movie.id);
              const origin = getOnboardingFilmOriginLabel(movie.id);
              const showPoster = hasMoviePoster(movie);
              return (
                <motion.button
                  key={movie.id}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => toggleLike(movie)}
                  className={`relative aspect-[2/3] rounded-xl overflow-hidden border text-left transition-all ${
                    on
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border/25 hover:border-primary/30"
                  }`}
                >
                  <div className="absolute inset-0 bg-foreground/10">
                    {showPoster ? (
                      <OnboardingFilmPoster movie={movie} onFailed={handlePosterFailed} />
                    ) : null}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-1.5 pt-4 pb-1.5">
                    <p className="text-[11px] font-sans font-medium text-white leading-snug line-clamp-2">
                      {getDisplayTitle(movie)}
                    </p>
                  </div>
                  {origin && (
                    <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[6px] font-sans font-semibold uppercase text-primary/90">
                      {origin === "Cinéma français" ? "FR" : "US"}
                    </span>
                  )}
                  <span
                    className={`absolute top-1 right-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-white/70 bg-black/30"
                    }`}
                  >
                    {on ? <Check className="w-3.5 h-3.5" /> : null}
                  </span>
                </motion.button>
              );
            })}
          </div>

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
    </OnboardingStepLayout>
    <OnboardingStickyFooter>
      <OnboardingValidateButton
        onValidate={handleComplete}
        disabled={!done}
        loading={saving}
        loadingLabel="Enregistrement…"
        label="Continuer"
      />
    </OnboardingStickyFooter>
    </div>
  );
}

export { ONBOARDING_FILM_TARGET } from "@/lib/onboarding-films";
