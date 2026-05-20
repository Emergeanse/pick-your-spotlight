import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, Sparkles, ChevronRight, ChevronDown, Brain, Film, Tv, Trophy, Eye, Heart, Bookmark, TrendingUp, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getEngagementData, type EngagementData } from "@/lib/engagement";
import { getLikedMovies } from "@/lib/liked-movies";
import { getMyPreferences } from "@/lib/preferences";
import CinemaDNA from "@/components/pick/CinemaDNA";
import TasteTrainer from "@/components/pick/TasteTrainer";
import GenrePreferences from "@/components/pick/GenrePreferences";
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
  peopleEvaluated: number;
  genresSelected: number;
}) {
  const { totalRecos, acceptedRecos, likedCount, watchlistCount, streakCount, peopleEvaluated, genresSelected } = data;

  // 1. Data volume (max 25pts)
  const totalSignals = totalRecos + likedCount + watchlistCount;
  const volumeScore = Math.min(Math.sqrt(totalSignals) * 3.5, 25);

  // 2. Acceptance rate (max 25pts)
  const acceptRate = totalRecos > 0 ? acceptedRecos / totalRecos : 0;
  const acceptScore = Math.min(acceptRate * 25, 25);

  // 3. Engagement consistency (max 10pts)
  const streakScore = Math.min(streakCount * 2, 10);

  // 4. Films & series training (max 15pts)
  const trainingScore = Math.min(likedCount * 1.5, 15);

  // 5. People preferences — actors & directors (max 15pts)
  const peopleScore = Math.min(Math.sqrt(peopleEvaluated) * 3, 15);

  // 6. Genre profile — 1pt per genre selected, max at 10 genres (max 10pts)
  const genresScore = Math.min(genresSelected, 10);

  const total = Math.round(volumeScore + acceptScore + streakScore + trainingScore + peopleScore + genresScore);

  return {
    total: Math.min(total, 100),
    breakdown: [
      { label: "Données collectées", score: Math.round(volumeScore), max: 25, detail: `${totalSignals} interactions` },
      { label: "Taux de satisfaction", score: Math.round(acceptScore), max: 25, detail: totalRecos > 0 ? `${Math.round(acceptRate * 100)}% de recos validées` : "Pas encore de données" },
      { label: "Régularité", score: Math.round(streakScore), max: 10, detail: streakCount > 0 ? `Série de ${streakCount}` : "Commence une série" },
      { label: "Films & séries évalués", score: Math.round(trainingScore), max: 15, detail: `${likedCount} titres évalués` },
      { label: "Acteurs & Réalisateurs", score: Math.round(peopleScore), max: 15, detail: peopleEvaluated > 0 ? `${peopleEvaluated} personnes évaluées` : "Entraîne tes préférences" },
      { label: "Genres favoris", score: genresScore, max: 10, detail: genresSelected > 0 ? `${genresSelected}/10 genres sélectionnés` : "Sélectionne tes genres" },
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
  const [peopleEvaluated, setPeopleEvaluated] = useState(0);
  const [genresSelected, setGenresSelected] = useState(0);
  const [showGenres, setShowGenres] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!user) { navigate("/auth"); return; }
    loadData();
  }, [user, isReady]);

  useEffect(() => {
    const handleReset = () => { setShowTrainer(false); setShowDNA(false); };
    window.addEventListener("cinema-reset", handleReset);
    return () => window.removeEventListener("cinema-reset", handleReset);
  }, []);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [engData, likedData, dnaData, { count: wlCount }, { count: peopleCount }, myPrefs] = await Promise.all([
        getEngagementData(user.id),
        getLikedMovies().catch(() => []),
        supabase.from("cinematic_profiles" as any).select("personality_title, dna_archetype, global_level").eq("user_id", user.id).maybeSingle(),
        supabase.from("watchlist").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("user_people_preferences" as any).select("id", { count: "exact", head: true }).eq("user_id", user.id),
        getMyPreferences().catch(() => []),
      ]);
      setEngagement(engData);
      setLikedMovies(likedData);
      setWatchlistCount(wlCount || 0);
      setPeopleEvaluated(peopleCount || 0);
      setGenresSelected(myPrefs.filter((p) => p.tag.category === "genre" && p.weight > 0).length);
      if (dnaData.data) {
        const d = dnaData.data as any;
        setDnaTitle(d.personality_title || null);
        setDnaLevel(d.global_level || null);
        setDnaArchetype(d.dna_archetype || null);
      }

      const genreCounts: Record<string, number> = {};
      let movies = 0, series = 0;
      likedData.forEach((m: any) => {
        (m.genres || []).forEach((g: string) => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
        if (m.media_type === "tv" || m.first_air_date) series++; else movies++;
      });
      setGenreStats(Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).map(([genre, count]) => ({ genre, count })));
      setMovieVsSeries({ movies, series });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Radar chart data — top 8 genres normalized to 0-100
  const radarData = useMemo(() => {
    if (genreStats.length === 0) return [];
    const top = genreStats.slice(0, 8);
    const max = top[0]?.count || 1;
    return top.map(gs => ({
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
      peopleEvaluated,
      genresSelected,
    });
  }, [engagement, likedMovies.length, watchlistCount, peopleEvaluated, genresSelected]);

  if (!isReady || loading) return <div className="fixed inset-0 bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;
  if (!user) return null;

  if (showDNA) {
    return (
      <div className="fixed inset-0 bottom-14 bg-background overflow-y-auto z-30">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button onClick={() => setShowDNA(false)} className="flex items-center gap-2 text-foreground/50 hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /><span className="font-serif text-lg">Mon Cinéma</span>
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
          <button onClick={() => setShowTrainer(false)} className="flex items-center gap-2 text-foreground/50 hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /><span className="font-serif text-lg">Mon Cinéma</span>
          </button>
        </div>
        <div className="p-5"><TasteTrainer onClose={() => { setShowTrainer(false); loadData(); }} /></div>
      </div>
    );
  }

  const totalRecos = engagement?.totalRecommendations || 0;
  const reachedMilestones = MILESTONES.filter(m => totalRecos >= m.count);
  const nextMilestone = MILESTONES.find(m => totalRecos < m.count);
  const confidenceTotal = confidence?.total || 0;
  const confidenceLabel = confidenceTotal < 20 ? "Apprentissage" : confidenceTotal < 45 ? "En progression" : confidenceTotal < 70 ? "Bien calibré" : confidenceTotal < 90 ? "Très précis" : "Expert";
  const confidenceColor = confidenceTotal < 20 ? "text-foreground/40" : confidenceTotal < 45 ? "text-yellow-500/70" : confidenceTotal < 70 ? "text-primary/70" : "text-primary";

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      <div className="px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-2">
        <h1 className="text-2xl font-serif">Mon Cinéma</h1>
      </div>

      <div className="max-w-lg mx-auto px-5 py-4 pb-32 space-y-6">

        {/* ─── ADN Cinéma ─── */}
        <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          onClick={() => setShowDNA(true)}
          className="w-full text-left rounded-2xl p-5 border border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.03] hover:border-primary/30 transition-all group relative overflow-hidden active:scale-[0.98]">
          <div className="relative z-10">
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary/40 font-sans font-semibold mb-2">Ton ADN Cinéma</p>
            {dnaTitle ? (
              <>
                <h2 className="text-xl font-serif mb-1 group-hover:text-primary/90 transition-colors">{dnaTitle}</h2>
                {dnaArchetype && <p className="text-primary/50 text-xs font-sans mb-1">{dnaArchetype}</p>}
                {dnaLevel && <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-primary/8 text-primary/60 font-sans">{dnaLevel}</span>}
              </>
            ) : (
              <h2 className="text-base font-serif text-foreground/50">Découvre ton profil cinématographique</h2>
            )}
            <div className="flex items-center gap-1 mt-3 text-primary/30 group-hover:text-primary/50 transition-colors">
              <span className="text-[11px] font-sans">Explorer</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </motion.button>

        {/* ─── Radar chart — Empreinte genres ─── */}
        {radarData.length >= 3 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <h3 className="text-xs font-sans font-semibold text-foreground/35 uppercase tracking-widest mb-1">Empreinte cinématographique</h3>
            <p className="text-[10px] text-foreground/20 font-sans mb-3">Basée sur tes {likedMovies.length} films évalués</p>
            <div className="rounded-2xl bg-card/30 border border-border/8 p-2 pt-4">
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                  <PolarGrid stroke="hsl(var(--foreground) / 0.06)" strokeDasharray="3 3" />
                  <PolarAngleAxis
                    dataKey="genre"
                    tick={{ fill: "hsl(var(--foreground) / 0.4)", fontSize: 10, fontFamily: "var(--font-sans)" }}
                    tickLine={false}
                  />
                  <Radar
                    name="Genres"
                    dataKey="value"
                    stroke="hsl(var(--primary) / 0.7)"
                    fill="hsl(var(--primary) / 0.15)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* ─── Genre preferences ─── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <button
            onClick={() => setShowGenres((v) => !v)}
            className="w-full flex items-center justify-between mb-2 group"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-sans font-semibold text-foreground/35 uppercase tracking-widest">Mes genres & styles</h3>
              {genresSelected > 0 && (
                <span className="text-[9px] font-sans px-1.5 py-0.5 rounded-full bg-primary/15 text-primary/70 border border-primary/20">
                  {genresSelected} sélectionné{genresSelected > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-foreground/25 transition-transform duration-200 ${showGenres ? "rotate-180" : ""}`}
            />
          </button>

          {/* Une seule instance — collapsed contrôle l'affichage */}
          <div className={showGenres || genresSelected > 0 ? "" : "hidden"}>
            <div className={`rounded-2xl bg-card/30 border border-border/8 transition-all ${showGenres ? "p-4" : "px-4 py-3"}`}>
              <AnimatePresence initial={false}>
                {showGenres && (
                  <motion.p
                    key="desc"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-[10px] text-foreground/20 font-sans overflow-hidden mb-3"
                  >
                    Sélectionne les styles que tu aimes — Pick s'en sert pour tes recommandations
                  </motion.p>
                )}
              </AnimatePresence>
              <GenrePreferences onCountChange={setGenresSelected} collapsed={!showGenres} />
            </div>
          </div>
        </motion.div>

        {/* ─── Stats table ─── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h3 className="text-xs font-sans font-semibold text-foreground/35 uppercase tracking-widest mb-3">Statistiques</h3>
          <div className="rounded-2xl bg-card/30 border border-border/8 overflow-hidden divide-y divide-border/5">
            {[
              { icon: <Eye className="w-3.5 h-3.5 text-primary/40" />, label: "Recommandations reçues", value: totalRecos },
              { icon: <Heart className="w-3.5 h-3.5 text-destructive/40" />, label: "Films évalués / likés", value: likedMovies.length },
              { icon: <Bookmark className="w-3.5 h-3.5 text-primary/40" />, label: "En watchlist", value: watchlistCount },
              { icon: <Film className="w-3.5 h-3.5 text-primary/40" />, label: "Films", value: movieVsSeries.movies },
              { icon: <Tv className="w-3.5 h-3.5 text-primary/40" />, label: "Séries", value: movieVsSeries.series },
              { icon: <TrendingUp className="w-3.5 h-3.5 text-primary/40" />, label: "Meilleure série", value: `${engagement?.bestStreak || 0} d'affilée` },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  {row.icon}
                  <span className="text-sm font-sans text-foreground/60">{row.label}</span>
                </div>
                <span className="text-sm font-sans font-semibold text-foreground tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ─── Fiabilité / Confiance ─── */}
        {confidence && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-primary/30" />
              <h3 className="text-xs font-sans font-semibold text-foreground/35 uppercase tracking-widest">Niveau de personnalisation</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-foreground/15 hover:text-foreground/30 transition-colors"><Info className="w-3 h-3" /></button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
                    <p>Ce score reflète à quel point Pick te connaît. Plus tu interagis (recos, likes, watchlist, training), plus les suggestions sont personnalisées.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="rounded-2xl bg-card/30 border border-border/8 p-4">
              {/* Main score */}
              <div className="flex items-end justify-between mb-3">
                <div>
                  <span className={`text-3xl font-serif font-bold tabular-nums ${confidenceColor}`}>{confidenceTotal}</span>
                  <span className="text-foreground/20 text-sm font-sans">/100</span>
                </div>
                <span className={`text-xs font-sans font-semibold ${confidenceColor}`}>{confidenceLabel}</span>
              </div>

              {/* Progress bar */}
              <div className="h-2 rounded-full bg-foreground/[0.04] overflow-hidden mb-4">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${confidenceTotal}%` }}
                  transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-primary/30 via-primary/60 to-primary"
                />
              </div>

              {/* Toggle detail */}
              <button
                onClick={() => setShowConfidenceDetail(!showConfidenceDetail)}
                className="text-[11px] font-sans text-primary/40 hover:text-primary/60 transition-colors mb-1"
              >
                {showConfidenceDetail ? "Masquer le détail" : "Comment c'est calculé ?"}
              </button>

              {showConfidenceDetail && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="overflow-hidden mt-3 space-y-2.5"
                >
                  {confidence.breakdown.map((item, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-sans text-foreground/40">{item.label}</span>
                        <span className="text-[11px] font-sans text-foreground/30 tabular-nums">{item.score}/{item.max}</span>
                      </div>
                      <div className="h-1 rounded-full bg-foreground/[0.04] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(item.score / item.max) * 100}%` }}
                          transition={{ delay: 0.4 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full bg-primary/40"
                        />
                      </div>
                      <p className="text-[9px] font-sans text-foreground/15 mt-0.5">{item.detail}</p>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* Trainer CTA */}
              <button onClick={() => setShowTrainer(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 mt-4 rounded-xl bg-primary/8 border border-primary/15 hover:bg-primary/12 transition-colors active:scale-[0.98]">
                <Brain className="w-3.5 h-3.5 text-primary" />
                <span className="text-primary text-[12px] font-sans font-semibold">Entraîner mes goûts</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* ─── Trophées ─── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-3.5 h-3.5 text-primary/30" />
            <h3 className="text-xs font-sans font-semibold text-foreground/35 uppercase tracking-widest">Trophées</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MILESTONES.map(m => {
              const reached = totalRecos >= m.count;
              return (
                <div key={m.count}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                    reached ? "bg-primary/[0.04] border-primary/15" : "bg-card/20 border-border/5"
                  }`}>
                  <span className={`text-lg ${reached ? "" : "grayscale opacity-20"}`}>{m.icon}</span>
                  <span className={`text-[10px] font-sans text-center leading-tight ${reached ? "text-foreground/60" : "text-foreground/15"}`}>
                    {reached ? m.label : "???"}
                  </span>
                  <span className={`text-[9px] font-sans ${reached ? "text-primary/50" : "text-foreground/10"}`}>{m.count} recos</span>
                </div>
              );
            })}
          </div>
          {nextMilestone && (
            <p className="text-foreground/20 text-[11px] font-sans mt-2 text-center">
              Plus que {nextMilestone.count - totalRecos} reco{nextMilestone.count - totalRecos > 1 ? "s" : ""} pour "{nextMilestone.label}"
            </p>
          )}
        </motion.div>

      </div>
    </div>
  );
};

export default MyCinema;
