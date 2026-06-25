import { describe, expect, it } from "vitest";
import { getNotificationIcon, getNotificationRoute } from "@/lib/notification-navigation";

describe("getNotificationRoute", () => {
  it("redirige event_film_chosen vers la page détail de la soirée", () => {
    expect(getNotificationRoute("event_film_chosen", { event_id: "evt-42" })).toBe(
      "/app/soirees/evt-42",
    );
  });

  it("redirige event_film_chosen sans event_id vers la liste des soirées", () => {
    expect(getNotificationRoute("event_film_chosen", null)).toBe("/app/soirees");
  });

  it("conserve les routes existantes pour les autres types", () => {
    expect(getNotificationRoute("friend_request", null)).toBe("/app/friends");
    expect(getNotificationRoute("event_invite", { event_id: "evt-1" })).toBe("/app/soirees/evt-1");
  });
});

describe("getNotificationIcon", () => {
  it("retourne l'icône film choisi pour event_film_chosen", () => {
    expect(getNotificationIcon("event_film_chosen")).toBe("🎩");
  });
});
