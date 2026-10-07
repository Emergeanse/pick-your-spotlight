import { describe, it, expect } from "vitest";
import { comparerAdn, phraseComparaison } from "@/lib/adn-public";
import type { Adn } from "@/lib/adn";

const adn = (o: Partial<Adn> = {}): Adn => ({ emotion: 50, tension: 50, imaginaire: 50, contemplation: 50, rythme: 50, legerete: 50, ...o });

describe("« Vous et Chris » : comparaison de deux ADN", () => {
  it("100 % pour deux ADN identiques, moins quand ils s'éloignent", () => {
    expect(comparerAdn(adn(), adn()).affinite).toBe(100);
    expect(comparerAdn(adn(), adn({ tension: 80, legerete: 20 })).affinite).toBe(75);
    expect(comparerAdn(adn({ emotion: 90, tension: 90, imaginaire: 90 }), adn({ emotion: 10, tension: 10, imaginaire: 10 })).affinite).toBe(0);
  });

  it("trouve les traits forts communs et le plus net écart", () => {
    const c = comparerAdn(adn({ emotion: 80, tension: 70, legerete: 70 }), adn({ emotion: 85, tension: 75, legerete: 40 }));
    expect(c.communs).toEqual(["Émotion", "Tension"]);
    expect(c.ecart).toEqual({ libelle: "Légèreté", plusFortChez: "toi" });
  });

  it("formule la phrase en français, articles et élisions compris", () => {
    const c = comparerAdn(adn({ emotion: 80, tension: 70 }), adn({ emotion: 85, tension: 75, imaginaire: 80 }));
    expect(phraseComparaison(c, "Sophie")).toBe("Vous partagez une forte sensibilité à l'émotion et la tension. Sophie recherche davantage d'imaginaire.");
  });

  it("reste neutre sans dominante commune ni écart net", () => {
    expect(phraseComparaison(comparerAdn(adn(), adn({ rythme: 55 })), "Lou")).toBe("Vos goûts se ressemblent sans dominante commune marquée.");
  });
});

describe("phrase de comparaison : cohérence", () => {
  it("ne cite pas comme écart un trait déjà partagé", () => {
    const c = comparerAdn(adn({ emotion: 60, imaginaire: 65 }), adn({ emotion: 90, imaginaire: 70, legerete: 20 }));
    expect(c.communs).toContain("Émotion");
    expect(c.ecart?.libelle).toBe("Légèreté");
  });

  it("commence chaque phrase par une majuscule", () => {
    const c = comparerAdn(adn(), adn({ tension: 80 }));
    expect(phraseComparaison(c, "cette personne")).toBe("Cette personne recherche davantage de tension.");
  });
});
