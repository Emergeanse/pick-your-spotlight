import { describe, it, expect } from "vitest";
import { notificationsStore } from "@/lib/notifications-store";
import type { NotificationItem } from "@/lib/friend-notifications";

/**
 * La cloche publie ses notifications, l'accueil les lit et peut demander
 * l'ouverture du panneau. Un abonné doit être prévenu de chaque changement, et
 * cesser de l'être une fois désabonné.
 */

const notif = (id: string): NotificationItem => ({
  id, type: "event_invite", title: `Invitation ${id}`, body: null, data: null, read: false, created_at: "2026-10-06T12:00:00Z",
});

describe("notifications partagées entre la cloche et l'accueil", () => {
  it("transmet la liste publiée par la cloche", () => {
    notificationsStore.definirNotifications([notif("a"), notif("b")]);
    expect(notificationsStore.lire().notifications.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("compte chaque demande d'ouverture du panneau", () => {
    const avant = notificationsStore.lire().demandesOuverture;
    notificationsStore.ouvrirPanneau();
    notificationsStore.ouvrirPanneau();
    expect(notificationsStore.lire().demandesOuverture).toBe(avant + 2);
  });

  it("prévient les abonnés, puis plus du tout une fois désabonnés", () => {
    let appels = 0;
    const desabonner = notificationsStore.abonner(() => { appels++; });
    notificationsStore.definirNotifications([notif("c")]);
    expect(appels).toBe(1);
    desabonner();
    notificationsStore.ouvrirPanneau();
    expect(appels).toBe(1);
  });

  it("conserve les notifications quand on demande l'ouverture", () => {
    notificationsStore.definirNotifications([notif("d")]);
    notificationsStore.ouvrirPanneau();
    expect(notificationsStore.lire().notifications[0].id).toBe("d");
  });
});
