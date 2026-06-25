import { describe, expect, it } from "vitest";
import {
  countUnreadNotifications,
  isPersistedNotificationId,
  mergeFriendRequestNotifications,
  type NotificationItem,
} from "@/lib/friend-notifications";

describe("mergeFriendRequestNotifications", () => {
  const baseNotification: NotificationItem = {
    id: "notif-1",
    type: "event_invite",
    title: "Soirée ciné",
    body: "Tu es invité·e",
    data: { event_id: "evt-1" },
    read: false,
    created_at: "2026-06-25T10:00:00.000Z",
  };

  it("ajoute une demande d'ami synthétique si aucune notification n'existe", () => {
    const merged = mergeFriendRequestNotifications([], [{
      friendshipId: "friendship-abc",
      requesterName: "Alice",
      createdAt: "2026-06-25T12:00:00.000Z",
    }]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("friendship-friendship-abc");
    expect(merged[0].type).toBe("friend_request");
    expect(merged[0].title).toBe("Alice veut être ton ami !");
    expect(merged[0].read).toBe(false);
  });

  it("évite les doublons quand une notification friend_request existe déjà", () => {
    const existing: NotificationItem = {
      id: "notif-fr",
      type: "friend_request",
      title: "Alice veut être ton ami !",
      body: "Accepte sa demande pour regarder des films ensemble.",
      data: { friendship_id: "friendship-abc" },
      read: false,
      created_at: "2026-06-25T12:00:00.000Z",
    };

    const merged = mergeFriendRequestNotifications([existing], [{
      friendshipId: "friendship-abc",
      requesterName: "Alice",
      createdAt: "2026-06-25T12:00:00.000Z",
    }]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("notif-fr");
  });

  it("trie par date décroissante et limite à 20 éléments", () => {
    const notifications = Array.from({ length: 19 }, (_, i) => ({
      ...baseNotification,
      id: `notif-${i}`,
      created_at: `2026-06-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
    }));

    const pending = Array.from({ length: 3 }, (_, i) => ({
      friendshipId: `pending-${i}`,
      requesterName: `User ${i}`,
      createdAt: `2026-06-${String(20 + i).padStart(2, "0")}T10:00:00.000Z`,
    }));

    const merged = mergeFriendRequestNotifications(notifications, pending);
    expect(merged).toHaveLength(20);
    expect(merged[0].created_at).toBe("2026-06-22T10:00:00.000Z");
    expect(merged[0].id).toBe("friendship-pending-2");
  });
});

describe("countUnreadNotifications", () => {
  it("compte les notifications non lues, y compris les demandes d'ami synthétiques", () => {
    const items: NotificationItem[] = [
      { id: "1", type: "friend_request", title: "A", body: null, data: null, read: false, created_at: "" },
      { id: "2", type: "event_invite", title: "B", body: null, data: null, read: true, created_at: "" },
      { id: "friendship-x", type: "friend_request", title: "C", body: null, data: null, read: false, created_at: "" },
    ];

    expect(countUnreadNotifications(items)).toBe(2);
  });
});

describe("isPersistedNotificationId", () => {
  it("identifie les notifications persistées vs synthétiques", () => {
    expect(isPersistedNotificationId("uuid-123")).toBe(true);
    expect(isPersistedNotificationId("friendship-abc")).toBe(false);
  });
});
