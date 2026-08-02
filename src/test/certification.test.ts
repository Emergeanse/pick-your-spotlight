import { describe, it, expect } from "vitest";
import {
  frToLevel,
  usToLevel,
  resolveCertification,
  maxLevelForAgeRange,
  isAllowed,
  CERT_LEVEL_LABELS,
  CERT_LEVELS,
} from "../../supabase/functions/_shared/certification";

describe("lecture des barèmes", () => {
  it("France : TP et U valent tous publics", () => {
    expect(frToLevel("TP")).toBe(0);
    expect(frToLevel("U")).toBe(0);
    expect(frToLevel("tp")).toBe(0);
    expect(frToLevel(" TP ")).toBe(0);
  });

  it("France : les paliers chiffrés, avec ou sans tiret", () => {
    expect(frToLevel("12")).toBe(2);
    expect(frToLevel("-12")).toBe(2);
    expect(frToLevel("16")).toBe(3);
    expect(frToLevel("18")).toBe(4);
  });

  it("États-Unis : barème cinéma", () => {
    expect(usToLevel("G")).toBe(0);
    expect(usToLevel("PG")).toBe(1);
    expect(usToLevel("PG-13")).toBe(2);
    expect(usToLevel("R")).toBe(3);
    expect(usToLevel("NC-17")).toBe(4);
  });

  it("États-Unis : barème télévisé", () => {
    expect(usToLevel("TV-Y7")).toBe(0);
    expect(usToLevel("TV-PG")).toBe(1);
    expect(usToLevel("TV-14")).toBe(2);
    expect(usToLevel("TV-MA")).toBe(4);
  });

  it("les valeurs vides ou non renseignées ne comptent pas", () => {
    ["", "  ", "NR", "unrated", "Not Rated", null, undefined, 12, {}].forEach((v) => {
      expect(frToLevel(v)).toBeNull();
      expect(usToLevel(v)).toBeNull();
    });
  });

  it("une valeur inconnue est ignorée plutôt qu'interprétée", () => {
    expect(frToLevel("ZZ")).toBeNull();
    expect(usToLevel("M")).toBeNull();
  });
});

describe("resolveCertification — la plus restrictive gagne", () => {
  it("retient le plus strict des deux", () => {
    // Il faut sauver le soldat Ryan : tous publics en France, R aux USA.
    expect(resolveCertification("TP", "R")).toEqual({ level: 3, source: "us" });
  });

  it("retient la France quand elle est la plus stricte", () => {
    expect(resolveCertification("16", "PG")).toEqual({ level: 3, source: "fr" });
  });

  it("signale l'accord des deux barèmes", () => {
    expect(resolveCertification("TP", "G")).toEqual({ level: 0, source: "fr+us" });
  });

  it("se contente d'un seul barème quand l'autre manque", () => {
    expect(resolveCertification(null, "PG-13")).toEqual({ level: 2, source: "us" });
    expect(resolveCertification("12", null)).toEqual({ level: 2, source: "fr" });
  });

  it("sans aucune certification, le verdict est vide", () => {
    expect(resolveCertification(null, null)).toEqual({ level: null, source: null });
    expect(resolveCertification("NR", "NR")).toEqual({ level: null, source: null });
  });

  it("cas réels mesurés sur TMDB", () => {
    const cas: [string, unknown, unknown, number][] = [
      ["Zootopie", "TP", "PG", 1],
      ["Toy Story 3", "TP", "G", 0],
      ["Paddington 2", "TP", "PG", 1],
      ["Le Voyage de Chihiro", "TP", "PG", 1],
      ["Matrix", "TP", "R", 3],
      ["Soldat Ryan", "TP", "R", 3],
      ["Incendies", "TP", "PG-13", 2],
      ["Prisoners", "12", "R", 3],
      ["La Cité de Dieu", "16", "R", 3],
      ["Whiplash", "TP", "R", 3],
    ];
    for (const [titre, fr, us, attendu] of cas) {
      expect(resolveCertification(fr, us).level, titre).toBe(attendu);
    }
  });
});

describe("maxLevelForAgeRange", () => {
  it("chaque tranche a son plafond", () => {
    expect(maxLevelForAgeRange("enfant")).toBe(1);
    expect(maxLevelForAgeRange("pre_ado")).toBe(2);
    expect(maxLevelForAgeRange("ado")).toBe(3);
    expect(maxLevelForAgeRange("adulte")).toBe(4);
  });

  it("sans âge déclaré, aucune contrainte", () => {
    expect(maxLevelForAgeRange(null)).toBeNull();
    expect(maxLevelForAgeRange(undefined)).toBeNull();
    expect(maxLevelForAgeRange("inconnu")).toBeNull();
  });
});

describe("isAllowed", () => {
  it("laisse tout passer sans contrainte", () => {
    expect(isAllowed(4, null)).toBe(true);
    expect(isAllowed(null, null)).toBe(true);
  });

  it("refuse au-dessus du plafond", () => {
    expect(isAllowed(3, 1)).toBe(false); // R devant un enfant
    expect(isAllowed(2, 1)).toBe(false);
  });

  it("accepte au niveau du plafond et en dessous", () => {
    expect(isAllowed(1, 1)).toBe(true);
    expect(isAllowed(0, 1)).toBe(true);
  });

  it("un titre sans certification est refusé dès qu'un enfant est présent", () => {
    // 10 % du catalogue n'a aucune certification. Le silence n'autorise rien.
    expect(isAllowed(null, 1)).toBe(false);
    expect(isAllowed(null, 2)).toBe(false);
    expect(isAllowed(null, 3)).toBe(false);
  });

  it("mais reste accepté pour un groupe d'adultes", () => {
    expect(isAllowed(null, 4)).toBe(true);
  });

  it("le scénario complet : soirée famille avec un enfant de 7 ans", () => {
    const plafond = maxLevelForAgeRange("enfant");
    const verdict = (fr: unknown, us: unknown) => isAllowed(resolveCertification(fr, us).level, plafond);

    expect(verdict("TP", "G")).toBe(true);    // Toy Story 3
    expect(verdict("TP", "PG")).toBe(true);   // Zootopie
    expect(verdict("TP", "R")).toBe(false);   // Soldat Ryan
    expect(verdict("TP", "PG-13")).toBe(false); // Incendies
    expect(verdict("12", "R")).toBe(false);   // Prisoners
    expect(verdict(null, null)).toBe(false);  // certification inconnue
  });
});

describe("cohérence des tables", () => {
  it("chaque niveau a un libellé", () => {
    CERT_LEVELS.forEach((l) => expect(CERT_LEVEL_LABELS[l]).toBeTruthy());
  });
});
