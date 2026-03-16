import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Flame, Target, Trophy, TrendingUp, Sparkles, Loader2, Dna, BookOpen, Lock, Unlock, Brain, MessageSquareText, Shuffle, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getEngagementData, getProgressionMessage, getStreakLabel, type EngagementData } from "@/lib/engagement";
import { Progress } from "@/components/ui/progress";
import CinemaDNA from "@/components/pick/CinemaDNA";

const MILESTONES = [
  { count: 1, label: "Premier film", emoji: "🎬", desc: "Ta première recommandation Pick" },
  { count: 5, label: "Cinéphile débutant", emoji: "🍿", desc: "5 films découverts ensemble" },
  { count: 10, label: "Fidèle spectateur", emoji: "📽️", desc: "10 recommandations" },
  { count: 20, label: "Explorateur", emoji: "🧭", desc: "20 films — Pick te connaît bien" },
  { count: 50, label: "Connaisseur", emoji: "🎪", desc: "50 films — goûts bien affûtés" },
  { count: 100, label: "Maître cinéphile", emoji: "👑", desc: "100 films — légende vivante" },
];

const STREAK_MILESTONES = [
  { count: 3, label: "Coup triple", emoji: "🔥" },
  { count: 5, label: "Sniper", emoji: "🎯" },
  { count: 10, label: "Inarrêtable", emoji: "🏆" },
  { count: 20, label: "Légendaire", emoji: "💎" },
];

const MyCinema = () => {
  const { user, isReady } = useAuth();
  const navigate = useNavigate();
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDNA, setShowDNA] = useState(false);
  const [likedCount, setLikedCount] = useState(0);

  useEffect(() => {
    if (!isReady) return;
    if (!user) { navigate("/auth"); return; }
    loadData();
  }, [user, isReady]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [engData, likedData] = await Promise.all([
        getEngagementData(user.id),
        supabase.from("liked_movies").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      setEngagement(engData);
      setLikedCount(likedData.count || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isReady || loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const progressionMessage = engagement ? getProgressionMessage(engagement) : null;
  const streakLabel = engagement ? getStreakLabel(engagement.streakCount) : "";
  const nextMilestone = MILESTONES.find(m => (engagement?.totalRecommendations || 0) < m.count);
  const reachedMilestones = MILESTONES.filter(m => (engagement?.totalRecommendations || 0) >= m.count);
  const bestStreakMilestone = STREAK_MILESTONES.filter(m => (engagement?.bestStreak || 0) >= m.count).pop();

  // If DNA full screen overlay
  if (showDNA) {
    return (
      <div className="fixed inset-0 bg-background overflow-y-auto z-50">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button
            onClick={() => setShowDNA(false)}
            className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-serif text-lg">Mon Cinéma</span>
          </button>
        </div>
        <CinemaDNA userId={user.id} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <button
            onClick={() => navigate("/app")}
            className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-serif text-lg">Mon Cinéma</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 pb-32">
        {/* Progression Message */}
        {progressionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 px-4 py-3 rounded-2xl bg-primary/[0.06] border border-primary/15 text-center"
          >
            <p className="text-sm font-sans text-foreground/80">{progressionMessage}</p>
          </motion.div>
        )}

        {/* ─── Stats Hero ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="grid grid-cols-3 gap-2.5">
            {/* Streak */}
            <div className="bg-card rounded-2xl p-4 text-center border border-border/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent" />
              <div className="relative">
                <div className="flex items-center justify-center gap-1 mb-2">
                  {(engagement?.streakCount || 0) >= 5
                    ? <Target className="w-5 h-5 text-primary" />
                    : <Flame className="w-5 h-5 text-primary" />
                  }
                </div>
                <p className="text-3xl font-serif text-foreground">{engagement?.streakCount || 0}</p>
                <p className="text-[10px] text-muted-foreground font-sans mt-1">Série en cours</p>
                {streakLabel && (
                  <p className="text-[10px] text-primary font-sans font-medium mt-0.5">{streakLabel}</p>
                )}
              </div>
            </div>

            {/* Total Recos */}
            <div className="bg-card rounded-2xl p-4 text-center border border-border/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent" />
              <div className="relative">
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className="w-5 h-5 text-primary/60" />
                </div>
                <p className="text-3xl font-serif text-foreground">{engagement?.totalRecommendations || 0}</p>
                <p className="text-[10px] text-muted-foreground font-sans mt-1">Recommandations</p>
              </div>
            </div>

            {/* Profile Confidence */}
            <div className="bg-card rounded-2xl p-4 text-center border border-border/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent" />
              <div className="relative">
                <div className="flex items-center justify-center mb-2">
                  <Sparkles className="w-5 h-5 text-primary/60" />
                </div>
                <p className="text-3xl font-serif text-primary">{engagement?.profileConfidence || 0}%</p>
                <p className="text-[10px] text-muted-foreground font-sans mt-1">Confiance</p>
                <div className="w-full h-1.5 rounded-full bg-foreground/10 mt-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${engagement?.profileConfidence || 0}%` }}
                    transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Best Streak */}
          {(engagement?.bestStreak || 0) > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-center gap-2 mt-3"
            >
              <Trophy className="w-3.5 h-3.5 text-primary/50" />
              <p className="text-[11px] text-muted-foreground font-sans">
                Record : <span className="text-foreground font-medium">{engagement?.bestStreak}</span> recos validées d'affilée
                {bestStreakMilestone && ` ${bestStreakMilestone.emoji}`}
              </p>
            </motion.div>
          )}
        </motion.div>

        {/* ─── ADN Cinéma Teaser ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <CinemaDNA userId={user.id} teaser onOpenFull={() => setShowDNA(true)} />
        </motion.div>

        {/* ─── Milestones ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8"
        >
          <h2 className="text-[11px] uppercase tracking-[0.15em] text-foreground/30 font-sans font-semibold mb-4">
            Tes jalons
          </h2>
          <div className="space-y-2">
            {MILESTONES.map((milestone, i) => {
              const reached = (engagement?.totalRecommendations || 0) >= milestone.count;
              const isNext = milestone === nextMilestone;
              const progress = isNext
                ? Math.min(((engagement?.totalRecommendations || 0) / milestone.count) * 100, 100)
                : reached ? 100 : 0;

              return (
                <motion.div
                  key={milestone.count}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.04 }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                    reached
                      ? "bg-primary/[0.06] border-primary/15"
                      : isNext
                        ? "bg-card border-border/20"
                        : "bg-card/50 border-border/10 opacity-50"
                  }`}
                >
                  <span className="text-xl w-8 text-center">{milestone.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-sans font-medium ${reached ? "text-foreground" : "text-foreground/60"}`}>
                        {milestone.label}
                      </p>
                      <span className="text-[10px] text-muted-foreground font-sans">
                        {milestone.count} films
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-sans">{milestone.desc}</p>
                    {isNext && (
                      <div className="mt-1.5">
                        <Progress value={progress} className="h-1" />
                        <p className="text-[9px] text-muted-foreground font-sans mt-0.5">
                          {engagement?.totalRecommendations || 0}/{milestone.count}
                        </p>
                      </div>
                    )}
                  </div>
                  {reached && (
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-primary" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ─── Streak Milestones ─── */}
        {(engagement?.bestStreak || 0) >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-8"
          >
            <h2 className="text-[11px] uppercase tracking-[0.15em] text-foreground/30 font-sans font-semibold mb-4">
              Séries record
            </h2>
            <div className="flex gap-2 flex-wrap">
              {STREAK_MILESTONES.map((sm) => {
                const reached = (engagement?.bestStreak || 0) >= sm.count;
                return (
                  <div
                    key={sm.count}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-full border text-sm font-sans ${
                      reached
                        ? "bg-primary/[0.08] border-primary/20 text-foreground"
                        : "bg-card/50 border-border/10 text-foreground/30"
                    }`}
                  >
                    <span>{sm.emoji}</span>
                    <span className="font-medium">{sm.label}</span>
                    <span className="text-[10px] text-muted-foreground">{sm.count}+</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ─── Lexique link ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10 flex justify-center"
        >
          <button
            onClick={() => navigate("/glossary")}
            className="flex items-center gap-2 text-[12px] text-primary/50 hover:text-primary font-sans font-medium transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Lexique Cinéma
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default MyCinema;
