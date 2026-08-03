/**
 * Normalise les `suitability_tags` existants sur le vocabulaire fermé.
 *
 * Contrairement à backfill-certification, aucun appel externe : on relit,
 * normalise et réécrit. Les lots peuvent donc être bien plus gros.
 *
 * La valeur d'origine est conservée dans `suitability_tags_raw` au premier
 * passage : la normalisation reste rejouable si le vocabulaire évolue, et rien
 * n'est perdu si une correspondance se révèle mauvaise.
 *
 * Appel : POST { batchSize?: number, dryRun?: boolean }
 * Réservé aux administrateurs.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAdmin } from "../_shared/auth.ts";
import { normalizeSuitabilityTags } from "../_shared/suitability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const adminAuth = await requireAdmin(req, corsHeaders);
  if (adminAuth.response) return adminAuth.response;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { batchSize = 500, dryRun = false } =
    req.method === "POST" ? await req.json().catch(() => ({})) : {};

  const { data: rows, error } = await supabase
    .from("movie_embeddings")
    .select("tmdb_id, media_type, suitability_tags, suitability_tags_raw")
    .is("suitability_tags_raw", null)
    .order("tmdb_id", { ascending: true })
    .limit(Math.min(Number(batchSize) || 500, 2000));

  if (error) return json({ error: error.message }, 500);
  if (!rows || rows.length === 0) {
    return json({ message: "Normalisation terminée — aucun titre restant.", remaining: 0, processed: 0 });
  }

  let changed = 0;
  let unchanged = 0;
  let emptied = 0;
  const dropped = new Map<string, number>();

  for (const r of rows) {
    const original: string[] = Array.isArray(r.suitability_tags) ? r.suitability_tags : [];
    const normalized = normalizeSuitabilityTags(original);

    // Trace des valeurs qu'aucune règle ne reconnaît, pour pouvoir enrichir la
    // table de correspondance plutôt que de perdre l'information en silence.
    for (const o of original) {
      if (normalizeSuitabilityTags([o]).length === 0) {
        const k = String(o).slice(0, 60);
        dropped.set(k, (dropped.get(k) ?? 0) + 1);
      }
    }

    if (normalized.length === 0 && original.length > 0) emptied++;
    if (same(original, normalized)) unchanged++;
    else changed++;

    if (!dryRun) {
      await supabase
        .from("movie_embeddings")
        .update({ suitability_tags: normalized, suitability_tags_raw: original })
        .eq("tmdb_id", r.tmdb_id)
        .eq("media_type", r.media_type);
    }
  }

  const { count: remaining } = await supabase
    .from("movie_embeddings")
    .select("tmdb_id", { count: "exact", head: true })
    .is("suitability_tags_raw", null);

  const topDropped = [...dropped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log(
    `[SUIT] lot de ${rows.length}${dryRun ? " (à blanc)" : ""} — ${changed} modifiés, ${unchanged} inchangés, ` +
      `${emptied} vidés | ${dropped.size} valeurs non reconnues | reste ${remaining ?? "?"}`,
  );

  return json({
    processed: rows.length,
    changed,
    unchanged,
    emptied,
    dryRun,
    unrecognized: Object.fromEntries(topDropped),
    remaining: remaining ?? null,
  });
});
