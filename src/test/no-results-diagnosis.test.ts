import { describe, it, expect } from "vitest";
import { diagnoseNoResults } from "@/lib/recommendation-pipeline";

/**
 * Le 5 octobre, en mode avion, Pick répondait « Aucun film trouvé à 80 % de
 * correspondance. Essaie de baisser le seuil ». Le seuil n'y était pour rien :
 * aucune requête n'était partie. L'utilisateur baissait le seuil, réessayait,
 * et obtenait le même message — l'application accusait ses réglages d'une
 * panne de réseau.
 *
 * Ces tests tiennent la règle : hors ligne, on ne parle jamais des filtres.
 */

const HORS_LIGNE = "Tu es hors ligne. Pick a besoin d'Internet pour chercher un film.";

describe("hors ligne, les filtres ne sont jamais mis en cause", () => {
  it("le dit, même avec un seuil et une note très stricts", () => {
    const d = diagnoseNoResults({ horsLigne: true, seuil: 90, noteMin: 8, messageHorsLigne: HORS_LIGNE });
    expect(d.message).toBe(HORS_LIGNE);
    expect(d.message).not.toMatch(/seuil|note/i);
  });

  it("ne propose aucun réglage à changer", () => {
    // Les boutons « Baisser le seuil » et « Enlever le filtre de note » ne
    // doivent pas s'afficher : ils ne répareraient rien.
    const d = diagnoseNoResults({ horsLigne: true, seuil: 90, noteMin: 8, messageHorsLigne: HORS_LIGNE });
    expect(d.suggestThreshold).toBeUndefined();
    expect(d.suggestRating).toBeUndefined();
  });

  it("le dit aussi quand les filtres sont parfaitement permissifs", () => {
    const d = diagnoseNoResults({ horsLigne: true, seuil: 50, noteMin: 0, messageHorsLigne: HORS_LIGNE });
    expect(d.message).toBe(HORS_LIGNE);
  });
});

describe("en ligne, le diagnostic des filtres est conservé", () => {
  it("met en cause le seuil seul quand il est trop haut", () => {
    const d = diagnoseNoResults({ horsLigne: false, seuil: 80, noteMin: 5, messageHorsLigne: HORS_LIGNE });
    expect(d.message).toContain("80%");
    expect(d.suggestThreshold).toBe(60);
    expect(d.suggestRating).toBeUndefined();
  });

  it("met en cause la note seule quand le seuil est raisonnable", () => {
    const d = diagnoseNoResults({ horsLigne: false, seuil: 60, noteMin: 8, messageHorsLigne: HORS_LIGNE });
    expect(d.message).toContain("8/10");
    expect(d.suggestRating).toBe(true);
    expect(d.suggestThreshold).toBeUndefined();
  });

  it("met en cause les deux quand les deux sont stricts", () => {
    const d = diagnoseNoResults({ horsLigne: false, seuil: 85, noteMin: 7, messageHorsLigne: HORS_LIGNE });
    expect(d.message).toContain("85%");
    expect(d.message).toContain("7/10");
    expect(d.suggestThreshold).toBe(60);
    expect(d.suggestRating).toBe(true);
  });

  it("reste honnête quand aucun filtre n'explique le vide", () => {
    const d = diagnoseNoResults({ horsLigne: false, seuil: 60, noteMin: 5, messageHorsLigne: HORS_LIGNE });
    expect(d.message).toBe("Impossible de trouver des films pour le moment.");
    expect(d.suggestThreshold).toBeUndefined();
    expect(d.suggestRating).toBeUndefined();
  });

  it("ne bascule pas sur les seuils limites", () => {
    // Les bornes exactes — 70 et 6 — étaient déjà celles du code d'origine ;
    // ce test interdit de les déplacer par inadvertance.
    expect(diagnoseNoResults({ horsLigne: false, seuil: 70, noteMin: 6, messageHorsLigne: HORS_LIGNE }).suggestThreshold).toBeUndefined();
    expect(diagnoseNoResults({ horsLigne: false, seuil: 71, noteMin: 6, messageHorsLigne: HORS_LIGNE }).suggestThreshold).toBe(60);
    expect(diagnoseNoResults({ horsLigne: false, seuil: 70, noteMin: 7, messageHorsLigne: HORS_LIGNE }).suggestRating).toBe(true);
  });
});
