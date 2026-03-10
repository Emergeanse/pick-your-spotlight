import { supabase } from "@/integrations/supabase/client";
import type { MovieDetail } from "@/lib/tmdb";

export async function likeMovie(movie: MovieDetail) {
  const genres = (movie.genres || []).map(g => g.name);
  const { error } = await supabase.from("liked_movies").upsert({
    user_id: (await supabase.auth.getUser()).data.user?.id,
    tmdb_id: movie.id,
    title: movie.title || movie.name || "Sans titre",
    genres,
    poster_path: movie.poster_path,
  }, { onConflict: "user_id,tmdb_id" });
  if (error) throw error;
}

export async function unlikeMovie(tmdbId: number) {
  const { error } = await supabase
    .from("liked_movies")
    .delete()
    .eq("tmdb_id", tmdbId)
    .eq("user_id", (await supabase.auth.getUser()).data.user?.id!);
  if (error) throw error;
}

export async function isMovieLiked(tmdbId: number): Promise<boolean> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return false;
  const { data } = await supabase
    .from("liked_movies")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function getLikedMovies() {
  const { data, error } = await supabase
    .from("liked_movies")
    .select("*")
    .order("liked_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
