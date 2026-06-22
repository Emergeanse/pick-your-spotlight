import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAdmin } from "../_shared/auth.ts";
import { tmdbUrl } from "../_shared/tmdb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const adminAuth = await requireAdmin(req, corsHeaders);
  if (adminAuth.response) return adminAuth.response;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { batchSize = 100 } = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  const { data: films, error } = await supabase
    .from("movie_embeddings")
    .select("tmdb_id, media_type, year")
    .is("original_language", null)
    .order("tmdb_id", { ascending: true })
    .limit(batchSize);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!films || films.length === 0) {
    return new Response(JSON.stringify({ message: "Backfill terminé — aucun film restant.", remaining: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let updated = 0;
  let errors = 0;

  for (const film of films) {
    const type = film.media_type === "tv" ? "tv" : "movie";
    try {
      const res = await fetch(tmdbUrl(`/${type}/${film.tmdb_id}`));
      if (!res.ok) { errors++; continue; }
      const detail = await res.json();

      const origLang = detail.original_language;
      if (!origLang) { errors++; continue; }

      const patch: Record<string, any> = { original_language: origLang };

      if (!film.year) {
        const dateStr = type === "tv" ? detail.first_air_date : detail.release_date;
        if (dateStr && dateStr.length >= 4) {
          patch.year = parseInt(dateStr.substring(0, 4), 10);
        }
      }

      const { error: patchError } = await supabase
        .from("movie_embeddings")
        .update(patch)
        .eq("tmdb_id", film.tmdb_id);

      if (patchError) { errors++; } else { updated++; }

      await new Promise((r) => setTimeout(r, 80));
    } catch {
      errors++;
    }
  }

  const { count: remaining } = await supabase
    .from("movie_embeddings")
    .select("*", { count: "exact", head: true })
    .is("original_language", null);

  console.log(`[BACKFILL] updated=${updated} errors=${errors} remaining=${remaining ?? "?"}`);

  return new Response(
    JSON.stringify({ updated, errors, remaining: remaining ?? -1, processed: films.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
