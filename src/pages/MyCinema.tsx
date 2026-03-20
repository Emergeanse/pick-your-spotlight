import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Sparkles, ChevronRight, Brain, Film, Tv, Trophy, BarChart3, Heart, Bookmark, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getEngagementData, type EngagementData } from "@/lib/engagement";
import { getLikedMovies } from "@/lib/liked-movies";
import { getPosterUrl, getMovieDetails } from "@/lib/tmdb";
import CinemaDNA from "@/components/pick/CinemaDNA";
import TasteTrainer from "@/components/pick/TasteTrainer";

const MILESTONES = [
  { count: 1, label: "Premier film", icon: "🎬" },
  { count: 5, label: "Cinéphile débutant", icon: "🍿" },
  { count: 10, label: "Fidèle spectateur", icon: "📽️" },
  { count: 20, label: "Explorateur", icon: "🧭" },
  { count: 50, label: "Connaisseur", icon: "🎪" },
  { count: 100, label: "Maître cinéphile", icon: "👑" },
];

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

  useEffect(() => {
    if (!isReady) return;
    if (!user) { navigate("/auth"); return; }
    loadData();
  }, [user, isReady]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [engData, likedData, dnaData, { count: wlCount }] = await Promise.all([
        getEngagementData(user.id),
        getLikedMovies().catch(() => []),
        supabase.from("cinematic_profiles" as any).select("personality_title, dna_archetype, global_level").eq("user_id", user.id).maybeSingle(),
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

      // Genre stats
      const genreCounts: Record<string, number> = {};
      let movies = 0, series = 0;
      likedData.forEach((m: any) => {
        (m.genres || []).forEach((g: string) => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
        if (m.media_type === "tv" || m.first_air_date) series++; else movies++;
      });
      setGenreStats(Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([genre, count]) => ({ genre, count })));
      setMovieVsSeries({ movies, series });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (!isReady || loading) return <div className="fixed inset-0 bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;
  if (!user) return null;

  if (showDNA) {
    return (
      <div className="fixed inset-0 bg-background overflow-y-auto z-50">
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
      <div className="fixed inset-0 bg-background overflow-y-auto z-50">
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
  const confidence = engagement?.profileConfidence || 0;
  const maxGenreCount = genreStats.length > 0 ? genreStats[0].count : 1;
  const reachedMilestones = MILESTONES.filter(m => totalRecos >= m.count);
  const nextMilestone = MILESTONES.find(m => totalRecos < m.count);

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      <div className="px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-2">
        <h1 className="text-2xl font-serif">Mon Cinéma</h1>
      </div>

      <div className="max-w-lg mx-auto px-5 py-4 pb-32 space-y-6">

        {/* ─── ADN Cinéma ─── */}
        <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          onClick={() => setShowDNA(true)}
          className="w-full text-left rounded-2xl p-5 border border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.03] hover:border-primary/30 transition-all group relative overflow-hidden">
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

        {/* ─── Key metrics ─── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="grid grid-cols-4 gap-2">
          {[
            { value: totalRecos, label: "Recos", icon: <Eye className="w-3 h-3 text-primary/40" /> },
            { value: likedMovies.length, label: "Favoris", icon: <Heart className="w-3 h-3 text-destructive/40" /> },
            { value: watchlistCount, label: "Watchlist", icon: <Bookmark className="w-3 h-3 text-primary/40" /> },
            { value: `${movieVsSeries.movies}/${movieVsSeries.series}`, label: "Films/Séries", icon: <Film className="w-3 h-3 text-primary/40" /> },
          ].map((stat, i) => (
            <div key={i} className="rounded-xl bg-card/40 border border-border/8 p-3 text-center">
              <div className="flex justify-center mb-1">{stat.icon}</div>
              <p className="text-lg font-serif text-foreground">{stat.value}</p>
              <p className="text-[9px] text-foreground/25 font-sans">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* ─── Top genres ─── */}
        {genreStats.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-3.5 h-3.5 text-primary/30" />
              <h3 className="text-xs font-sans font-semibold text-foreground/35 uppercase tracking-widest">Genres favoris</h3>
            </div>
            <div className="space-y-2.5">
              {genreStats.map((gs, i) => (
                <div key={gs.genre} className="flex items-center gap-3">
                  <span className="text-foreground/50 text-[12px] font-sans w-28 truncate">{gs.genre}</span>
                  <div className="flex-1 h-2 rounded-full bg-foreground/[0.04] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(gs.count / maxGenreCount) * 100}%` }}
                      transition={{ delay: 0.15 + i * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-full bg-primary/50"
                    />
                  </div>
                  <span className="text-foreground/25 text-[11px] font-sans tabular-nums w-5 text-right">{gs.count}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── Favoris gallery ─── */}
        {likedMovies.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <h3 className="text-xs font-sans font-semibold text-foreground/35 uppercase tracking-widest mb-3">Tes coups de cœur</h3>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {likedMovies.slice(0, 10).map((m: any, i: number) => m.poster_path && (
                <motion.div key={m.tmdb_id || i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.18 + i * 0.03 }}
                  className="shrink-0 w-[4.5rem] group">
                  <div className="rounded-lg overflow-hidden border border-border/8">
                    <img src={getPosterUrl(m.poster_path, "w185")} alt={m.title} className="w-full aspect-[2/3] object-cover" loading="lazy" />
                  </div>
                  <p className="text-[9px] font-sans text-foreground/30 truncate mt-1 px-0.5">{m.title}</p>
                </motion.div>
              ))}
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

        {/* ─── Confidence + Trainer CTA ─── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="rounded-xl bg-primary/[0.03] border border-primary/10 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary/40" />
                <span className="text-[11px] font-sans font-semibold text-foreground/40">Précision Pick</span>
              </div>
              <span className="text-primary/60 text-sm font-sans font-semibold tabular-nums">{confidence}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden mb-3">
              <motion.div initial={{ width: 0 }} animate={{ width: `${confidence}%` }} transition={{ delay: 0.35, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full bg-gradient-to-r from-primary/40 to-primary/80" />
            </div>
            <button onClick={() => setShowTrainer(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary/8 border border-primary/15 hover:bg-primary/12 transition-colors active:scale-[0.98]">
              <Brain className="w-3.5 h-3.5 text-primary" />
              <span className="text-primary text-[12px] font-sans font-semibold">Améliorer mes recos</span>
            </button>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default MyCinema;