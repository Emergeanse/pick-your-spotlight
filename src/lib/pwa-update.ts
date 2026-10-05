import { registerSW } from "virtual:pwa-register";

/**
 * Garde l'application installée à jour sans qu'on ait à la réinstaller.
 *
 * Deux trous à boucher, constatés sur iPhone :
 *
 * 1. Le navigateur ne cherche une nouvelle version du service worker qu'au
 *    lancement de la page. Or une application posée sur l'écran d'accueil
 *    n'est presque jamais relancée : iOS la sort de veille, sans navigation,
 *    donc sans vérification. On la déclenche nous-mêmes à chaque retour au
 *    premier plan.
 * 2. Même une fois la nouvelle version installée, l'écran ouvert continue
 *    d'exécuter l'ancien code. En mode `autoUpdate`, `registerSW` recharge la
 *    page dès que le nouveau worker prend la main : c'est ce qui manquait au
 *    script injecté automatiquement, qui se contentait d'enregistrer.
 *
 * Le rechargement ne survient donc que quelques secondes après une ouverture
 * ou un retour dans l'application, jamais au milieu d'une longue utilisation.
 */

/** Filet pour qui garde l'application ouverte au premier plan des heures. */
const VERIFICATION_PERIODIQUE_MS = 60 * 60 * 1000;

export function installPwaUpdates(): void {
  if (!("serviceWorker" in navigator)) return;

  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;

      const verifier = () => {
        if (document.visibilityState !== "visible" || !navigator.onLine) return;
        // Un échec réseau n'a rien de grave : on retentera au prochain retour.
        registration.update().catch(() => {});
      };

      document.addEventListener("visibilitychange", verifier);
      window.setInterval(verifier, VERIFICATION_PERIODIQUE_MS);
    },
  });
}
