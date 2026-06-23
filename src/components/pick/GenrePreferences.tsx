import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react";

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



function countSelected(m: Map<string, BadgeState>) {

  return [...m.values()].filter((s) => s === "selected").length;

}



function statesAreDirty(current: Map<string, BadgeState>, saved: Map<string, BadgeState>) {

  if (current.size !== saved.size) return true;

  for (const [key, value] of current) {

    if (saved.get(key) !== value) return true;

  }

  for (const key of saved.keys()) {

    if (!current.has(key)) return true;

  }

  return false;

}



export interface GenrePreferencesHandle {

  save: () => Promise<void>;

  isDirty: () => boolean;

}



interface GenrePreferencesProps {

  onCountChange?: (count: number) => void;

  onRejectedCountChange?: (count: number) => void;

  onDirtyChange?: (dirty: boolean) => void;

  /** When true, changes are held locally until `save()` is called via ref. */

  deferSave?: boolean;

  collapsed?: boolean;

  /** Preview: read-only chips for summary row. Full: interactive grid (default). */

  mode?: "full" | "preview";

  /** Limit preview chips (liked first, then excluded). */

  previewLimit?: number;

  /** Sheet tab filter — show only liked or excluded genres. */

  filter?: "liked" | "excluded";

  /** When set, capture chip order once per key (sheet open / tab switch). Toggles do not re-sort. */

  orderKey?: string;

  readOnly?: boolean;

}



const GenrePreferences = forwardRef<GenrePreferencesHandle, GenrePreferencesProps>(({

  onCountChange,

  onRejectedCountChange,

  onDirtyChange,

  deferSave = false,

  collapsed = false,

  mode = "full",

  previewLimit = 4,

  filter,

  orderKey,

  readOnly = false,

}, ref) => {

  const [tags, setTags] = useState<PreferenceTag[]>([]);

  const [states, setStates] = useState<Map<string, BadgeState>>(new Map());

  const [loading, setLoading] = useState(true);

  const [pending, setPending] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);

  const savedStatesRef = useRef<Map<string, BadgeState>>(new Map());

  const genreOrderRef = useRef<PreferenceTag[]>([]);

  const originOrderRef = useRef<PreferenceTag[]>([]);

  const lastOrderKeyRef = useRef<string | undefined>();



  const notifyDirty = useCallback((next: Map<string, BadgeState>) => {

    if (!deferSave) return;

    onDirtyChange?.(statesAreDirty(next, savedStatesRef.current));

  }, [deferSave, onDirtyChange]);



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



        const hasAnyOriginPref = userPrefs.some((p) => ORIGIN_KEYS.has(p.tag.key));

        if (!hasAnyOriginPref) {

          const originTags = allTags.filter((t) => ORIGIN_KEYS.has(t.key));

          if (deferSave) {

            originTags.forEach((t) => initial.set(t.key, "selected"));

          } else {

            await Promise.all(originTags.map((t) => setPreference(t.id, 1, "explicit")));

            originTags.forEach((t) => initial.set(t.key, "selected"));

          }

        }



        savedStatesRef.current = new Map(initial);

        setStates(initial);

        onCountChange?.(countSelected(initial));

        onRejectedCountChange?.([...initial.values()].filter((s) => s === "rejected").length);

        onDirtyChange?.(false);

      } finally {

        setLoading(false);

      }

    };

    load();

  }, [deferSave]);



  const persistChanges = useCallback(async (current: Map<string, BadgeState>, saved: Map<string, BadgeState>) => {

    const tagByKey = new Map(tags.map((t) => [t.key, t]));

    const allKeys = new Set([...current.keys(), ...saved.keys()]);



    for (const key of allKeys) {

      const cur = current.get(key) ?? "none";

      const prev = saved.get(key) ?? "none";

      if (cur === prev) continue;

      const tag = tagByKey.get(key);

      if (!tag) continue;

      if (cur === "selected") await setPreference(tag.id, 1, "explicit");

      else if (cur === "rejected") await setPreference(tag.id, -1, "explicit");

      else await removePreference(tag.id);

    }



    savedStatesRef.current = new Map(current);

    onDirtyChange?.(false);

  }, [onDirtyChange, tags]);



  useImperativeHandle(ref, () => ({

    save: async () => {

      if (!deferSave || !statesAreDirty(states, savedStatesRef.current)) return;

      setSaving(true);

      try {

        await persistChanges(states, savedStatesRef.current);

      } finally {

        setSaving(false);

      }

    },

    isDirty: () => statesAreDirty(states, savedStatesRef.current),

  }), [deferSave, persistChanges, states]);



  const sortForFilter = useCallback(

    (items: PreferenceTag[], stateMap: Map<string, BadgeState>) => {

      if (!filter) return items;

      return [...items].sort((a, b) => {

        const sa = stateMap.get(a.key) ?? "none";

        const sb = stateMap.get(b.key) ?? "none";

        const rank = (state: BadgeState) => {

          if (filter === "liked") {

            if (state === "selected") return 0;

            if (state === "none") return 1;

            return 2;

          }

          if (state === "rejected") return 0;

          if (state === "none") return 1;

          return 2;

        };

        return rank(sa) - rank(sb) || a.label.localeCompare(b.label, "fr");

      });

    },

    [filter],

  );



  useEffect(() => {

    if (!orderKey) {

      lastOrderKeyRef.current = undefined;

      genreOrderRef.current = [];

      originOrderRef.current = [];

      return;

    }

    if (loading || tags.length === 0) return;

    if (lastOrderKeyRef.current === orderKey) return;

    lastOrderKeyRef.current = orderKey;



    const g = tags.filter((t) => !ORIGIN_KEYS.has(t.key));

    const o = tags.filter((t) => ORIGIN_KEYS.has(t.key));

    const genreBase = collapsed ? g.filter((t) => states.has(t.key)) : g;

    const originBase = collapsed ? o.filter((t) => states.has(t.key)) : o;

    genreOrderRef.current = sortForFilter(genreBase, states);

    originOrderRef.current = sortForFilter(originBase, states);

  }, [orderKey, loading, tags, filter, collapsed, sortForFilter, states]);



  const toggle = useCallback(

    async (tag: PreferenceTag) => {

      if (pending.has(tag.key) || saving) return;

      const current = states.get(tag.key) ?? "none";



      const next: BadgeState =

        current === "none" ? "selected" : current === "selected" ? "rejected" : "none";



      const applyLocal = (map: Map<string, BadgeState>) => {

        if (next === "none") map.delete(tag.key);

        else map.set(tag.key, next);

        onCountChange?.(countSelected(map));

        onRejectedCountChange?.([...map.values()].filter((s) => s === "rejected").length);

        notifyDirty(map);

        return map;

      };



      if (deferSave) {

        setStates((prev) => applyLocal(new Map(prev)));

        return;

      }



      setStates((prev) => applyLocal(new Map(prev)));

      setPending((prev) => new Set(prev).add(tag.key));



      try {

        if (next === "selected") await setPreference(tag.id, 1, "explicit");

        else if (next === "rejected") await setPreference(tag.id, -1, "explicit");

        else await removePreference(tag.id);

      } catch {

        setStates((prev) => {

          const m = new Map(prev);

          if (current === "none") m.delete(tag.key);

          else m.set(tag.key, current);

          onCountChange?.(countSelected(m));

          onRejectedCountChange?.([...m.values()].filter((s) => s === "rejected").length);

          return m;

        });

      } finally {

        setPending((prev) => {

          const nextPending = new Set(prev);

          nextPending.delete(tag.key);

          return nextPending;

        });

      }

    },

    [states, pending, saving, deferSave, notifyDirty, onCountChange, onRejectedCountChange],

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



  const previewGenreTags = genres

    .filter((t) => {

      const s = states.get(t.key);

      return s === "selected" || s === "rejected";

    })

    .slice(0, previewLimit);



  const previewOriginTags = origins.filter((t) => {

    const s = states.get(t.key);

    return s === "selected" || s === "rejected";

  });



  const visibleGenres = (() => {

    if (mode === "preview") return previewGenreTags;

    const base = collapsed ? genres.filter((t) => states.has(t.key)) : genres;

    if (orderKey && lastOrderKeyRef.current === orderKey && genreOrderRef.current.length > 0) {

      return genreOrderRef.current;

    }

    if (filter) return sortForFilter(base, states);

    return base;

  })();



  const visibleOrigins = (() => {

    if (mode === "preview") return previewOriginTags;

    const base = collapsed ? origins.filter((t) => states.has(t.key)) : origins;

    if (orderKey && lastOrderKeyRef.current === orderKey && originOrderRef.current.length > 0) {

      return originOrderRef.current;

    }

    if (filter) return sortForFilter(base, states);

    return base;

  })();



  const renderChip = (tag: PreferenceTag, i: number) => {

    const state = states.get(tag.key) ?? "none";

    const isPending = pending.has(tag.key);

    const interactive = !readOnly && mode === "full";



    const chipClass = `relative flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-sans font-medium transition-all duration-200 border ${

      state === "selected"

        ? "bg-primary/15 border-primary text-primary neon-glow"

        : state === "rejected"

        ? "bg-destructive/10 border-destructive/40 text-destructive"

        : "bg-card/50 border-border/20 text-foreground/50 hover:border-primary/30 hover:text-foreground/70"

    } ${isPending || saving ? "opacity-60" : ""}`;



    if (!interactive) {

      return (

        <span key={tag.key} className={chipClass}>

          {state === "rejected" && <Ban className="w-2.5 h-2.5 shrink-0" />}

          <span>{tag.label}</span>

        </span>

      );

    }



    return (

      <motion.button

        key={tag.key}

        initial={{ opacity: 0, scale: 0.92 }}

        animate={{ opacity: 1, scale: 1 }}

        transition={{ delay: i * 0.02, duration: 0.2 }}

        whileTap={{ scale: 0.93 }}

        onClick={() => toggle(tag)}

        disabled={isPending || saving}

        className={chipClass}

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



  if (mode === "preview" && previewGenreTags.length === 0 && previewOriginTags.length === 0) return null;

  if (mode === "full" && collapsed && visibleGenres.length === 0 && visibleOrigins.length === 0) return null;



  const selectedCount = countSelected(states);

  const rejectedCount = [...states.values()].filter((s) => s === "rejected").length;



  const showSectionHeaders = mode === "full" && !collapsed;

  const showGenreHeader = visibleGenres.length > 0 && visibleOrigins.length > 0 && (showSectionHeaders || mode === "preview");

  const showOriginHeader = visibleOrigins.length > 0 && (showSectionHeaders || mode === "preview");

  const originsFirst = visibleOrigins.length > 0 && (mode === "preview" || !!filter);



  const renderSection = (

    items: PreferenceTag[],

    header: string | null,

    offset: number,

  ) => (

    <div>

      {header && (

        <p className="text-[9px] font-sans text-foreground/40 uppercase tracking-widest mb-2">

          {header}

        </p>

      )}

      <div className={`flex flex-wrap gap-2 ${mode === "full" && collapsed ? "max-h-[108px] overflow-hidden" : ""}`}>

        {items.map((tag, i) => renderChip(tag, offset + i))}

      </div>

    </div>

  );



  const originsSection = visibleOrigins.length > 0

    ? renderSection(

        visibleOrigins,

        showOriginHeader

          ? mode === "preview"

            ? "Langues d'origine"

            : "Langues d'origine · 1 clic = aimé · 2 clics = exclu"

          : null,

        visibleGenres.length,

      )

    : null;



  const genresSection = visibleGenres.length > 0

    ? renderSection(visibleGenres, showGenreHeader ? "Genres" : null, 0)

    : null;



  return (

    <div className="space-y-3">

      {originsFirst ? (

        <>

          {originsSection}

          {genresSection}

        </>

      ) : (

        <>

          {genresSection}

          {originsSection}

        </>

      )}



      {deferSave && mode === "full" && (

        <p className="text-[10px] font-sans text-foreground/45">

          Tes changements seront enregistrés avec le bouton en bas de la page.

        </p>

      )}



      {mode === "full" && !collapsed && !filter && (selectedCount > 0 || rejectedCount > 0) && (

        <p className="text-[10px] font-sans text-foreground/45 mt-1">

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

});



GenrePreferences.displayName = "GenrePreferences";



export default GenrePreferences;

