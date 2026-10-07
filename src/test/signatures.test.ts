import { describe, expect, it } from "vitest";
import { signaturesAdn } from "@/lib/signatures";

const adn = (o: Partial<Record<"emotion" | "tension" | "imaginaire" | "contemplation" | "rythme" | "legerete", number>>) =>
  ({ emotion: 50, tension: 50, imaginaire: 50, contemplation: 50, rythme: 50, legerete: 50, ...o });

describe("signatures de l'ADN", () => {
  it("un profil moyen n'a pas de signature", () => {
    expect(signaturesAdn(adn({}))).toEqual([]);
  });

  it("tension forte et légèreté faible : Dark / intense", () => {
    expect(signaturesAdn(adn({ tension: 75, legerete: 30 })).map((s) => s.id)).toContain("dark");
  });

  it("la SF adulte demande l'univers Science-Fiction", () => {
    const a = adn({ contemplation: 70, imaginaire: 72 });
    expect(signaturesAdn(a).map((s) => s.id)).not.toContain("sf");
    expect(signaturesAdn(a, ["Science-Fiction"]).map((s) => s.id)).toContain("sf");
  });

  it("garde quatre signatures au plus", () => {
    expect(signaturesAdn(adn({ tension: 90, contemplation: 90, imaginaire: 90, emotion: 90, legerete: 10, rythme: 10 }), ["Science-Fiction", "Horreur"]).length).toBeLessThanOrEqual(4);
  });
});
