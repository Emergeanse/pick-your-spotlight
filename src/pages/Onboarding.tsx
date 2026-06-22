import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import pickLogo from "@/assets/pick-logo.png";
import OnboardingFilmTrainer from "@/components/onboarding/OnboardingFilmTrainer";
import OnboardingSoloDemo, { type SoloLaunchChoice } from "@/components/onboarding/OnboardingSoloDemo";

/** Genres proposés à l'initiation — sélection rapide, pas la liste complète */
const ONBOARDING_GENRES = [
  "Comédie", "Drame", "Thriller", "Action", "Romance", "Fantastique",
  "Animation", "Science-Fiction", "Horreur", "Aventure", "Mystère", "Famille",
];

/** Préréglages reco pour les nouveaux profils (modifiables plus tard dans Profil) */
const ONBOARDING_MIN_RATING = 6;
const ONBOARDING_MATCH_THRESHOLD = 60;

type OnboardingStep = "welcome" | "genres" | "films" | "solo";
const STEPS: OnboardingStep[] = ["welcome", "genres", "films", "solo"];

const Onboarding = () => {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [filmsDone, setFilmsDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const stepIndex = STEPS.indexOf(step) + 1;
  const totalSteps = STEPS.length;
  const genresList = Array.from(selectedGenres);

  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const persistProfile = async () => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;
    const genres = genresList.slice(0, 8);
    await supabase.from("profiles").update({
      onboarding_completed: true,
      favorite_genres: genres,
      preferred_platforms: [],
      birth_year: null,
      media_preference: "both",
      min_rating: ONBOARDING_MIN_RATING,
      match_threshold: ONBOARDING_MATCH_THRESHOLD,
      tour_completed: true,
      activation_completed: true,
      activation_step: "done",
    } as any).eq("id", userId);

    try {
      const { setLikedGenres, setSinglePreference } = await import("@/lib/preferences");
      await Promise.all([
        setLikedGenres(genres, "onboarding"),
        setSinglePreference("media_type", "both", "onboarding"),
        setSinglePreference("rating_threshold", "good", "onboarding"),
      ]);
    } catch (e) {
      console.warn("preferences mirror failed", e);
    }
  };

  const finishWithLaunch = async (choice: SoloLaunchChoice) => {
    setSaving(true);
    try {
      await persistProfile();
      const state: Record<string, unknown> = { onboardingFirstPick: true };
      if (choice.mode === "genre") {
        state.genres = [choice.genre];
      } else if (choice.mode === "voice") {
        state.moodContext = choice.prompt;
      }
      navigate("/app", { state, replace: true });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="w-full max-w-lg mx-auto mb-2">
      <div className="flex items-center gap-2 mb-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < stepIndex ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-xs font-sans">Étape {stepIndex}/{totalSteps}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-y-auto overscroll-y-contain touch-pan-y">
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
              <img src={pickLogo} alt="Pick" className="w-20 h-20 object-contain" />
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
              className="text-foreground/50 text-sm font-sans text-center max-w-sm mb-10 leading-relaxed"
            >
              En 2 minutes : tes genres, quelques films, puis ta première recherche Solo.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
              <Button variant="hero" size="xl" onClick={() => setStep("genres")}>
                C&apos;est parti <ArrowRight className="w-4 h-4" />
              </Button>
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
            className="flex flex-col items-center justify-start min-h-full px-5 py-6"
          >
            <div className="w-full max-w-lg pt-[env(safe-area-inset-top)]">{renderStepIndicator()}</div>
            <div className="flex items-center gap-3 mb-2 mt-4 max-w-lg w-full">
              <img src={pickLogo} alt="Pick" className="w-10 h-10 object-contain shrink-0" />
              <h1 className="text-2xl md:text-3xl font-serif">Tes genres préférés</h1>
            </div>
            <p className="text-muted-foreground text-sm font-sans mb-4 text-center max-w-lg">
              Coche au moins 2 genres — Pick partira avec des réglages souples pour te proposer vite des idées.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mb-6">
              {ONBOARDING_GENRES.map((genre) => {
                const isSelected = selectedGenres.has(genre);
                return (
                  <motion.button
                    key={genre}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleGenre(genre)}
                    className={`px-4 py-2.5 rounded-full text-sm font-sans font-medium transition-all border ${
                      isSelected
                        ? "bg-primary/15 border-primary/30 text-primary"
                        : "bg-card border-transparent text-foreground/60 hover:border-primary/20"
                    }`}
                  >
                    {genre}
                  </motion.button>
                );
              })}
            </div>

            <div className="w-full max-w-lg mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/30 bg-card/60 px-4 py-3 flex items-start gap-3">
                <Star className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-sans font-semibold text-foreground/85">Note minimum</p>
                  <p className="text-sm font-serif">{ONBOARDING_MIN_RATING}+ / 10</p>
                  <p className="text-[10px] font-sans text-muted-foreground mt-0.5">Films corrects et mieux notés</p>
                </div>
              </div>
              <div className="rounded-xl border border-border/30 bg-card/60 px-4 py-3 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-sans font-semibold text-foreground/85">Similarité</p>
                  <p className="text-sm font-serif">{ONBOARDING_MATCH_THRESHOLD}%</p>
                  <p className="text-[10px] font-sans text-muted-foreground mt-0.5">Assez ouvert pour découvrir</p>
                </div>
              </div>
            </div>
            <p className="text-[10px] font-sans text-muted-foreground text-center max-w-sm mb-6">
              Tu pourras affiner note et similarité dans ton profil à tout moment.
            </p>

            <Button
              variant="hero"
              size="xl"
              onClick={() => setStep("films")}
              disabled={selectedGenres.size < 2}
            >
              Continuer <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        )}

        {step === "films" && !filmsDone && (
          <motion.div
            key="films"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="min-h-full"
          >
            <OnboardingFilmTrainer
              favoriteGenres={genresList}
              onBack={() => setStep("genres")}
              onComplete={() => {
                setFilmsDone(true);
                setStep("solo");
              }}
            />
          </motion.div>
        )}

        {step === "solo" && (
          <motion.div
            key="solo"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="min-h-full"
          >
            <div className="w-full max-w-lg mx-auto px-5 pt-[env(safe-area-inset-top)]">
              {renderStepIndicator()}
            </div>
            <OnboardingSoloDemo
              favoriteGenres={genresList}
              onBack={() => setStep("films")}
              onLaunch={finishWithLaunch}
              saving={saving}
            />
            {saving && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Onboarding;
