import { describe, it, expect } from "vitest";
import {
  AGE_RANGES,
  AGE_RANGE_LABELS,
  MAX_CERTIFICATION,
  isAgeRange,
  strictestAgeRange,
} from "@/lib/age-ranges";
import * as serverAge from "../../supabase/functions/_shared/age";

describe("parité client / serveur", () => {
  // La copie serveur existe parce qu'une edge function Deno ne peut pas
  // importer le bundle client. Ce test est le garde-fou contre la divergence.
  it("les deux listes de tranches sont identiques et dans le même ordre", () => {
    expect([...serverAge.AGE_RANGES]).toEqual([...AGE_RANGES]);
  });

  it("les certifications maximales sont identiques", () => {
    expect(serverAge.MAX_CERTIFICATION).toEqual(MAX_CERTIFICATION);
  });

  it("les deux implémentations donnent le même résultat", () => {
    const cas = [
      ["ado", "adulte"],
      ["adulte", "enfant", "ado"],
      ["adulte"],
      [],
      [null, undefined, "inconnu"],
      ["pre_ado", "enfant"],
    ];
    for (const c of cas) {
      expect(serverAge.strictestAgeRange(c as any)).toBe(strictestAgeRange(c as any));
    }
  });
});

describe("strictestAgeRange", () => {
  it("retient la tranche la plus jeune du groupe", () => {
    expect(strictestAgeRange(["adulte", "ado", "enfant"])).toBe("enfant");
    expect(strictestAgeRange(["adulte", "ado"])).toBe("ado");
    expect(strictestAgeRange(["adulte", "adulte"])).toBe("adulte");
  });

  it("ignore les valeurs absentes ou inconnues", () => {
    expect(strictestAgeRange([null, "ado", undefined, "n'importe quoi"])).toBe("ado");
  });

  it("renvoie null si personne n'a déclaré d'âge", () => {
    expect(strictestAgeRange([])).toBeNull();
    expect(strictestAgeRange([null, undefined])).toBeNull();
    expect(strictestAgeRange(["inconnu"])).toBeNull();
  });

  it("un seul enfant contraint tout le groupe", () => {
    // Le cas qui motive la fonctionnalité : sept adultes et un enfant de 7 ans.
    const groupe = ["adulte", "adulte", "adulte", "adulte", "adulte", "adulte", "adulte", "enfant"];
    expect(strictestAgeRange(groupe)).toBe("enfant");
  });
});

describe("isAgeRange", () => {
  it("accepte les valeurs connues", () => {
    AGE_RANGES.forEach((r) => expect(isAgeRange(r)).toBe(true));
  });

  it("rejette tout le reste", () => {
    [null, undefined, "", "ADULTE", "enfants", 12, {}].forEach((v) => expect(isAgeRange(v)).toBe(false));
  });
});

describe("cohérence des tables de correspondance", () => {
  it("chaque tranche a un libellé et une certification", () => {
    AGE_RANGES.forEach((r) => {
      expect(AGE_RANGE_LABELS[r]).toBeTruthy();
      expect(MAX_CERTIFICATION).toHaveProperty(r);
    });
  });

  it("seuls les adultes sont sans restriction", () => {
    expect(MAX_CERTIFICATION.adulte).toBeNull();
    expect(MAX_CERTIFICATION.enfant).toBe("TP");
    expect(MAX_CERTIFICATION.ado).toBe("16");
  });
});
