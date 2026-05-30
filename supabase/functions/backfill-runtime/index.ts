import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { batchSize = 100, mediaType = "movie" } =
    req.method === "POST" ? await req.json().catch(() => ({})) : {};

  // Récupère le prochain batch de films sans runtime
  let query = supabase
    .from("movie_embeddings")
    .select("tmdb_id, media_type, title")
    .is("runtime", null)
    .order("tmdb_id", { ascending: true })
    .limit(batchSize);

  if (mediaType !== "both") query = query.eq("media_type", mediaType);

  const { data: films, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!films || films.length === 0) {
    return new Response(
      JSON.stringify({ message: "Backfill terminé — aucun film restant.", remaining: 0, updated: 0, errors: 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let updated = 0;
  let errors = 0;
  let skipped = 0;

  for (const film of films) {
    const type = film.media_type === "tv" ? "tv" : "movie";
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/${type}/${film.tmdb_id}?api_key=${TMDB_API_KEY}&language=fr-FR`,
      );
      if (res.status === 404) {
        // Marquer comme traité (runtime=0) pour éviter de re-boucler indéfiniment
        await supabase.from("movie_embeddings").update({ runtime: 0 }).eq("tmdb_id", film.tmdb_id);
        skipped++;
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      if (!res.ok) { errors++; await new Promise((r) => setTimeout(r, 300)); continue; }
      const detail = await res.json();

      const runtime = type === "tv"
        ? (detail.episode_run_time?.[0] || null)
        : (detail.runtime || null);

      if (!runtime) {
        // Marquer comme traité (runtime=0) pour éviter de re-boucler
        await supabase.from("movie_embeddings").update({ runtime: 0 }).eq("tmdb_id", film.tmdb_id);
        skipped++;
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }

      const { error: patchError } = await supabase
        .from("movie_embeddings")
        .update({ runtime })
        .eq("tmdb_id", film.tmdb_id);

      if (patchError) { errors++; } else { updated++; }

      await new Promise((r) => setTimeout(r, 300));
    } catch {
      errors++;
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // Compte combien il en reste
  let countQuery = supabase
    .from("movie_embeddings")
    .select("*", { count: "exact", head: true })
    .is("runtime", null);
  if (mediaType !== "both") countQuery = countQuery.eq("media_type", mediaType);
  const { count: remaining } = await countQuery;

  console.log(`[BACKFILL-RUNTIME] updated=${updated} skipped=${skipped} errors=${errors} remaining=${remaining ?? "?"}`);

  return new Response(
    JSON.stringify({ updated, skipped, errors, remaining: remaining ?? -1, processed: films.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
