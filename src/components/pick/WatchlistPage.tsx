import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Bookmark, Heart, Loader2, Sparkles, X, Clock, Search, ThumbsDown, ThumbsUp, Trash2, CheckCircle, SlidersHorizontal } from "lucide-react";
import { getWatchlist, removeFromWatchlist } from "@/lib/watchlist";
import { getPosterUrl, getMovieDetails } from "@/lib/tmdb";
import type { MovieDetail } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import PickCharacter from "./PickCharacter";
import FeedbackBadge from "./FeedbackBadge";
import FlipCardDetail from "./FlipCardDetail";
import { useMovieInteractions } from "@/hooks/use-movie-interactions";
import { listFeedbackByType, clearFeedbackType, type FeedbackType, type MovieInteractionState } from "@/lib/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";


interface WatchlistPageProps {
  onMovieSelect: (movie: MovieDetail) => void;
  tabs?: ActiveTab[];        // onglets à afficher (défaut : tous)
  title?: string;            // titre de la page
  defaultTab?: ActiveTab;    // onglet actif au démarrage
}

type MediaFilter = "all" | "movie" | "tv";
type ActiveTab = "watchlist" | "liked" | "loved" | "seen" | "disliked";

const DISLIKE_LABELS: Record<string, string> = {
  skip: "Pas dans le mood",
  not_for_me: "Pas pour moi",
  dislike: "Pas aimé",
};

const mapCatalogRow = (row: any, feedbackType?: string): any | null => {
  if (!row?.catalog_items) return null;
  return {
    id: row.item_id,
    tmdb_id: row.catalog_items.tmdb_id,
    title: row.catalog_items.title,
    poster_path: row.catalog_items.poster_path,
    media_type: row.catalog_items.media_type,
    runtime: row.catalog_items.runtime,
    overview: row.catalog_items.overview,
    vote_average: row.catalog_items.vote_average,
    genres: [] as string[],
    added_at: row.created_at,
    feedback_type: feedbackType ?? row.feedback_type,
  };
};

const getPickBubbleMessage = (tab: ActiveTab, count: number, hour: number): string => {
  if (count === 0) return "";
  if (tab === "liked") return `${count} titre${count > 1 ? "s" : ""} aimé${count > 1 ? "s" : ""} au pouce. Pick s'en souvient !`;
  if (tab === "loved") return `${count} coup${count > 1 ? "s" : ""} de cœur. Tes vrais favoris sont ici.`;
  if (tab === "seen") return `${count} titre${count > 1 ? "s" : ""} déjà vu${count > 1 ? "s" : ""}. Tu en as parcouru du chemin !`;
  if (tab === "disliked") return `${count} titre${count > 1 ? "s" : ""} écarté${count > 1 ? "s" : ""}. Pick les évite pour toi.`;
  if (hour >= 18 || hour < 4) return `${count} titre${count > 1 ? "s" : ""} t'attend${count > 1 ? "ent" : ""}. Lequel ce soir ?`;
  if (hour >= 12) return `Tu as ${count} titre${count > 1 ? "s" : ""} en attente. Prépare ta soirée !`;
  return `${count} titre${count > 1 ? "s" : ""} dans ta liste. On en parle ce soir ?`;
};

const COMMENTS: Record<ActiveTab, string[]> = {
  watchlist: [
    "Tu l'as sauvegardé, c'est qu'il te fait de l'œil.",
    "Parfait pour un soir de semaine.",
    "Un classique à ne pas rater.",
    "Celui-ci attend son moment depuis un moment.",
    "Idéal pour une soirée tranquille.",
  ],
  liked: [
    "Tu lui as mis un pouce — bon signe.",
    "Ça t'a plu, Pick s'en souvient.",
    "Un titre qui t'a parlé.",
    "Noté dans tes goûts.",
    "Pick affine ses recommandations grâce à toi.",
  ],
  loved: [
    "Un vrai coup de cœur.",
    "Tu as adoré celui-là !",
    "Dans tes classiques personnels.",
    "Un favori absolu.",
    "Un titre qui t'a marqué.",
  ],
  seen: [
    "Déjà dans tes archives.",
    "Tu l'as regardé — un souvenir de ciné.",
    "Vu et retenu.",
    "Fait partie de ton parcours.",
    "Tu peux en parler maintenant !",
  ],
  disliked: [
    "Pick ne le reproposera plus.",
    "Écarté de tes recommandations.",
    "Pas pour toi — c'est noté.",
    "Pick a retenu la leçon.",
    "Ce genre n'est pas le tien.",
  ],
};

const TAB_CONFIG: Record<ActiveTab, { label: string; icon: React.ReactNode; color: string }> = {
  watchlist: { label: "À voir", icon: <Bookmark className="w-3.5 h-3.5" />, color: "text-blue-400" },
  liked: { label: "Aimés", icon: <ThumbsUp className="w-3.5 h-3.5" />, color: "text-primary" },
  loved: { label: "Adorés", icon: <Heart className="w-3.5 h-3.5" />, color: "text-rose-400" },
  seen: { label: "Vus", icon: <CheckCircle className="w-3.5 h-3.5" />, color: "text-emerald-400" },
  disliked: { label: "Écartés", icon: <ThumbsDown className="w-3.5 h-3.5" />, color: "text-foreground/45" },
};

const CARD_COLORS = [
  { bg: "bg-violet-500/10 border-violet-500/20",  hover: "hover:bg-violet-500/15" },
  { bg: "bg-blue-500/10 border-blue-500/20",       hover: "hover:bg-blue-500/15" },
  { bg: "bg-rose-500/10 border-rose-500/20",       hover: "hover:bg-rose-500/15" },
  { bg: "bg-amber-500/10 border-amber-500/20",     hover: "hover:bg-amber-500/15" },
];

const SwipeableCard = ({
  item,
  index,
  tab,
  onSelect,
  onRemove,
  interaction,
}: {
  item: any;
  index: number;
  tab: ActiveTab;
  onSelect: () => void;
  onRemove: () => void;
  interaction?: MovieInteractionState;
}) => {
  const x = useMotionValue(0);
  const removeBgOpacity = useTransform(x, [-120, 0], [1, 0]);
  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -100) onRemove();
  };
  const comment = COMMENTS[tab][index % COMMENTS[tab].length];
  const mediaType = item.media_type || (item.first_air_date ? "tv" : "movie");
  const isDisliked = tab === "disliked";
  const colorScheme = CARD_COLORS[index % CARD_COLORS.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="relative overflow-hidden rounded-2xl"
    >
      <motion.div
        style={{ opacity: removeBgOpacity }}
        className="absolute inset-0 bg-destructive/20 flex items-center justify-end pr-5 rounded-2xl"
      >
        <span className="text-destructive text-xs font-sans font-medium">Retirer</span>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={`relative flex items-start gap-3.5 p-3.5 rounded-2xl border backdrop-blur-sm transition-colors ${
          isDisliked
            ? "bg-card/15 border-border/10 hover:bg-card/25"
            : `${colorScheme.bg} ${colorScheme.hover}`
        }`}
      >
        <button onClick={onSelect} className="flex items-start gap-3.5 flex-1 min-w-0 text-left">
          <div className="relative shrink-0">
            {item.poster_path ? (
              <img
                src={getPosterUrl(item.poster_path, "w185")}
                alt={item.title}
                className={`w-14 h-[84px] rounded-lg object-cover border border-border/20 ${isDisliked ? "opacity-50 grayscale" : ""}`}
                loading="lazy"
              />
            ) : (
              <div className={`w-14 h-[84px] rounded-lg bg-foreground/5 ${isDisliked ? "opacity-40" : ""}`} />
            )}
            {interaction?.hasInteraction && !isDisliked && (
              <div className="absolute -top-1 -left-1">
                <FeedbackBadge type={interaction.primaryStatus} inWatchlist={interaction.watchlist} seen={interaction.seen} />
              </div>
            )}
            {isDisliked && item.feedback_type && (
              <div className="absolute -bottom-1 left-0 right-0 flex justify-center">
                <span className="text-[8px] font-sans text-foreground/45 bg-background/80 px-1.5 py-0.5 rounded-full border border-border/10 leading-none">
                  {DISLIKE_LABELS[item.feedback_type] ?? item.feedback_type}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 py-0.5">
            <p className={`text-[13.5px] font-sans font-semibold line-clamp-1 mb-1 ${isDisliked ? "text-foreground/40" : "text-foreground"}`}>
              {item.title}
            </p>
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-[11px] text-foreground/45 font-sans capitalize">
                {mediaType === "tv" ? "Série" : "Film"}
              </p>
              {item.runtime && (
                <span className="text-[11px] text-foreground/45 font-sans flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {item.runtime} min
                </span>
              )}
              {item.vote_average > 0 && (
                <span className="text-[11px] text-foreground/45 font-sans">
                  ★ {item.vote_average.toFixed(1)}
                </span>
              )}
            </div>

            {item.genres && item.genres.length > 0 && (
              <div className="flex gap-1 flex-wrap mb-1.5">
                {item.genres.slice(0, 2).map((g: string) => (
                  <span key={g} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/60 font-sans font-medium">
                    {g}
                  </span>
                ))}
              </div>
            )}

            <p className={`text-[10.5px] font-sans italic line-clamp-1 ${isDisliked ? "text-foreground/35" : "text-primary/55"}`}>
              {comment}
            </p>
          </div>
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="shrink-0 self-center w-8 h-8 rounded-full flex items-center justify-center text-foreground/45 hover:text-destructive hover:bg-destructive/10 transition-all active:scale-90"
          aria-label="Supprimer"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </motion.div>
  );
};

async function hydrateMissingPosters(
  groups: { items: any[]; setter: React.Dispatch<React.SetStateAction<any[]>> }[],
) {
  const seen = new Map<string, { mediaType: "movie" | "tv"; tmdbId: number }>();
  for (const { items } of groups) {
    for (const it of items) {
      if (it && it.tmdb_id && (!it.poster_path || !it.title || /^TMDB #\d+$/.test(String(it.title)) || !it.genres || it.genres.length === 0)) {
        const mt = (it.media_type || (it.first_air_date ? "tv" : "movie")) as "movie" | "tv";
        seen.set(`${it.tmdb_id}:${mt}`, { mediaType: mt, tmdbId: it.tmdb_id });
      }
    }
  }
  if (seen.size === 0) return;

  const resolved = new Map<string, string | null>();
  const resolvedTitle = new Map<string, string | null>();
  const resolvedGenres = new Map<string, string[]>();

  await Promise.all(
    Array.from(seen.values()).map(async ({ tmdbId, mediaType }) => {
      try {
        const detail = await getMovieDetails(tmdbId, mediaType);
        const key = `${tmdbId}:${mediaType}`;
        resolved.set(key, detail?.poster_path ?? null);
        resolvedTitle.set(key, detail?.title || (detail as any).name || null);
        resolvedGenres.set(key, (detail?.genres || []).map((g: any) => g.name));
      } catch {
        const key = `${tmdbId}:${mediaType}`;
        resolved.set(key, null);
        resolvedTitle.set(key, null);
        resolvedGenres.set(key, []);
      }
    }),
  );

  for (const { items, setter } of groups) {
    let changed = false;
    const next = items.map((it: any) => {
      if (!it?.tmdb_id) return it;
      const mt = it.media_type || (it.first_air_date ? "tv" : "movie");
      const key = `${it.tmdb_id}:${mt}`;
      const updated = { ...it };
      if (!it.poster_path && resolved.has(key)) {
        const p = resolved.get(key);
        if (p) { updated.poster_path = p; changed = true; }
      }
      if ((!it.title || /^TMDB #\d+$/.test(String(it.title))) && resolvedTitle.has(key)) {
        const t = resolvedTitle.get(key);
        if (t) { updated.title = t; changed = true; }
      }
      if ((!it.genres || it.genres.length === 0) && resolvedGenres.has(key)) {
        const g = resolvedGenres.get(key);
        if (g && g.length > 0) { updated.genres = g; changed = true; }
      }
      return updated;
    });
    if (changed) setter(next);
  }

  try {
    await Promise.all(
      Array.from(resolved.entries())
        .filter(([, p]) => !!p)
        .map(([key, p]) => {
          const [tmdbIdStr, mt] = key.split(":");
          const title = resolvedTitle.get(key);
          const updates: Record<string, unknown> = { poster_path: p };
          if (title) updates.title = title;
          return supabase
            .from("catalog_items")
            .update(updates)
            .eq("tmdb_id", Number(tmdbIdStr))
            .eq("media_type", mt)
            .is("poster_path", null);
        }),
    );
  } catch {
    // ignore — UI hydration already happened
  }
}

const ALL_TABS: ActiveTab[] = ["watchlist", "liked", "loved", "seen", "disliked"];

const WatchlistPage = ({ tabs: allowedTabs, title, defaultTab }: WatchlistPageProps) => {
  const visibleTabs = allowedTabs ?? ALL_TABS;
  const [activeTab, setActiveTab] = useState<ActiveTab>(defaultTab ?? visibleTabs[0]);
  const [watchlistItems, setWatchlistItems] = useState<any[]>([]);
  const [likedItems, setLikedItems] = useState<any[]>([]);
  const [lovedItems, setLovedItems] = useState<any[]>([]);
  const [seenItems, setSeenItems] = useState<any[]>([]);
  const [dislikedItems, setDislikedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailMovie, setDetailMovie] = useState<MovieDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  useEffect(() => {
    loadData();
    if (!localStorage.getItem("pick_swipe_hint_seen")) {
      const t = setTimeout(() => {
        setShowSwipeHint(true);
        setTimeout(() => {
          setShowSwipeHint(false);
          localStorage.setItem("pick_swipe_hint_seen", "1");
        }, 2800);
      }, 900);
      return () => clearTimeout(t);
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const needs = (tab: ActiveTab) => visibleTabs.includes(tab);
      const primaryTab = defaultTab ?? visibleTabs[0];

      // ── Passe 1 : onglet actif uniquement ──
      const loadPrimary = async () => {
        if (primaryTab === "loved"    && needs("loved"))    return { loved:    (await listFeedbackByType("love")).map((r: any) => mapCatalogRow(r, "love")).filter(Boolean) };
        if (primaryTab === "liked"    && needs("liked"))    return { liked:    (await listFeedbackByType("like")).map((r: any) => mapCatalogRow(r, "like")).filter(Boolean) };
        if (primaryTab === "watchlist"&& needs("watchlist"))return { watchlist: await getWatchlist() };
        if (primaryTab === "seen"     && needs("seen"))     return { seen:     (await listFeedbackByType("seen")).map((r: any) => mapCatalogRow(r, "seen")).filter(Boolean) };
        return {};
      };

      const primary = await loadPrimary();
      if (primary.loved)     setLovedItems(primary.loved as any[]);
      if (primary.liked)     setLikedItems(primary.liked as any[]);
      if (primary.watchlist) setWatchlistItems(primary.watchlist as any[]);
      if (primary.seen)      setSeenItems(primary.seen as any[]);

      // Si l'onglet prioritaire est vide, charger le fallback AVANT d'afficher
      const primaryItems = primary.loved ?? primary.liked ?? primary.watchlist ?? primary.seen ?? [];
      if ((primaryItems as any[]).length === 0) {
        const fallbackOrder: ActiveTab[] = ["liked", "watchlist", "seen", "disliked"];
        const fallback = fallbackOrder.find(t => visibleTabs.includes(t) && t !== primaryTab);
        if (fallback) {
          if (fallback === "liked" && needs("liked")) {
            const likedFallback = (await listFeedbackByType("like")).map((r: any) => mapCatalogRow(r, "like")).filter(Boolean) as any[];
            setLikedItems(likedFallback);
          } else if (fallback === "watchlist" && needs("watchlist")) {
            setWatchlistItems(await getWatchlist() as any[]);
          } else if (fallback === "seen" && needs("seen")) {
            const seenFallback = (await listFeedbackByType("seen")).map((r: any) => mapCatalogRow(r, "seen")).filter(Boolean) as any[];
            setSeenItems(seenFallback);
          }
          setActiveTab(fallback);
        }
      }

      setLoading(false);

      // ── Passe 2 : reste en arrière-plan ──
      const [watchlist, likedRaw, lovedRaw, seenRaw, { data: rejectedRaw }] = await Promise.all([
        needs("watchlist") && !primary.watchlist ? getWatchlist()                  : Promise.resolve(primary.watchlist ?? []),
        needs("liked")     && !primary.liked     ? listFeedbackByType("like")      : Promise.resolve(primary.liked    ?? []),
        needs("loved")     && !primary.loved     ? listFeedbackByType("love")      : Promise.resolve(primary.loved    ?? []),
        needs("seen")      && !primary.seen      ? listFeedbackByType("seen")      : Promise.resolve(primary.seen     ?? []),
        needs("disliked") && user
          ? supabase.from("user_item_feedback")
              .select("item_id, feedback_type, score, created_at, catalog_items:item_id(id, tmdb_id, title, poster_path, media_type, year, runtime, overview, vote_average)")
              .eq("user_id", user.id).in("feedback_type", ["skip", "not_for_me", "dislike"]).order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

      // Si primary contient déjà les données mappées, on les réutilise directement
      const likedList    = primary.liked    ? (primary.liked    as any[]) : (likedRaw  as any[]).map((r: any) => mapCatalogRow(r, "like")).filter(Boolean) as any[];
      const lovedList    = primary.loved    ? (primary.loved    as any[]) : (lovedRaw  as any[]).map((r: any) => mapCatalogRow(r, "love")).filter(Boolean) as any[];
      const seenList     = primary.seen     ? (primary.seen     as any[]) : (seenRaw   as any[]).map((r: any) => mapCatalogRow(r, "seen")).filter(Boolean) as any[];
      const seenTmdbIds  = new Set<number>();
      const dislikedList = ((rejectedRaw as any[]) || [])
        .map((r: any) => mapCatalogRow(r)).filter(Boolean)
        .filter((item: any) => { if (!item?.tmdb_id || seenTmdbIds.has(item.tmdb_id)) return false; seenTmdbIds.add(item.tmdb_id); return true; }) as any[];

      setWatchlistItems(watchlist as any[]);
      setLikedItems(likedList);
      setLovedItems(lovedList);
      setSeenItems(seenList);
      setDislikedItems(dislikedList);

      hydrateMissingPosters([
        { items: watchlist as any[], setter: setWatchlistItems },
        { items: likedList,          setter: setLikedItems },
        { items: lovedList,          setter: setLovedItems },
        { items: seenList,           setter: setSeenItems },
        { items: dislikedList,       setter: setDislikedItems },
      ]);
    } catch {
      setWatchlistItems([]); setLikedItems([]); setLovedItems([]); setSeenItems([]); setDislikedItems([]);
      setLoading(false);
    }
  };

  const itemsByTab: Record<ActiveTab, any[]> = {
    watchlist: watchlistItems,
    liked: likedItems,
    loved: lovedItems,
    seen: seenItems,
    disliked: dislikedItems,
  };

  const currentItems = itemsByTab[activeTab];

  // Genre filter uses ALL items across all tabs
  const availableGenres = useMemo(() => {
    const allItems = [...watchlistItems, ...likedItems, ...lovedItems, ...seenItems, ...dislikedItems];
    const genres = new Set<string>();
    allItems.forEach((item: any) => (item.genres || []).forEach((g: string) => genres.add(g)));
    return Array.from(genres).sort();
  }, [watchlistItems, likedItems, seenItems, dislikedItems]);

  const filteredItems = useMemo(() => {
    return currentItems.filter((item: any) => {
      if (mediaFilter !== "all") {
        const mt = item.media_type || (item.first_air_date ? "tv" : "movie");
        if (mt !== mediaFilter) return false;
      }
      if (searchQuery.trim()) {
        if (!item.title?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      if (genreFilter.length > 0 && (!item.genres || !genreFilter.some((g) => item.genres.includes(g)))) return false;
      return true;
    });
  }, [currentItems, mediaFilter, searchQuery, genreFilter]);

  const visibleTmdbIds = useMemo(() => filteredItems.map((i: any) => i.tmdb_id).filter(Boolean), [filteredItems]);
  const interactions = useMovieInteractions(visibleTmdbIds);

  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMediaFilter("all");
    setSearchQuery("");
    setGenreFilter([]);
  };

  const handleRemoveWatchlist = async (tmdbId: number) => {
    try {
      await removeFromWatchlist(tmdbId);
      setWatchlistItems((prev) => prev.filter((i) => i.tmdb_id !== tmdbId));
      toast.success("Retiré de ta liste");
    } catch { toast.error("Erreur"); }
  };

  const handleRemoveLiked = async (tmdbId: number) => {
    try {
      await clearFeedbackType(tmdbId, ["like"]);
      setLikedItems((prev) => prev.filter((i) => i.tmdb_id !== tmdbId));
      toast.success("Like retiré");
    } catch { toast.error("Erreur"); }
  };

  const handleRemoveLoved = async (tmdbId: number) => {
    try {
      await clearFeedbackType(tmdbId, ["love"]);
      setLovedItems((prev) => prev.filter((i) => i.tmdb_id !== tmdbId));
      toast.success("Retiré de tes adorés");
    } catch { toast.error("Erreur"); }
  };

  const handleRemoveSeen = async (tmdbId: number) => {
    try {
      await clearFeedbackType(tmdbId, ["seen"]);
      setSeenItems((prev) => prev.filter((i) => i.tmdb_id !== tmdbId));
      toast.success("Retiré de tes vus");
    } catch { toast.error("Erreur"); }
  };

  const handleRemoveDisliked = async (tmdbId: number) => {
    try {
      await clearFeedbackType(tmdbId, ["skip", "not_for_me", "dislike"]);
      setDislikedItems((prev) => prev.filter((i) => i.tmdb_id !== tmdbId));
      toast.success("Retiré");
    } catch { toast.error("Erreur"); }
  };

  const handleRemove = (item: any) => {
    const tmdbId = item.tmdb_id;
    if (activeTab === "watchlist") handleRemoveWatchlist(tmdbId);
    else if (activeTab === "liked") handleRemoveLiked(tmdbId);
    else if (activeTab === "loved") handleRemoveLoved(tmdbId);
    else if (activeTab === "seen") handleRemoveSeen(tmdbId);
    else handleRemoveDisliked(tmdbId);
  };

  const handleResetAll = async () => {
    if (!currentItems.length) return;
    setResetting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const targetType: FeedbackType[] =
        activeTab === "watchlist" ? ["watchlist"] :
        activeTab === "liked" ? ["like"] :
        activeTab === "loved" ? ["love"] :
        activeTab === "seen" ? ["seen"] :
        ["skip", "not_for_me", "dislike"];

      const { error } = await supabase
        .from("user_item_feedback")
        .delete()
        .eq("user_id", user.id)
        .in("feedback_type", targetType);

      if (error) throw error;

      if (activeTab === "watchlist") { setWatchlistItems([]); toast.success("Liste vidée"); }
      else if (activeTab === "liked") { setLikedItems([]); toast.success("Aimés réinitialisés"); }
      else if (activeTab === "loved") { setLovedItems([]); toast.success("Adorés réinitialisés"); }
      else if (activeTab === "seen") { setSeenItems([]); toast.success("Historique effacé"); }
      else { setDislikedItems([]); toast.success("Liste réinitialisée"); }
    } catch {
      toast.error("Erreur lors de la réinitialisation");
    } finally {
      setResetting(false);
      setShowResetConfirm(false);
    }
  };

  const handleOpenDetail = async (item: any) => {
    setDetailLoading(true);
    try {
      const mediaType = item.media_type || (item.first_air_date ? "tv" : "movie");
      const movie = await getMovieDetails(item.tmdb_id, mediaType);
      setDetailMovie(movie);
    } catch {
      toast.error("Impossible d'ouvrir la fiche");
    } finally {
      setDetailLoading(false);
    }
  };

  const hour = new Date().getHours();
  const bubbleMessage = getPickBubbleMessage(activeTab, currentItems.length, hour);

  const TABS = visibleTabs;

  const RESET_LABELS: Record<ActiveTab, { title: string; body: string; success: string }> = {
    watchlist: { title: "Vider ta liste ?", body: `${watchlistItems.length} titre${watchlistItems.length > 1 ? "s" : ""} seront supprimés.`, success: "Liste vidée" },
    liked: { title: "Réinitialiser tes aimés ?", body: `${likedItems.length} titre${likedItems.length > 1 ? "s" : ""} seront retirés.`, success: "Réinitialisé" },
    loved: { title: "Réinitialiser tes adorés ?", body: `${lovedItems.length} titre${lovedItems.length > 1 ? "s" : ""} seront retirés.`, success: "Réinitialisé" },
    seen: { title: "Effacer ton historique vu ?", body: `${seenItems.length} titre${seenItems.length > 1 ? "s" : ""} disparaîtront.`, success: "Effacé" },
    disliked: { title: "Réinitialiser les films écartés ?", body: `${dislikedItems.length} titre${dislikedItems.length > 1 ? "s" : ""} seront oubliés.`, success: "Réinitialisé" },
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto scrollbar-dark px-5 pt-4 pb-24">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
        <div className="flex gap-2 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 flex-1 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-lg mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-2 rounded-lg bg-white/[0.02]">
              <Skeleton className="h-24 w-16 rounded-md flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }


  return (
    <div className="h-full overflow-y-auto scrollbar-dark px-5 pt-4 pb-24">
      {/* Sticky header zone — keeps title + tabs visible while scrolling the list */}
      <div className="sticky -top-4 z-20 -mx-5 px-5 pt-3 pb-3 bg-gradient-to-b from-black/10 via-transparent to-transparent backdrop-blur-[2px]">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-serif leading-tight">{title ?? "Ma Collection"}</h1>
            <p className="text-foreground/50 text-[11px] font-sans mt-0.5 tabular-nums">
              {TABS.reduce((acc, t) => acc + (itemsByTab[t]?.length ?? 0), 0)} titres au total
            </p>
          </div>
          {currentItems.length > 0 && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-sans text-destructive/50 hover:text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Vider
            </button>
          )}
        </motion.div>

        {/* Tab bar + bubble sur la même ligne */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="flex items-center gap-2"
        >
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1 shrink-0">
            {TABS.map((tab) => {
              const count = itemsByTab[tab].length;
              const cfg = TAB_CONFIG[tab];
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-xl text-[12px] font-sans font-medium transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    active
                      ? "bg-white/[0.08] backdrop-blur-sm text-foreground border-white/[0.12]"
                      : "text-foreground/40 border-transparent hover:text-foreground/70 hover:bg-white/[0.06]"
                  }`}
                  aria-pressed={active}
                >
                  <span className={active ? cfg.color : ""}>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium tabular-nums ${
                    count === 0
                      ? "text-foreground/30"
                      : active ? "bg-primary/15 text-primary/80" : "bg-foreground/5 text-foreground/50"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {currentItems.length > 0 && (
            <motion.p
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-foreground/45 text-[11px] font-sans leading-tight min-w-0 truncate"
            >
              {bubbleMessage}
            </motion.p>
          )}
        </motion.div>
      </div>

      <div className="h-4" />

      {/* Filters */}
      {currentItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="space-y-2.5 mb-5"
        >
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/45" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un titre…"
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-white/[0.05] backdrop-blur-sm border border-white/[0.08] text-sm font-sans text-foreground placeholder:text-foreground/45 focus:outline-none focus:border-primary/30 transition-colors"
            />
          </div>

          {/* Filtres toggle row */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-sans font-medium border transition-all ${
                filtersOpen || genreFilter.length > 0 || mediaFilter !== "all"
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-card/40 border-border/15 text-foreground/50 hover:text-foreground/80"
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              Filtres
              {(genreFilter.length > 0 || mediaFilter !== "all") && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary/30 text-[9px]">
                  {genreFilter.length + (mediaFilter !== "all" ? 1 : 0)}
                </span>
              )}
            </button>

            {(genreFilter.length > 0 || mediaFilter !== "all") && (
              <button
                onClick={() => { setMediaFilter("all"); setGenreFilter([]); }}
                className="text-[10px] font-sans text-foreground/40 hover:text-foreground/70 transition-colors"
              >
                Réinitialiser
              </button>
            )}

            <p className="ml-auto text-[10px] font-sans text-foreground/45">
              {filteredItems.length} résultat{filteredItems.length > 1 ? "s" : ""}
            </p>
          </div>

          <AnimatePresence initial={false}>
            {filtersOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-1">
                  {/* Type chips */}
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                    {(["all", "movie", "tv"] as MediaFilter[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setMediaFilter(f)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-sans font-medium border transition-all ${
                          mediaFilter === f
                            ? "bg-primary/15 border-primary/30 text-primary"
                            : "bg-card/40 border-border/15 text-foreground/40 hover:text-foreground/60"
                        }`}
                      >
                        {f === "all" ? "Tout" : f === "movie" ? "Films" : "Séries"}
                      </button>
                    ))}
                  </div>

                  {/* Genre chips */}
                  {availableGenres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {availableGenres.map((g) => {
                        const active = genreFilter.includes(g);
                        return (
                          <button
                            key={g}
                            onClick={() =>
                              setGenreFilter((prev) =>
                                active ? prev.filter((x) => x !== g) : [...prev, g]
                              )
                            }
                            className={`px-3 py-1.5 rounded-full text-[11px] font-sans font-medium border transition-all ${
                              active
                                ? "bg-primary/15 border-primary/30 text-primary"
                                : "bg-card/40 border-border/15 text-foreground/50 hover:text-foreground/60"
                            }`}
                          >
                            {g}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Swipe hint — once only */}
      <AnimatePresence>
        {showSwipeHint && filteredItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-center gap-1.5 mb-3 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20 mx-auto w-fit"
          >
            <span className="text-[11px] font-sans text-destructive/70">← Glisser vers la gauche pour retirer</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Item list */}
      {currentItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <PickCharacter
            mood="wave"
            message={
              activeTab === "watchlist" ? "Sauvegarde des titres et retrouve-les ici !"
              : activeTab === "liked" ? "Mets un 👍 sur les films qui t'ont plu pour affiner tes recos !"
              : activeTab === "loved" ? "Mets un ❤️ sur tes vrais coups de cœur pour les retrouver ici !"
              : activeTab === "seen" ? "Marque ce que tu as déjà vu pour affiner tes recommandations !"
              : "Les films que tu écarteras apparaîtront ici — Pick ne les reproposera plus."
            }
            size="md"
            animate
          />
          <p className="text-foreground/45 text-xs font-sans mt-4">
            {activeTab === "watchlist" ? "Ta liste est vide"
            : activeTab === "liked" ? "Aucun film aimé"
            : activeTab === "loved" ? "Aucun coup de cœur"
            : activeTab === "seen" ? "Aucun titre marqué comme vu"
            : "Aucun titre écarté"}
          </p>
          {activeTab !== "disliked" && (
            <Button
              onClick={() => window.dispatchEvent(new CustomEvent("pick-navigate-home"))}
              className="mt-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-sans text-sm px-5 gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Trouve-moi un film
            </Button>
          )}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-foreground/45 text-sm font-sans">
            Aucun résultat{searchQuery ? ` pour "${searchQuery}"` : " avec ces filtres"}
          </p>
          <button
            onClick={() => { setMediaFilter("all"); setSearchQuery(""); setGenreFilter([]); }}
            className="mt-3 text-primary text-xs font-sans underline"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item, i) => (
            <SwipeableCard
              key={item.id}
              item={item}
              index={i}
              tab={activeTab}
              onSelect={() => handleOpenDetail(item)}
              onRemove={() => handleRemove(item)}
              interaction={interactions[item.tmdb_id]}
            />
          ))}
        </div>
      )}

      {/* Loading overlay */}
      <AnimatePresence>
        {detailLoading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
          >
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>



      <FlipCardDetail
        item={detailMovie}
        type="movie"
        isOpen={!!detailMovie}
        onClose={() => setDetailMovie(null)}
      />

      {/* Reset confirm */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowResetConfirm(false)} />
            <motion.div
              initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              transition={{ type: "spring", damping: 25 }}
              className="relative w-full max-w-lg rounded-t-2xl bg-card border-t border-border/20 p-6 pb-[calc(2rem+env(safe-area-inset-bottom))]"
            >
              <div className="w-10 h-1 rounded-full bg-border/30 mx-auto mb-5" />
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
                  <Trash2 className="w-5 h-5 text-destructive/60" />
                </div>
                <h3 className="text-base font-serif mb-1">{RESET_LABELS[activeTab].title}</h3>
                <p className="text-foreground/40 text-sm font-sans">{RESET_LABELS[activeTab].body} Cette action est irréversible.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 h-12 rounded-xl bg-card border border-border/20 text-foreground/60 font-sans text-sm font-medium hover:bg-card/80 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleResetAll}
                  disabled={resetting}
                  className="flex-1 h-12 rounded-xl bg-destructive/90 text-destructive-foreground font-sans text-sm font-medium hover:bg-destructive transition-colors flex items-center justify-center gap-2"
                >
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5" /> Tout supprimer</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WatchlistPage;
