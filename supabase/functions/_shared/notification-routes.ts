/**
 * Page ouverte quand on touche une notification sur le téléphone.
 *
 * Copie de `getNotificationRoute` (src/lib/notification-navigation.ts) : les
 * fonctions serveur ne peuvent pas importer le code de l'application. Un test
 * (src/test/notification-routes-parity.test.ts) vérifie que les deux restent
 * identiques pour chaque type.
 */
export function routePourNotification(
  type: string,
  data: Record<string, unknown> | null | undefined,
): string {
  if (type === "friend_request" || type === "friend_accepted") return "/app/friends";
  if (type === "duo_accepted") return "/app/duo";
  if (type === "film_recommended") {
    const tmdbId = data?.tmdb_id;
    if (!tmdbId) return "/app/my-cinema?onglet=watchlist";
    const media = data?.media_type === "tv" ? "tv" : "movie";
    return `/app/my-cinema?onglet=watchlist&film=${tmdbId}&media=${media}`;
  }
  if (type === "event_invite" || type === "event_confirmed" || type === "event_film_chosen") {
    const eventId = data?.event_id;
    if (eventId) return `/app/soirees/${eventId}`;
    return "/app/soirees";
  }
  return "/app";
}

export interface ContenuPush {
  title: string;
  body: string;
  url: string;
  /** Regroupe les notifications d'un même sujet sur le téléphone. */
  tag: string;
}

/** Le message réellement envoyé, construit à partir d'une ligne `notifications`. */
export function construirePush(notif: {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
}): ContenuPush {
  const eventId = notif.data?.event_id;
  return {
    title: notif.title,
    body: notif.body ?? "",
    url: routePourNotification(notif.type, notif.data),
    tag: eventId ? `event-${eventId}` : `notif-${notif.id}`,
  };
}
