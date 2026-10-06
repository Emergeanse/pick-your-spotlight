import { describe, it, expect } from "vitest";
import { calculerAdn, evolutionAdn, traitsDominants, universFavoris } from "@/lib/adn";

/** Vecteur « catalogue moyen » : chaque dimension à sa moyenne. */
const moyen = () => {
  const v = new Array(32).fill(0.5);
  Object.entries({ 1: 0.66, 2: 0.64, 3: 0.44, 4: 0.45, 8: 0.48, 9: 0.53, 11: 0.44, 13: 0.44, 14: 0.48, 18: 0.47, 22: 0.31, 23: 0.54 })
    .forEach(([i, x]) => { v[Number(i)] = x; });
  return v;
};

describe("ADN cinéma : six traits calculés sur le vecteur de goût", () => {
  it("vaut 50 partout pour des goûts dans la moyenne du catalogue", () => {
    const adn = calculerAdn(moyen())!;
    expect(Object.values(adn).every((x) => x === 50)).toBe(true);
  });

  it("monte l'émotion pour qui aime les films profonds et chaleureux", () => {
    const v = moyen(); v[1] = 0.9; v[14] = 0.8;
    const adn = calculerAdn(v)!;
    expect(adn.emotion).toBeGreaterThan(80);
    expect(traitsDominants(adn, 1)[0].id).toBe("emotion");
  });

  it("oppose action et contemplation sur le rythme", () => {
    const lent = moyen(); lent[2] = 0.4;
    const adn = calculerAdn(lent)!;
    expect(adn.contemplation).toBeGreaterThan(50);
    expect(adn.action).toBeLessThan(50);
  });

  it("reste entre 5 et 99, et refuse un vecteur absent", () => {
    const extreme = moyen(); extreme[3] = 5;
    expect(calculerAdn(extreme)!.humour).toBe(99);
    expect(calculerAdn(null)).toBeNull();
  });

  it("ne signale que les variations d'au moins 3 points", () => {
    const fond = calculerAdn(moyen())!;
    const recent = { ...fond, imaginaire: fond.imaginaire + 8, humour: fond.humour + 2 };
    expect(evolutionAdn(fond, recent).map((e) => [e.id, e.ecart])).toEqual([["imaginaire", 8]]);
  });
});

describe("univers favoris : le drame ne domine plus par défaut", () => {
  it("ne met pas le drame en tête quand il est dans la proportion du catalogue", () => {
    // Mêmes proportions que le catalogue (drame sur ~48 % des films), mais deux
    // fois plus de science-fiction que la moyenne.
    const catalogue = { "Drame": 479, "Comédie": 367, "Thriller": 181, "Action": 235, "Crime": 164, "Romance": 123, "Science-Fiction": 158 };
    const u = universFavoris(Object.entries(catalogue).map(([genre, count]) => ({ genre, count: genre === "Science-Fiction" ? count * 2 : count })));
    expect(u[0]).toBe("Science-Fiction");
    expect(u).not.toContain("Drame");
  });

  it("fusionne les libellés de séries et ignore les genres trop rares", () => {
    const u = universFavoris([{ genre: "Sci-Fi & Fantasy", count: 2 }, { genre: "Science-Fiction", count: 2 }, { genre: "Western", count: 1 }, { genre: "Drame", count: 4 }]);
    expect(u).toContain("Science-Fiction");
    expect(u).not.toContain("Western");
  });

  it("se rabat sur les plus présents pour un profil encore jeune", () => {
    expect(universFavoris([{ genre: "Horreur", count: 1 }, { genre: "Drame", count: 2 }])).toEqual(["Drame", "Horreur"]);
  });
});
