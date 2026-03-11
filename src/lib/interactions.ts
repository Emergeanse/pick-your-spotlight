import { supabase } from "@/integrations/supabase/client";

export type ActionType = 
  | "liked" 
  | "unliked" 
  | "saved" 
  | "unsaved" 
  | "watched" 
  | "skipped" 
  | "opened" 
  | "searched";

interface InteractionContext {
  mood?: string;
  context?: string;
  time?: string;
  source?: string;
  [key: string]: unknown;
}

export async function trackInteraction(
  tmdbId: number,
  actionType: ActionType,
  context: InteractionContext = {}
) {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    await supabase.from("user_interactions" as any).insert({
      user_id: userId,
      tmdb_id: tmdbId,
      action_type: actionType,
      context,
    } as any);
  } catch (e) {
    console.error("Failed to track interaction:", e);
  }
}

export async function getUserTasteProfile() {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return null;

  // Get liked movies with genres
  const { data: likedMovies } = await supabase
    .from("liked_movies")
    .select("tmdb_id, genres, title")
    .eq("user_id", userId);

  // Get recent interactions
  const { data: interactions } = await supabase
    .from("user_interactions" as any)
    .select("tmdb_id, action_type, context, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100) as any;

  // Get profile preferences
  const { data: profile } = await supabase
    .from("profiles")
    .select("favorite_genres, preferred_platforms")
    .eq("id", userId)
    .single();

  // Build genre frequency map
  const genreCounts: Record<string, number> = {};
  (likedMovies || []).forEach(m => {
    (m.genres || []).forEach(g => {
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });
  });

  // Count interaction signals
  const skipCount = (interactions || []).filter(i => i.action_type === "skipped").length;
  const watchCount = (interactions || []).filter(i => i.action_type === "watched").length;
  const likeCount = (likedMovies || []).length;

  // Get skipped movie IDs to exclude
  const skippedIds = (interactions || [])
    .filter(i => i.action_type === "skipped")
    .map(i => i.tmdb_id);

  const watchedIds = (interactions || [])
    .filter(i => i.action_type === "watched")
    .map(i => i.tmdb_id);

  const likedIds = (likedMovies || []).map(m => m.tmdb_id);

  const topGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([g]) => g);

  return {
    topGenres,
    genreCounts,
    likedTitles: (likedMovies || []).map(m => m.title).slice(0, 15),
    likedIds,
    skippedIds,
    watchedIds,
    excludeIds: [...new Set([...skippedIds, ...watchedIds, ...likedIds])],
    preferredPlatforms: profile?.preferred_platforms || [],
    stats: { likeCount, watchCount, skipCount },
  };
}
