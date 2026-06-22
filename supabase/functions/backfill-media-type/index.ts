import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAdmin } from "../_shared/auth.ts";
import { tmdbUrl } from "../_shared/tmdb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const CONCURRENCY = 5; // appels TMDB simultanés

async function checkAndFix(
  supabase: any,
  film: { tmdb_id: number; title: string },
): Promise<"confirmed" | "corrected" | "error"> {
  try {
    const movieRes = await fetch(tmdbUrl(`/movie/${film.tmdb_id}`, { language: "fr-FR" }));
    if (movieRes.ok) return "confirmed";

    // /movie null ou 404 → tester /tv
    const tvRes = await fetch(tmdbUrl(`/tv/${film.tmdb_id}`, { language: "fr-FR" }));
    if (!tvRes.ok) {
      console.warn(`[backfill] Introuvable movie ni tv: ${film.tmdb_id} "${film.title}"`);
      return "error";
    }

    const { error: patchError } = await supabase
      .from("movie_embeddings")
      .update({ media_type: "tv" })
      .eq("tmdb_id", film.tmdb_id);

    if (patchError) {
      console.error(`[backfill] Patch error ${film.tmdb_id}: ${patchError.message}`);
      return "error";
    }
    console.log(`[backfill] Corrigé: "${film.title}" (${film.tmdb_id}) movie → tv`);
    return "corrected";
  } catch (e) {
    console.error(`[backfill] Exception ${film.tmdb_id}:`, e);
    return "error";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const adminAuth = await requireAdmin(req, corsHeaders);
  if (adminAuth.response) return adminAuth.response;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { batchSize = 200, offset = 0 } =
    req.method === "POST" ? await req.json().catch(() => ({})) : {};

  const { data: films, error } = await supabase
    .from("movie_embeddings")
    .select("tmdb_id, title")
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
      JSON.stringify({ message: "Backfill terminé — plus rien à vérifier.", checked: 0, corrected: 0, errors: 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let confirmed = 0;
  let corrected = 0;
  let errors = 0;

  // Traitement par groupes de CONCURRENCY appels simultanés
  for (let i = 0; i < films.length; i += CONCURRENCY) {
    const chunk = films.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map((f: any) => checkAndFix(supabase, f)));
    for (const r of results) {
      if (r === "confirmed") confirmed++;
      else if (r === "corrected") corrected++;
      else errors++;
    }
    // Pause courte entre groupes pour respecter le rate-limit TMDB (~40 req/s)
    if (i + CONCURRENCY < films.length) {
      await new Promise((r) => setTimeout(r, 150));
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
