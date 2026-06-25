export function getNotificationRoute(
  type: string,
  data: Record<string, unknown> | null | undefined,
): string {
  if (type === "friend_request" || type === "friend_accepted") {
    return "/app/friends";
  }
  if (type === "duo_accepted") {
    return "/app/duo";
  }
  if (type === "session_invite") {
    return "/app/pick-together-group";
  }
  if (
    type === "event_invite" ||
    type === "event_confirmed" ||
    type === "event_film_chosen"
  ) {
    const eventId = data?.event_id;
    if (eventId) return `/app/soirees/${eventId}`;
    return "/app/soirees";
  }
  return "/app";
}

export function getNotificationIcon(type: string): string {
  switch (type) {
    case "friend_request":
      return "👋";
    case "friend_accepted":
      return "🤝";
    case "duo_accepted":
      return "💑";
    case "session_invite":
      return "🎬";
    case "event_invite":
      return "🎉";
    case "event_confirmed":
      return "✅";
    case "event_film_chosen":
      return "🎩";
    default:
      return "🔔";
  }
}
