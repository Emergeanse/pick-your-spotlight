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

  const { batchSize = 50, offset = 0 } =
    req.method === "POST" ? await req.json().catch(() => ({})) : {};

  // Récupère les enregistrements stockés comme "movie" — ce sont les seuls potentiellement faux
  const { data: films, error } = await supabase
    .from("movie_embeddings")
    .select("tmdb_id, title, media_type")
    .eq("media_type", "movie")
    .order("tmdb_id", { ascending: true })
    .range(offset, offset + batchSize - 1);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!films || films.length === 0) {
    return new Response(
      JSON.stringify({ message: "Backfill terminé — aucun enregistrement restant à vérifier.", checked: 0, corrected: 0, errors: 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let corrected = 0;
  let confirmed = 0;
  let errors = 0;

  for (const film of films) {
    try {
      // Tester d'abord /movie/{id}
      const movieRes = await fetch(
        `https://api.themoviedb.org/3/movie/${film.tmdb_id}?api_key=${TMDB_API_KEY}&language=fr-FR`,
      );

      if (movieRes.ok) {
        // C'est bien un film — rien à corriger
        confirmed++;
        await new Promise((r) => setTimeout(r, 150));
        continue;
      }

      // /movie retourne null ou 404 : tester /tv/{id}
      const tvRes = await fetch(
        `https://api.themoviedb.org/3/tv/${film.tmdb_id}?api_key=${TMDB_API_KEY}&language=fr-FR`,
      );

      if (tvRes.ok) {
        // C'est une série stockée à tort comme "movie" — corriger
        const { error: patchError } = await supabase
          .from("movie_embeddings")
          .update({ media_type: "tv" })
          .eq("tmdb_id", film.tmdb_id);

        if (patchError) {
          console.error(`[backfill] Patch error tmdb_id=${film.tmdb_id}: ${patchError.message}`);
          errors++;
        } else {
          console.log(`[backfill] Corrigé: "${film.title}" (${film.tmdb_id}) movie → tv`);
          corrected++;
        }
      } else {
        // Introuvable sur TMDB (movie ni tv) — on laisse tel quel
        console.warn(`[backfill] Introuvable sur TMDB: tmdb_id=${film.tmdb_id} "${film.title}"`);
        errors++;
      }

      await new Promise((r) => setTimeout(r, 150));
    } catch (e) {
      console.error(`[backfill] Exception tmdb_id=${film.tmdb_id}:`, e);
      errors++;
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return new Response(
    JSON.stringify({
      message: `Batch terminé (offset=${offset}, size=${batchSize})`,
      checked: films.length,
      confirmed_movies: confirmed,
      corrected_to_tv: corrected,
      errors,
      next_offset: offset + films.length,
      has_more: films.length === batchSize,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
