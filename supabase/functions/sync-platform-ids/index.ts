import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";
const PARALLEL = 30; // appels TMDB simultanés — TMDB tolère ~40 req/10s

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
      // forceRefresh=true : re-vérifie tous les films (y compris ceux déjà renseignés)
      forceRefresh = false,
    } = body;

    // ── Récupère jusqu'à 5000 films via pagination (PostgREST cap = 1000/page) ──
    const MAX_FILMS = 5000;
    const PAGE_SIZE = 1000;
    const allFilms: any[] = [];
    let from = 0;

    while (allFilms.length < MAX_FILMS) {
      const toFetch = Math.min(PAGE_SIZE, MAX_FILMS - allFilms.length);
      let q = supabase
        .from("movie_embeddings")
        .select("tmdb_id, media_type, title")
        .order("tmdb_id", { ascending: true })
        .range(from, from + toFetch - 1);
      if (!forceRefresh) q = q.eq("platform_ids", "{}");
      const { data: page, error: pageError } = await q;
      if (pageError) throw pageError;
      if (!page || page.length === 0) break;
      allFilms.push(...page);
      if (page.length < toFetch) break;
      from += toFetch;
    }

    const films = allFilms;
    if (films.length === 0) {
      return new Response(
        JSON.stringify({ message: "Aucun film à mettre à jour — platform_ids déjà renseignés.", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!films || films.length === 0) {
      return new Response(
        JSON.stringify({ message: "Aucun film à mettre à jour — platform_ids déjà renseignés.", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[SYNC-PLATFORMS] ${films.length} films à traiter (forceRefresh=${forceRefresh})`);

    // ── Appels TMDB par lots parallèles de PARALLEL films ──
    const results: { tmdb_id: number; title: string; platform_ids: number[] }[] = [];
    let tmdbErrors = 0;

    for (let i = 0; i < films.length; i += PARALLEL) {
      const chunk = films.slice(i, i + PARALLEL);
      const chunkResults = await Promise.all(
        chunk.map(async (film: any) => {
          const itemType: "movie" | "tv" = film.media_type === "tv" ? "tv" : "movie";
          const platformIds = await getProviderIdsFR(Number(film.tmdb_id), itemType);
          return { tmdb_id: film.tmdb_id, title: film.title, platform_ids: platformIds };
        }),
      );
      results.push(...chunkResults);

      const batchNum = Math.floor(i / PARALLEL) + 1;
      const totalBatches = Math.ceil(films.length / PARALLEL);
      const withPlatforms = chunkResults.filter((r) => r.platform_ids.length > 0).length;
      console.log(`[SYNC-PLATFORMS] Lot ${batchNum}/${totalBatches}: ${withPlatforms}/${chunk.length} ont des plateformes`);

      // Pause courte entre les lots pour respecter le rate limit TMDB
      if (i + PARALLEL < films.length) {
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    // ── Mise à jour en base — tous les résultats en parallèle ──
    const updateErrors: number[] = [];
    await Promise.all(
      results.map(async (r) => {
        // NULL = vérifié, aucune plateforme FR (évite re-traitement) ; [] = pas encore traité
        const { error } = await supabase
          .from("movie_embeddings")
          .update({ platform_ids: r.platform_ids.length > 0 ? r.platform_ids : null })
          .eq("tmdb_id", r.tmdb_id);
        if (error) {
          console.error(`[SYNC-PLATFORMS] Update error tmdb_id=${r.tmdb_id}: ${error.message}`);
          updateErrors.push(r.tmdb_id);
          tmdbErrors++;
        }
      }),
    );

    const withPlatforms = results.filter((r) => r.platform_ids.length > 0);
    const withoutPlatforms = results.filter((r) => r.platform_ids.length === 0);

    console.log(
      `[SYNC-PLATFORMS] Terminé: ${withPlatforms.length} films avec plateformes, ${withoutPlatforms.length} sans plateforme FR, ${tmdbErrors} erreurs DB`,
    );

    return new Response(
      JSON.stringify({
        processed: results.length,
        withPlatforms: withPlatforms.length,
        withoutPlatforms: withoutPlatforms.length,
        dbErrors: tmdbErrors,
        // Films sans aucune plateforme FR (candidats à la suppression)
        toDelete: withoutPlatforms.map((r) => ({ tmdb_id: r.tmdb_id, title: r.title })),
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
