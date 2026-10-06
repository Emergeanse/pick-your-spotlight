import { describe, it, expect } from "vitest";
import { cleEnOctets, doitProposerPush, PUSH_SNOOZE_MS, VAPID_PUBLIC_KEY } from "@/lib/push";

/**
 * Notifications sur le téléphone : la clé publique doit être une clé P-256 non
 * compressée (65 octets, commençant par 0x04), sans quoi l'abonnement échoue ;
 * et la proposition d'activer ne doit apparaître qu'au bon moment.
 */

const MAINTENANT = Date.UTC(2026, 9, 6, 12, 0, 0);
const base = {
  supporte: true,
  permission: "default" as NotificationPermission,
  dejaAbonne: false,
  aDesNotifications: true,
  remisLe: null,
  maintenant: MAINTENANT,
};

describe("clé publique VAPID", () => {
  it("est une clé P-256 non compressée de 65 octets", () => {
    const octets = cleEnOctets(VAPID_PUBLIC_KEY);
    expect(octets.length).toBe(65);
    expect(octets[0]).toBe(0x04);
  });

  it("décode le base64 url, rembourrage compris", () => {
    expect(Array.from(cleEnOctets("AQID"))).toEqual([1, 2, 3]);
    expect(Array.from(cleEnOctets("_-8"))).toEqual([0xff, 0xef]);
  });
});

describe("faut-il proposer les notifications sur le téléphone", () => {
  it("propose à qui a déjà reçu des notifications et n'a jamais répondu", () => {
    expect(doitProposerPush(base)).toBe(true);
  });

  it("ne propose jamais à la première ouverture, sans aucune notification", () => {
    expect(doitProposerPush({ ...base, aDesNotifications: false })).toBe(false);
  });

  it("se tait si le navigateur ne sait pas faire (Safari hors écran d'accueil)", () => {
    expect(doitProposerPush({ ...base, supporte: false, permission: null })).toBe(false);
  });

  it("ne repose pas la question déjà tranchée, dans un sens ou dans l'autre", () => {
    expect(doitProposerPush({ ...base, permission: "granted" })).toBe(false);
    expect(doitProposerPush({ ...base, permission: "denied" })).toBe(false);
  });

  it("se tait si ce téléphone est déjà abonné", () => {
    expect(doitProposerPush({ ...base, dejaAbonne: true })).toBe(false);
  });

  it("respecte un « plus tard » pendant un mois", () => {
    const hier = MAINTENANT - 24 * 60 * 60 * 1000;
    expect(doitProposerPush({ ...base, remisLe: hier })).toBe(false);
    expect(doitProposerPush({ ...base, remisLe: MAINTENANT - PUSH_SNOOZE_MS })).toBe(true);
  });

  it("ne reste pas muet pour toujours si l'horloge a reculé", () => {
    expect(doitProposerPush({ ...base, remisLe: MAINTENANT + 60_000 })).toBe(true);
  });
});
