import { describe, it, expect } from "vitest";
import {
  readSnooze,
  isIosSafari,
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

describe("reconnaître Safari sur iPhone et iPad", () => {
  // Safari iOS n'envoie jamais l'événement d'installation : on montre le geste
  // à la main, donc seulement là où ce geste existe tel qu'on le décrit.
  const IPHONE_SAFARI =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const IPAD_DEGUISE_EN_MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
  const CHROME_IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1";
  const APPLI_GOOGLE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/335.0.668384077 Mobile/15E148 Safari/604.1";
  const INSTAGRAM =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0";
  const CHROME_ANDROID =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";

  it("reconnaît Safari sur iPhone", () => {
    expect(isIosSafari(IPHONE_SAFARI, 5)).toBe(true);
  });

  it("démasque l'iPad qui se fait passer pour un Mac", () => {
    expect(isIosSafari(IPAD_DEGUISE_EN_MAC, 5)).toBe(true);
  });

  it("laisse tranquille un vrai Mac", () => {
    expect(isIosSafari(IPAD_DEGUISE_EN_MAC, 0)).toBe(false);
  });

  it("écarte les autres navigateurs iOS, qui rangent Partager ailleurs", () => {
    expect(isIosSafari(CHROME_IPHONE, 5)).toBe(false);
    expect(isIosSafari(APPLI_GOOGLE, 5)).toBe(false);
  });

  it("écarte les navigateurs intégrés, qui ne savent pas installer", () => {
    expect(isIosSafari(INSTAGRAM, 5)).toBe(false);
  });

  it("ne confond pas Android avec iOS", () => {
    expect(isIosSafari(CHROME_ANDROID, 5)).toBe(false);
  });
});
