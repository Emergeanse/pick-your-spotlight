import { describe, it, expect } from "vitest";
import { libelleAdhesion, intensiteAdhesion } from "@/lib/adhesion-label";

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
