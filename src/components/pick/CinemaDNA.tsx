import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw, Loader2, Film, Brain, TrendingUp, Heart, BarChart3, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getUserTasteProfile } from "@/lib/interactions";
import { getLikedMovies } from "@/lib/liked-movies";
import { getPosterUrl } from "@/lib/tmdb";
import pickLogo from "@/assets/pick-logo.png";

interface CinematicProfile {
  personality_title: string;
  narrative: string;
  taste_traits: string[];
  representative_films: string[];
  evolution_note?: string | null;
}

interface LearnedInsight {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: string;
}

interface CinemaDNAProps {
  userId: string;
  teaser?: boolean;
  onOpenFull?: () => void;
}

const CinemaDNA = ({ userId, teaser, onOpenFull }: CinemaDNAProps) => {
  const [profile, setProfile] = useState<CinematicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [insights, setInsights] = useState<LearnedInsight[]>([]);
  const [likedPosters, setLikedPosters] = useState<string[]>([]);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    loadProfile();
    if (!teaser) {
      loadInsights();
      loadLikedPosters();
    }
  }, [userId, teaser]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("cinematic_profiles" as any)
        .select("personality_title, narrative, taste_traits, representative_films, evolution_note")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) setProfile(data as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadLikedPosters = async () => {
    try {
      const liked = await getLikedMovies();
      setLikeCount(liked.length);
      setLikedPosters(liked.slice(0, 8).map((m: any) => m.poster_path).filter(Boolean));
    } catch {}
  };

  const loadInsights = async () => {
    try {
      const taste = await getUserTasteProfile();
      if (!taste) return;
      const items: LearnedInsight[] = [];

      if (taste.topGenres.length > 0) {
        items.push({
          icon: Heart,
          label: "Genres favoris",
          value: taste.topGenres.slice(0, 4).join(", "),
        });
      }
      if (taste.tasteClusters.length > 0) {
        items.push({
          icon: Zap,
          label: "Ambiances préférées",
          value: taste.tasteClusters.slice(0, 3).join(", "),
        });
      }
      if (taste.stats.likeCount > 0) {
        items.push({
          icon: BarChart3,
          label: "Films aimés",
          value: `${taste.stats.likeCount} films`,
          color: taste.stats.likeCount > 10 ? "text-primary" : undefined,
        });
      }
      if (taste.stats.acceptanceRate > 0) {
        items.push({
          icon: TrendingUp,
          label: "Taux de confiance",
          value: `${taste.stats.acceptanceRate}%`,
          color: taste.stats.acceptanceRate > 70 ? "text-green-400" : undefined,
        });
      }
      if (taste.skipPatterns.avgSkipRate > 0.5) {
        items.push({
          icon: Brain,
          label: "Exigence",
          value: "Sélectif·ve — tu sais ce que tu veux",
        });
      }
      if (taste.session.mood) {
        const moodLabels: Record<string, string> = {
          relax: "Détente", excited: "Intensité", romantic: "Romance",
          "mind-blowing": "Surprises", "easy-watch": "Films faciles", fun: "Fun",
        };
        items.push({
          icon: Sparkles,
          label: "Humeur récente",
          value: moodLabels[taste.session.mood] || taste.session.mood,
        });
      }
      setInsights(items);
    } catch {}
  };

  const MIN_LIKED_FOR_DNA = 15;

  const generateProfile = async () => {
    if (likeCount < MIN_LIKED_FOR_DNA) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("cinematic-profile", {
        body: {},
      });

      if (error) {
        throw new Error(error.message || "Failed to generate");
      }

      if (!data || data.error === "not_enough_data") {
        // Update like count from response
        if (data?.liked_count !== undefined) setLikeCount(data.liked_count);
        return;
      }

      setProfile(data as CinematicProfile);
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  // --- TEASER MODE ---
  if (teaser) {
    if (loading) return null;
    if (!profile) {
      return (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onOpenFull}
          className="w-full max-w-md text-left rounded-2xl p-4 bg-primary/[0.06] border border-primary/15 hover:border-primary/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary/70" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-sans font-semibold text-primary/70 mb-0.5">🧬 ADN Cinéma</p>
              <p className="text-foreground/40 text-[12px] font-sans">Découvre ton profil cinématographique unique</p>
            </div>
          </div>
        </motion.button>
      );
    }
    return (
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={onOpenFull}
        className="w-full max-w-md text-left rounded-2xl p-4 bg-primary/[0.06] border border-primary/15 hover:border-primary/30 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-sm">🧬</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-primary/50 font-sans font-semibold">ADN Cinéma</p>
            <p className="text-sm font-serif text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {profile.personality_title}
            </p>
          </div>
        </div>
      </motion.button>
    );
  }

  // --- FULL MODE ---
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  if (!profile) {
    const progress = Math.min(100, Math.round((likeCount / MIN_LIKED_FOR_DNA) * 100));
    const remaining = Math.max(0, MIN_LIKED_FOR_DNA - likeCount);
    const isUnlocked = likeCount >= MIN_LIKED_FOR_DNA;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center text-center px-6 py-16"
      >
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-6">
          <img src={pickLogo} alt="Pick" className="w-10 h-10 object-contain" />
        </div>
        <h3 className="font-serif text-2xl mb-3 text-foreground">Ton ADN Cinéma</h3>

        {isUnlocked ? (
          <>
            <p className="text-muted-foreground text-sm font-sans mb-6 max-w-xs mx-auto leading-relaxed">
              Pick a assez de données pour créer ton portrait cinématographique unique !
            </p>
            <Button
              onClick={generateProfile}
              disabled={generating}
              className="rounded-full gap-2 font-sans px-8 h-12"
              variant="hero"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? "Pick analyse…" : "Découvrir mon profil"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-sm font-sans mb-4 max-w-xs mx-auto leading-relaxed">
              Encore <span className="text-primary font-semibold">{remaining} film{remaining > 1 ? "s" : ""}</span> à évaluer pour débloquer ton ADN Cinéma.
            </p>

            {/* Progress ring */}
            <div className="relative w-28 h-28 mb-5">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--foreground) / 0.08)" strokeWidth="6" />
                <motion.circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - progress / 100) }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-sans font-bold text-foreground">{likeCount}</span>
                <span className="text-[10px] font-sans text-foreground/40">/ {MIN_LIKED_FOR_DNA}</span>
              </div>
            </div>

            <p className="text-foreground/30 text-[11px] font-sans mb-4">
              Utilise « Entraîne ton Pick » pour évaluer rapidement des films
            </p>
          </>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 py-6 pb-16">
      {/* ─── Hero: Personality Title ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-10"
      >
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold/50 font-sans font-semibold mb-4">
          🧬 Ton ADN Cinéma
        </p>
        <h2 className="font-serif text-3xl md:text-4xl text-foreground leading-tight mb-2">
          {profile.personality_title}
        </h2>
        <div className="w-16 h-[2px] bg-gradient-to-r from-transparent via-gold/40 to-transparent mx-auto mt-4 mb-6" />
        <p className="text-foreground/50 text-[14px] font-sans leading-[1.9] max-w-sm mx-auto">
          {profile.narrative}
        </p>
      </motion.div>

      {/* ─── Taste Traits ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap justify-center gap-2 mb-10"
      >
        {profile.taste_traits.map((trait, i) => (
          <motion.span
            key={trait}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.04 }}
            className="px-3.5 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary/80 text-[12px] font-sans font-medium"
          >
            {trait}
          </motion.span>
        ))}
      </motion.div>

      {/* ─── Pick te connaît — Insights Grid ─── */}
      {insights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-primary/60" />
            <h3 className="text-[13px] font-sans font-semibold text-foreground/60 uppercase tracking-wide">
              Ce que Pick sait de toi
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {insights.map((insight, i) => {
              const Icon = insight.icon;
              return (
                <motion.div
                  key={insight.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.05 }}
                  className="rounded-xl bg-card/60 border border-border/15 p-3.5 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon className={`w-3.5 h-3.5 ${insight.color || "text-primary/50"}`} />
                    <span className="text-[10px] text-foreground/35 font-sans uppercase tracking-wider">{insight.label}</span>
                  </div>
                  <p className={`text-[13px] font-sans font-medium ${insight.color || "text-foreground/80"} leading-snug`}>
                    {insight.value}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ─── Films qui te définissent ─── */}
      {profile.representative_films.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-10"
        >
          <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/25 font-sans font-semibold mb-3 text-center">
            Films qui te définissent
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {profile.representative_films.map((film) => (
              <span
                key={film}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/[0.04] border border-border/15 text-foreground/50 text-[12px] font-sans font-medium"
              >
                <Film className="w-3 h-3" />
                {film}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Liked Movies Mosaic ─── */}
      {likedPosters.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-10"
        >
          <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/25 font-sans font-semibold mb-3 text-center">
            Tes coups de cœur ({likeCount})
          </p>
          <div className="flex justify-center gap-1.5 overflow-hidden">
            {likedPosters.map((poster, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.04 }}
                className="w-14 h-20 rounded-lg overflow-hidden flex-shrink-0"
              >
                <img
                  src={getPosterUrl(poster, "w185")}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Evolution Note ─── */}
      {profile.evolution_note && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-primary/[0.05] border border-primary/10 max-w-sm mx-auto mb-8"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary/40 mt-0.5 flex-shrink-0" />
          <p className="text-foreground/40 text-[12px] font-sans leading-relaxed italic">
            {profile.evolution_note}
          </p>
        </motion.div>
      )}

      {/* ─── Refresh ─── */}
      <div className="flex justify-center">
        <button
          onClick={generateProfile}
          disabled={generating}
          className="flex items-center gap-1.5 text-[11px] text-primary/35 hover:text-primary font-sans font-medium transition-colors"
        >
          {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Actualiser mon profil
        </button>
      </div>
    </motion.div>
  );
};

export default CinemaDNA;
