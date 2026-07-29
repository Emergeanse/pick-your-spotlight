import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, RefreshCw, Loader2, Film, Brain, Eye, Compass, Shield,
  Users, Gem, TrendingUp, Star, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getUserTasteProfile } from "@/lib/interactions";
import { getLikedMovies } from "@/lib/liked-movies";
import { getPosterUrl } from "@/lib/tmdb";
import pickLogoLunettes from "@/assets/pick-logo-lunettes.webp";
import CinemaAvatar from "@/components/pick/CinemaAvatar";

// ── Types ──
interface TasteSignature {
  name: string;
  category: string;
}

interface Specialization {
  name: string;
  level: string;
}

interface Distinction {
  name: string;
  category: string;
}

interface FullCinematicProfile {
  personality_title: string;
  dna_archetype: string | null;
  narrative: string;
  taste_traits: string[];
  taste_signatures: TasteSignature[];
  specializations: Specialization[];
  distinctions: Distinction[];
  global_level: string;
  social_reputation: string[];
  representative_films: string[];
  evolution_note?: string | null;
}

interface CinemaDNAProps {
  userId: string;
  teaser?: boolean;
  onOpenFull?: () => void;
}

// ── Level config ──
const LEVEL_ORDER = [
  "Regard naissant",
  "Regard sensible",
  "Œil affûté",
  "Connaisseur nuancé",
  "Curateur cinématographique",
  "Signature de goût",
  "Référence Pick",
];

const SPECIALIZATION_LEVELS = ["Sensible à", "Habitué de", "Fin connaisseur de", "Référence de"];

const DISTINCTION_ICONS: Record<string, typeof Eye> = {
  Regard: Eye,
  Exploration: Compass,
  Cohérence: Shield,
  Intelligence: Brain,
  Social: Users,
  Découverte: Gem,
  Évolution: TrendingUp,
  Maturité: Star,
};

const SIGNATURE_COLORS: Record<string, string> = {
  Rythme: "from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-300",
  "Intensité émotionnelle": "from-rose-500/20 to-rose-500/5 border-rose-500/20 text-rose-300",
  Émotion: "from-rose-500/20 to-rose-500/5 border-rose-500/20 text-rose-300",
  Visuel: "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-300",
  "Style visuel": "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-300",
  Narration: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-300",
  Structure: "from-violet-500/20 to-violet-500/5 border-violet-500/20 text-violet-300",
  Univers: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/20 text-cyan-300",
};

const CinemaDNA = ({ userId, teaser, onOpenFull }: CinemaDNAProps) => {
  const [profile, setProfile] = useState<FullCinematicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [likedPosters, setLikedPosters] = useState<string[]>([]);
  const [likeCount, setLikeCount] = useState(0);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
    loadLikedPosters();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("cinematic_profiles" as any)
        .select("personality_title, dna_archetype, narrative, taste_traits, taste_signatures, specializations, distinctions, global_level, social_reputation, representative_films, evolution_note")
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

  const MIN_LIKED_FOR_DNA = 15;

  const generateProfile = async () => {
    if (likeCount < MIN_LIKED_FOR_DNA) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("cinematic-profile", { body: {} });
      if (error) throw new Error(error.message || "Failed to generate");
      if (!data || data.error === "not_enough_data") {
        if (data?.liked_count !== undefined) setLikeCount(data.liked_count);
        return;
      }
      setProfile(data as FullCinematicProfile);
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  // ── TEASER MODE ──
  if (teaser) {
    if (loading) return null;
    if (!profile) {
      const remaining = Math.max(0, MIN_LIKED_FOR_DNA - likeCount);
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
              <p className="text-foreground/40 text-[12px] font-sans">
                {likeCount >= MIN_LIKED_FOR_DNA
                  ? "Prêt à découvrir ton profil !"
                  : `Encore ${remaining} film${remaining > 1 ? "s" : ""} pour débloquer`}
              </p>
            </div>
          </div>
        </motion.button>
      );
    }

    const levelIndex = LEVEL_ORDER.indexOf(profile.global_level);

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
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[10px] uppercase tracking-widest text-primary/50 font-sans font-semibold">ADN Cinéma</p>
              {levelIndex >= 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold/70 font-sans font-medium">
                  {profile.global_level}
                </span>
              )}
            </div>
            <p className="text-sm font-serif text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {profile.dna_archetype || profile.personality_title}
            </p>
          </div>
        </div>
      </motion.button>
    );
  }

  // ── FULL MODE — Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  // ── FULL MODE — No profile yet ──
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
          <img src={pickLogoLunettes} alt="Pick" className="w-10 h-10 object-contain" />
        </div>
        <h3 className="font-serif text-2xl mb-3 text-foreground">Ton ADN Cinéma</h3>

        {isUnlocked ? (
          <>
            <p className="text-muted-foreground text-sm font-sans mb-6 max-w-xs mx-auto leading-relaxed">
              Pick a assez de données pour créer ton portrait cinématographique unique !
            </p>
            <Button onClick={generateProfile} disabled={generating} className="rounded-full gap-2 font-sans px-8 h-12" variant="hero">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? "Pick analyse…" : "Découvrir mon profil"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-sm font-sans mb-4 max-w-xs mx-auto leading-relaxed">
              Encore <span className="text-primary font-semibold">{remaining} film{remaining > 1 ? "s" : ""}</span> à évaluer pour débloquer ton ADN Cinéma.
            </p>
            <div className="relative w-28 h-28 mb-5">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--foreground) / 0.08)" strokeWidth="6" />
                <motion.circle
                  cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--primary))" strokeWidth="6" strokeLinecap="round"
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
            <p className="text-foreground/45 text-[11px] font-sans mb-4">
              Utilise « Entraîne ton Pick » pour évaluer rapidement des films
            </p>
          </>
        )}
      </motion.div>
    );
  }

  // ── FULL MODE — Profile Display ──
  const dnaName = profile.dna_archetype || profile.personality_title;
  const levelIndex = LEVEL_ORDER.indexOf(profile.global_level);
  const levelProgress = levelIndex >= 0 ? ((levelIndex + 1) / LEVEL_ORDER.length) * 100 : 15;

  // Group distinctions by category
  const distinctionsByCategory: Record<string, Distinction[]> = {};
  (profile.distinctions || []).forEach(d => {
    if (!distinctionsByCategory[d.category]) distinctionsByCategory[d.category] = [];
    distinctionsByCategory[d.category].push(d);
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 py-6 pb-16">

      {/* ═══ LAYER 1 — DNA ARCHETYPE ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-8"
      >
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold/50 font-sans font-semibold mb-4">
          🧬 Ton ADN Cinéma
        </p>

        {/* Avatar */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="rounded-full overflow-hidden shadow-[0_0_40px_rgba(139,92,246,0.35)] ring-2 ring-white/12">
              <CinemaAvatar
                personalityTitle={profile.personality_title}
                dnaArchetype={profile.dna_archetype}
                tasteTaits={profile.taste_traits}
                globalLevel={profile.global_level}
                size={128}
              />
            </div>
            {/* Level badge overlaid on avatar */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-background/90 border border-gold/20 shadow-sm whitespace-nowrap">
              <div className="w-1.5 h-1.5 rounded-full bg-gold/60 shrink-0" />
              <span className="text-[9px] font-sans font-semibold text-gold/70 uppercase tracking-wider">
                {profile.global_level}
              </span>
            </div>
          </div>
        </div>

        <h2 className="font-serif text-3xl md:text-4xl text-foreground leading-tight mb-2 mt-3">
          {dnaName}
        </h2>

        <div className="w-16 h-[2px] bg-gradient-to-r from-transparent via-gold/40 to-transparent mx-auto mt-4 mb-5" />

        <p className="text-foreground/50 text-[14px] font-sans leading-[1.9] max-w-sm mx-auto">
          {profile.narrative}
        </p>
      </motion.div>

      {/* ── Level Progress ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="mb-10 max-w-sm mx-auto"
      >
        <div className="flex justify-between items-center mb-2">
          {LEVEL_ORDER.map((level, i) => {
            const isActive = i <= levelIndex;
            const isCurrent = i === levelIndex;
            return (
              <div key={level} className="flex flex-col items-center" style={{ flex: 1 }}>
                <div
                  className={`w-2 h-2 rounded-full transition-all ${
                    isCurrent ? "bg-gold scale-125 shadow-[0_0_6px_hsl(var(--gold)/0.5)]" :
                    isActive ? "bg-gold/50" : "bg-foreground/10"
                  }`}
                />
              </div>
            );
          })}
        </div>
        <div className="h-1 rounded-full bg-foreground/8 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${levelProgress}%` }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-gold/40 to-gold/80"
          />
        </div>
      </motion.div>

      {/* ═══ LAYER 2 — TASTE SIGNATURES ═══ */}
      {profile.taste_signatures && profile.taste_signatures.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <SectionHeader label="Signatures de goût" />
          <div className="flex flex-wrap justify-center gap-2">
            {profile.taste_signatures.map((sig, i) => {
              const colorClasses = SIGNATURE_COLORS[sig.category] || "from-primary/20 to-primary/5 border-primary/20 text-primary/80";
              return (
                <motion.div
                  key={sig.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  className={`px-3.5 py-2 rounded-xl bg-gradient-to-br ${colorClasses} border text-[12px] font-sans font-medium`}
                >
                  <span className="block text-[9px] uppercase tracking-wider opacity-60 mb-0.5">{sig.category}</span>
                  {sig.name}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ═══ LAYER 3 — SPECIALIZATIONS ═══ */}
      {profile.specializations && profile.specializations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <CollapsibleSection
            label="Spécialisations"
            isOpen={expandedSection === "specs"}
            onToggle={() => toggleSection("specs")}
            count={profile.specializations.length}
          >
            <div className="space-y-2.5">
              {profile.specializations.map((spec, i) => {
                const levelIdx = SPECIALIZATION_LEVELS.indexOf(spec.level);
                const levelPercent = levelIdx >= 0 ? ((levelIdx + 1) / SPECIALIZATION_LEVELS.length) * 100 : 25;
                return (
                  <motion.div
                    key={spec.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="rounded-xl bg-card/50 border border-border/10 p-3.5"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-sans font-medium text-foreground/80">{spec.name}</span>
                      <span className="text-[10px] font-sans font-semibold text-primary/60 uppercase tracking-wider">
                        {spec.level}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-foreground/8 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${levelPercent}%` }}
                        transition={{ delay: 0.1 * i, duration: 0.6 }}
                        className="h-full rounded-full bg-gradient-to-r from-primary/40 to-primary/70"
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CollapsibleSection>
        </motion.div>
      )}

      {/* ═══ LAYER 4 — DISTINCTIONS ═══ */}
      {Object.keys(distinctionsByCategory).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mb-8"
        >
          <CollapsibleSection
            label="Distinctions"
            isOpen={expandedSection === "distinctions"}
            onToggle={() => toggleSection("distinctions")}
            count={profile.distinctions.length}
          >
            <div className="space-y-4">
              {Object.entries(distinctionsByCategory).map(([category, items]) => {
                const Icon = DISTINCTION_ICONS[category] || Star;
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-3.5 h-3.5 text-gold/50" />
                      <span className="text-[10px] uppercase tracking-wider text-foreground/45 font-sans font-semibold">
                        {category}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map(d => (
                        <span
                          key={d.name}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gold/[0.06] border border-gold/12 text-gold/70 text-[11px] font-sans font-medium"
                        >
                          {d.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        </motion.div>
      )}

      {/* ═══ LAYER 6 — SOCIAL REPUTATION ═══ */}
      {profile.social_reputation && profile.social_reputation.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <SectionHeader label="Réputation sociale" />
          <div className="flex flex-wrap justify-center gap-2">
            {profile.social_reputation.map((rep) => (
              <span
                key={rep}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/[0.08] border border-blue-500/15 text-blue-300/80 text-[11px] font-sans font-medium"
              >
                <Users className="w-3 h-3" />
                {rep}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Films qui te définissent ── */}
      {profile.representative_films.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="mb-8"
        >
          <SectionHeader label="Films qui te définissent" />
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

      {/* ── Liked Movies Mosaic ── */}
      {likedPosters.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <SectionHeader label={`Tes coups de cœur (${likeCount})`} />
          <div className="flex justify-center gap-1.5 overflow-hidden">
            {likedPosters.map((poster, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.04 }}
                className="w-14 h-20 rounded-lg overflow-hidden flex-shrink-0"
              >
                <img src={getPosterUrl(poster, "w185")} alt="" className="w-full h-full object-cover" loading="lazy" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Evolution Note ── */}
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

      {/* ── Refresh ── */}
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

// ── Reusable sub-components ──

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/45 font-sans font-semibold mb-3 text-center">
      {label}
    </p>
  );
}

function CollapsibleSection({
  label,
  isOpen,
  onToggle,
  count,
  children,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-center gap-2 mb-3 group"
      >
        <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/45 font-sans font-semibold group-hover:text-foreground/40 transition-colors">
          {label}
        </p>
        <span className="text-[10px] text-foreground/40 font-sans">({count})</span>
        {isOpen ? (
          <ChevronUp className="w-3 h-3 text-foreground/40" />
        ) : (
          <ChevronDown className="w-3 h-3 text-foreground/40" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CinemaDNA;
