import { supabase } from "@/integrations/supabase/client";
import type { MovieDetail } from "@/lib/tmdb";

export async function addToWatchlist(movie: MovieDetail) {
  const mediaType = movie.first_air_date ? "tv" : "movie";
  const { error } = await supabase.from("watchlist").upsert({
    user_id: (await supabase.auth.getUser()).data.user?.id!,
    tmdb_id: movie.id,
    title: movie.title || movie.name || "Sans titre",
    poster_path: movie.poster_path,
    media_type: mediaType,
  }, { onConflict: "user_id,tmdb_id" });
  if (error) throw error;
}

export async function removeFromWatchlist(tmdbId: number) {
  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("tmdb_id", tmdbId)
    .eq("user_id", (await supabase.auth.getUser()).data.user?.id!);
  if (error) throw error;
}

export async function isInWatchlist(tmdbId: number): Promise<boolean> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return false;
  const { data } = await supabase
    .from("watchlist")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function getWatchlist() {
  const { data, error } = await supabase
    .from("watchlist")
    .select("*")
    .order("added_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
