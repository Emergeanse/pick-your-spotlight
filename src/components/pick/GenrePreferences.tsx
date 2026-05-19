import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { listPreferenceTags, getMyPreferences, setPreference, removePreference, type PreferenceTag } from "@/lib/preferences";

const STYLE_KEYS = new Set([
  "cinema-francais",
  "cinema-asiatique",
  "films-auteur",
  "comedie-romantique",
  "cinema-independant",
  "film-noir",
]);

const GenrePreferences = () => {
  const [tags, setTags] = useState<PreferenceTag[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [allTags, userPrefs] = await Promise.all([
          listPreferenceTags("genre"),
          getMyPreferences(),
        ]);
        setTags(allTags);
        setSelected(
          new Set(
            userPrefs
              .filter((p) => p.tag.category === "genre" && p.weight > 0)
              .map((p) => p.tag.key),
          ),
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggle = useCallback(
    async (tag: PreferenceTag) => {
      if (pending.has(tag.key)) return;
      const wasSelected = selected.has(tag.key);

      setSelected((prev) => {
        const next = new Set(prev);
        if (wasSelected) next.delete(tag.key);
        else next.add(tag.key);
        return next;
      });
      setPending((prev) => new Set(prev).add(tag.key));

      try {
        if (wasSelected) {
          await removePreference(tag.id);
        } else {
          await setPreference(tag.id, 1, "explicit");
        }
      } catch {
        // Revert optimistic update on error
        setSelected((prev) => {
          const next = new Set(prev);
          if (wasSelected) next.add(tag.key);
          else next.delete(tag.key);
          return next;
        });
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(tag.key);
          return next;
        });
      }
    },
    [selected, pending],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-4 h-4 text-primary/40 animate-spin" />
      </div>
    );
  }

  const standard = tags.filter((t) => !STYLE_KEYS.has(t.key));
  const styles = tags.filter((t) => STYLE_KEYS.has(t.key));

  const renderChip = (tag: PreferenceTag, i: number) => {
    const isSelected = selected.has(tag.key);
    const isPending = pending.has(tag.key);

    return (
      <motion.button
        key={tag.key}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: i * 0.02, duration: 0.2 }}
        whileTap={{ scale: 0.93 }}
        onClick={() => toggle(tag)}
        disabled={isPending}
        className={`relative px-3 py-1.5 rounded-full text-[11px] font-sans font-medium transition-all duration-200 border ${
          isSelected
            ? "bg-primary/15 border-primary text-primary neon-glow"
            : "bg-card/50 border-border/20 text-foreground/50 hover:border-primary/30 hover:text-foreground/70"
        } ${isPending ? "opacity-60" : ""}`}
      >
        {tag.label}
        {isPending && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-3 h-3 animate-spin text-primary/60" />
          </span>
        )}
      </motion.button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {standard.map((tag, i) => renderChip(tag, i))}
      </div>

      {styles.length > 0 && (
        <div>
          <p className="text-[9px] font-sans text-foreground/20 uppercase tracking-widest mb-2">
            Styles cinématographiques
          </p>
          <div className="flex flex-wrap gap-2">
            {styles.map((tag, i) => renderChip(tag, standard.length + i))}
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <p className="text-[10px] font-sans text-primary/40 mt-1">
          {selected.size} style{selected.size > 1 ? "s" : ""} sélectionné{selected.size > 1 ? "s" : ""} · utilisé{selected.size > 1 ? "s" : ""} pour tes recommandations
        </p>
      )}
    </div>
  );
};

export default GenrePreferences;
