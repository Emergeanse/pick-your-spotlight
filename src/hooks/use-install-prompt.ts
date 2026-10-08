import { useCallback, useEffect, useState } from "react";

/**
 * L'invitation à installer Pick sur l'écran d'accueil.
 *
 * Chrome Android n'ouvre cette porte que si l'application remplit ses critères
 * (manifeste valide + service worker qui répond aux navigations) : l'événement
 * `beforeinstallprompt` n'arrive jamais sinon, et la bannière ne s'affiche pas.
 * Rien à masquer à la main sur un navigateur qui ne sait pas installer.
 *
 * Safari iOS est l'exception : il sait installer (Partager → Sur l'écran
 * d'accueil) mais n'envoie jamais `beforeinstallprompt` et ne laisse aucune
 * page ouvrir cette fenêtre. On ne peut qu'expliquer le geste à faire.
 *
 * La logique de décision est sortie du hook (`shouldOfferInstall`, `readSnooze`)
 * pour être testable sans navigateur.
 */

/**
 * `beforeinstallprompt` n'est pas dans la bibliothèque TypeScript standard.
 * Le type est déclaré ici plutôt que contourné par un `any` : le cliquet de
 * lint ne descend que si on arrête d'en ajouter.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export const INSTALL_SNOOZE_KEY = "pick_install_snooze";

/**
 * Un « plus tard » met l'invitation en sourdine un mois. Redemander à chaque
 * ouverture transformerait une proposition en harcèlement.
 */
export const INSTALL_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Relit la date du dernier refus. Tolère une valeur absente, vide ou abîmée :
 * dans le doute on considère qu'aucun refus n'a été exprimé.
 */
export function readSnooze(brut: string | null): number | null {
  if (!brut) return null;
  const date = Number(brut);
  if (!Number.isFinite(date) || date <= 0) return null;
  return date;
}

export function shouldOfferInstall(etat: {
  dejaInstallee: boolean;
  refuseeLe: number | null;
  maintenant: number;
}): boolean {
  if (etat.dejaInstallee) return false;
  if (etat.refuseeLe === null) return true;
  // Une horloge reculée (changement de fuseau, date bidouillée) donnerait un
  // écart négatif : on repropose plutôt que de rester muet pour toujours.
  const ecart = etat.maintenant - etat.refuseeLe;
  return ecart < 0 || ecart >= INSTALL_SNOOZE_MS;
}

/** Vraie quand la page tourne déjà depuis l'icône de l'écran d'accueil. */
export function isStandalone(): boolean {
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    // Safari iOS n'implémente pas `display-mode` et passe par cette propriété.
    const nav = navigator as Navigator & { standalone?: boolean };
    return nav.standalone === true;
  } catch {
    return false;
  }
}

/**
 * Vraie pour Safari sur iPhone ou iPad — le seul navigateur iOS où l'on puisse
 * montrer le chemin « Partager → Sur l'écran d'accueil » sans se tromper.
 *
 * - L'iPad se fait passer pour un Mac depuis iPadOS 13 ; seul l'écran tactile
 *   le trahit (un vrai Mac annonce 0 point de contact).
 * - Chrome, Firefox, Edge, Opera et l'appli Google sur iOS gardent le jeton
 *   « Safari » mais rangent le bouton Partager ailleurs : on les écarte plutôt
 *   que de décrire un bouton qu'ils n'ont pas au même endroit.
 * - Les navigateurs intégrés (Instagram, Facebook…) n'ont pas le jeton
 *   « Safari/ » et ne savent pas installer du tout.
 */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  const ios =
    /iPhone|iPad|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (!ios) return false;
  if (!/Safari\//.test(userAgent)) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\//.test(userAgent);
}

function detecterIosSafari(): boolean {
  try {
    return isIosSafari(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  } catch {
    return false;
  }
}

function lireRefus(): number | null {
  try {
    return readSnooze(localStorage.getItem(INSTALL_SNOOZE_KEY));
  } catch {
    // Navigation privée ou stockage bloqué : on propose, sans mémoire.
    return null;
  }
}

function noterRefus(): void {
  try {
    localStorage.setItem(INSTALL_SNOOZE_KEY, String(Date.now()));
  } catch {
    // Sans stockage, l'invitation reviendra à la prochaine visite. Tant pis.
  }
}

function oublierRefus(): void {
  try {
    localStorage.removeItem(INSTALL_SNOOZE_KEY);
  } catch {
    // Idem : rien à rattraper.
  }
}

export interface InstallPrompt {
  /** Vraie quand la bannière a lieu d'être affichée. */
  proposable: boolean;
  /**
   * « navigateur » : un bouton ouvre la vraie fenêtre d'installation.
   * « ios » : aucune fenêtre possible, la bannière explique le geste.
   */
  mode: "navigateur" | "ios";
  /** Ouvre la vraie fenêtre d'installation du navigateur. */
  installer: () => Promise<void>;
  /** « Plus tard » : range l'invitation pour un mois. */
  remettre: () => void;
}

export function useInstallPrompt(): InstallPrompt {
  // L'événement a pu arriver avant le chargement de l'app (voir index.html).
  const [evenement, setEvenement] = useState<BeforeInstallPromptEvent | null>(
    () => (window as Window & { __pickInstall?: BeforeInstallPromptEvent }).__pickInstall ?? null,
  );
  const [iosSafari] = useState(detecterIosSafari);
  // Sur iOS aucun événement ne disparaît au refus : il faut s'en souvenir ici.
  const [rangee, setRangee] = useState(false);

  useEffect(() => {
    const capturer = (e: Event) => {
      // Sans ça, Chrome affiche sa propre barre d'installation en bas de page,
      // qui recouvre la barre d'onglets.
      e.preventDefault();
      setEvenement(e as BeforeInstallPromptEvent);
    };
    const repris = () => {
      const e = (window as Window & { __pickInstall?: BeforeInstallPromptEvent }).__pickInstall;
      if (e) setEvenement(e);
    };
    const installee = () => {
      (window as Window & { __pickInstall?: BeforeInstallPromptEvent }).__pickInstall = undefined;
      setEvenement(null);
      // L'application est posée sur l'écran d'accueil : la sourdine n'a plus
      // d'objet, et la garder fausserait une réinstallation plus tard.
      oublierRefus();
    };

    window.addEventListener("beforeinstallprompt", capturer);
    window.addEventListener("pick-install-pret", repris);
    window.addEventListener("appinstalled", installee);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturer);
      window.removeEventListener("pick-install-pret", repris);
      window.removeEventListener("appinstalled", installee);
    };
  }, []);

  const installer = useCallback(async () => {
    if (!evenement) return;
    // L'événement n'est utilisable qu'une fois : on le retire d'abord, pour
    // qu'un double appui ne déclenche pas deux fenêtres.
    setEvenement(null);
    (window as Window & { __pickInstall?: BeforeInstallPromptEvent }).__pickInstall = undefined;
    await evenement.prompt();
    const choix = await evenement.userChoice;
    if (choix.outcome === "dismissed") noterRefus();
  }, [evenement]);

  const remettre = useCallback(() => {
    noterRefus();
    setEvenement(null);
    setRangee(true);
  }, []);

  const proposable =
    !rangee &&
    (evenement !== null || iosSafari) &&
    shouldOfferInstall({
      dejaInstallee: isStandalone(),
      refuseeLe: lireRefus(),
      maintenant: Date.now(),
    });

  return { proposable, mode: evenement !== null ? "navigateur" : "ios", installer, remettre };
}
