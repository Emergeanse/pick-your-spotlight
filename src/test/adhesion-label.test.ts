import { describe, it, expect } from "vitest";
import { libelleAdhesion, intensiteAdhesion, apparenceAdhesion } from "@/lib/adhesion-label";

describe("l'adhésion en mots", () => {
  it("dit ce que Pick en pense, par paliers", () => {
    expect(libelleAdhesion(95)).toBe("Excellent choix");
    expect(libelleAdhesion(90)).toBe("Excellent choix");
    expect(libelleAdhesion(88)).toBe("Très bon choix");
    expect(libelleAdhesion(72)).toBe("Bon choix");
    expect(libelleAdhesion(60)).toBe("À tenter");
    expect(libelleAdhesion(30)).toBe("Choix audacieux");
  });

  it("allume le badge avec le score, sans sortir de 0–1", () => {
    expect(intensiteAdhesion(20)).toBe(0);
    expect(intensiteAdhesion(100)).toBe(1);
    expect(intensiteAdhesion(88)).toBeGreaterThan(intensiteAdhesion(60));
  });
});

describe("apparence de la gemme selon le score", () => {
  it("plus grande, plus vive et plus chaude quand le score monte", () => {
    const bas = apparenceAdhesion(35), moyen = apparenceAdhesion(72), haut = apparenceAdhesion(96);
    expect(bas.echelle).toBeLessThan(moyen.echelle);
    expect(moyen.echelle).toBeLessThan(haut.echelle);
    expect(bas.luminosite).toBeLessThan(haut.luminosite);
    expect(bas.teinte).toBe(-40);
    expect(haut.teinte).toBeGreaterThan(0);
  });

  it("reste dans ses bornes et ne pulse qu'à partir de 90 %", () => {
    expect(apparenceAdhesion(0).echelle).toBeCloseTo(0.8);
    expect(apparenceAdhesion(100).echelle).toBeCloseTo(1.08);
    expect(apparenceAdhesion(89).pulse).toBe(false);
    expect(apparenceAdhesion(90).pulse).toBe(true);
  });
});
