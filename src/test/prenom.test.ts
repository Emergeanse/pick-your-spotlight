import { describe, it, expect } from "vitest";
import { prenomValide, PRENOM_MAX } from "@/lib/prenom";

/** Le prénom demandé à tout compte qui n'en a pas : ni vide, ni trop long. */
describe("prénom demandé à l'ouverture", () => {
  it("accepte un prénom normal, débarrassé des espaces superflus", () => {
    expect(prenomValide("  Lou  ")).toBe("Lou");
    expect(prenomValide("Jean   Lou")).toBe("Jean Lou");
  });

  it("refuse le vide et l'initiale seule", () => {
    expect(prenomValide("")).toBeNull();
    expect(prenomValide("   ")).toBeNull();
    expect(prenomValide("L")).toBeNull();
  });

  it(`refuse au-delà de ${PRENOM_MAX} caractères`, () => {
    expect(prenomValide("a".repeat(PRENOM_MAX))).toBe("a".repeat(PRENOM_MAX));
    expect(prenomValide("a".repeat(PRENOM_MAX + 1))).toBeNull();
  });
});
