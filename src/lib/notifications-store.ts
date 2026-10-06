import { useSyncExternalStore } from "react";
import type { NotificationItem } from "@/lib/friend-notifications";

/**
 * Notifications partagées entre la cloche de l'en-tête et la carte « dernière
 * notification » de l'accueil.
 *
 * La cloche reste la seule à les lire et à s'abonner au temps réel : un second
 * abonnement Supabase sur le même canal se marcherait dessus. Elle publie ici
 * la liste à jour ; l'accueil la lit, et peut demander à la cloche d'ouvrir
 * son panneau (« Tout voir »).
 */
interface EtatNotifications {
  notifications: NotificationItem[];
  /** Incrémenté à chaque demande d'ouverture du panneau de la cloche. */
  demandesOuverture: number;
}

let etat: EtatNotifications = { notifications: [], demandesOuverture: 0 };
const abonnes = new Set<() => void>();

function publier(suivant: EtatNotifications) {
  etat = suivant;
  abonnes.forEach((f) => f());
}

export const notificationsStore = {
  lire: () => etat,
  abonner(f: () => void) {
    abonnes.add(f);
    return () => { abonnes.delete(f); };
  },
  definirNotifications(notifications: NotificationItem[]) {
    publier({ ...etat, notifications });
  },
  ouvrirPanneau() {
    publier({ ...etat, demandesOuverture: etat.demandesOuverture + 1 });
  },
};

export function useNotificationsStore(): EtatNotifications {
  return useSyncExternalStore(notificationsStore.abonner, notificationsStore.lire, notificationsStore.lire);
}
