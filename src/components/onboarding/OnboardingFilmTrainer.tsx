import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDisplayTitle, getPosterUrl, type Movie } from "@/lib/tmdb";
import {
  buildOnboardingFilmDisplayPool,
  getOnboardingFilmOriginLabel,
  ONBOARDING_FILM_TARGET,
} from "@/lib/onboarding-films";
import { saveOnboardingFilmsProgress } from "@/lib/onboarding-progress";
import { setFeedback } from "@/lib/feedback";
import { recordAcceptedRecommendation } from "@/lib/engagement";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import OnboardingStepLayout from "@/components/onboarding/OnboardingStepLayout";

interface OnboardingFilmTrainerProps {
  favoriteGenres: string[];
  excludedGenres?: string[];
  onFilmsProgressChange?: (count: number) => void;
  onComplete: () => void;
}

export default function OnboardingFilmTrainer({
  favoriteGenres,
  excludedGenres = [],
  onFilmsProgressChange,
  onComplete,
}: OnboardingFilmTrainerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const likedIdsRef = useRef(likedIds);
  likedIdsRef.current = likedIds;

  const genresKey = favoriteGenres.join(",");
  const excludedKey = excludedGenres.join(",");

  const loadPool = useCallback(
    async (pinnedIds: number[], opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      else setRefreshing(true);
      try {
        const pool = await buildOnboardingFilmDisplayPool(favoriteGenres, excludedGenres, pinnedIds);
        setMovies(pool);
        if (opts?.silent) {
          setLikedIds((prev) => {
            const poolIds = new Set(pool.map((m) => m.id));
            const next = new Set<number>();
            prev.forEach((id) => {
              if (poolIds.has(id)) next.add(id);
            });
            return next;
          });
        }
        return pool;
      } catch (e) {
        console.error("onboarding film pool failed", e);
        toast({
          title: "Chargement impossible",
          description: "Vérifie ta connexion et réessaie.",
          variant: "destructive",
        });
        return [];
      } finally {
        if (!opts?.silent) setLoading(false);
        else setRefreshing(false);
      }
    },
    [genresKey, excludedKey, toast],
  );

  // Chargement initial uniquement — pas de re-fetch à chaque render parent
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMovies([]);
    setLikedIds(new Set());

    buildOnboardingFilmDisplayPool(favoriteGenres, excludedGenres, [])
      .then((pool) => {
        if (cancelled) return;
        setMovies(pool);
      })
      .catch((e) => {
        console.error("onboarding film pool failed", e);
        if (!cancelled) {
          toast({
            title: "Chargement impossible",
            description: "Vérifie ta connexion et réessaie.",
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [genresKey, excludedKey, toast]);

  const persistProgress = useCallback(
    async (count: number) => {
      onFilmsProgressChange?.(count);
      try {
        await saveOnboardingFilmsProgress(count);
      } catch (e) {
        console.error("onboarding films progress save failed", e);
      }
    },
    [onFilmsProgressChange],
  );

  const handleRefresh = () => {
    if (likedIdsRef.current.size >= ONBOARDING_FILM_TARGET) return;
    void loadPool([...likedIdsRef.current], { silent: true });
  };

  const toggleLike = (movie: Movie) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(movie.id)) next.delete(movie.id);
      else if (next.size < ONBOARDING_FILM_TARGET) next.add(movie.id);
      void persistProgress(next.size);
      return next;
    });
  };

  const handleComplete = async () => {
    if (!user || likedIds.size < ONBOARDING_FILM_TARGET) return;
    const selected = movies.filter((m) => likedIds.has(m.id));
    if (selected.length < ONBOARDING_FILM_TARGET) {
      toast({
        title: "Sélection incomplète",
        description: "Choisis 10 films ou actualise la liste pour en trouver d'autres.",
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
      await persistProgress(ONBOARDING_FILM_TARGET);
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

  const count = likedIds.size;
  const done = count >= ONBOARDING_FILM_TARGET;
  const canRefresh = !loading && !done;

  return (
    <OnboardingStepLayout>
      <h1 className="text-2xl md:text-3xl font-serif mb-2">Quelques films pour te connaître</h1>
      <p className="text-sm text-muted-foreground font-sans mb-4 leading-relaxed">
        10 affiches au hasard — coche celles que tu aimes. Pas assez de titres connus ? Clique sur « Autres films ».
      </p>

      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[10px] font-sans text-foreground/40 uppercase tracking-wide">
          {movies.length} proposés · choisis {ONBOARDING_FILM_TARGET}
        </p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={!canRefresh || refreshing}
          className="inline-flex items-center gap-1.5 text-[11px] font-sans font-medium text-primary/80 hover:text-primary disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Actualisation…" : "Autres films"}
        </button>
      </div>

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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-6">
          {movies.map((movie, i) => {
            const on = likedIds.has(movie.id);
            const full = !on && count >= ONBOARDING_FILM_TARGET;
            const origin = getOnboardingFilmOriginLabel(movie.id);
            const poster = getPosterUrl(movie.poster_path, "w342");
            return (
              <motion.button
                key={movie.id}
                type="button"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.025 }}
                whileTap={full ? undefined : { scale: 0.96 }}
                disabled={full}
                onClick={() => toggleLike(movie)}
                className={`relative rounded-xl overflow-hidden border text-left transition-all ${
                  on
                    ? "border-primary ring-2 ring-primary/30"
                    : full
                      ? "border-border/15 opacity-40"
                      : "border-border/25 hover:border-primary/30"
                }`}
              >
                {poster ? (
                  <img
                    src={poster}
                    alt={getDisplayTitle(movie)}
                    className="w-full aspect-[2/3] object-cover"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] bg-foreground/10" />
                )}
                {origin && (
                  <span className="absolute top-1 left-1 rounded-md bg-black/60 px-1 py-0.5 text-[7px] font-sans font-semibold uppercase tracking-wide text-primary/90">
                    {origin === "Cinéma français" ? "FR" : "US"}
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pt-5 pb-1.5">
                  <p className="text-[8px] font-sans font-semibold text-white leading-tight line-clamp-2">
                    {getDisplayTitle(movie)}
                  </p>
                </div>
                {on && (
                  <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </span>
                )}
              </motion.button>
            );
          })}
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
