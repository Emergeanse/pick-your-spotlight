import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { listPreferenceTags, getMyPreferences, setPreference, removePreference, type PreferenceTag } from "@/lib/preferences";

// Keys treated as cinematic origins — shown in "Styles cinématographiques" section
const ORIGIN_KEYS = new Set([
  "cinema-francais",
  "cinema-americain",
  "cinema-asiatique",
  "cinema-africain",
  "cinema-amerique-du-sud",
]);

interface GenrePreferencesProps {
  onCountChange?: (count: number) => void;
  collapsed?: boolean;
}

const GenrePreferences = ({ onCountChange, collapsed = false }: GenrePreferencesProps) => {
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

        const initialSelected = new Set(
          userPrefs
            .filter((p) => p.tag.category === "genre" && p.weight > 0)
            .map((p) => p.tag.key),
        );

        // Auto-select all origins on first load if user has never set any origin pref
        const hasAnyOriginPref = userPrefs.some((p) => ORIGIN_KEYS.has(p.tag.key));
        if (!hasAnyOriginPref) {
          const originTags = allTags.filter((t) => ORIGIN_KEYS.has(t.key));
          await Promise.all(originTags.map((t) => setPreference(t.id, 1, "explicit")));
          originTags.forEach((t) => initialSelected.add(t.key));
        }

        setSelected(initialSelected);
        onCountChange?.(initialSelected.size);
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
        onCountChange?.(next.size);
        return next;
      });
      setPending((prev) => new Set(prev).add(tag.key));
      try {
        if (wasSelected) await removePreference(tag.id);
        else await setPreference(tag.id, 1, "explicit");
      } catch {
        setSelected((prev) => {
          const next = new Set(prev);
          if (wasSelected) next.add(tag.key);
          else next.delete(tag.key);
          onCountChange?.(next.size);
          return next;
        });
      } finally {
        setPending((prev) => { const next = new Set(prev); next.delete(tag.key); return next; });
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

  const genres = tags.filter((t) => !ORIGIN_KEYS.has(t.key));
  const origins = tags.filter((t) => ORIGIN_KEYS.has(t.key));

  const visibleGenres = collapsed ? genres.filter((t) => selected.has(t.key)) : genres;
  const visibleOrigins = collapsed ? origins.filter((t) => selected.has(t.key)) : origins;

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

  if (collapsed && visibleGenres.length === 0 && visibleOrigins.length === 0) return null;

  return (
    <div className="space-y-3">
      {visibleGenres.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visibleGenres.map((tag, i) => renderChip(tag, i))}
        </div>
      )}

      {visibleOrigins.length > 0 && (
        <div>
          {!collapsed && (
            <p className="text-[9px] font-sans text-foreground/20 uppercase tracking-widest mb-2">
              Styles cinématographiques · décoche pour exclure une origine
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {visibleOrigins.map((tag, i) => renderChip(tag, visibleGenres.length + i))}
          </div>
        </div>
      )}

      {!collapsed && selected.size > 0 && (
        <p className="text-[10px] font-sans text-primary/40 mt-1">
          {selected.size} sélectionné{selected.size > 1 ? "s" : ""} · utilisé{selected.size > 1 ? "s" : ""} pour tes recommandations
        </p>
      )}
    </div>
  );
};

export default GenrePreferences;
