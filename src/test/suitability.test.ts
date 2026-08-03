import { describe, it, expect } from "vitest";
import {
  SUITABILITY,
  foldToken,
  normalizeSuitabilityTag,
  normalizeSuitabilityTags,
  isChildFriendly,
} from "../../supabase/functions/_shared/suitability";

describe("foldToken", () => {
  it("minuscules, accents retirés, séparateurs unifiés", () => {
    expect(foldToken("Famille_Adolescents")).toBe("famille adolescents");
    expect(foldToken("  CINÉPHILES  ")).toBe("cinephiles");
    expect(foldToken("famille-age-mature")).toBe("famille age mature");
    expect(foldToken("ados+")).toBe("ados");
  });

  it("écarte les parenthèses", () => {
    expect(foldToken("famille (ado)")).toBe("famille");
    expect(foldToken("amis (avertis)")).toBe("amis");
  });

  it("tolère les entrées non textuelles", () => {
    [null, undefined, 12, {}, []].forEach((v) => expect(foldToken(v)).toBe(""));
  });
});

describe("valeurs fréquentes du catalogue", () => {
  // Les 25 valeurs qui couvrent 99 % du volume.
  it("les canoniques se normalisent en elles-mêmes", () => {
    expect(normalizeSuitabilityTag("solo")).toEqual(["solo"]);
    expect(normalizeSuitabilityTag("couple")).toEqual(["couple"]);
    expect(normalizeSuitabilityTag("amis")).toEqual(["amis"]);
    expect(normalizeSuitabilityTag("famille")).toEqual(["famille"]);
    expect(normalizeSuitabilityTag("adolescents")).toEqual(["adolescents"]);
    expect(normalizeSuitabilityTag("adultes")).toEqual(["adultes"]);
  });

  it("la casse n'a pas d'importance", () => {
    expect(normalizeSuitabilityTag("Amis")).toEqual(["amis"]);
    expect(normalizeSuitabilityTag("Solo")).toEqual(["solo"]);
    expect(normalizeSuitabilityTag("Couple")).toEqual(["couple"]);
  });

  it("l'anglais et l'espagnol présents en base", () => {
    expect(normalizeSuitabilityTag("friends")).toEqual(["amis"]);
    expect(normalizeSuitabilityTag("family")).toEqual(["famille"]);
    expect(normalizeSuitabilityTag("adults")).toEqual(["adultes"]);
    expect(normalizeSuitabilityTag("kids")).toEqual(["famille", "enfants"]);
    expect(normalizeSuitabilityTag("amigos")).toEqual(["amis"]);
    expect(normalizeSuitabilityTag("pareja")).toEqual(["couple"]);
  });

  it("group et groupe deviennent amis", () => {
    expect(normalizeSuitabilityTag("group")).toEqual(["amis"]);
    expect(normalizeSuitabilityTag("groupe")).toEqual(["amis"]);
  });

  it("la faute « adolecents » présente en base est rattrapée", () => {
    expect(normalizeSuitabilityTag("adolecents")).toEqual(["adolescents"]);
  });
});

describe("« enfants » implique toujours « famille »", () => {
  it.each(["enfants", "kids", "jeunes enfants", "jeune public"])("%s", (v) => {
    const r = normalizeSuitabilityTag(v);
    expect(r).toContain("enfants");
    expect(r).toContain("famille");
  });
});

describe("longue traîne", () => {
  it("les compositions portent plusieurs notions", () => {
    expect(normalizeSuitabilityTag("famille_adolescents")).toEqual(["famille", "adolescents"]);
    expect(normalizeSuitabilityTag("famille_avec_ados")).toEqual(["famille", "adolescents"]);
    expect(normalizeSuitabilityTag("famille_pere_fils_ados")).toEqual(["famille", "adolescents"]);
    expect(normalizeSuitabilityTag("famille_ados_plus")).toEqual(["famille", "adolescents"]);
  });

  it("les variantes de famille sont rattachées", () => {
    ["famille élargie", "goûter_en_famille", "famille_nuitee", "famille-age-mature"].forEach((v) =>
      expect(normalizeSuitabilityTag(v)).toContain("famille"),
    );
  });

  it("les tournures d'âge sont comprises", () => {
    expect(normalizeSuitabilityTag("plus_de_13_ans")).toEqual(["adolescents"]);
    expect(normalizeSuitabilityTag("mature audience")).toEqual(["adultes"]);
  });

  it("ce qui n'est pas un contexte de visionnage est écarté", () => {
    // Mieux vaut ne rien écrire que de deviner. Liste relevée sur le passage
    // à blanc du catalogue : ce sont des goûts, pas des contextes.
    ["cinephile", "cinéphiles", "littérature", "premieres_seances", "fans_de_super_héros",
     "lgbtq+", "filles", "amateur d'horreur", "contemplative", "arthouse",
     "horror fans", "horror_fans", "amateurs de SF", "historian", "historique",
     "amusement", "fan de comédie"].forEach((v) =>
      expect(normalizeSuitabilityTag(v)).toEqual([]),
    );
  });

  it("« jeunesse » et « tous publics » sont rattrapés", () => {
    // Remontés par le passage à blanc : ce sont bien des contextes.
    expect(normalizeSuitabilityTag("jeunesse")).toEqual(["famille", "enfants"]);
    expect(normalizeSuitabilityTag("tous publics")).toEqual(["famille"]);
    expect(normalizeSuitabilityTag("tous_âges")).toEqual(["famille"]);
    // Variantes au singulier, relevées sur le passage complet du catalogue.
    expect(normalizeSuitabilityTag("tout public")).toEqual(["famille"]);
    expect(normalizeSuitabilityTag("tout_âge")).toEqual(["famille"]);
  });

  it("« famille (avertissement pour jeunes enfants) » reste famille", () => {
    // Les parenthèses sont écartées : l'avertissement ne doit pas se lire
    // comme une recommandation pour enfants.
    const r = normalizeSuitabilityTag("famille (avertissement pour jeunes enfants)");
    expect(r).toEqual(["famille"]);
    expect(r).not.toContain("enfants");
  });
});

describe("normalizeSuitabilityTags — liste complète", () => {
  it("déduplique et range dans l'ordre canonique", () => {
    expect(normalizeSuitabilityTags(["amis", "Amis", "friends", "solo"])).toEqual(["solo", "amis"]);
  });

  it("fusionne les notions issues de plusieurs entrées", () => {
    expect(normalizeSuitabilityTags(["famille", "kids", "couple"])).toEqual(["couple", "famille", "enfants"]);
  });

  it("tolère les entrées vides ou invalides", () => {
    expect(normalizeSuitabilityTags(null)).toEqual([]);
    expect(normalizeSuitabilityTags([])).toEqual([]);
    expect(normalizeSuitabilityTags(["", null, 42, "n'importe quoi"])).toEqual([]);
  });

  it("cas réel : un film d'animation familial", () => {
    expect(normalizeSuitabilityTags(["famille", "enfants", "solo", "amis"]))
      .toEqual(["solo", "amis", "famille", "enfants"]);
  });

  it("toutes les sorties appartiennent au vocabulaire fermé", () => {
    const sortie = normalizeSuitabilityTags([
      "famille_pere_fils_ados", "pareja", "kids", "mature audience", "group", "cinephile",
    ]);
    sortie.forEach((v) => expect(SUITABILITY).toContain(v));
  });
});

describe("isChildFriendly", () => {
  it("vrai seulement si « enfants » est explicite", () => {
    expect(isChildFriendly(["famille", "enfants"])).toBe(true);
    expect(isChildFriendly(["kids"])).toBe(true);
    expect(isChildFriendly(["famille"])).toBe(false);
    expect(isChildFriendly(["adultes"])).toBe(false);
    expect(isChildFriendly([])).toBe(false);
    expect(isChildFriendly(null)).toBe(false);
  });
});
