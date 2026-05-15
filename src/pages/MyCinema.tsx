import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  ChevronRight,
  Brain,
  Film,
  Tv,
  Trophy,
  Eye,
  Heart,
  Bookmark,
  TrendingUp,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getEngagementData, type EngagementData } from "@/lib/engagement";
import { getLikedMovies } from "@/lib/liked-movies";
import CinemaDNA from "@/components/pick/CinemaDNA";
import TasteTrainer from "@/components/pick/TasteTrainer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";

const MILESTONES = [
  { count: 1, label: "Premier film", icon: "🎬" },
  { count: 5, label: "Cinéphile débutant", icon: "🍿" },
  { count: 10, label: "Fidèle spectateur", icon: "📽️" },
  { count: 20, label: "Explorateur", icon: "🧭" },
  { count: 50, label: "Connaisseur", icon: "🎪" },
  { count: 100, label: "Maître cinéphile", icon: "👑" },
];

/** Calculate a detailed confidence score with breakdown */
function computeDetailedConfidence(data: {
  totalRecos: number;
  acceptedRecos: number;
  likedCount: number;
  watchlistCount: number;
  streakCount: number;
  genreCount: number;
}) {
  const { totalRecos, acceptedRecos, likedCount, watchlistCount, streakCount, genreCount } = data;

  // 1. Data volume (max 30pts) — more data = better knowledge
  const totalSignals = totalRecos + likedCount + watchlistCount;
  const volumeScore = Math.min(Math.sqrt(totalSignals) * 4, 30);

  // 2. Acceptance rate (max 25pts) — how well Pick matches
  const acceptRate = totalRecos > 0 ? acceptedRecos / totalRecos : 0;
  const acceptScore = Math.min(acceptRate * 25, 25);

  // 3. Genre diversity (max 20pts) — broader taste profile = better understanding
  const diversityScore = Math.min(genreCount * 3, 20);

  // 4. Engagement consistency (max 15pts) — streak shows ongoing calibration
  const streakScore = Math.min(streakCount * 2.5, 15);

  // 5. Taste training (max 10pts) — liked movies are explicit signals
  const trainingScore = Math.min(likedCount * 1.5, 10);

  const total = Math.round(volumeScore + acceptScore + diversityScore + streakScore + trainingScore);

  return {
    total: Math.min(total, 100),
    breakdown: [
      { label: "Données collectées", score: Math.round(volumeScore), max: 30, detail: `${totalSignals} interactions` },
      {
        label: "Taux de satisfaction",
        score: Math.round(acceptScore),
        max: 25,
        detail: totalRecos > 0 ? `${Math.round(acceptRate * 100)}% de recos validées` : "Pas encore de données",
      },
      {
        label: "Diversité des genres",
        score: Math.round(diversityScore),
        max: 20,
        detail: `${genreCount} genres identifiés`,
      },
      {
        label: "Régularité",
        score: Math.round(streakScore),
        max: 15,
        detail: streakCount > 0 ? `Série de ${streakCount}` : "Commence une série",
      },
      { label: "Entraînement goûts", score: Math.round(trainingScore), max: 10, detail: `${likedCount} films évalués` },
    ],
  };
}

const MyCinema = () => {
  const { user, isReady } = useAuth();
  const navigate = useNavigate();
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDNA, setShowDNA] = useState(false);
  const [showTrainer, setShowTrainer] = useState(false);
  const [likedMovies, setLikedMovies] = useState<any[]>([]);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [dnaTitle, setDnaTitle] = useState<string | null>(null);
  const [dnaLevel, setDnaLevel] = useState<string | null>(null);
  const [dnaArchetype, setDnaArchetype] = useState<string | null>(null);
  const [genreStats, setGenreStats] = useState<{ genre: string; count: number }[]>([]);
  const [movieVsSeries, setMovieVsSeries] = useState({ movies: 0, series: 0 });
  const [showConfidenceDetail, setShowConfidenceDetail] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    loadData();
  }, [user, isReady]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [engData, likedData, dnaData, { count: wlCount }] = await Promise.all([
        getEngagementData(user.id),
        getLikedMovies().catch(() => []),
        supabase
          .from("cinematic_profiles" as any)
          .select("personality_title, dna_archetype, global_level")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("watchlist").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      setEngagement(engData);
      setLikedMovies(likedData);
      setWatchlistCount(wlCount || 0);
      if (dnaData.data) {
        const d = dnaData.data as any;
        setDnaTitle(d.personality_title || null);
        setDnaLevel(d.global_level || null);
        setDnaArchetype(d.dna_archetype || null);
      }

      const genreCounts: Record<string, number> = {};
      let movies = 0,
        series = 0;
      likedData.forEach((m: any) => {
        (m.genres || []).forEach((g: string) => {
          genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
        if (m.media_type === "tv" || m.first_air_date) series++;
        else movies++;
      });
      setGenreStats(
        Object.entries(genreCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([genre, count]) => ({ genre, count })),
      );
      setMovieVsSeries({ movies, series });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Radar chart data — top 8 genres normalized to 0-100
  const radarData = useMemo(() => {
    if (genreStats.length === 0) return [];
    const top = genreStats.slice(0, 8);
    const max = top[0]?.count || 1;
    return top.map((gs) => ({
      genre: gs.genre.length > 10 ? gs.genre.slice(0, 9) + "…" : gs.genre,
      fullGenre: gs.genre,
      value: Math.round((gs.count / max) * 100),
      count: gs.count,
    }));
  }, [genreStats]);

  const confidence = useMemo(() => {
    if (!engagement) return null;
    return computeDetailedConfidence({
      totalRecos: engagement.totalRecommendations,
      acceptedRecos: engagement.acceptedRecommendations,
      likedCount: likedMovies.length,
      watchlistCount,
      streakCount: engagement.streakCount,
      genreCount: genreStats.length,
    });
  }, [engagement, likedMovies.length, watchlistCount, genreStats.length]);

  if (!isReady || loading)
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  if (!user) return null;

  if (showDNA) {
    return (
      <div className="fixed inset-0 bottom-14 bg-background overflow-y-auto z-30">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button
            onClick={() => setShowDNA(false)}
            className="flex items-center gap-2 text-foreground/50 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-serif text-lg">Mon Cinéma</span>
          </button>
        </div>
        <CinemaDNA userId={user.id} />
      </div>
    );
  }

  if (showTrainer) {
    return (
      <div className="fixed inset-0 bottom-14 bg-background overflow-y-auto z-30">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button
            onClick={() => setShowTrainer(false)}
            className="flex items-center gap-2 text-foreground/50 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-serif text-lg">Mon Cinéma</span>
          </button>
        </div>
        <div className="p-5">
          <TasteTrainer
            onClose={() => {
              setShowTrainer(false);
              loadData();
            }}
          />
        </div>
      </div>
    );
  }

  const totalRecos = engagement?.totalRecommendations || 0;
  const reachedMilestones = MILESTONES.filter((m) => totalRecos >= m.count);
  const nextMilestone = MILESTONES.find((m) => totalRecos < m.count);
  const confidenceTotal = confidence?.total || 0;
  const confidenceLabel =
    confidenceTotal < 20
      ? "Pick Novice"
      : confidenceTotal < 45
        ? "Pick Confirmé"
        : confidenceTotal < 70
          ? "Pick Expert"
          : "Pick Maître";
  const confidenceColor =
    confidenceTotal < 20
      ? "text-foreground/40"
      : confidenceTotal < 45
        ? "text-yellow-500/70"
        : confidenceTotal < 70
          ? "text-primary/70"
          : "text-primary";

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      <div className="px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-2">
        <h1 className="text-2xl font-serif">Mon Cinéma</h1>
      </div>

      <div className="max-w-lg mx-auto px-5 py-4 pb-32 space-y-6">
        {/* ─── ADN Cinéma ─── */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setShowDNA(true)}
          className="w-full text-left rounded-2xl p-5 border border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.03] hover:border-primary/30 transition-all group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Brain className="w-5 h-5 text-primary" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-primary/70 font-sans font-semibold">
                  ADN Cinéma
                </p>
              </div>
              <p className="font-serif text-xl text-foreground leading-tight">
                {dnaTitle || dnaArchetype || "Découvre ton profil"}
              </p>
              <p className="text-sm text-foreground/45 mt-1">{dnaLevel || "Analyse tes goûts et affinités ciné"}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-foreground/20 group-hover:text-primary transition-colors" />
          </div>
        </motion.button>

        {/* ─── Niveau de personnalisation ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 px-1">
            <Sparkles className="w-4 h-4 text-primary/70" />
            <h2 className="text-[11px] uppercase tracking-[0.18em] text-foreground/60 font-sans font-semibold">
              Niveau de personnalisation
            </h2>
            <TooltipProvider>
              <Tooltip open={showConfidenceDetail} onOpenChange={setShowConfidenceDetail}>
                <TooltipTrigger asChild>
                  <button className="text-foreground/20 hover:text-primary transition-colors">
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs p-3 bg-card border border-border/20">
                  <div className="space-y-2">
                    <p className="text-[11px] font-sans font-semibold text-foreground/80">Comment c'est calculé ?</p>
                    {confidence?.breakdown.map((item, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] font-sans">
                          <span className="text-foreground/60">{item.label}</span>
                          <span className="text-primary/70 font-semibold">
                            {item.score}/{item.max}
                          </span>
                        </div>
                        <p className="text-[9px] text-foreground/35 font-sans">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="rounded-3xl border border-border/15 bg-card/60 p-6 backdrop-blur-xl">
            <div className="flex items-end justify-between mb-4">
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-serif text-primary">{confidenceTotal}</span>
                <span className="text-foreground/35 text-2xl font-sans">/100</span>
              </div>
              <span className={`text-base font-sans font-semibold ${confidenceColor}`}>{confidenceLabel}</span>
            </div>
            <div className="h-3 rounded-full bg-foreground/[0.05] overflow-hidden mb-4">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${confidenceTotal}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-primary rounded-full"
              />
            </div>
            <button
              onClick={() => setShowTrainer(true)}
              className="w-full mt-2 py-4 rounded-2xl border border-primary/20 bg-background/20 hover:bg-primary/[0.05] transition-colors flex items-center justify-center gap-2.5"
            >
              <Brain className="w-4 h-4 text-primary/80" />
              <span className="text-primary text-lg font-sans font-medium">Entraîner mes goûts</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MyCinema;
