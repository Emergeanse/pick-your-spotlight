import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

// Nombre de films traités en parallèle — TMDB tolère ~40 req/10s
const PARALLEL_BATCH = 20;

async function getProviderIdsFR(tmdbId: number, mediaType: "movie" | "tv"): Promise<number[]> {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    const fr = data?.results?.FR;
    if (!fr) return [];
    return [...(fr.flatrate || []), ...(fr.free || []), ...(fr.ads || [])].map((p: any) => Number(p.provider_id));
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase env vars");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const {
      // Mode refresh : true = re-vérifie tous les films, false = seulement les vides
      forceRefresh = false,
      // Taille du lot à traiter par appel (pour éviter le timeout des edge functions)
      batchSize = 200,
      // Offset pour la pagination (reprendre là où on s'est arrêtés)
      offset = 0,
    } = body;

    // ── Récupère les films à traiter ──
    let query = supabase
      .from("movie_embeddings")
      .select("tmdb_id, media_type, title")
      .order("tmdb_id", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (!forceRefresh) {
      // En mode normal : seulement les films dont platform_ids est vide
      query = query.eq("platform_ids", "{}");
    }

    const { data: films, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!films || films.length === 0) {
      return new Response(
        JSON.stringify({ message: "Aucun film à mettre à jour.", processed: 0, updated: 0, offset }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[SYNC-PLATFORMS] Traitement de ${films.length} films (offset=${offset}, forceRefresh=${forceRefresh})`);

    // ── Traitement par mini-lots parallèles pour respecter le rate limit TMDB ──
    let updated = 0;
    let errors = 0;
    const results: { tmdb_id: number; title: string; platform_ids: number[] }[] = [];

    for (let i = 0; i < films.length; i += PARALLEL_BATCH) {
      const chunk = films.slice(i, i + PARALLEL_BATCH);

      const chunkResults = await Promise.all(
        chunk.map(async (film: any) => {
          const itemType: "movie" | "tv" = film.media_type === "tv" ? "tv" : "movie";
          const platformIds = await getProviderIdsFR(Number(film.tmdb_id), itemType);
          return { tmdb_id: film.tmdb_id, title: film.title, platform_ids: platformIds };
        }),
      );

      results.push(...chunkResults);
      console.log(`[SYNC-PLATFORMS] Lot ${Math.floor(i / PARALLEL_BATCH) + 1}: ${chunkResults.length} films vérifiés`);

      // Petite pause entre les lots pour rester dans le rate limit TMDB (40 req/10s)
      if (i + PARALLEL_BATCH < films.length) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    // ── Mise à jour en base par batch d'upserts ──
    for (const r of results) {
      const { error: upsertError } = await supabase
        .from("movie_embeddings")
        .update({ platform_ids: r.platform_ids })
        .eq("tmdb_id", r.tmdb_id);

      if (upsertError) {
        console.error(`[SYNC-PLATFORMS] Erreur update tmdb_id=${r.tmdb_id}: ${upsertError.message}`);
        errors++;
      } else {
        updated++;
        if (r.platform_ids.length > 0) {
          console.log(`[SYNC-PLATFORMS] ✓ ${r.title} (${r.tmdb_id}) → [${r.platform_ids.join(",")}]`);
        }
      }
    }

    const hasMore = films.length === batchSize;
    const nextOffset = offset + films.length;

    console.log(
      `[SYNC-PLATFORMS] Terminé: ${updated} mis à jour, ${errors} erreurs. ${hasMore ? `Prochain offset: ${nextOffset}` : "Catalogue complet."}`,
    );

    return new Response(
      JSON.stringify({
        processed: films.length,
        updated,
        errors,
        hasMore,
        nextOffset: hasMore ? nextOffset : null,
        summary: results.map((r) => ({
          tmdb_id: r.tmdb_id,
          title: r.title,
          platform_count: r.platform_ids.length,
          platform_ids: r.platform_ids,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[SYNC-PLATFORMS] Erreur:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
