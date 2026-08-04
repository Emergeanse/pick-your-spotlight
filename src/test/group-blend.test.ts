import { describe, it, expect } from "vitest";
import {
  VECTOR_DIM,
  averageVectors,
  unionAll,
  intersectWithUnionFallback,
  blendGroupProfile,
  type MemberSignals,
} from "../../supabase/functions/_shared/group-blend";

const vec = (fill: number) => new Array(VECTOR_DIM).fill(fill);

const member = (over: Partial<MemberSignals> = {}): MemberSignals => ({
  userId: "u",
  stableVector: null,
  recentVector: null,
  avoidanceVector: null,
  topClusters: [],
  rejectedClusters: [],
  confidence: 50,
  likedGenres: [],
  excludedGenres: [],
  platforms: [],
  minRating: 0,
  seenTmdbIds: [],
  ...over,
});

describe("averageVectors", () => {
  it("moyenne composante par composante", () => {
    const out = averageVectors([vec(0), vec(1)]);
    expect(out).not.toBeNull();
    expect(out!.every((n) => n === 0.5)).toBe(true);
  });

  it("ignore les vecteurs absents", () => {
    const out = averageVectors([vec(1), null, undefined]);
    expect(out!.every((n) => n === 1)).toBe(true);
  });

  it("ignore les vecteurs mal dimensionnés", () => {
    const out = averageVectors([vec(1), [0, 1, 2]]);
    expect(out!.every((n) => n === 1)).toBe(true);
  });

  it("ignore les vecteurs contenant NaN", () => {
    const bad = vec(0);
    bad[3] = NaN;
    const out = averageVectors([vec(1), bad]);
    expect(out!.every((n) => n === 1)).toBe(true);
  });

  it("renvoie null si aucun vecteur exploitable", () => {
    expect(averageVectors([null, undefined, [1, 2]])).toBeNull();
    expect(averageVectors([])).toBeNull();
  });
});

describe("unionAll", () => {
  it("déduplique en conservant l'ordre d'apparition", () => {
    expect(unionAll([["a", "b"], ["b", "c"], null])).toEqual(["a", "b", "c"]);
  });

  it("supporte les listes vides", () => {
    expect(unionAll([])).toEqual([]);
    expect(unionAll([[], null, undefined])).toEqual([]);
  });
});

describe("intersectWithUnionFallback", () => {
  it("renvoie l'intersection quand elle existe", () => {
    const r = intersectWithUnionFallback([["Comédie", "Drame"], ["Drame", "Action"]]);
    expect(r.values).toEqual(["Drame"]);
    expect(r.usedFallback).toBe(false);
  });

  it("retombe sur l'union quand l'intersection est vide", () => {
    const r = intersectWithUnionFallback([["Comédie"], ["Horreur"]]);
    expect(r.values).toEqual(["Comédie", "Horreur"]);
    expect(r.usedFallback).toBe(true);
  });

  it("ignore les listes vides plutôt que de tout annuler", () => {
    // Un participant sans préférence ne doit pas vider l'intersection des autres.
    const r = intersectWithUnionFallback([["Comédie", "Drame"], [], ["Drame"]]);
    expect(r.values).toEqual(["Drame"]);
    expect(r.usedFallback).toBe(false);
  });

  it("renvoie vide si personne n'a de préférence", () => {
    const r = intersectWithUnionFallback([[], null]);
    expect(r.values).toEqual([]);
    expect(r.usedFallback).toBe(false);
  });
});

describe("blendGroupProfile", () => {
  it("un seul membre : le profil du groupe est le sien", () => {
    const out = blendGroupProfile([
      member({ stableVector: vec(0.4), likedGenres: ["Comédie"], minRating: 7, seenTmdbIds: [1, 2] }),
    ]);
    expect(out.memberCount).toBe(1);
    expect(out.stableTasteVector!.every((n) => n === 0.4)).toBe(true);
    expect(out.likedGenres).toEqual(["Comédie"]);
    expect(out.minRating).toBe(7);
    expect(out.excludeIds).toEqual([1, 2]);
  });

  it("deux membres : moyenne des vecteurs, intersection des genres", () => {
    const out = blendGroupProfile([
      member({ stableVector: vec(0), likedGenres: ["Comédie", "Drame"] }),
      member({ stableVector: vec(1), likedGenres: ["Drame", "Action"] }),
    ]);
    expect(out.stableTasteVector!.every((n) => n === 0.5)).toBe(true);
    expect(out.likedGenres).toEqual(["Drame"]);
    expect(out.contributingVectorCount).toBe(2);
  });

  it("cinq membres : la moyenne porte sur tous", () => {
    const out = blendGroupProfile([0, 0, 0, 1, 1].map((v) => member({ stableVector: vec(v) })));
    expect(out.memberCount).toBe(5);
    expect(out.stableTasteVector!.every((n) => Math.abs(n - 0.4) < 1e-9)).toBe(true);
  });

  it("un genre aimé par l'un et exclu par l'autre : l'exclusion l'emporte", () => {
    // Cas réel observé sur une soirée à quatre : Marie aime l'Animation,
    // JeanLou l'exclut. Le genre ressortait dans les deux listes et le moteur
    // recevait une consigne contradictoire.
    const out = blendGroupProfile([
      member({ likedGenres: ["Comédie", "Animation"] }),
      member({ likedGenres: ["Crime"], excludedGenres: ["Animation"] }),
    ]);
    expect(out.excludedGenres).toContain("Animation");
    expect(out.likedGenres).not.toContain("Animation");
  });

  it("le retrait d'un genre exclu ne vide pas la liste des autres", () => {
    const out = blendGroupProfile([
      member({ likedGenres: ["Animation"] }),
      member({ likedGenres: ["Crime"], excludedGenres: ["Animation"] }),
    ]);
    // Le premier membre n'a plus rien d'aimé : sa liste vide est ignorée
    // plutôt que d'annuler l'intersection.
    expect(out.likedGenres).toEqual(["Crime"]);
  });

  it("un genre exclu par un seul membre exclut pour tout le groupe", () => {
    const out = blendGroupProfile([
      member({ excludedGenres: ["Horreur"] }),
      member({ excludedGenres: [] }),
      member({ excludedGenres: ["Guerre"] }),
    ]);
    expect(out.excludedGenres.sort()).toEqual(["Guerre", "Horreur"]);
  });

  it("la note minimale du groupe est celle du plus exigeant", () => {
    const out = blendGroupProfile([member({ minRating: 6 }), member({ minRating: 8 }), member({ minRating: 0 })]);
    expect(out.minRating).toBe(8);
  });

  it("la confiance du groupe est celle du membre le moins bien profilé", () => {
    const out = blendGroupProfile([member({ confidence: 90 }), member({ confidence: 30 })]);
    expect(out.confidence).toBe(30);
  });

  it("les films vus par un membre sont exclus pour tout le groupe", () => {
    const out = blendGroupProfile([member({ seenTmdbIds: [10, 20] }), member({ seenTmdbIds: [20, 30] })]);
    expect(out.excludeIds.sort((a, b) => a - b)).toEqual([10, 20, 30]);
  });

  it("plateformes : intersection si elle existe", () => {
    const out = blendGroupProfile([member({ platforms: [8, 119] }), member({ platforms: [119, 337] })]);
    expect(out.sharedPlatforms).toEqual([119]);
  });

  it("plateformes : union si aucune n'est commune", () => {
    const out = blendGroupProfile([member({ platforms: [8] }), member({ platforms: [337] })]);
    expect(out.sharedPlatforms.sort((a, b) => a - b)).toEqual([8, 337]);
  });

  it("un membre sans vecteur ne dégrade pas la moyenne des autres", () => {
    const out = blendGroupProfile([
      member({ stableVector: vec(1) }),
      member({ stableVector: null }),
    ]);
    expect(out.stableTasteVector!.every((n) => n === 1)).toBe(true);
    expect(out.contributingVectorCount).toBe(1);
    expect(out.memberCount).toBe(2);
  });

  it("groupe sans aucun vecteur : pas de plantage, vecteurs nuls", () => {
    const out = blendGroupProfile([member(), member()]);
    expect(out.stableTasteVector).toBeNull();
    expect(out.recentTasteVector).toBeNull();
    expect(out.avoidanceVector).toBeNull();
    expect(out.contributingVectorCount).toBe(0);
  });

  it("liste vide : renvoie un profil neutre sans lever d'erreur", () => {
    const out = blendGroupProfile([]);
    expect(out.memberCount).toBe(0);
    expect(out.stableTasteVector).toBeNull();
    expect(out.minRating).toBe(0);
    expect(out.confidence).toBe(50);
    expect(out.excludeIds).toEqual([]);
  });

  it("les trois vecteurs sont fusionnés indépendamment", () => {
    const out = blendGroupProfile([
      member({ stableVector: vec(0), recentVector: vec(0.2), avoidanceVector: vec(0.8) }),
      member({ stableVector: vec(1), recentVector: vec(0.4), avoidanceVector: null }),
    ]);
    expect(out.stableTasteVector!.every((n) => n === 0.5)).toBe(true);
    expect(out.recentTasteVector!.every((n) => Math.abs(n - 0.3) < 1e-9)).toBe(true);
    // Un seul membre a un vecteur d'évitement : il est repris tel quel.
    expect(out.avoidanceVector!.every((n) => n === 0.8)).toBe(true);
  });

  it("les clusters rejetés s'additionnent, les clusters aimés s'intersectent", () => {
    const out = blendGroupProfile([
      member({ topClusters: ["slow_burn", "dark"], rejectedClusters: ["gore"] }),
      member({ topClusters: ["dark", "epique"], rejectedClusters: ["musical"] }),
    ]);
    expect(out.topClusters).toEqual(["dark"]);
    expect(out.rejectedClusters.sort()).toEqual(["gore", "musical"]);
  });
});
