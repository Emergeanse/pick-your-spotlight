import { describe, it, expect } from "vitest";
import { getNotificationRoute } from "@/lib/notification-navigation";
import { construirePush, routePourNotification } from "../../supabase/functions/_shared/notification-routes";

/**
 * La fonction serveur send-push ne peut pas importer le code de l'application :
 * elle a sa copie de la règle « quelle page ouvrir pour quelle notification ».
 * Si les deux divergent, toucher une notification sur le téléphone n'ouvrirait
 * pas la même page que la toucher dans la cloche.
 */

const TYPES = [
  "friend_request", "friend_accepted", "duo_accepted",
  "event_invite", "event_confirmed", "event_film_chosen",
  "session_invite", "type_inconnu",
];
const DONNEES = [null, {}, { event_id: "evt-42" }, { duo_id: "duo-7" }];

describe("même page ouverte depuis le téléphone et depuis la cloche", () => {
  for (const type of TYPES) {
    for (const data of DONNEES) {
      it(`${type} avec ${JSON.stringify(data)}`, () => {
        expect(routePourNotification(type, data)).toBe(getNotificationRoute(type, data));
      });
    }
  }
});

describe("contenu envoyé au téléphone", () => {
  it("reprend titre et texte, et vise la soirée concernée", () => {
    const push = construirePush({
      id: "n1", type: "event_film_chosen", title: "Le film est choisi !", body: "Ce soir : Parasite", data: { event_id: "evt-42" },
    });
    expect(push).toEqual({ title: "Le film est choisi !", body: "Ce soir : Parasite", url: "/app/soirees/evt-42", tag: "event-evt-42" });
  });

  it("regroupe par soirée, sinon par notification ; texte vide plutôt que null", () => {
    const push = construirePush({ id: "n2", type: "friend_request", title: "Léa veut être ton amie", body: null, data: null });
    expect(push.tag).toBe("notif-n2");
    expect(push.body).toBe("");
  });
});
