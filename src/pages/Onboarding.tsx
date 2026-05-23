import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, Loader2, Film, Tv, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import pickLogo from "@/assets/pick-logo.png";
import type { StreamingPlatform } from "@/components/pick/PlatformStep";
import { ALL_PLATFORMS } from "@/lib/platforms";

const ALL_GENRES = [
  "Action", "Aventure", "Animation", "Comédie", "Crime", "Documentaire",
  "Drame", "Famille", "Fantastique", "Histoire", "Horreur", "Musique",
  "Mystère", "Romance", "Science-Fiction", "Thriller", "Guerre", "Western",
];

const platforms: StreamingPlatform[] = ALL_PLATFORMS as unknown as StreamingPlatform[];

type OnboardingStep = "welcome" | "birth_year" | "genres" | "platforms" | "media_type";
const STEPS: OnboardingStep[] = ["welcome", "birth_year", "genres", "platforms", "media_type"];

const MEDIA_OPTIONS = [
  { value: "movie", label: "Films", icon: Film, desc: "Uniquement des films" },
  { value: "tv", label: "Séries", icon: Tv, desc: "Uniquement des séries" },
  { value: "both", label: "Les deux", icon: Layers, desc: "Films et séries" },
] as const;

const currentYear = new Date().getFullYear();
const MIN_YEAR = 1940;
const MAX_YEAR = currentYear - 10;

const Onboarding = () => {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<number[]>([]);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [mediaPreference, setMediaPreference] = useState<string>("both");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const stepIndex = STEPS.indexOf(step) + 1;
  const totalSteps = STEPS.length;

  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  const toggleGenre = (g: string) => {
    setSelectedGenres(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  const togglePlatform = (id: number) => {
    setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (userId) {
        const genres = Array.from(selectedGenres).slice(0, 8);
        await supabase.from("profiles").update({
          onboarding_completed: true,
          favorite_genres: genres,
          preferred_platforms: selectedPlatforms,
          birth_year: birthYear,
          media_preference: mediaPreference,
          tour_completed: false,
          activation_completed: false,
          activation_step: "train_20",
        } as any).eq("id", userId);

        // Mirror to V1 normalized preferences
        try {
          const { setLikedGenres, setLikedPlatforms, setSinglePreference } = await import("@/lib/preferences");
          await Promise.all([
            setLikedGenres(genres, "onboarding"),
            setLikedPlatforms(selectedPlatforms, "onboarding"),
            setSinglePreference("media_type", mediaPreference || "both", "onboarding"),
          ]);
        } catch (e) { console.warn("preferences mirror failed", e); }
      }
      sessionStorage.setItem("pick_force_tour", "1");
      navigate("/app", { state: { showTour: true } });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const canContinueGenres = selectedGenres.size >= 2;

  const renderStepIndicator = () => (
    <div className="w-full max-w-2xl mx-auto mb-2">
      <div className="flex items-center gap-2 mb-2">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < stepIndex ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>
      <p className="text-muted-foreground text-xs font-sans">Étape {stepIndex}/{totalSteps}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-y-auto overscroll-y-contain touch-pan-y">
      <AnimatePresence mode="wait">
        {/* ── Welcome ── */}
        {step === "welcome" && (
          <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center min-h-full px-6">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 200 }} className="mb-6">
              <img src={pickLogo} alt="Pick" className="w-20 h-20 object-contain" />
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="text-3xl md:text-4xl font-serif text-center mb-3">
              Bienvenue sur Pick
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="text-foreground/50 text-sm font-sans text-center max-w-sm mb-2 leading-relaxed">
              Je vais apprendre tes goûts pour te recommander le film parfait, à chaque fois.
            </motion.p>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="text-primary/60 text-xs font-sans text-center max-w-xs mb-10">
              Quelques questions rapides, puis on passe aux choses sérieuses.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}>
              <Button variant="hero" size="xl" onClick={() => setStep("birth_year")}>
                C'est parti <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </motion.div>
        )}

        {/* ── Birth Year ── */}
        {step === "birth_year" && (
          <motion.div key="birth_year" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-start md:justify-center min-h-full px-5 py-6 md:py-0">
            <div className="w-full max-w-xl pt-[env(safe-area-inset-top)]">{renderStepIndicator()}</div>
            <div className="flex items-center gap-3 mb-2 mt-4">
              <img src={pickLogo} alt="Pick" className="w-10 h-10 object-contain" />
              <h1 className="text-2xl md:text-4xl font-serif">Quelle est ton année de naissance ?</h1>
            </div>
            <p className="text-muted-foreground text-sm font-sans mb-8 text-center">
              Pour adapter mes recommandations à ta génération
            </p>

            <div className="w-full max-w-xs mb-10">
              <select
                value={birthYear ?? ""}
                onChange={e => setBirthYear(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full bg-card border border-border/30 rounded-xl px-4 py-3.5 text-sm font-sans text-foreground outline-none focus:border-primary/50 transition-colors appearance-none"
              >
                <option value="" className="text-muted-foreground">Sélectionne ton année</option>
                {Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MAX_YEAR - i).map(year => (
                  <option key={year} value={year}>{year} ({new Date().getFullYear() - year} ans)</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col items-center gap-3">
              <Button variant="hero" size="xl" onClick={() => setStep("genres")} disabled={!birthYear}>
                Continuer <ArrowRight className="w-4 h-4" />
              </Button>
              <button onClick={() => { setBirthYear(null); setStep("genres"); }} className="text-muted-foreground text-sm font-sans hover:text-foreground transition-colors">
                Préfère ne pas dire
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Genres ── */}
        {step === "genres" && (
          <motion.div key="genres" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-start md:justify-center min-h-full px-5 py-6 md:py-0">
            <div className="w-full max-w-xl pt-[env(safe-area-inset-top)]">{renderStepIndicator()}</div>
            <div className="flex items-center gap-3 mb-2 mt-4">
              <img src={pickLogo} alt="Pick" className="w-10 h-10 object-contain" />
              <h1 className="text-2xl md:text-4xl font-serif">Qu'est-ce qui te plaît ?</h1>
            </div>
            <p className="text-muted-foreground text-sm font-sans mb-8 text-center">Choisis au moins 2 genres que tu aimes</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-xl mb-10">
              {ALL_GENRES.map((genre) => {
                const isSelected = selectedGenres.has(genre);
                return (
                  <motion.button key={genre} whileTap={{ scale: 0.95 }} onClick={() => toggleGenre(genre)}
                    className={`px-4 py-2.5 rounded-full text-sm font-sans font-medium transition-all duration-200 cursor-pointer border ${
                      isSelected
                        ? "bg-primary/15 border-primary/30 text-primary"
                        : "bg-card border-transparent text-foreground/60 hover:border-primary/20 hover:text-foreground"
                    }`}>
                    {genre}
                  </motion.button>
                );
              })}
            </div>
            <Button variant="hero" size="xl" onClick={() => setStep("platforms")} disabled={!canContinueGenres}>
              Continuer <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        )}

        {/* ── Platforms ── */}
        {step === "platforms" && (
          <motion.div key="platforms" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-start md:justify-center min-h-full px-4 md:px-6 py-6 md:py-0">
            <div className="w-full max-w-xl pt-[env(safe-area-inset-top)]">{renderStepIndicator()}</div>
            <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl md:text-4xl font-serif mb-2 text-center mt-4">
              Tes plateformes de streaming
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="text-muted-foreground text-xs md:text-sm font-sans mb-8 md:mb-10 text-center">
              Sélectionne tes abonnements pour des recommandations adaptées
            </motion.p>
            <div className="grid grid-cols-4 gap-2 md:gap-4 max-w-xl w-full mb-8 md:mb-10">
              {platforms.map((platform, i) => {
                const isSelected = selectedPlatforms.includes(platform.id);
                return (
                  <motion.button key={platform.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.95 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }} onClick={() => togglePlatform(platform.id)}
                    className={`relative bg-card rounded-xl md:rounded-2xl p-2.5 md:p-5 flex flex-col items-center gap-1.5 md:gap-2.5 transition-all duration-200 hover:scale-[1.02] cursor-pointer border ${
                      isSelected ? "border-primary neon-glow" : "border-transparent hover:border-primary/30"
                    }`}>
                    {isSelected && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-1 right-1 md:top-2 md:right-2 w-4 h-4 md:w-5 md:h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 md:w-3 md:h-3 text-primary-foreground" />
                      </motion.div>
                    )}
                    <img src={platform.logo} alt={platform.label} className="w-8 h-8 md:w-12 md:h-12 rounded-lg object-cover" />
                    <span className="font-sans text-[10px] md:text-sm tracking-wide text-foreground/90 leading-tight text-center">{platform.label}</span>
                  </motion.button>
                );
              })}
            </div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex flex-col sm:flex-row gap-3 items-center">
              <Button variant="hero" size="xl" onClick={() => setStep("media_type")}>
                {selectedPlatforms.length === 0 ? "Passer" : "Continuer"} <ArrowRight className="w-4 h-4" />
              </Button>
              <button onClick={() => setStep("genres")} className="text-muted-foreground text-sm font-sans hover:text-foreground transition-colors">Retour</button>
            </motion.div>
          </motion.div>
        )}

        {/* ── Media Type ── */}
        {step === "media_type" && (
          <motion.div key="media_type" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-start md:justify-center min-h-full px-5 py-6 md:py-0">
            <div className="w-full max-w-xl pt-[env(safe-area-inset-top)]">{renderStepIndicator()}</div>
            <div className="flex items-center gap-3 mb-2 mt-4">
              <img src={pickLogo} alt="Pick" className="w-10 h-10 object-contain" />
              <h1 className="text-2xl md:text-4xl font-serif">Films ou séries ?</h1>
            </div>
            <p className="text-muted-foreground text-sm font-sans mb-8 text-center">
              Qu'est-ce que tu préfères regarder ?
            </p>
            <div className="flex flex-col gap-3 w-full max-w-sm mb-10">
              {MEDIA_OPTIONS.map(({ value, label, icon: Icon, desc }) => (
                <motion.button key={value} whileTap={{ scale: 0.97 }} onClick={() => setMediaPreference(value)}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                    mediaPreference === value
                      ? "bg-primary/15 border-primary/30"
                      : "bg-card border-transparent hover:border-primary/20"
                  }`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    mediaPreference === value ? "bg-primary/25" : "bg-muted"
                  }`}>
                    <Icon className={`w-5 h-5 ${mediaPreference === value ? "text-primary" : "text-foreground/50"}`} />
                  </div>
                  <div className="text-left">
                    <p className={`font-sans font-semibold text-sm ${mediaPreference === value ? "text-primary" : "text-foreground"}`}>{label}</p>
                    <p className="text-foreground/40 text-xs font-sans">{desc}</p>
                  </div>
                </motion.button>
              ))}
            </div>
            <div className="flex flex-col items-center gap-3">
              <Button variant="hero" size="xl" onClick={handleFinish} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Terminer <ArrowRight className="w-4 h-4" /></>}
              </Button>
              <button onClick={() => setStep("platforms")} className="text-muted-foreground text-sm font-sans hover:text-foreground transition-colors">Retour</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Onboarding;
