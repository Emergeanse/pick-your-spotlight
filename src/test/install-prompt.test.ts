import { describe, it, expect } from "vitest";
import {
  readSnooze,
  shouldOfferInstall,
  INSTALL_SNOOZE_MS,
} from "@/hooks/use-install-prompt";

/**
 * L'invitation à installer Pick se juge sur trois choses : l'application
 * tourne-t-elle déjà depuis l'écran d'accueil, l'a-t-on déjà refusée, et
 * depuis combien de temps. Une invitation qui revient à chaque ouverture
 * cesse d'être une proposition.
 */

const MAINTENANT = Date.UTC(2026, 9, 5, 12, 0, 0);

describe("relecture de la date de refus", () => {
  it("accepte une date écrite normalement", () => {
    expect(readSnooze(String(MAINTENANT))).toBe(MAINTENANT);
  });

  it("traite l'absence de valeur comme l'absence de refus", () => {
    expect(readSnooze(null)).toBeNull();
    expect(readSnooze("")).toBeNull();
  });

  it("ne se laisse pas abîmer par une valeur corrompue", () => {
    // Un stockage partagé avec d'autres onglets, d'autres versions, voire une
    // extension : la valeur relue n'est pas forcément celle qu'on a écrite.
    expect(readSnooze("bientôt")).toBeNull();
    expect(readSnooze("NaN")).toBeNull();
    expect(readSnooze("-1")).toBeNull();
    expect(readSnooze("0")).toBeNull();
  });
});

describe("faut-il proposer l'installation", () => {
  it("propose à qui n'a jamais rien refusé", () => {
    expect(
      shouldOfferInstall({ dejaInstallee: false, refuseeLe: null, maintenant: MAINTENANT }),
    ).toBe(true);
  });

  it("se tait quand l'application tourne déjà depuis l'écran d'accueil", () => {
    expect(
      shouldOfferInstall({ dejaInstallee: true, refuseeLe: null, maintenant: MAINTENANT }),
    ).toBe(false);
  });

  it("se tait le lendemain d'un refus", () => {
    const hier = MAINTENANT - 24 * 60 * 60 * 1000;
    expect(
      shouldOfferInstall({ dejaInstallee: false, refuseeLe: hier, maintenant: MAINTENANT }),
    ).toBe(false);
  });

  it("repropose une fois le mois écoulé", () => {
    const ilYaUnMois = MAINTENANT - INSTALL_SNOOZE_MS;
    expect(
      shouldOfferInstall({ dejaInstallee: false, refuseeLe: ilYaUnMois, maintenant: MAINTENANT }),
    ).toBe(true);
  });

  it("ne se tait pas pour toujours si l'horloge a reculé", () => {
    // Un refus daté du futur — fuseau horaire changé, horloge remise à l'heure —
    // donnerait un écart négatif, donc une sourdine éternelle.
    const demain = MAINTENANT + 24 * 60 * 60 * 1000;
    expect(
      shouldOfferInstall({ dejaInstallee: false, refuseeLe: demain, maintenant: MAINTENANT }),
    ).toBe(true);
  });

  it("la sourdine l'emporte toujours sur rien, mais jamais sur l'installation", () => {
    const hier = MAINTENANT - 24 * 60 * 60 * 1000;
    expect(
      shouldOfferInstall({ dejaInstallee: true, refuseeLe: hier, maintenant: MAINTENANT }),
    ).toBe(false);
  });
});
