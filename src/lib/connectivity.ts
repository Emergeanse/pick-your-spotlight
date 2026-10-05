import { useEffect, useState } from "react";

/**
 * Savoir si l'appareil est hors ligne.
 *
 * Ça n'avait pas d'objet avant octobre 2026 : sans réseau, l'application ne
 * s'ouvrait pas. Depuis qu'un service worker en garde la coquille, elle
 * s'ouvre très bien — et laisse l'utilisateur lancer des actions qui ne
 * peuvent pas aboutir. Le pipeline de recommandation, lui, interprétait
 * l'absence de réponse comme une absence de résultats et accusait les filtres
 * de l'utilisateur : « Aucun film trouvé à 80 % de correspondance ». On
 * baissait le seuil, on réessayait, et ça recommençait.
 */

/**
 * `navigator.onLine` ne promet pas qu'Internet répond, seulement qu'une
 * interface réseau existe. C'est donc fiable dans un sens et un seul : quand
 * il dit faux, il n'y a effectivement rien à tenter. On ne s'en sert que
 * comme ça — jamais pour conclure que la connexion fonctionne.
 */
export function isOffline(): boolean {
  try {
    return typeof navigator !== "undefined" && navigator.onLine === false;
  } catch {
    // Environnement sans `navigator` : on suppose en ligne plutôt que de
    // bloquer une action qui aurait peut-être marché.
    return false;
  }
}

export const OFFLINE_MESSAGE =
  "Tu es hors ligne. Pick a besoin d'Internet pour chercher un film.";

/** Suit l'état de la connexion et redessine quand il change. */
export function useOnlineStatus(): boolean {
  const [enLigne, setEnLigne] = useState(() => !isOffline());

  useEffect(() => {
    const majEnLigne = () => setEnLigne(true);
    const majHorsLigne = () => setEnLigne(false);
    window.addEventListener("online", majEnLigne);
    window.addEventListener("offline", majHorsLigne);
    // L'état a pu changer entre le premier rendu et l'abonnement.
    setEnLigne(!isOffline());
    return () => {
      window.removeEventListener("online", majEnLigne);
      window.removeEventListener("offline", majHorsLigne);
    };
  }, []);

  return enLigne;
}
