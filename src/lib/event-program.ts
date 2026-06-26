import { supabase } from "@/integrations/supabase/client";
import { getDisplayTitle, type MovieDetail } from "@/lib/tmdb";
import { resolvePickMediaType } from "@/lib/event-final-pick";

/** Enregistre le film choisi sur une soirée (révélation surprise/timed). */
export async function programFilmForEvent(eventId: string, movie: MovieDetail): Promise<void> {
  const pickMediaType = resolvePickMediaType(movie);

  const { data: ci } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("tmdb_id", movie.id)
    .eq("media_type", pickMediaType)
    .maybeSingle();

  const { error } = await supabase
    .from("events")
    .update({
      final_pick_id: ci?.id ?? null,
      final_pick_title: getDisplayTitle(movie),
      final_pick_poster: movie.poster_path ?? null,
      final_pick_tmdb_id: movie.id,
      final_pick_media_type: pickMediaType,
      status: "done",
    })
    .eq("id", eventId);

  if (error) throw error;
}
