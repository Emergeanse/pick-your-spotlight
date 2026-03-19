import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, MessageCircle, Bookmark, Heart, ArrowRight, Check, Dna, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import pickLogo from "@/assets/pick-logo.png";
import pickWave from "@/assets/pick-squirrel-wave.png";

type MissionId = "train_20" | "first_reco" | "talk_to_pick" | "watchlist_3" | "like_5";

interface Mission {
  id: MissionId;
  title: string;
  desc: string;
  hint: string;
  icon: typeof Brain;
  emoji: string;
  threshold: number;
}

const MISSIONS: Mission[] = [
  { id: "train_20", title: "Apprends-moi qui tu es", desc: "Évalue 20 films pour que Pick comprenne tes goûts", hint: "C'est rapide, promis — swipe à droite si tu aimes, à gauche sinon.", icon: Brain, emoji: "🧠", threshold: 20 },
  { id: "first_reco", title: "Ta première recommandation", desc: "Lance « Pick pour ce soir » et découvre ta suggestion", hint: "Voyons ce que Pick a trouvé pour toi !", icon: Sparkles, emoji: "🍿", threshold: 1 },
  { id: "talk_to_pick", title: "Parle à Pick", desc: "Envoie un message à Pick pour découvrir le chat", hint: "Essaie : « Un thriller psychologique récent » ou « Quelque chose de léger »", icon: MessageCircle, emoji: "💬", threshold: 1 },
  { id: "watchlist_3", title: "Crée ta liste", desc: "Sauvegarde 3 films dans ta watchlist", hint: "Tu ne les perdras plus jamais.", icon: Bookmark, emoji: "📌", threshold: 3 },
  { id: "like_5", title: "Tes coups de cœur", desc: "Marque 5 films que tu as adorés", hint: "Ça affine encore plus tes recommandations.", icon: Heart, emoji: "❤️", threshold: 5 },
];

interface ActivationFlowProps {
  onStartMission: (missionId: MissionId) => void;
  onComplete: () => void;
}

const ActivationFlow = ({ onStartMission, onComplete }: ActivationFlowProps) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<MissionId>("train_20");
  const [progress, setProgress] = useState<Record<MissionId, number>>({
    train_20: 0, first_reco: 0, talk_to_pick: 0, watchlist_3: 0, like_5: 0,
  });
  const [showMissionCard, setShowMissionCard] = useState(true);
  const [showReward, setShowReward] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load current step from DB + compute real progress
  const loadProgress = useCallback(async () => {
    if (!user) return;

    const [profileRes, interactionsRes, watchlistRes, likedRes] = await Promise.all([
      supabase.from("profiles").select("activation_step, activation_completed").eq("id", user.id).single(),
      supabase.from("user_interactions").select("id").eq("user_id", user.id).in("action_type", ["liked", "unsure", "skipped"]),
      supabase.from("watchlist").select("id").eq("user_id", user.id),
      supabase.from("liked_movies").select("id").eq("user_id", user.id),
    ]);

    if (profileRes.data?.activation_completed) {
      onComplete();
      return;
    }

    const step = (profileRes.data as any)?.activation_step as MissionId || "train_20";

    // Check daily_usage for reco count & chat count
    const today = new Date().toISOString().split("T")[0];
    const usageRes = await supabase.from("daily_usage" as any)
      .select("recommendation_count, chat_count")
      .eq("user_id", user.id).maybeSingle();

    const totalRecos = (usageRes.data as any)?.recommendation_count || 0;
    // Also check total_recommendations in profiles for historical count
    const profileFullRes = await supabase.from("profiles").select("total_recommendations").eq("id", user.id).single();
    const historicalRecos = (profileFullRes.data as any)?.total_recommendations || 0;

    const newProgress: Record<MissionId, number> = {
      train_20: interactionsRes.data?.length || 0,
      first_reco: Math.max(totalRecos, historicalRecos),
      talk_to_pick: (usageRes.data as any)?.chat_count || 0,
      watchlist_3: watchlistRes.data?.length || 0,
      like_5: likedRes.data?.length || 0,
    };

    setProgress(newProgress);
    setCurrentStep(step);
    setLoaded(true);

    // Auto-advance if current mission is already completed
    const currentMission = MISSIONS.find(m => m.id === step);
    if (currentMission && newProgress[step] >= currentMission.threshold) {
      await advanceStep(step, newProgress);
    }
  }, [user]);

  const advanceStep = async (fromStep: MissionId, currentProgress: Record<MissionId, number>) => {
    if (!user) return;
    const idx = MISSIONS.findIndex(m => m.id === fromStep);
    
    // Check all subsequent missions too
    let nextIdx = idx + 1;
    while (nextIdx < MISSIONS.length) {
      const nextMission = MISSIONS[nextIdx];
      if (currentProgress[nextMission.id] < nextMission.threshold) break;
      nextIdx++;
    }

    if (nextIdx >= MISSIONS.length) {
      // All done! Grant trial
      setShowReward(true);
      await supabase.from("profiles").update({
        activation_completed: true,
        activation_step: "like_5",
      } as any).eq("id", user.id);

      // Grant 7-day trial
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      await supabase.from("subscriptions").upsert({
        user_id: user.id,
        plan: "pick_plus",
        status: "trial",
        current_period_start: now.toISOString(),
        current_period_end: trialEnd.toISOString(),
      } as any, { onConflict: "user_id" });
      return;
    }

    const nextStep = MISSIONS[nextIdx].id;
    setCurrentStep(nextStep);
    setShowMissionCard(true);
    await supabase.from("profiles").update({ activation_step: nextStep } as any).eq("id", user.id);
  };

  useEffect(() => { loadProgress(); }, [loadProgress]);

  // Poll progress every 3s when mission card is hidden (user is doing the mission)
  useEffect(() => {
    if (showMissionCard || showReward || !loaded) return;
    const interval = setInterval(loadProgress, 3000);
    return () => clearInterval(interval);
  }, [showMissionCard, showReward, loaded, loadProgress]);

  if (!loaded) return null;

  const currentMission = MISSIONS.find(m => m.id === currentStep)!;
  const currentMissionIndex = MISSIONS.findIndex(m => m.id === currentStep);
  const currentProgress = progress[currentStep] || 0;
  const currentThreshold = currentMission?.threshold || 1;
  const progressPercent = Math.min(100, (currentProgress / currentThreshold) * 100);

  // Reward screen
  if (showReward) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100]">
        <div className="absolute inset-0 bg-background/95 backdrop-blur-xl" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-5 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
            <PartyPopper className="w-16 h-16 text-primary mx-auto mb-4" />
          </motion.div>
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4 }}>
            <img src={pickWave} alt="Pick" className="w-20 h-20 object-contain mx-auto mb-4" />
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            className="text-3xl font-serif mb-3">Ton ADN Cinéma est prêt ! 🧬</motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            className="text-foreground/60 text-sm font-sans mb-2 max-w-sm leading-relaxed">
            Tu as débloqué <span className="text-primary font-semibold">7 jours gratuits de Pick+</span>
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
            className="text-foreground/40 text-xs font-sans mb-8 max-w-xs space-y-1">
            <p>✨ Recommandations illimitées</p>
            <p>💬 Chatbot cinéma complet</p>
            <p>🧬 ADN Cinéma avancé</p>
            <p>🎬 Compagnon de visionnage illimité</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
            <Button variant="hero" size="xl" onClick={onComplete}>
              C'est parti ! <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // Persistent progress bar (always visible at top)
  const ProgressBar = () => (
    <motion.div initial={{ y: -60 }} animate={{ y: 0 }} className="fixed top-0 left-0 right-0 z-[90] bg-background/80 backdrop-blur-lg border-b border-border/30 px-4 py-2 safe-area-top">
      <div className="flex items-center gap-2 max-w-lg mx-auto">
        <div className="flex items-center gap-1.5 flex-1">
          {MISSIONS.map((m, i) => {
            const isDone = i < currentMissionIndex || (i === currentMissionIndex && progress[m.id] >= m.threshold);
            const isCurrent = i === currentMissionIndex;
            return (
              <div key={m.id} className="flex-1 flex items-center gap-1">
                <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  isDone ? "bg-primary" : isCurrent ? "bg-primary/40" : "bg-muted"
                }`}>
                  {isCurrent && (
                    <motion.div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.3 }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={() => setShowMissionCard(true)} className="text-xs font-sans text-primary/80 hover:text-primary shrink-0">
          {currentMission?.emoji}
        </button>
      </div>
      {!showMissionCard && (
        <button onClick={() => setShowMissionCard(true)}
          className="text-[11px] font-sans text-foreground/40 text-center w-full mt-0.5 hover:text-foreground/60 transition-colors">
          {currentMission?.title} — {currentProgress}/{currentThreshold}
        </button>
      )}
    </motion.div>
  );

  // Mission card overlay
  if (showMissionCard) {
    const Icon = currentMission.icon;
    return (
      <>
        <ProgressBar />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[95]">
          <div className="absolute inset-0 bg-background/90 backdrop-blur-xl" />
          <div className="relative z-10 flex flex-col items-center justify-center h-full px-5 text-center">
            {/* Completed missions */}
            {currentMissionIndex > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mb-6">
                {MISSIONS.slice(0, currentMissionIndex).map(m => (
                  <div key={m.id} className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                ))}
              </motion.div>
            )}

            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
              className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">{currentMission.emoji}</span>
            </motion.div>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
              className="text-primary/60 text-xs font-sans font-medium uppercase tracking-wider mb-2">
              Mission {currentMissionIndex + 1}/{MISSIONS.length}
            </motion.p>

            <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-2xl font-serif mb-2">{currentMission.title}</motion.h2>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="text-foreground/50 text-sm font-sans mb-1 max-w-sm leading-relaxed">{currentMission.desc}</motion.p>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="text-primary/50 text-xs font-sans italic mb-6 max-w-xs">{currentMission.hint}</motion.p>

            {/* Progress indicator */}
            {currentProgress > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-xs mb-6">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }} transition={{ duration: 0.5 }} />
                </div>
                <p className="text-foreground/40 text-xs font-sans mt-1">{currentProgress}/{currentThreshold}</p>
              </motion.div>
            )}

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Button variant="hero" size="xl" onClick={() => {
                setShowMissionCard(false);
                onStartMission(currentStep);
              }}>
                {currentProgress > 0 ? "Continuer" : "C'est parti"} <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </>
    );
  }

  // Just the persistent bar when user is doing the mission
  return <ProgressBar />;
};

export default ActivationFlow;
export type { MissionId };
