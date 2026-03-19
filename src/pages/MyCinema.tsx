import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Sparkles, RefreshCw, ChevronRight, Crown, TrendingUp, Calendar, Brain, Film, Tv, Trophy, History, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { usePickPlus } from "@/hooks/use-pick-plus";
import { supabase } from "@/integrations/supabase/client";
import { getEngagementData, type EngagementData } from "@/lib/engagement";
import { getLikedMovies } from "@/lib/liked-movies";
import { getPosterUrl } from "@/lib/tmdb";
import CinemaDNA from "@/components/pick/CinemaDNA";
import PickCharacter from "@/components/pick/PickCharacter";
import BottomTabBar from "@/components/pick/BottomTabBar";
import PickPlusPaywall from "@/components/pick/PickPlusPaywall";
import TasteTrainer from "@/components/pick/TasteTrainer";

const MILESTONES = [
  { count: 1, label: "Premier film", emoji: "🎬" },
  { count: 5, label: "Cinéphile débutant", emoji: "🍿" },
  { count: 10, label: "Fidèle spectateur", emoji: "📽️" },
  { count: 20, label: "Explorateur", emoji: "🧭" },
  { count: 50, label: "Connaisseur", emoji: "🎪" },
  { count: 100, label: "Maître cinéphile", emoji: "👑" },
];

const MyCinema = () => {
  const { user, isReady } = useAuth();
  const navigate = useNavigate();
  const { isPremium, shouldShowPaywall, showPaywall, hidePaywall } = usePickPlus();
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDNA, setShowDNA] = useState(false);
  const [showTrainer, setShowTrainer] = useState(false);
  const [likedCount, setLikedCount] = useState(0);
  const [likedMovies, setLikedMovies] = useState<any[]>([]);
  const [recentPosters, setRecentPosters] = useState<{ poster: string; title: string }[]>([]);
  const [dnaTitle, setDnaTitle] = useState<string | null>(null);
  const [dnaLevel, setDnaLevel] = useState<string | null>(null);
  const [interactionHistory, setInteractionHistory] = useState<any[]>([]);
  const [genreStats, setGenreStats] = useState<{ genre: string; count: number }[]>([]);
  const [movieVsSeriesCount, setMovieVsSeriesCount] = useState<{ movies: number; series: number }>({ movies: 0, series: 0 });

  useEffect(() => {
    if (!isReady) return;
    if (!user) { navigate("/auth"); return; }
    loadData();
  }, [user, isReady]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [engData, likedData, dnaData, interactions] = await Promise.all([
        getEngagementData(user.id),
        getLikedMovies().catch(() => []),
        supabase.from("cinematic_profiles" as any)
          .select("personality_title, dna_archetype, global_level")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("user_interactions")
          .select("tmdb_id, action_type, created_at, context")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      setEngagement(engData);
      setLikedMovies(likedData);
      setLikedCount(likedData.length);
      setRecentPosters(
        likedData.slice(0, 6).map((m: any) => ({ poster: m.poster_path, title: m.title })).filter((m: any) => m.poster)
      );
      if (dnaData.data) {
        const d = dnaData.data as any;
        setDnaTitle(d.dna_archetype || d.personality_title || null);
        setDnaLevel(d.global_level || null);
      }
      if (interactions.data) {
        setInteractionHistory(interactions.data);
      }

      // Compute genre stats from liked movies
      const genreCounts: Record<string, number> = {};
      let movies = 0, series = 0;
      likedData.forEach((m: any) => {
        (m.genres || []).forEach((g: string) => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
        if (m.media_type === "tv" || m.first_air_date) series++;
        else movies++;
      });
      setGenreStats(Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([genre, count]) => ({ genre, count })));
      setMovieVsSeriesCount({ movies, series });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isReady || loading) {
    return <div className="fixed inset-0 bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;
  }

  if (!user) return null;

  if (showDNA) {
    return (
      <div className="fixed inset-0 bg-background overflow-y-auto z-50">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button onClick={() => setShowDNA(false)} className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors">
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
      <div className="fixed inset-0 bg-background overflow-y-auto z-50">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button onClick={() => setShowTrainer(false)} className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-serif text-lg">Mon Cinéma</span>
          </button>
        </div>
        <div className="p-5">
          <TasteTrainer onClose={() => { setShowTrainer(false); loadData(); }} />
        </div>
      </div>
    );
  }

  const totalRecos = engagement?.totalRecommendations || 0;
  const confidence = engagement?.profileConfidence || 0;
  const reachedMilestones = MILESTONES.filter(m => totalRecos >= m.count);
  const maxGenreCount = genreStats.length > 0 ? genreStats[0].count : 1;

  const getWeeklyNarrative = () => {
    if (totalRecos === 0) return "Commence à explorer et Pick apprendra à te connaître.";
    if (totalRecos === 1) return "Tu as découvert ton premier film avec Pick. C'est le début d'une belle aventure !";
    if (totalRecos <= 5) return `Pick t'a fait découvrir ${totalRecos} films. Continue pour affiner tes recommandations.`;
    return `Pick t'a déjà recommandé ${totalRecos} films. Tes goûts se précisent !`;
  };

  const getLearningMessage = () => {
    if (confidence === 0 && totalRecos === 0) return "Pick ne te connaît pas encore — note tes premiers films pour commencer.";
    if (confidence < 30) return "Pick te connaît de mieux en mieux — continue à noter tes films.";
    return `Pick est sûr à ${confidence}% de ses recommandations pour toi.`;
  };

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      <div className="px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-serif">Mon Cinéma</h1>
        {!isPremium && (
          <button onClick={() => navigate("/app/pick-plus")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/20 text-gold text-[11px] font-sans font-semibold hover:bg-gold/15 transition-colors">
            <Crown className="w-3 h-3" />Pick+
          </button>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-5 py-4 pb-32">
        {/* ADN Cinéma Card */}
        <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={() => setShowDNA(true)}
          className="w-full text-left rounded-2xl p-5 mb-6 border border-gold/20 bg-gradient-to-br from-card/80 via-card/60 to-gold/[0.03] hover:border-gold/35 transition-all group relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.04] to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold/50 font-sans font-semibold">🧬 Ton ADN Cinéma</p>
              {dnaLevel && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold/70 font-sans font-medium">{dnaLevel}</span>}
            </div>
            {dnaTitle ? (
              <h2 className="text-xl font-serif text-foreground mb-2 group-hover:text-gold/90 transition-colors">{dnaTitle}</h2>
            ) : (
              <h2 className="text-lg font-serif text-foreground/60 mb-1">Découvre ton profil cinématographique</h2>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-gold/40 group-hover:text-gold/60 transition-colors">
              <span className="text-[11px] font-sans">Explorer</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </motion.button>

        {/* ─── Stats Cards ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl bg-card/50 border border-border/10 p-3 text-center">
            <p className="text-2xl font-serif text-foreground">{totalRecos}</p>
            <p className="text-[10px] text-foreground/30 font-sans mt-0.5">Recommandations</p>
          </div>
          <div className="rounded-xl bg-card/50 border border-border/10 p-3 text-center">
            <p className="text-2xl font-serif text-foreground">{likedCount}</p>
            <p className="text-[10px] text-foreground/30 font-sans mt-0.5">Coups de cœur</p>
          </div>
          <div className="rounded-xl bg-card/50 border border-border/10 p-3 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Film className="w-3 h-3 text-primary/50" />
              <span className="text-lg font-serif text-foreground">{movieVsSeriesCount.movies}</span>
              <span className="text-foreground/20 text-xs">/</span>
              <Tv className="w-3 h-3 text-primary/50" />
              <span className="text-lg font-serif text-foreground">{movieVsSeriesCount.series}</span>
            </div>
            <p className="text-[10px] text-foreground/30 font-sans mt-0.5">Films / Séries</p>
          </div>
        </motion.div>

        {/* ─── Top Genres ─── */}
        {genreStats.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-3.5 h-3.5 text-primary/40" />
              <p className="text-[11px] uppercase tracking-[0.15em] text-foreground/25 font-sans font-semibold">Tes genres préférés</p>
            </div>
            <div className="space-y-2">
              {genreStats.map((gs, i) => (
                <div key={gs.genre} className="flex items-center gap-3">
                  <span className="text-foreground/50 text-[12px] font-sans w-24 truncate">{gs.genre}</span>
                  <div className="flex-1 h-2 rounded-full bg-foreground/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(gs.count / maxGenreCount) * 100}%` }}
                      transition={{ delay: 0.2 + i * 0.05, duration: 0.6, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-primary/40 to-primary/70"
                    />
                  </div>
                  <span className="text-foreground/30 text-[11px] font-sans font-medium w-6 text-right">{gs.count}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── Achievements ─── */}
        {reachedMilestones.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-3.5 h-3.5 text-gold/50" />
              <p className="text-[11px] uppercase tracking-[0.15em] text-foreground/25 font-sans font-semibold">Trophées débloqués</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {MILESTONES.map(m => {
                const reached = totalRecos >= m.count;
                return (
                  <div key={m.count}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-sans ${
                      reached ? "bg-gold/8 border-gold/20 text-foreground" : "bg-card/30 border-border/10 text-foreground/15"
                    }`}>
                    <span className={reached ? "" : "grayscale opacity-30"}>{m.emoji}</span>
                    <span className="font-medium">{reached ? m.label : "???"}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Pick+ Teaser */}
        {!isPremium && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-6 relative">
            <div className="rounded-2xl border border-gold/10 bg-card/30 p-4 relative overflow-hidden">
              <div className="absolute inset-0 backdrop-blur-[2px] bg-background/20 z-10 rounded-2xl flex flex-col items-center justify-center">
                <button onClick={() => showPaywall()}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-gold/15 border border-gold/25 text-gold text-xs font-sans font-semibold hover:bg-gold/20 transition-all">
                  <Crown className="w-3.5 h-3.5" />Débloquer avec Pick+
                </button>
              </div>
              <div className="space-y-3 opacity-40">
                <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary/40" /><span className="text-xs font-sans text-foreground/40">Évolution de tes goûts</span></div>
                <div className="h-16 rounded-xl bg-foreground/5" />
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-primary/40" /><span className="text-xs font-sans text-foreground/40">Rapport mensuel cinéma</span></div>
                <div className="h-10 rounded-xl bg-foreground/5" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Weekly Narrative */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mb-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 mt-0.5"><PickCharacter mood="default" size="sm" animate={false} /></div>
            <div className="flex-1 px-4 py-3 rounded-2xl bg-card/50 border border-border/10">
              <p className="text-foreground/60 text-[13px] font-sans leading-relaxed">{getWeeklyNarrative()}</p>
            </div>
          </div>
        </motion.div>

        {/* Recent Activity */}
        {recentPosters.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="mb-6">
            <p className="text-[11px] uppercase tracking-[0.15em] text-foreground/25 font-sans font-semibold mb-3">Tes derniers films</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {recentPosters.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.24 + i * 0.04 }}
                  className="shrink-0 w-20 rounded-xl overflow-hidden border border-border/10">
                  <img src={getPosterUrl(m.poster, "w185")} alt={m.title} className="w-full aspect-[2/3] object-cover" loading="lazy" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Interaction History */}
        {interactionHistory.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-3.5 h-3.5 text-foreground/25" />
              <p className="text-[11px] uppercase tracking-[0.15em] text-foreground/25 font-sans font-semibold">Activité récente</p>
            </div>
            <div className="space-y-1.5">
              {interactionHistory.slice(0, 8).map((interaction, i) => {
                const actionLabels: Record<string, { label: string; emoji: string }> = {
                  opened: { label: "Consulté", emoji: "👁️" },
                  liked: { label: "Aimé", emoji: "❤️" },
                  saved: { label: "Sauvegardé", emoji: "🔖" },
                  skipped: { label: "Passé", emoji: "⏭️" },
                  reviewed: { label: "Noté", emoji: "⭐" },
                  unliked: { label: "Retiré des favoris", emoji: "💔" },
                  unsaved: { label: "Retiré de la watchlist", emoji: "🗑️" },
                };
                const info = actionLabels[interaction.action_type] || { label: interaction.action_type, emoji: "📌" };
                const date = new Date(interaction.created_at);
                const timeAgo = getTimeAgo(date);
                return (
                  <div key={`${interaction.id || i}`} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card/30 border border-border/5">
                    <span className="text-sm">{info.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground/50 text-[11px] font-sans truncate">{info.label} — ID #{interaction.tmdb_id}</p>
                    </div>
                    <span className="text-foreground/20 text-[10px] font-sans shrink-0">{timeAgo}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Learning Progress */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} className="mb-6">
          <div className="px-4 py-3.5 rounded-2xl bg-primary/[0.04] border border-primary/10">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary/50" />
              <span className="text-[10px] uppercase tracking-wider text-primary/40 font-sans font-semibold">Apprentissage</span>
            </div>
            <p className="text-foreground/60 text-[13px] font-sans leading-relaxed">{getLearningMessage()}</p>
            {confidence > 0 && (
              <div className="mt-2.5 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${confidence}%` }} transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary" />
              </div>
            )}
            <button onClick={() => setShowTrainer(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors">
              <Brain className="w-4 h-4 text-primary" />
              <span className="text-primary text-[13px] font-sans font-semibold">Améliore tes recos</span>
            </button>
          </div>
        </motion.div>
      </div>

      <BottomTabBar />
      <PickPlusPaywall open={shouldShowPaywall} onClose={hidePaywall} trigger="dna_advanced" />
    </div>
  );
};

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `il y a ${diffD}j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default MyCinema;
