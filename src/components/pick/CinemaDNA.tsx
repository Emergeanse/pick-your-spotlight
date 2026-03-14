import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, RefreshCw, Loader2, Film, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import pickLogo from "@/assets/pick-logo.png";

interface CinematicProfile {
  personality_title: string;
  narrative: string;
  taste_traits: string[];
  representative_films: string[];
  evolution_note?: string | null;
}

interface CinemaDNAProps {
  userId: string;
  /** If true, renders as a compact teaser card (for homepage) */
  teaser?: boolean;
  onOpenFull?: () => void;
}

const CinemaDNA = ({ userId, teaser, onOpenFull }: CinemaDNAProps) => {
  const [profile, setProfile] = useState<CinematicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("cinematic_profiles" as any)
        .select("personality_title, narrative, taste_traits, representative_films, evolution_note")
        .eq("user_id", userId)
        .maybeSingle();

      if (data) {
        setProfile(data as any);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generateProfile = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cinematic-profile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({}),
        }
      );
      if (!response.ok) throw new Error("Failed to generate");
      const result = await response.json();
      setProfile(result);
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
      <div className="flex items-center gap-2 py-8">
        <Loader2 className="w-4 h-4 text-primary animate-spin" />
        <span className="text-muted-foreground text-sm font-sans">Chargement du profil…</span>
      </div>
    );
  }

  if (!profile) {
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
        <p className="text-muted-foreground text-sm font-sans mb-6 max-w-xs mx-auto leading-relaxed">
          Pick analyse tes goûts pour créer ton portrait cinématographique unique. Comme une empreinte, mais pour les films.
        </p>
        <Button
          onClick={generateProfile}
          disabled={generating}
          className="rounded-full gap-2 font-sans px-8 h-12"
          variant="hero"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {generating ? "Pick analyse…" : "Découvrir mon profil"}
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-6 py-8"
    >
      {/* Personality Title — hero treatment */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-8"
      >
        <p className="text-[10px] uppercase tracking-[0.2em] text-primary/50 font-sans font-semibold mb-3">
          🧬 Ton profil cinématographique
        </p>
        <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-1 leading-tight">
          {profile.personality_title}
        </h2>
        <div className="w-12 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent mx-auto mt-4" />
      </motion.div>

      {/* Narrative */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-foreground/60 text-[14px] font-sans leading-[1.8] text-center max-w-sm mx-auto mb-8"
      >
        {profile.narrative}
      </motion.p>

      {/* Taste traits */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap justify-center gap-2 mb-8"
      >
        {profile.taste_traits.map((trait, i) => (
          <motion.span
            key={trait}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.05 }}
            className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[12px] font-sans font-medium"
          >
            {trait}
          </motion.span>
        ))}
      </motion.div>

      {/* Representative films */}
      {profile.representative_films.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/25 font-sans font-semibold mb-3 text-center">
            Films qui te définissent
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {profile.representative_films.map((film) => (
              <span
                key={film}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/[0.04] border border-border/20 text-foreground/50 text-[12px] font-sans font-medium"
              >
                <Film className="w-3 h-3" />
                {film}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Evolution note */}
      {profile.evolution_note && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-primary/[0.06] border border-primary/10 max-w-sm mx-auto"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary/50 mt-0.5 flex-shrink-0" />
          <p className="text-foreground/45 text-[12px] font-sans leading-relaxed italic">
            {profile.evolution_note}
          </p>
        </motion.div>
      )}

      {/* Refresh */}
      <div className="flex justify-center mt-8">
        <button
          onClick={generateProfile}
          disabled={generating}
          className="flex items-center gap-1.5 text-[11px] text-primary/40 hover:text-primary font-sans font-medium transition-colors"
        >
          {generating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Actualiser mon profil
        </button>
      </div>
    </motion.div>
  );
};

export default CinemaDNA;
