import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Ban } from "lucide-react";
import { listPreferenceTags, getMyPreferences, setPreference, removePreference, type PreferenceTag } from "@/lib/preferences";

const ORIGIN_KEYS = new Set([
  "cinema-francais",
  "cinema-americain",
  "cinema-asiatique",
  "cinema-africain",
  "cinema-amerique-du-sud",
]);

type BadgeState = "none" | "selected" | "rejected";

interface GenrePreferencesProps {
  onCountChange?: (count: number) => void;
  collapsed?: boolean;
}

const GenrePreferences = ({ onCountChange, collapsed = false }: GenrePreferencesProps) => {
  const [tags, setTags] = useState<PreferenceTag[]>([]);
  const [states, setStates] = useState<Map<string, BadgeState>>(new Map());
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

        const initial = new Map<string, BadgeState>();
        userPrefs
          .filter((p) => p.tag.category === "genre")
          .forEach((p) => {
            if (p.weight > 0) initial.set(p.tag.key, "selected");
            else if (p.weight < 0) initial.set(p.tag.key, "rejected");
          });

        // Auto-select all origins on first load if user has never set any origin pref
        const hasAnyOriginPref = userPrefs.some((p) => ORIGIN_KEYS.has(p.tag.key));
        if (!hasAnyOriginPref) {
          const originTags = allTags.filter((t) => ORIGIN_KEYS.has(t.key));
          await Promise.all(originTags.map((t) => setPreference(t.id, 1, "explicit")));
          originTags.forEach((t) => initial.set(t.key, "selected"));
        }

        setStates(initial);
        onCountChange?.(countSelected(initial));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const countSelected = (m: Map<string, BadgeState>) =>
    [...m.values()].filter((s) => s === "selected").length;

  const toggle = useCallback(
    async (tag: PreferenceTag) => {
      if (pending.has(tag.key)) return;
      const current = states.get(tag.key) ?? "none";

      // Cycle: none → selected → rejected → none
      const next: BadgeState =
        current === "none" ? "selected" : current === "selected" ? "rejected" : "none";

      setStates((prev) => {
        const m = new Map(prev);
        if (next === "none") m.delete(tag.key);
        else m.set(tag.key, next);
        onCountChange?.(countSelected(m));
        return m;
      });
      setPending((prev) => new Set(prev).add(tag.key));

      try {
        if (next === "selected") await setPreference(tag.id, 1, "explicit");
        else if (next === "rejected") await setPreference(tag.id, -1, "explicit");
        else await removePreference(tag.id);
      } catch {
        // Rollback
        setStates((prev) => {
          const m = new Map(prev);
          if (current === "none") m.delete(tag.key);
          else m.set(tag.key, current);
          onCountChange?.(countSelected(m));
          return m;
        });
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(tag.key);
          return next;
        });
      }
    },
    [states, pending],
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

  const visibleGenres = collapsed
    ? genres.filter((t) => states.has(t.key))
    : genres;
  const visibleOrigins = collapsed
    ? origins.filter((t) => states.has(t.key))
    : origins;

  const renderChip = (tag: PreferenceTag, i: number) => {
    const state = states.get(tag.key) ?? "none";
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
        className={`relative flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-sans font-medium transition-all duration-200 border ${
          state === "selected"
            ? "bg-primary/15 border-primary text-primary neon-glow"
            : state === "rejected"
            ? "bg-destructive/10 border-destructive/40 text-destructive"
            : "bg-card/50 border-border/20 text-foreground/50 hover:border-primary/30 hover:text-foreground/70"
        } ${isPending ? "opacity-60" : ""}`}
      >
        {state === "rejected" && <Ban className="w-2.5 h-2.5 shrink-0" />}
        <span>{tag.label}</span>
        {isPending && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/40">
            <Loader2 className="w-3 h-3 animate-spin text-primary/60" />
          </span>
        )}
      </motion.button>
    );
  };

  if (collapsed && visibleGenres.length === 0 && visibleOrigins.length === 0) return null;

  const selectedCount = countSelected(states);
  const rejectedCount = [...states.values()].filter((s) => s === "rejected").length;

  return (
    <div className="space-y-3">
      {visibleGenres.length > 0 && (
        <div className={`flex flex-wrap gap-2 max-h-[108px] ${collapsed ? "overflow-hidden" : "overflow-y-auto scrollbar-dark"}`}>
          {visibleGenres.map((tag, i) => renderChip(tag, i))}
        </div>
      )}

      {visibleOrigins.length > 0 && (
        <div>
          {!collapsed && (
            <p className="text-[9px] font-sans text-foreground/20 uppercase tracking-widest mb-2">
              Styles cinématographiques · 1 clic = aimé · 2 clics = exclu
            </p>
          )}
          <div className={`flex flex-wrap gap-2 max-h-[72px] ${collapsed ? "overflow-hidden" : "overflow-y-auto scrollbar-dark"}`}>
            {visibleOrigins.map((tag, i) => renderChip(tag, visibleGenres.length + i))}
          </div>
        </div>
      )}

      {!collapsed && (selectedCount > 0 || rejectedCount > 0) && (
        <p className="text-[10px] font-sans text-foreground/30 mt-1">
          {selectedCount > 0 && (
            <span className="text-primary/40">{selectedCount} aimé{selectedCount > 1 ? "s" : ""}</span>
          )}
          {selectedCount > 0 && rejectedCount > 0 && " · "}
          {rejectedCount > 0 && (
            <span className="text-destructive/40">{rejectedCount} exclu{rejectedCount > 1 ? "s" : ""}</span>
          )}
        </p>
      )}
    </div>
  );
};

export default GenrePreferences;
