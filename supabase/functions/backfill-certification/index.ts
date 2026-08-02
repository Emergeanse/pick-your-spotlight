/**
 * Remplit la certification d'âge des titres depuis TMDB.
 *
 * Deux appels par titre selon son type :
 *   - film  : /movie/{id}/release_dates  → certification par pays
 *   - série : /tv/{id}/content_ratings    → note par pays
 *
 * On conserve les valeurs brutes FR et US en plus du niveau calculé, pour
 * pouvoir rejouer la normalisation sans réinterroger TMDB si le barème évolue.
 *
 * `certification_checked_at` est écrit même quand TMDB ne renvoie rien : sans
 * ça, le backfill reprendrait indéfiniment les mêmes titres sans certification.
 *
 * Appel : POST { batchSize?: number, mediaType?: "movie" | "tv" | "both" }
 * Réservé aux administrateurs.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAdmin } from "../_shared/auth.ts";
import { tmdbUrl } from "../_shared/tmdb.ts";
import { resolveCertification } from "../_shared/certification.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Certification d'un pays donné, en écartant les valeurs vides et « NR ». */
function pickCountry(blocks: any[], iso: string, field: "release_dates" | "rating"): string | null {
  const block = (blocks ?? []).find((b: any) => b?.iso_3166_1 === iso);
  if (!block) return null;

  if (field === "rating") {
    const r = typeof block.rating === "string" ? block.rating.trim() : "";
    return r && r.toUpperCase() !== "NR" ? r : null;
  }

  const values = (block.release_dates ?? [])
    .map((d: any) => (typeof d?.certification === "string" ? d.certification.trim() : ""))
    .filter((c: string) => c && c.toUpperCase() !== "NR");
  return values[0] ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const adminAuth = await requireAdmin(req, corsHeaders);
  if (adminAuth.response) return adminAuth.response;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { batchSize = 100, mediaType = "both" } =
    req.method === "POST" ? await req.json().catch(() => ({})) : {};

  let query = supabase
    .from("movie_embeddings")
    .select("tmdb_id, media_type, title")
    .is("certification_checked_at", null)
    .order("tmdb_id", { ascending: true })
    .limit(Math.min(Number(batchSize) || 100, 400));

  if (mediaType !== "both") query = query.eq("media_type", mediaType);

  const { data: titles, error } = await query;
  if (error) return json({ error: error.message }, 500);

  if (!titles || titles.length === 0) {
    return json({ message: "Backfill terminé — aucun titre restant.", remaining: 0, updated: 0 });
  }

  let withCert = 0;
  let withoutCert = 0;
  let failures = 0;
  const byLevel: Record<string, number> = {};

  for (const t of titles) {
    const type = t.media_type === "tv" ? "tv" : "movie";
    try {
      const path = type === "tv"
        ? `/tv/${t.tmdb_id}/content_ratings`
        : `/movie/${t.tmdb_id}/release_dates`;

      const res = await fetch(tmdbUrl(path, {}));

      // 404 : le titre n'existe plus chez TMDB. On l'horodate quand même pour
      // ne pas le repasser à chaque lot.
      let fr: string | null = null;
      let us: string | null = null;
      if (res.ok) {
        const data = await res.json();
        const blocks = data?.results ?? [];
        const field = type === "tv" ? "rating" : "release_dates";
        fr = pickCountry(blocks, "FR", field as any);
        us = pickCountry(blocks, "US", field as any);
      }

      const verdict = resolveCertification(fr, us);
      if (verdict.level != null) {
        withCert++;
        byLevel[String(verdict.level)] = (byLevel[String(verdict.level)] ?? 0) + 1;
      } else {
        withoutCert++;
      }

      await supabase
        .from("movie_embeddings")
        .update({
          certification_level: verdict.level,
          certification_source: verdict.source,
          certification_fr: fr,
          certification_us: us,
          certification_checked_at: new Date().toISOString(),
        })
        .eq("tmdb_id", t.tmdb_id)
        .eq("media_type", t.media_type);

      // TMDB tolère ~50 requêtes/seconde ; on reste très en deçà.
      await new Promise((r) => setTimeout(r, 120));
    } catch (e) {
      failures++;
      console.error(`[CERT] ${t.title} (${t.tmdb_id}) :`, e instanceof Error ? e.message : e);
    }
  }

  const { count: remaining } = await supabase
    .from("movie_embeddings")
    .select("tmdb_id", { count: "exact", head: true })
    .is("certification_checked_at", null);

  console.log(
    `[CERT] lot de ${titles.length} — ${withCert} avec certification, ${withoutCert} sans, ` +
      `${failures} en échec | répartition ${JSON.stringify(byLevel)} | reste ${remaining ?? "?"}`,
  );

  return json({
    processed: titles.length,
    withCertification: withCert,
    withoutCertification: withoutCert,
    failures,
    byLevel,
    remaining: remaining ?? null,
  });
});
