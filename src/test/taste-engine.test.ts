/**
 * Tests unitaires — taste-engine.ts (TNR pipeline phase 1 · backlog 1.19)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Fixtures Supabase (configurables par test) ───────────────────────────────

type LikedRow = { tmdb_id: number; title: string; genres: string[]; liked_at: string };
type WatchlistRow = { tmdb_id: number; title: string; genres: string[]; added_at: string };
type InteractionRow = {
  tmdb_id: number;
  action_type: string;
  context?: Record<string, unknown>;
  created_at: string;
};
type EmbeddingRow = { tmdb_id: number; embedding: number[] | string };
type CachedVectorRow = {
  taste_vector: string | number[] | null;
  recent_taste_vector: string | number[] | null;
  avoidance_vector: string | number[] | null;
  top_clusters: string[];
  rejected_clusters: string[];
  stable_confidence: number;
  novelty_tolerance: number;
  fatigue_state: Record<string, number>;
  liked_count: number;
};
type RejectedScoreRow = { movie_id: number; score: number; last_updated: string };

let likedMovies: LikedRow[] = [];
let watchlistItems: WatchlistRow[] = [];
let interactions: InteractionRow[] = [];
let cachedVectors: CachedVectorRow | null = null;
let rejectedScores: RejectedScoreRow[] = [];
let embeddingRows: EmbeddingRow[] = [];
let upsertPayloads: unknown[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const makeChain = (resolve: () => unknown): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      eq: () => chain,
      lte: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      select: () => chain,
      maybeSingle: () => Promise.resolve({ data: resolve(), error: null }),
      upsert: (payload: unknown) => {
        upsertPayloads.push(payload);
        return Promise.resolve({ data: null, error: null });
      },
      then: (onFulfilled: (v: { data: unknown; error: null }) => unknown) =>
        Promise.resolve({ data: resolve(), error: null }).then(onFulfilled),
    };
    return chain;
  };

  return {
    supabase: {
      from: (table: string) => {
        switch (table) {
          case "liked_movies":
            return makeChain(() => likedMovies);
          case "watchlist":
            return makeChain(() => watchlistItems);
          case "user_interactions":
            return makeChain(() => interactions);
          case "user_taste_vectors":
            return makeChain(() => cachedVectors);
          case "user_movie_scores":
            return makeChain(() => rejectedScores);
          case "movie_embeddings":
            return makeChain(() => embeddingRows);
          default:
            return makeChain(() => []);
        }
      },
    },
  };
});

import {
  decayWeight,
  weightedAverageVector,
  parseVector,
  inferClusters,
  computeMultiVectorProfile,
  computeUserTasteVector,
  clearTasteProfileCacheForTests,
} from "@/lib/taste-engine";

const VECTOR_DIM = 32;

const unitVec = (index: number, magnitude = 1): number[] => {
  const v = new Array(VECTOR_DIM).fill(0);
  v[index] = magnitude;
  return v;
};

const daysAgo = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const fingerprintHash = (
  liked: LikedRow[],
  watchlist: WatchlistRow[],
  interactionCount: number,
  rejectedCount: number
): number => {
  const likedIds = liked.map((m) => m.tmdb_id).sort().join(",");
  const watchlistIds = watchlist.map((w) => w.tmdb_id).sort().join(",");
  const fingerprint = `${likedIds}|${watchlistIds}|${interactionCount}|${rejectedCount}`;
  let hash = 5381;
  for (let i = 0; i < fingerprint.length; i++) {
    hash = (Math.imul(hash, 33) ^ fingerprint.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

beforeEach(() => {
  likedMovies = [];
  watchlistItems = [];
  interactions = [];
  cachedVectors = null;
  rejectedScores = [];
  embeddingRows = [];
  upsertPayloads = [];
  clearTasteProfileCacheForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ── decayWeight ───────────────────────────────────────────────────────────────

describe("decayWeight — demi-vie exponentielle", () => {
  it("poids ≈ 1 pour une interaction aujourd'hui", () => {
    const today = new Date().toISOString();
    expect(decayWeight(today, 150)).toBeCloseTo(1, 2);
  });

  it("poids ≈ 0.5 après une demi-vie complète", () => {
    const halfLife = 21;
    expect(decayWeight(daysAgo(halfLife), halfLife)).toBeCloseTo(0.5, 2);
  });

  it("poids plus faible pour une date plus ancienne (stable vs récent)", () => {
    const recent = decayWeight(daysAgo(7), 21);
    const old = decayWeight(daysAgo(60), 21);
    expect(recent).toBeGreaterThan(old);
    expect(old).toBeLessThan(0.15);
  });

  it("demi-vie longue (150j) décroît plus lentement que courte (21j)", () => {
    const days = 30;
    const stable = decayWeight(daysAgo(days), 150);
    const recent = decayWeight(daysAgo(days), 21);
    expect(stable).toBeGreaterThan(recent);
  });
});

// ── weightedAverageVector ───────────────────────────────────────────────────

describe("weightedAverageVector — fusion pondérée 32D", () => {
  it("retourne null si aucun item", () => {
    expect(weightedAverageVector([])).toBeNull();
  });

  it("retourne null si tous les vecteurs invalides", () => {
    expect(
      weightedAverageVector([
        { vec: [], weight: 1 },
        { vec: new Array(16).fill(0), weight: 1 },
      ])
    ).toBeNull();
  });

  it("un seul vecteur valide → copie normalisée", () => {
    const vec = unitVec(0, 2);
    const result = weightedAverageVector([{ vec, weight: 1 }])!;
    expect(result).toHaveLength(VECTOR_DIM);
    expect(result[0]).toBeCloseTo(2, 5);
    expect(result[1]).toBe(0);
  });

  it("deux vecteurs identiques → même direction", () => {
    const vec = unitVec(3);
    const result = weightedAverageVector([
      { vec, weight: 2 },
      { vec, weight: 8 },
    ])!;
    expect(result[3]).toBeCloseTo(1, 5);
  });

  it("pondération asymétrique tire le barycentre vers le vecteur le plus lourd", () => {
    const a = unitVec(0, 1);
    const b = unitVec(1, 1);
    const result = weightedAverageVector([
      { vec: a, weight: 9 },
      { vec: b, weight: 1 },
    ])!;
    expect(result[0]).toBeGreaterThan(result[1]);
  });
});

// ── parseVector ───────────────────────────────────────────────────────────────

describe("parseVector — sérialisation DB", () => {
  it("null / undefined → null", () => {
    expect(parseVector(null)).toBeNull();
    expect(parseVector(undefined)).toBeNull();
  });

  it("tableau 32D → retourné tel quel", () => {
    const vec = unitVec(5);
    expect(parseVector(vec)).toEqual(vec);
  });

  it("chaîne JSON → parsée", () => {
    const vec = unitVec(2);
    expect(parseVector(`[${vec.join(",")}]`)).toEqual(vec);
  });

  it("chaîne invalide → null", () => {
    expect(parseVector("not-a-vector")).toBeNull();
  });
});

// ── inferClusters — genres FR (tmdb.ts) ───────────────────────────────────────

describe("inferClusters — mapping genres français", () => {
  it("Comédie → clusters feel good / léger", () => {
    const clusters = inferClusters({ Comédie: 3 });
    expect(clusters["feel good"]).toBe(3);
    expect(clusters["léger"]).toBe(3);
    expect(clusters["divertissant"]).toBe(3);
  });

  it("Horreur → dark / intense / visceral", () => {
    const clusters = inferClusters({ Horreur: 2 });
    expect(clusters["dark / intense"]).toBe(2);
    expect(clusters["visceral"]).toBe(2);
  });

  it("Science-Fiction → mind blowing / cérébral", () => {
    const clusters = inferClusters({ "Science-Fiction": 1 });
    expect(clusters["mind blowing"]).toBe(1);
    expect(clusters["cérébral"]).toBe(1);
  });

  it("genre inconnu → aucun cluster", () => {
    expect(inferClusters({ "Genre-Inventé": 5 })).toEqual({});
  });

  it("genres multiples cumulent les scores", () => {
    const clusters = inferClusters({ Thriller: 2, Mystère: 1 });
    expect(clusters["twist ending"]).toBe(3);
    expect(clusters["cérébral"]).toBe(1);
  });
});

// ── computeMultiVectorProfile — intégration mockée ────────────────────────────

describe("computeMultiVectorProfile — profil multi-vecteurs", () => {
  it("historique vide → null (aucun tmdb_id)", async () => {
    const profile = await computeMultiVectorProfile("user-empty");
    expect(profile).toBeNull();
    expect(upsertPayloads).toHaveLength(0);
  });

  it("likes sans embedding → profil partiel (vecteurs null, clusters depuis genres)", async () => {
    likedMovies = [
      { tmdb_id: 100, title: "Film A", genres: ["Comédie"], liked_at: daysAgo(1) },
    ];
    embeddingRows = [];
    const profile = await computeMultiVectorProfile("user-no-emb");
    expect(profile).not.toBeNull();
    expect(profile!.stableTasteVector).toBeNull();
    expect(profile!.recentTasteVector).toBeNull();
    expect(profile!.avoidanceVector).toBeNull();
    expect(profile!.topClusters).toContain("feel good");
    expect(profile!.stableConfidence).toBeGreaterThan(0);
  });

  it("historique court — stable vector + topClusters depuis genres likés", async () => {
    const vec = unitVec(0);
    likedMovies = [
      {
        tmdb_id: 101,
        title: "Comédie récente",
        genres: ["Comédie", "Romance"],
        liked_at: daysAgo(2),
      },
      {
        tmdb_id: 102,
        title: "Thriller récent",
        genres: ["Thriller"],
        liked_at: daysAgo(5),
      },
    ];
    embeddingRows = [
      { tmdb_id: 101, embedding: vec },
      { tmdb_id: 102, embedding: unitVec(1) },
    ];

    const profile = await computeMultiVectorProfile("user-likes")!;

    expect(profile).not.toBeNull();
    expect(profile!.stableTasteVector).toHaveLength(VECTOR_DIM);
    expect(profile!.topClusters.length).toBeGreaterThan(0);
    expect(profile!.topClusters.some((c) => c.includes("feel good") || c.includes("suspense"))).toBe(
      true
    );
    expect(profile!.stableConfidence).toBeGreaterThan(0);
    expect(upsertPayloads).toHaveLength(1);
  });

  it("vecteur récent — seuls les likes < 30j alimentent recentTasteVector", async () => {
    const recentVec = unitVec(4, 1);
    const oldVec = unitVec(7, 1);
    likedMovies = [
      { tmdb_id: 201, title: "Récent", genres: ["Action"], liked_at: daysAgo(5) },
      { tmdb_id: 202, title: "Ancien", genres: ["Action"], liked_at: daysAgo(90) },
    ];
    embeddingRows = [
      { tmdb_id: 201, embedding: recentVec },
      { tmdb_id: 202, embedding: oldVec },
    ];

    const profile = await computeMultiVectorProfile("user-recent")!;

    expect(profile!.recentTasteVector).not.toBeNull();
    expect(profile!.recentTasteVector![4]).toBeCloseTo(1, 3);
    expect(profile!.recentTasteVector![7]).toBeCloseTo(0, 3);
    expect(profile!.stableTasteVector![7]).toBeGreaterThan(0);
  });

  it("skips et unliked → avoidanceVector non null", async () => {
    const likeVec = unitVec(0);
    const skipVec = unitVec(8, 1);
    likedMovies = [
      { tmdb_id: 301, title: "Liké", genres: ["Drame"], liked_at: daysAgo(3) },
    ];
    interactions = [
      { tmdb_id: 302, action_type: "skipped", created_at: daysAgo(1) },
      { tmdb_id: 303, action_type: "unliked", created_at: daysAgo(2) },
    ];
    embeddingRows = [
      { tmdb_id: 301, embedding: likeVec },
      { tmdb_id: 302, embedding: skipVec },
      { tmdb_id: 303, embedding: unitVec(9, 1) },
    ];

    const profile = await computeMultiVectorProfile("user-avoid")!;

    expect(profile!.avoidanceVector).not.toBeNull();
    expect(profile!.avoidanceVector![8]).toBeGreaterThan(0);
  });

  it("rejected_style répété → rejectedClusters si genre absent des likes", async () => {
    likedMovies = [
      { tmdb_id: 401, title: "Comédie ok", genres: ["Comédie"], liked_at: daysAgo(1) },
    ];
    interactions = [
      {
        tmdb_id: 402,
        action_type: "rejected_style",
        context: { genres: ["Horreur"] },
        created_at: daysAgo(1),
      },
      {
        tmdb_id: 403,
        action_type: "rejected_too_intense",
        context: { genres: ["Horreur"] },
        created_at: daysAgo(2),
      },
      {
        tmdb_id: 404,
        action_type: "rejected_style",
        context: { genres: ["Horreur"] },
        created_at: daysAgo(3),
      },
    ];
    embeddingRows = [
      { tmdb_id: 401, embedding: unitVec(0) },
      { tmdb_id: 402, embedding: unitVec(1) },
      { tmdb_id: 403, embedding: unitVec(2) },
      { tmdb_id: 404, embedding: unitVec(3) },
    ];

    const profile = await computeMultiVectorProfile("user-reject-clusters")!;

    expect(profile!.rejectedClusters).toContain("Horreur");
    expect(profile!.topClusters.some((c) => c.includes("feel good"))).toBe(true);
  });

  it("cache DB frais (fingerprint) → pas d'upsert, vecteurs parsés depuis cache", async () => {
    const stable = unitVec(0);
    likedMovies = [
      { tmdb_id: 501, title: "Cached", genres: ["Drame"], liked_at: daysAgo(1) },
    ];
    watchlistItems = [];
    interactions = [];
    rejectedScores = [];
    const totalCount = likedMovies.length + watchlistItems.length;
    const hash = fingerprintHash(likedMovies, watchlistItems, 0, 0);

    cachedVectors = {
      taste_vector: `[${stable.join(",")}]`,
      recent_taste_vector: null,
      avoidance_vector: null,
      top_clusters: ["émotionnel"],
      rejected_clusters: [],
      stable_confidence: 72,
      novelty_tolerance: 0.2,
      fatigue_state: {},
      liked_count: totalCount + hash,
    };

    const profile = await computeMultiVectorProfile("user-cached")!;

    expect(profile!.stableTasteVector![0]).toBeCloseTo(1, 5);
    expect(profile!.topClusters).toEqual(["émotionnel"]);
    expect(profile!.stableConfidence).toBe(72);
    expect(upsertPayloads).toHaveLength(0);
  });

  it("cache mémoire session — second appel sans recalcul DB lourd", async () => {
    likedMovies = [
      { tmdb_id: 601, title: "Mémoire", genres: ["Action"], liked_at: daysAgo(1) },
    ];
    embeddingRows = [{ tmdb_id: 601, embedding: unitVec(2) }];

    const first = await computeMultiVectorProfile("user-mem-cache");
    upsertPayloads = [];
    embeddingRows = [];

    const second = await computeMultiVectorProfile("user-mem-cache");

    expect(second).toEqual(first);
    expect(upsertPayloads).toHaveLength(0);
  });

  it("fatigueState — genres exposés sur 7 jours", async () => {
    likedMovies = [
      { tmdb_id: 701, title: "Semaine", genres: ["Animation", "Famille"], liked_at: daysAgo(2) },
    ];
    embeddingRows = [{ tmdb_id: 701, embedding: unitVec(0) }];

    const profile = await computeMultiVectorProfile("user-fatigue")!;

    expect(profile!.fatigueState["genre_Animation"]).toBe(1);
    expect(profile!.fatigueState["genre_Famille"]).toBe(1);
  });
});

describe("computeUserTasteVector — wrapper legacy", () => {
  it("retourne stableTasteVector du profil", async () => {
    likedMovies = [
      { tmdb_id: 801, title: "Legacy", genres: ["Drame"], liked_at: daysAgo(1) },
    ];
    embeddingRows = [{ tmdb_id: 801, embedding: unitVec(5, 1) }];

    const vec = await computeUserTasteVector("user-legacy");

    expect(vec).not.toBeNull();
    expect(vec![5]).toBeCloseTo(1, 5);
  });
});
