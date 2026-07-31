/**
 * Profil de goût fusionné d'une soirée à plusieurs.
 *
 * Pourquoi côté serveur : la RLS verrouille `user_taste_vectors`,
 * `user_item_feedback` et `user_preferences` sur `auth.uid() = user_id`. Une
 * fusion côté client obligerait à ouvrir ces tables entre participants, donc à
 * exposer les données de goût de chacun au navigateur des autres. Ici, seuls
 * des AGRÉGATS sortent de la fonction — jamais une ligne nominative.
 *
 * Entrée  : { eventId }
 * Sortie  : vecteurs fusionnés + contraintes de groupe, prêts à être passés
 *           tels quels à `surprise-personalized`. Le moteur de recommandation
 *           n'est pas modifié.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAuth } from "../_shared/auth.ts";
import { blendGroupProfile, VECTOR_DIM, type MemberSignals } from "../_shared/group-blend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function parseVector(raw: unknown): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

// Actions qui signifient « ce titre est déjà consommé » — il ne doit plus
// ressortir pour personne dans le groupe.
const SEEN_ACTIONS = ["seen", "not_for_me", "love", "like", "watchlist"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth.response) return auth.response;
    const callerId = auth.user!.id;

    const { eventId } = await req.json().catch(() => ({}));
    if (typeof eventId !== "string" || !eventId) {
      return json({ error: "eventId requis" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    // ── 1. Autorisation : l'appelant doit appartenir à la soirée ──────────
    const { data: event } = await admin
      .from("events")
      .select("id, organizer_id, context")
      .eq("id", eventId)
      .maybeSingle();

    if (!event) return json({ error: "Soirée introuvable" }, 404);

    const { data: participantRows } = await admin
      .from("event_participants")
      .select("user_id, guest_name, status")
      .eq("event_id", eventId);

    const participants = participantRows ?? [];
    const isOrganizer = event.organizer_id === callerId;
    const isParticipant = participants.some((p: any) => p.user_id === callerId);
    if (!isOrganizer && !isParticipant) {
      return json({ error: "Accès refusé" }, 403);
    }

    // ── 2. Membres retenus ────────────────────────────────────────────────
    // L'organisateur compte toujours. Les participants qui ont décliné sont
    // écartés : inutile de contraindre la soirée sur les goûts d'un absent.
    const memberIds = [
      ...new Set([
        event.organizer_id as string,
        ...participants
          .filter((p: any) => p.user_id && p.status !== "declined")
          .map((p: any) => p.user_id as string),
      ]),
    ];

    const guestNames = participants
      .filter((p: any) => !p.user_id && p.guest_name && p.status !== "declined")
      .map((p: any) => p.guest_name as string);

    // ── 3. Chargement en lot (service role : la RLS ne s'applique pas) ────
    const [vectorsRes, profilesRes, feedbackRes, prefsRes] = await Promise.all([
      admin
        .from("user_taste_vectors")
        .select("user_id, taste_vector, recent_taste_vector, avoidance_vector, top_clusters, rejected_clusters, stable_confidence")
        .in("user_id", memberIds),
      admin
        .from("profiles")
        .select("id, preferred_platforms, excluded_genres, favorite_genres, min_rating")
        .in("id", memberIds),
      admin
        .from("user_item_feedback")
        .select("user_id, item_id, action")
        .in("user_id", memberIds)
        .limit(4000),
      admin
        .from("user_preferences")
        .select("user_id, tag_id, weight")
        .in("user_id", memberIds)
        .limit(3000),
    ]);

    const vectors = vectorsRes.data ?? [];
    const profiles = profilesRes.data ?? [];
    const feedbackRows = (feedbackRes.data ?? []) as any[];
    const prefsRows = (prefsRes.data ?? []) as any[];

    // item_id → tmdb_id, pour convertir le feedback en exclusions
    const itemIds = [...new Set(feedbackRows.map((f) => f.item_id).filter(Boolean))];
    const itemToTmdb = new Map<string, number>();
    if (itemIds.length > 0) {
      const { data: items } = await admin
        .from("catalog_items")
        .select("id, tmdb_id")
        .in("id", itemIds);
      (items ?? []).forEach((it: any) => {
        if (it.tmdb_id) itemToTmdb.set(it.id, it.tmdb_id);
      });
    }

    // tag_id → libellé, en ne gardant que les genres
    const tagIds = [...new Set(prefsRows.map((p) => p.tag_id).filter(Boolean))];
    const tagLabel = new Map<string, string>();
    if (tagIds.length > 0) {
      const { data: tags } = await admin
        .from("preference_tags")
        .select("id, key, label, category")
        .in("id", tagIds)
        .eq("category", "genre");
      (tags ?? []).forEach((t: any) => tagLabel.set(t.id, t.label || t.key));
    }

    // ── 4. Signaux par membre ─────────────────────────────────────────────
    const byId = <T extends Record<string, any>>(rows: T[], key: string) => {
      const m = new Map<string, T>();
      rows.forEach((r) => m.set(r[key], r));
      return m;
    };
    const vectorById = byId(vectors as any[], "user_id");
    const profileById = byId(profiles as any[], "id");

    const members: MemberSignals[] = memberIds.map((uid) => {
      const v: any = vectorById.get(uid) ?? {};
      const p: any = profileById.get(uid) ?? {};

      const seen = new Set<number>();
      for (const f of feedbackRows) {
        if (f.user_id !== uid) continue;
        if (!SEEN_ACTIONS.includes(f.action)) continue;
        const tmdbId = itemToTmdb.get(f.item_id);
        if (tmdbId) seen.add(tmdbId);
      }

      // Genres aimés : les tags explicites priment, sinon le champ historique
      // `favorite_genres` du profil.
      const likedFromTags = prefsRows
        .filter((r) => r.user_id === uid && Number(r.weight) > 0 && tagLabel.has(r.tag_id))
        .map((r) => tagLabel.get(r.tag_id)!);
      const excludedFromTags = prefsRows
        .filter((r) => r.user_id === uid && Number(r.weight) < 0 && tagLabel.has(r.tag_id))
        .map((r) => tagLabel.get(r.tag_id)!);

      return {
        userId: uid,
        stableVector: parseVector(v.taste_vector),
        recentVector: parseVector(v.recent_taste_vector),
        avoidanceVector: parseVector(v.avoidance_vector),
        topClusters: v.top_clusters ?? [],
        rejectedClusters: v.rejected_clusters ?? [],
        confidence: Number(v.stable_confidence) || 50,
        likedGenres: likedFromTags.length > 0 ? likedFromTags : (p.favorite_genres ?? []),
        excludedGenres: [...new Set([...(p.excluded_genres ?? []), ...excludedFromTags])],
        platforms: p.preferred_platforms ?? [],
        minRating: Number(p.min_rating) || 0,
        seenTmdbIds: [...seen],
      };
    });

    // ── 5. Fusion ─────────────────────────────────────────────────────────
    const blended = blendGroupProfile(members);

    console.log(
      `[GROUP] event=${eventId} context=${event.context} membres=${blended.memberCount} ` +
        `(vecteurs=${blended.contributingVectorCount}) invités=${guestNames.length} ` +
        `| exclusions=${blended.excludeIds.length} minRating=${blended.minRating} ` +
        `| plateformes=[${blended.sharedPlatforms.join(",")}]`,
    );

    return json({
      eventId,
      context: event.context,
      memberCount: blended.memberCount,
      guestCount: guestNames.length,
      contributingVectorCount: blended.contributingVectorCount,
      // Prêts à passer tels quels à surprise-personalized
      userTasteVector: blended.stableTasteVector,
      recentTasteVector: blended.recentTasteVector,
      avoidanceVector: blended.avoidanceVector,
      tasteProfileOverrides: {
        topGenres: blended.likedGenres,
        tasteClusters: blended.topClusters,
        rejectedClusters: blended.rejectedClusters,
        excludeIds: blended.excludeIds,
        confidence: { score: blended.confidence },
      },
      constraints: {
        sharedPlatforms: blended.sharedPlatforms,
        excludedGenres: blended.excludedGenres,
        minRating: blended.minRating,
      },
      vectorDim: VECTOR_DIM,
    });
  } catch (e) {
    console.error("group-taste-profile error:", e);
    return json({ error: e instanceof Error ? e.message : "Erreur" }, 500);
  }
});
