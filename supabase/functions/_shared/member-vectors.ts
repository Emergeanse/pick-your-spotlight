/**
 * Calcul des vecteurs de goût d'un participant, côté serveur.
 *
 * Pourquoi ce module existe
 * -------------------------
 * `group-taste-profile` lisait les vecteurs dans `user_taste_vectors`. Or rien
 * dans le projet n'écrit jamais dans cette table : elle n'est qu'un cache
 * prévu puis jamais alimenté. Le vrai calcul est fait à chaque appel par
 * `computeMultiVectorProfile` (src/lib/taste-engine.ts), côté client.
 *
 * Résultat : la fusion récupérait systématiquement des vecteurs nuls et ne
 * combinait donc aucun goût réel. Ce module porte la même logique côté
 * serveur, où la RLS ne s'applique pas et où l'on peut lire les données de
 * tous les participants.
 *
 * Les constantes et pondérations sont reprises à l'identique de
 * `taste-engine.ts` : toute divergence produirait des recommandations de
 * groupe incohérentes avec les recommandations solo.
 *
 * Fonctions pures, sans API Deno — testées côté Vitest.
 */

export const VECTOR_DIM = 32;

export const STABLE_HALF_LIFE = 150; // ~5 mois
export const RECENT_HALF_LIFE = 21; // ~3 semaines
export const AVOIDANCE_HALF_LIFE = 60; // ~2 mois

/** Poids décroissant avec l'ancienneté, demi-vie exprimée en jours. */
export function decayWeight(dateStr: string | null | undefined, halfLifeDays: number, now = Date.now()): number {
  if (!dateStr) return 0;
  const t = new Date(dateStr).getTime();
  if (!Number.isFinite(t)) return 0;
  const daysAgo = (now - t) / (1000 * 60 * 60 * 24);
  return Math.exp((-0.693 * daysAgo) / halfLifeDays);
}

export function weightedAverageVector(items: { vec: number[]; weight: number }[]): number[] | null {
  if (!items || items.length === 0) return null;
  const result = new Array<number>(VECTOR_DIM).fill(0);
  let totalWeight = 0;
  for (const { vec, weight } of items) {
    if (!vec || vec.length !== VECTOR_DIM || !Number.isFinite(weight)) continue;
    totalWeight += weight;
    for (let i = 0; i < VECTOR_DIM; i++) result[i] += vec[i] * weight;
  }
  if (totalWeight === 0) return null;
  for (let i = 0; i < VECTOR_DIM; i++) result[i] /= totalWeight;
  return result;
}

// Un rejet ne pèse pas toujours pareil : « pas mon style » dit quelque chose
// de durable, « pas ce soir » presque rien. Repris tel quel du client.
export const AVOIDANCE_WEIGHTS: Record<string, number> = {
  rejected_style: 1.5,
  skipped: 1.0,
  rejected_too_intense: 0.8,
  rejected_too_slow: 0.8,
  rejected_too_long: 0.6,
  rejected_not_tonight: 0.4,
  unsure: 0.4,
};

export const AVOIDANCE_ACTIONS = Object.keys(AVOIDANCE_WEIGHTS);

export interface LikedRow { tmdb_id: number; liked_at: string }
export interface WatchlistRow { tmdb_id: number; added_at: string }
export interface InteractionRow { tmdb_id: number; action_type: string; created_at: string }

export interface MemberVectors {
  stable: number[] | null;
  recent: number[] | null;
  avoidance: number[] | null;
  /** Nombre de titres ayant réellement contribué — sert au diagnostic. */
  signalCount: number;
}

/**
 * Reconstruit les trois vecteurs d'un participant.
 *
 * `embeddings` associe un tmdb_id à son vecteur ; les titres absents sont
 * ignorés silencieusement, comme côté client.
 */
export function computeMemberVectors(
  liked: LikedRow[],
  watchlist: WatchlistRow[],
  interactions: InteractionRow[],
  embeddings: Map<number, number[]>,
  now = Date.now(),
): MemberVectors {
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const likedIds = new Set((liked ?? []).map((m) => m.tmdb_id));
  // Un titre à la fois aimé et en liste d'envie ne compte qu'une fois.
  const uniqueWatchlist = (watchlist ?? []).filter((w) => !likedIds.has(w.tmdb_id));

  // ── Vecteur stable : tout l'historique, décroissance lente ──
  const stableItems: { vec: number[]; weight: number }[] = [];
  for (const m of liked ?? []) {
    const vec = embeddings.get(m.tmdb_id);
    if (vec) stableItems.push({ vec, weight: decayWeight(m.liked_at, STABLE_HALF_LIFE, now) });
  }
  for (const w of uniqueWatchlist) {
    const vec = embeddings.get(w.tmdb_id);
    // La liste d'envie est un signal plus faible qu'un like assumé.
    if (vec) stableItems.push({ vec, weight: 0.4 * decayWeight(w.added_at, STABLE_HALF_LIFE, now) });
  }

  // ── Vecteur récent : 30 derniers jours, décroissance rapide ──
  const recentItems: { vec: number[]; weight: number }[] = [];
  for (const m of liked ?? []) {
    if (!m.liked_at || m.liked_at < thirtyDaysAgo) continue;
    const vec = embeddings.get(m.tmdb_id);
    if (vec) recentItems.push({ vec, weight: decayWeight(m.liked_at, RECENT_HALF_LIFE, now) });
  }
  for (const w of uniqueWatchlist) {
    if (!w.added_at || w.added_at < thirtyDaysAgo) continue;
    const vec = embeddings.get(w.tmdb_id);
    if (vec) recentItems.push({ vec, weight: 0.5 * decayWeight(w.added_at, RECENT_HALF_LIFE, now) });
  }
  for (const i of interactions ?? []) {
    if (i.action_type !== "watched" || !i.created_at || i.created_at < thirtyDaysAgo) continue;
    const vec = embeddings.get(i.tmdb_id);
    if (vec) recentItems.push({ vec, weight: 0.7 * decayWeight(i.created_at, RECENT_HALF_LIFE, now) });
  }

  // ── Vecteur d'évitement ──
  // « already_seen » est volontairement exclu : avoir vu un film est neutre.
  const avoidanceItems: { vec: number[]; weight: number }[] = [];
  for (const i of interactions ?? []) {
    const vec = embeddings.get(i.tmdb_id);
    if (!vec) continue;
    if (AVOIDANCE_WEIGHTS[i.action_type] !== undefined) {
      avoidanceItems.push({
        vec,
        weight: AVOIDANCE_WEIGHTS[i.action_type] * decayWeight(i.created_at, AVOIDANCE_HALF_LIFE, now),
      });
    } else if (i.action_type === "unliked") {
      // Un like retiré est le signal négatif le plus net.
      avoidanceItems.push({ vec, weight: 1.5 * decayWeight(i.created_at, AVOIDANCE_HALF_LIFE, now) });
    }
  }

  return {
    stable: weightedAverageVector(stableItems),
    recent: weightedAverageVector(recentItems),
    avoidance: weightedAverageVector(avoidanceItems),
    signalCount: stableItems.length,
  };
}
