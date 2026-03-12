import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, RefreshCw, Loader2, Film } from "lucide-react";
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
}

const CinemaDNA = ({ userId }: CinemaDNAProps) => {
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
        className="rounded-2xl bg-primary/5 border border-primary/15 p-6 text-center"
      >
        <img src={pickLogo} alt="Pick" className="w-12 h-12 mx-auto mb-3 object-contain" />
        <h3 className="font-serif text-lg mb-2">Ton ADN Cinéma</h3>
        <p className="text-muted-foreground text-sm font-sans mb-4 max-w-xs mx-auto">
          Pick analyse tes goûts pour créer ton profil cinématographique unique.
        </p>
        <Button
          onClick={generateProfile}
          disabled={generating}
          className="rounded-full gap-2 font-sans"
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-primary/5 border border-primary/15 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5 mb-3">
          <img src={pickLogo} alt="Pick" className="w-8 h-8 object-contain" />
          <p className="text-[10px] uppercase tracking-widest text-primary/60 font-sans font-semibold">
            Ton ADN Cinéma
          </p>
        </div>

        {/* Personality title */}
        <h3 className="font-serif text-xl md:text-2xl text-foreground mb-2">
          {profile.personality_title}
        </h3>

        {/* Narrative */}
        <p className="text-foreground/60 text-[13px] md:text-sm font-sans leading-relaxed mb-4">
          {profile.narrative}
        </p>

        {/* Taste traits */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {profile.taste_traits.map((trait) => (
            <span
              key={trait}
              className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-sans font-medium"
            >
              {trait}
            </span>
          ))}
        </div>

        {/* Representative films */}
        {profile.representative_films.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-sans font-semibold mb-2">
              Films qui te définissent
            </p>
            <div className="flex flex-wrap gap-1.5">
              {profile.representative_films.map((film) => (
                <span
                  key={film}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-foreground/[0.04] border border-border/20 text-foreground/60 text-[11px] font-sans font-medium"
                >
                  <Film className="w-2.5 h-2.5" />
                  {film}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Evolution note */}
        {profile.evolution_note && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/10"
          >
            <Sparkles className="w-3 h-3 text-primary/60 mt-0.5 flex-shrink-0" />
            <p className="text-foreground/50 text-[12px] font-sans leading-relaxed italic">
              {profile.evolution_note}
            </p>
          </motion.div>
        )}
      </div>

      {/* Refresh */}
      <div className="px-5 py-3 border-t border-primary/10 flex justify-end">
        <button
          onClick={generateProfile}
          disabled={generating}
          className="flex items-center gap-1.5 text-[11px] text-primary/50 hover:text-primary font-sans font-medium transition-colors"
        >
          {generating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Actualiser
        </button>
      </div>
    </motion.div>
  );
};

export default CinemaDNA;
