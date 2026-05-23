import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Heart, X } from "lucide-react";
import { listPreferenceTags, getMyPreferences, setPreference, removePreference, type PreferenceTag } from "@/lib/preferences";

const STYLE_KEYS = new Set([
  "comedie-romantique",
]);

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
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
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
        const initialExcluded = new Set(
          userPrefs
            .filter((p) => p.tag.category === "genre" && p.weight < 0)
            .map((p) => p.tag.key),
        );
        setSelected(initialSelected);
        setExcluded(initialExcluded);
        onCountChange?.(initialSelected.size + initialExcluded.size);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Binary toggle for regular genre/style tags
  const toggle = useCallback(
    async (tag: PreferenceTag) => {
      if (pending.has(tag.key)) return;
      const wasSelected = selected.has(tag.key);
      setSelected((prev) => {
        const next = new Set(prev);
        if (wasSelected) next.delete(tag.key);
        else next.add(tag.key);
        onCountChange?.(next.size + excluded.size);
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
          onCountChange?.(next.size + excluded.size);
          return next;
        });
      } finally {
        setPending((prev) => { const next = new Set(prev); next.delete(tag.key); return next; });
      }
    },
    [selected, excluded, pending],
  );

  // 3-state toggle for origin tags: neutral → liked → excluded → neutral
  const toggleOrigin = useCallback(
    async (tag: PreferenceTag) => {
      if (pending.has(tag.key)) return;
      const isLiked = selected.has(tag.key);
      const isExcluded = excluded.has(tag.key);
      setPending((prev) => new Set(prev).add(tag.key));
      try {
        if (!isLiked && !isExcluded) {
          setSelected((prev) => { const n = new Set(prev); n.add(tag.key); return n; });
          onCountChange?.(selected.size + 1 + excluded.size);
          await setPreference(tag.id, 1, "explicit");
        } else if (isLiked) {
          setSelected((prev) => { const n = new Set(prev); n.delete(tag.key); return n; });
          setExcluded((prev) => { const n = new Set(prev); n.add(tag.key); return n; });
          onCountChange?.(selected.size - 1 + excluded.size + 1);
          await setPreference(tag.id, -1, "explicit");
        } else {
          setExcluded((prev) => { const n = new Set(prev); n.delete(tag.key); return n; });
          onCountChange?.(selected.size + excluded.size - 1);
          await removePreference(tag.id);
        }
      } catch {
        // revert — reload would be safest but keep it simple
      } finally {
        setPending((prev) => { const next = new Set(prev); next.delete(tag.key); return next; });
      }
    },
    [selected, excluded, pending],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-4 h-4 text-primary/40 animate-spin" />
      </div>
    );
  }

  const standard = tags.filter((t) => !STYLE_KEYS.has(t.key) && !ORIGIN_KEYS.has(t.key));
  const styles = tags.filter((t) => STYLE_KEYS.has(t.key));
  const origins = tags.filter((t) => ORIGIN_KEYS.has(t.key));

  const visibleStandard = collapsed ? standard.filter((t) => selected.has(t.key)) : standard;
  const visibleStyles = collapsed ? styles.filter((t) => selected.has(t.key)) : styles;
  const visibleOrigins = collapsed
    ? origins.filter((t) => selected.has(t.key) || excluded.has(t.key))
    : origins;

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

  const renderOriginChip = (tag: PreferenceTag, i: number) => {
    const isLiked = selected.has(tag.key);
    const isExcluded = excluded.has(tag.key);
    const isPending = pending.has(tag.key);
    return (
      <motion.button
        key={tag.key}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: i * 0.02, duration: 0.2 }}
        whileTap={{ scale: 0.93 }}
        onClick={() => toggleOrigin(tag)}
        disabled={isPending}
        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-sans font-medium transition-all duration-200 border ${
          isLiked
            ? "bg-primary/15 border-primary text-primary neon-glow"
            : isExcluded
            ? "bg-destructive/10 border-destructive/50 text-destructive/80"
            : "bg-card/50 border-border/20 text-foreground/50 hover:border-primary/30 hover:text-foreground/70"
        } ${isPending ? "opacity-60" : ""}`}
      >
        {isLiked && <Heart className="w-2.5 h-2.5" />}
        {isExcluded && <X className="w-2.5 h-2.5" />}
        {tag.label}
        {isPending && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-3 h-3 animate-spin text-primary/60" />
          </span>
        )}
      </motion.button>
    );
  };

  const totalCount = selected.size + excluded.size;
  if (collapsed && visibleStandard.length === 0 && visibleStyles.length === 0 && visibleOrigins.length === 0) return null;

  return (
    <div className="space-y-3">
      {visibleStandard.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visibleStandard.map((tag, i) => renderChip(tag, i))}
        </div>
      )}

      {visibleStyles.length > 0 && (
        <div>
          {!collapsed && (
            <p className="text-[9px] font-sans text-foreground/20 uppercase tracking-widest mb-2">
              Styles cinématographiques
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {visibleStyles.map((tag, i) => renderChip(tag, visibleStandard.length + i))}
          </div>
        </div>
      )}

      {visibleOrigins.length > 0 && (
        <div>
          {!collapsed && (
            <p className="text-[9px] font-sans text-foreground/20 uppercase tracking-widest mb-2">
              Origines · appuie pour alterner ❤️ aimé / 🚫 évité
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {visibleOrigins.map((tag, i) => renderOriginChip(tag, i))}
          </div>
        </div>
      )}

      {!collapsed && totalCount > 0 && (
        <p className="text-[10px] font-sans text-primary/40 mt-1">
          {totalCount} préférence{totalCount > 1 ? "s" : ""} · utilisée{totalCount > 1 ? "s" : ""} pour tes recommandations
        </p>
      )}
    </div>
  );
};

export default GenrePreferences;
