import { describe, it, expect } from "vitest";
import {
  VECTOR_DIM,
  STABLE_HALF_LIFE,
  RECENT_HALF_LIFE,
  AVOIDANCE_HALF_LIFE,
  AVOIDANCE_WEIGHTS,
  decayWeight,
  weightedAverageVector,
  computeMemberVectors,
} from "../../supabase/functions/_shared/member-vectors";

const NOW = new Date("2026-08-03T12:00:00Z").getTime();
const ago = (days: number) => new Date(NOW - days * 86400000).toISOString();
const vec = (fill: number) => new Array(VECTOR_DIM).fill(fill);

describe("decayWeight", () => {
  it("vaut 1 aujourd'hui", () => {
    expect(decayWeight(ago(0), STABLE_HALF_LIFE, NOW)).toBeCloseTo(1, 3);
  });

  it("vaut la moitié après une demi-vie", () => {
    expect(decayWeight(ago(STABLE_HALF_LIFE), STABLE_HALF_LIFE, NOW)).toBeCloseTo(0.5, 2);
    expect(decayWeight(ago(RECENT_HALF_LIFE), RECENT_HALF_LIFE, NOW)).toBeCloseTo(0.5, 2);
    expect(decayWeight(ago(AVOIDANCE_HALF_LIFE), AVOIDANCE_HALF_LIFE, NOW)).toBeCloseTo(0.5, 2);
  });

  it("décroît avec l'ancienneté", () => {
    const recent = decayWeight(ago(10), STABLE_HALF_LIFE, NOW);
    const vieux = decayWeight(ago(300), STABLE_HALF_LIFE, NOW);
    expect(recent).toBeGreaterThan(vieux);
  });

  it("tolère les dates absentes ou invalides", () => {
    expect(decayWeight(null, STABLE_HALF_LIFE, NOW)).toBe(0);
    expect(decayWeight(undefined, STABLE_HALF_LIFE, NOW)).toBe(0);
    expect(decayWeight("pas une date", STABLE_HALF_LIFE, NOW)).toBe(0);
  });
});

describe("weightedAverageVector", () => {
  it("moyenne pondérée simple", () => {
    const r = weightedAverageVector([
      { vec: vec(0), weight: 1 },
      { vec: vec(1), weight: 1 },
    ]);
    expect(r!.every((n) => Math.abs(n - 0.5) < 1e-9)).toBe(true);
  });

  it("le poids influe réellement", () => {
    const r = weightedAverageVector([
      { vec: vec(0), weight: 1 },
      { vec: vec(1), weight: 3 },
    ]);
    expect(r!.every((n) => Math.abs(n - 0.75) < 1e-9)).toBe(true);
  });

  it("ignore les vecteurs mal dimensionnés", () => {
    const r = weightedAverageVector([{ vec: vec(1), weight: 1 }, { vec: [1, 2], weight: 5 }]);
    expect(r!.every((n) => n === 1)).toBe(true);
  });

  it("renvoie null si rien d'exploitable", () => {
    expect(weightedAverageVector([])).toBeNull();
    expect(weightedAverageVector([{ vec: vec(1), weight: 0 }])).toBeNull();
  });
});

describe("computeMemberVectors", () => {
  const emb = new Map<number, number[]>([
    [1, vec(1)],
    [2, vec(0)],
    [3, vec(0.5)],
  ]);

  it("un participant sans rien n'a aucun vecteur", () => {
    const r = computeMemberVectors([], [], [], emb, NOW);
    expect(r.stable).toBeNull();
    expect(r.recent).toBeNull();
    expect(r.avoidance).toBeNull();
    expect(r.signalCount).toBe(0);
  });

  it("un like récent produit un vecteur stable ET récent", () => {
    const r = computeMemberVectors([{ tmdb_id: 1, liked_at: ago(2) }], [], [], emb, NOW);
    expect(r.stable!.every((n) => Math.abs(n - 1) < 1e-6)).toBe(true);
    expect(r.recent!.every((n) => Math.abs(n - 1) < 1e-6)).toBe(true);
    expect(r.signalCount).toBe(1);
  });

  it("un like ancien ne nourrit que le vecteur stable", () => {
    // Au-delà de 30 jours, le titre sort de la fenêtre « récent ».
    const r = computeMemberVectors([{ tmdb_id: 1, liked_at: ago(90) }], [], [], emb, NOW);
    expect(r.stable).not.toBeNull();
    expect(r.recent).toBeNull();
  });

  it("la liste d'envie pèse moins qu'un like", () => {
    // Même date, même ancienneté : seul le coefficient 0.4 les distingue.
    const r = computeMemberVectors(
      [{ tmdb_id: 1, liked_at: ago(1) }],
      [{ tmdb_id: 2, added_at: ago(1) }],
      [],
      emb,
      NOW,
    );
    // vec(1) pondéré 1 et vec(0) pondéré 0.4 → moyenne ≈ 0.714
    expect(r.stable![0]).toBeGreaterThan(0.7);
    expect(r.stable![0]).toBeLessThan(0.73);
  });

  it("un titre à la fois aimé et en liste d'envie ne compte qu'une fois", () => {
    const r = computeMemberVectors(
      [{ tmdb_id: 1, liked_at: ago(1) }],
      [{ tmdb_id: 1, added_at: ago(1) }],
      [],
      emb,
      NOW,
    );
    expect(r.signalCount).toBe(1);
    expect(r.stable!.every((n) => Math.abs(n - 1) < 1e-6)).toBe(true);
  });

  it("les rejets nourrissent le vecteur d'évitement", () => {
    const r = computeMemberVectors([], [], [
      { tmdb_id: 1, action_type: "rejected_style", created_at: ago(1) },
    ], emb, NOW);
    expect(r.avoidance).not.toBeNull();
    expect(r.stable).toBeNull();
  });

  it("« already_seen » est neutre et ne pénalise rien", () => {
    const r = computeMemberVectors([], [], [
      { tmdb_id: 1, action_type: "already_seen", created_at: ago(1) },
    ], emb, NOW);
    expect(r.avoidance).toBeNull();
  });

  it("« unliked » est le signal négatif le plus fort", () => {
    const fort = computeMemberVectors([], [], [
      { tmdb_id: 1, action_type: "unliked", created_at: ago(1) },
      { tmdb_id: 2, action_type: "rejected_not_tonight", created_at: ago(1) },
    ], emb, NOW);
    // vec(1) pondéré 1.5 contre vec(0) pondéré 0.4 → tire nettement vers 1
    expect(fort.avoidance![0]).toBeGreaterThan(0.75);
  });

  it("« pas mon style » pèse plus que « pas ce soir »", () => {
    expect(AVOIDANCE_WEIGHTS.rejected_style).toBeGreaterThan(AVOIDANCE_WEIGHTS.rejected_not_tonight);
  });

  it("« watched » récent alimente le vecteur récent", () => {
    const r = computeMemberVectors([], [], [
      { tmdb_id: 1, action_type: "watched", created_at: ago(3) },
    ], emb, NOW);
    expect(r.recent).not.toBeNull();
    expect(r.stable).toBeNull();
  });

  it("les titres sans embedding sont ignorés sans planter", () => {
    const r = computeMemberVectors([{ tmdb_id: 999, liked_at: ago(1) }], [], [], emb, NOW);
    expect(r.stable).toBeNull();
    expect(r.signalCount).toBe(0);
  });

  it("cas réaliste : un profil constitué", () => {
    const r = computeMemberVectors(
      [
        { tmdb_id: 1, liked_at: ago(5) },
        { tmdb_id: 3, liked_at: ago(200) },
      ],
      [{ tmdb_id: 2, added_at: ago(10) }],
      [{ tmdb_id: 2, action_type: "skipped", created_at: ago(4) }],
      emb,
      NOW,
    );
    expect(r.stable).not.toBeNull();
    expect(r.recent).not.toBeNull();
    expect(r.avoidance).not.toBeNull();
    expect(r.signalCount).toBe(3);
    // Le like d'il y a 200 jours pèse moins que celui d'il y a 5 jours,
    // donc la moyenne penche vers vec(1).
    expect(r.stable![0]).toBeGreaterThan(0.5);
  });
});
