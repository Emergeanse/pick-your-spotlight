export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export interface PendingFriendRequest {
  friendshipId: string;
  requesterName: string;
  createdAt: string;
}

const FRIEND_REQUEST_BODY = "Accepte sa demande pour regarder des films ensemble.";

export function mergeFriendRequestNotifications(
  notifications: NotificationItem[],
  pendingReceived: PendingFriendRequest[],
): NotificationItem[] {
  const coveredFriendshipIds = new Set(
    notifications
      .filter((n) => n.type === "friend_request" && n.data?.friendship_id)
      .map((n) => String(n.data!.friendship_id)),
  );

  const synthetic = pendingReceived
    .filter((p) => !coveredFriendshipIds.has(p.friendshipId))
    .map((p) => ({
      id: `friendship-${p.friendshipId}`,
      type: "friend_request",
      title: `${p.requesterName} veut être ton ami !`,
      body: FRIEND_REQUEST_BODY,
      data: { friendship_id: p.friendshipId },
      read: false,
      created_at: p.createdAt,
    }));

  return [...synthetic, ...notifications]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);
}

export function countUnreadNotifications(notifications: NotificationItem[]): number {
  return notifications.filter((n) => !n.read).length;
}

export function isPersistedNotificationId(id: string): boolean {
  return !id.startsWith("friendship-");
}
