import { describe, it, expect, beforeEach, vi } from "vitest";
import { conseilDejaPropose, noterConseilPropose, conseilStore, MESSAGE_CONSEIL_MAX } from "@/lib/conseils";
import { getNotificationRoute, getNotificationIcon } from "@/lib/notification-navigation";

/**
 * Conseiller un film à un ami : la proposition après un « j'aime » ne revient
 * qu'une fois par film, le panneau s'ouvre depuis n'importe quel écran, et la
 * notification reçue mène à la fiche du film dans « À voir ».
 */

// Node 26 masque le localStorage de jsdom : un stockage en mémoire suffit ici.
const memoire = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memoire.get(k) ?? null,
  setItem: (k: string, v: string) => { memoire.set(k, String(v)); },
  removeItem: (k: string) => { memoire.delete(k); },
  clear: () => memoire.clear(),
});

describe("proposition « conseille-le à un ami », une seule fois par film", () => {
  beforeEach(() => localStorage.clear());

  it("n'a jamais été proposée au départ", () => {
    expect(conseilDejaPropose(496243)).toBe(false);
  });

  it("ne revient plus une fois proposée, pour ce film seulement", () => {
    noterConseilPropose(496243);
    expect(conseilDejaPropose(496243)).toBe(true);
    expect(conseilDejaPropose(27205)).toBe(false);
  });

  it("garde au plus 500 films en mémoire", () => {
    for (let i = 1; i <= 520; i++) noterConseilPropose(i);
    expect(conseilDejaPropose(1)).toBe(false);
    expect(conseilDejaPropose(520)).toBe(true);
    expect((JSON.parse(localStorage.getItem("pick_conseil_propose")!) as number[]).length).toBe(500);
  });

  it("résiste à un stockage abîmé", () => {
    localStorage.setItem("pick_conseil_propose", "{pas du json");
    expect(conseilDejaPropose(1)).toBe(false);
  });
});

describe("ouverture du panneau depuis n'importe quelle fiche", () => {
  it("transmet le film, puis se referme", () => {
    const film = { tmdbId: 496243, titre: "Parasite", posterPath: null, mediaType: "movie" as const };
    let appels = 0;
    const desabonner = conseilStore.abonner(() => { appels++; });
    conseilStore.ouvrir(film);
    expect(conseilStore.lire()).toEqual(film);
    conseilStore.fermer();
    expect(conseilStore.lire()).toBeNull();
    expect(appels).toBe(2);
    desabonner();
  });
});

describe("notification « Léa te conseille Parasite »", () => {
  it("ouvre la fiche du film dans « À voir »", () => {
    expect(getNotificationRoute("film_recommended", { tmdb_id: 496243, media_type: "movie" }))
      .toBe("/app/my-cinema?onglet=watchlist&film=496243&media=movie");
    expect(getNotificationRoute("film_recommended", { tmdb_id: 1399, media_type: "tv" }))
      .toBe("/app/my-cinema?onglet=watchlist&film=1399&media=tv");
  });

  it("sans film précisé, ouvre au moins « À voir »", () => {
    expect(getNotificationRoute("film_recommended", {})).toBe("/app/my-cinema?onglet=watchlist");
  });

  it("a sa propre icône, et un petit mot reste court", () => {
    expect(getNotificationIcon("film_recommended")).toBe("💌");
    expect(MESSAGE_CONSEIL_MAX).toBe(140);
  });
});
