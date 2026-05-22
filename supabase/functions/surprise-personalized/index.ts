import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

async function getMovieDetails(id: number, type: "movie" | "tv" = "movie"): Promise<any> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=fr-FR`);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return null; }
  } catch { return null; }
}

// Returns TMDB provider IDs available in France (flatrate + free + ads).
// Returns empty array on error so callers can decide whether to include the film.
async function getProviderIdsFR(tmdbId: number, mediaType: "movie" | "tv"): Promise<number[]> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    const fr = data?.results?.FR;
    if (!fr) return [];
    return [
      ...(fr.flatrate || []),
      ...(fr.free    || []),
      ...(fr.ads     || []),
    ].map((p: any) => Number(p.provider_id));
  } catch { return []; }
}

async function safeFetchJson(url: string): Promise<any> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return null; }
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      tasteProfile, userTasteVector,
      platformIds, excludeIds, excludedPlatformIds, excludedGenres,
      minRating: rawMinRating, rejectionContext,
      explorationLevel: rawExplorationLevel, mediaType: rawMediaType,
      count: rawCount, maxDuration: rawMaxDuration,
      minMatchScore: rawMinMatchScore,
      likedMovies,
    } = await req.json();

    const requestedCount = Math.max(1, Math.min(typeof rawCount === "number" ? rawCount : 3, 20));
    const minRating = typeof rawMinRating === "number" ? Math.min(rawMinRating, 8) : 0;
    const explorationLevel = typeof rawExplorationLevel === "number" ? Math.max(0, Math.min(10, rawExplorationLevel)) : 5;
    const mediaType: "movie" | "tv" | "both" = rawMediaType === "tv" ? "tv" : rawMediaType === "movie" ? "movie" : "both";
    const minMatchScore = typeof rawMinMatchScore === "number" ? Math.max(0, Math.min(100, rawMinMatchScore)) : 60;
    const maxDuration = typeof rawMaxDuration === "number" && rawMaxDuration > 0 ? rawMaxDuration : null;
    const searchType: "movie" | "tv" = mediaType === "both" ? (Math.random() < 0.5 ? "movie" : "tv") : mediaType;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ── Normalize excluded IDs ──
    const normalizedExcludeIds = [...new Set([
      ...(likedMovies || []).map((m: any) => Number(m.tmdb_id || m.id)).filter(Number.isFinite),
      ...((excludeIds || []).map((id: any) => Number(id)).filter(Number.isFinite)),
      ...(tasteProfile?.excludeIds || []).map((id: any) => Number(id)).filter(Number.isFinite),
    ])];
    const excludedSet = new Set(normalizedExcludeIds);
