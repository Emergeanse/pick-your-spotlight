import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, Star, Sparkles, Ban, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import pickLogo from "@/assets/pick-logo.png";
import OnboardingFilmTrainer from "@/components/onboarding/OnboardingFilmTrainer";
import OnboardingModesGuide from "@/components/onboarding/OnboardingModesGuide";
import OnboardingSoireesGuide from "@/components/onboarding/OnboardingSoireesGuide";
import OnboardingPlatformStep from "@/components/onboarding/OnboardingPlatformStep";
import OnboardingPeopleStep from "@/components/onboarding/OnboardingPeopleStep";
import OnboardingChrome from "@/components/onboarding/OnboardingChrome";
import OnboardingStickyFooter from "@/components/onboarding/OnboardingStickyFooter";
import { DEFAULT_ONBOARDING_PLATFORM_IDS } from "@/lib/onboarding-platforms";
import {
  ONBOARDING_MIN_RATING,
  ONBOARDING_MATCH_THRESHOLD,
  loadOnboardingProgress,
  saveOnboardingProgress,
  completeOnboarding,
  type OnboardingStep,
} from "@/lib/onboarding-progress";

const PREVIOUS_STEP: Partial<Record<OnboardingStep, OnboardingStep>> = {
  genres: "welcome",
  platforms: "genres",
  films: "platforms",
  actors: "films",
  directors: "actors",
  modes: "directors",
  soirees: "modes",
};

const ONBOARDING_GENRES = [
  "Comédie", "Drame", "Thriller", "Action", "Romance", "Fantastique",
  "Animation", "Science-Fiction", "Horreur", "Aventure", "Mystère", "Famille",
];

/** Exemples visuels — montrer j'aime / j'exclus avant que l'utilisateur touche aux chips. */
const DEMO_LIKED_GENRE = "Comédie";
const DEMO_EXCLUDED_GENRE = "Horreur";

type GenreChoice = "none" | "liked" | "excluded";

function hasGenreSelection(map: Map<string, GenreChoice>): boolean {
  return [...map.values()].some((v) => v === "liked" || v === "excluded");
}

function withGenreDemosIfEmpty(map: Map<string, GenreChoice>): Map<string, GenreChoice> {
  if (hasGenreSelection(map)) return map;
  const next = new Map(map);
  next.set(DEMO_LIKED_GENRE, "liked");
  next.set(DEMO_EXCLUDED_GENRE, "excluded");
  return next;
}

const Onboarding = () => {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [genreChoices, setGenreChoices] = useState<Map<string, GenreChoice>>(new Map());
  const [platformIds, setPlatformIds] = useState<number[]>(DEFAULT_ONBOARDING_PLATFORM_IDS);
  const [filmsProgress, setFilmsProgress] = useState(0);
  const [filmsLikedIds, setFilmsLikedIds] = useState<number[]>([]);
  const [filmsProposedIds, setFilmsProposedIds] = useState<number[]>([]);
  const [actorsSelectedIds, setActorsSelectedIds] = useState<number[]>([]);
  const [actorsProposedIds, setActorsProposedIds] = useState<number[]>([]);
  const [directorsSelectedIds, setDirectorsSelectedIds] = useState<number[]>([]);
  const [directorsProposedIds, setDirectorsProposedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [pausing, setPausing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const navigate = useNavigate();

  const likedGenres = [...genreChoices.entries()]
    .filter(([, v]) => v === "liked")
    .map(([g]) => g);
  const excludedGenres = [...genreChoices.entries()]
    .filter(([, v]) => v === "excluded")
    .map(([g]) => g);

  useEffect(() => {
    let cancelled = false;
    loadOnboardingProgress()
      .then(async (progress) => {
        if (cancelled || !progress) return;
        const map = new Map<string, GenreChoice>();
        progress.likedGenres.forEach((g) => map.set(g, "liked"));
        progress.excludedGenres.forEach((g) => map.set(g, "excluded"));
        setGenreChoices(withGenreDemosIfEmpty(map));
        setPlatformIds(progress.platformIds);
        setFilmsProgress(progress.filmsProgress);
        setFilmsLikedIds(progress.filmsLikedIds);
        setFilmsProposedIds(progress.filmsProposedIds);
        setActorsSelectedIds(progress.actorsSelectedIds);
        setActorsProposedIds(progress.actorsProposedIds);
        setDirectorsSelectedIds(progress.directorsSelectedIds);
        setDirectorsProposedIds(progress.directorsProposedIds);
        setStep(progress.step);
        if (progress.paused) {
          await saveOnboardingProgress(progress.step, {
            likedGenres: progress.likedGenres,
            excludedGenres: progress.excludedGenres,
            platformIds: progress.platformIds,
            paused: false,
          });
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  useEffect(() => {
    if (loading || step !== "genres") return;
    setGenreChoices((prev) => withGenreDemosIfEmpty(prev));
  }, [step, loading]);

  const cycleGenre = (g: string) => {
    setGenreChoices((prev) => {
      const next = new Map(prev);
      const current = next.get(g) ?? "none";
      const state: GenreChoice =
        current === "none" ? "liked" : current === "liked" ? "excluded" : "none";
      if (state === "none") next.delete(g);
      else next.set(g, state);
      return next;
    });
  };

  const progressPayload = useCallback(
    () => ({ likedGenres, excludedGenres, platformIds, paused: false as const }),
    [likedGenres, excludedGenres, platformIds],
  );

  const goToStep = useCallback(async (next: OnboardingStep) => {
    await saveOnboardingProgress(next, progressPayload());
    setStep(next);
  }, [progressPayload]);

  const handleStepBack = useCallback(() => {
    const prev = PREVIOUS_STEP[step];
    if (prev) void goToStep(prev);
  }, [step, goToStep]);

  const handlePause = useCallback(async () => {
    setPausing(true);
    try {
      await saveOnboardingProgress(step, { ...progressPayload(), paused: true });
      navigate("/app", { replace: true });
    } finally {
      setPausing(false);
    }
  }, [step, progressPayload, navigate]);

  const handlePlatformsContinue = async (ids: number[]) => {
    setPlatformIds(ids);
    await saveOnboardingProgress("films", {
      likedGenres,
      excludedGenres,
      platformIds: ids,
      paused: false,
    });
    setStep("films");
  };

  const handleFinish = async () => {
    setFinishing(true);
    try {
      await completeOnboarding(likedGenres, excludedGenres, platformIds);
      navigate("/app", { replace: true });
    } catch (e) {
      console.error(e);
    } finally {
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary/50" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-y-auto overscroll-y-contain touch-pan-y">
      {step !== "welcome" && (
        <OnboardingChrome
          step={step}
          onPause={handlePause}
          onBack={PREVIOUS_STEP[step] ? handleStepBack : undefined}
          pausing={pausing}
          filmsProgress={filmsProgress}
        />
      )}

      <AnimatePresence mode="wait">
        {step === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center min-h-full px-6"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
              className="mb-6"
            >
              <img src={pickLogo} alt="Pick" className="h-24 w-auto object-contain" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl md:text-4xl font-serif text-center mb-3"
            >
              Bienvenue sur Pick
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="text-foreground/50 text-sm font-sans text-center max-w-sm mb-2 leading-relaxed"
            >
              Environ <strong className="text-foreground/70 font-medium">2 minutes</strong> pour calibrer
              tes recommandations — genres, plateformes, films et quelques visages du 7e art.
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-[11px] font-sans text-foreground/40 text-center max-w-sm mb-8"
            >
              Tu peux t&apos;arrêter à tout moment avec «&nbsp;Plus tard&nbsp;» et reprendre où tu en étais.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="flex flex-col gap-3 w-full max-w-xs"
            >
              <Button variant="hero" size="xl" onClick={() => void goToStep("genres")}>
                C&apos;est parti <ArrowRight className="w-4 h-4" />
              </Button>
              <button
                type="button"
                onClick={() => void handlePause()}
                disabled={pausing}
                className="text-sm font-sans text-foreground/45 hover:text-foreground/65 transition-colors disabled:opacity-40"
              >
                {pausing ? "Enregistrement…" : "Plus tard"}
              </button>
            </motion.div>
          </motion.div>
        )}

        {step === "genres" && (
          <motion.div
            key="genres"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col min-h-full"
          >
            <div className="flex-1 flex flex-col items-center justify-start px-5 py-4 pb-2">
            <div className="flex items-center gap-3 mb-2 mt-2 max-w-lg w-full">
              <img src={pickLogo} alt="Pick" className="h-10 w-auto object-contain shrink-0" />
              <h1 className="text-2xl md:text-3xl font-serif">Tes genres</h1>
            </div>
            <p className="text-muted-foreground text-sm font-sans mb-2 text-center max-w-lg">
              Choisis ce que tu aimes — et ce que tu veux éviter.
            </p>
            <p className="text-[10px] font-sans text-foreground/45 text-center max-w-lg mb-1 uppercase tracking-wide">
              1 clic = j&apos;aime · 2 clics = j&apos;exclus · 3 clics = neutre
            </p>
            <p className="text-[11px] font-sans text-foreground/50 text-center max-w-lg mb-4 leading-relaxed">
              <span className="text-primary/75">{DEMO_LIKED_GENRE}</span> et{" "}
              <span className="text-destructive/75">{DEMO_EXCLUDED_GENRE}</span> sont des exemples — adapte-les
              ou choisis d&apos;autres genres (minimum 2 aimés).
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mb-4">
              {ONBOARDING_GENRES.map((genre) => {
                const state = genreChoices.get(genre) ?? "none";
                return (
                  <motion.button
                    key={genre}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => cycleGenre(genre)}
                    className={`flex items-center gap-1 px-4 py-2.5 rounded-full text-sm font-sans font-medium transition-all border ${
                      state === "liked"
                        ? "bg-primary/15 border-primary/30 text-primary"
                        : state === "excluded"
                          ? "bg-destructive/10 border-destructive/40 text-destructive"
                          : "bg-card border-transparent text-foreground/60 hover:border-primary/20"
                    }`}
                  >
                    {state === "liked" && <Check className="w-3 h-3 shrink-0" />}
                    {state === "excluded" && <Ban className="w-3 h-3 shrink-0" />}
                    {genre}
                  </motion.button>
                );
              })}
            </div>
            {(likedGenres.length > 0 || excludedGenres.length > 0) && (
              <p className="text-[10px] font-sans text-center max-w-lg mb-4">
                {likedGenres.length > 0 && (
                  <span className="text-primary/70">{likedGenres.length} aimé{likedGenres.length > 1 ? "s" : ""}</span>
                )}
                {likedGenres.length > 0 && excludedGenres.length > 0 && " · "}
                {excludedGenres.length > 0 && (
                  <span className="text-destructive/70">{excludedGenres.length} exclu{excludedGenres.length > 1 ? "s" : ""}</span>
                )}
              </p>
            )}
            <div className="w-full max-w-lg mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/30 bg-card/60 px-4 py-3 flex items-start gap-3">
                <Star className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-sans font-semibold text-foreground/85">Note minimum</p>
                  <p className="text-sm font-serif">{ONBOARDING_MIN_RATING}+ / 10</p>
                </div>
              </div>
              <div className="rounded-xl border border-border/30 bg-card/60 px-4 py-3 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-sans font-semibold text-foreground/85">Similarité</p>
                  <p className="text-sm font-serif">{ONBOARDING_MATCH_THRESHOLD}%</p>
                </div>
              </div>
            </div>
            </div>
            <OnboardingStickyFooter>
              <Button
                variant="hero"
                size="xl"
                className="w-full"
                onClick={() => void goToStep("platforms")}
                disabled={likedGenres.length < 2}
              >
                Continuer <ArrowRight className="w-4 h-4" />
              </Button>
            </OnboardingStickyFooter>
          </motion.div>
        )}

        {step === "platforms" && (
          <motion.div
            key="platforms"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="min-h-full"
          >
            <OnboardingPlatformStep
              initialPlatformIds={platformIds}
              onContinue={(ids) => void handlePlatformsContinue(ids)}
            />
          </motion.div>
        )}

        {step === "films" && (
          <motion.div
            key="films"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="min-h-full flex-1"
          >
            <OnboardingFilmTrainer
              favoriteGenres={likedGenres}
              excludedGenres={excludedGenres}
              initialFilmsLikedIds={filmsLikedIds}
              initialFilmsProposedIds={filmsProposedIds}
              onFilmsProgressChange={setFilmsProgress}
              onFilmsLikedIdsChange={setFilmsLikedIds}
              onFilmsProposedIdsChange={setFilmsProposedIds}
              onComplete={() => void goToStep("actors")}
            />
          </motion.div>
        )}

        {step === "actors" && (
          <motion.div
            key="actors"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="min-h-full"
          >
            <OnboardingPeopleStep
              personType="actor"
              initialSelectedIds={actorsSelectedIds}
              initialProposedIds={actorsProposedIds}
              onSelectedIdsChange={setActorsSelectedIds}
              onProposedIdsChange={setActorsProposedIds}
              onComplete={() => void goToStep("directors")}
            />
          </motion.div>
        )}

        {step === "directors" && (
          <motion.div
            key="directors"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="min-h-full"
          >
            <OnboardingPeopleStep
              personType="director"
              initialSelectedIds={directorsSelectedIds}
              initialProposedIds={directorsProposedIds}
              onSelectedIdsChange={setDirectorsSelectedIds}
              onProposedIdsChange={setDirectorsProposedIds}
              onComplete={() => void goToStep("modes")}
            />
          </motion.div>
        )}

        {step === "modes" && (
          <motion.div
            key="modes"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="min-h-full"
          >
            <OnboardingModesGuide onContinue={() => void goToStep("soirees")} />
          </motion.div>
        )}

        {step === "soirees" && (
          <motion.div
            key="soirees"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="min-h-full"
          >
            <OnboardingSoireesGuide
              onFinish={() => void handleFinish()}
              finishing={finishing}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Onboarding;
