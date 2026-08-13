/**
 * Remontée des erreurs du navigateur.
 *
 * Avant ça, une erreur chez un utilisateur n'existait que dans sa console :
 * personne ne la voyait jamais. Elle atterrit désormais dans `error_events`,
 * lisible par les seuls administrateurs.
 *
 * Trois règles de conduite, parce qu'un journal d'erreurs qui casse
 * l'application est pire que pas de journal :
 *
 *   — il n'échoue jamais bruyamment : toute erreur d'envoi est avalée ;
 *   — il ne se déclenche jamais sur lui-même, sous peine de boucle ;
 *   — il se tait sur les répétitions, pour ne pas noyer la table à cause d'une
 *     erreur qui se relance en boucle dans un rendu React.
 */
import { supabase } from "@/integrations/supabase/client";

const MAX_MESSAGE = 2000;
const MAX_STACK = 8000;

/** Empreintes déjà envoyées pendant cette visite, et à quel moment. */
const dejaVues = new Map<string, number>();
/** Deux minutes : assez pour étouffer une boucle, assez court pour revoir un vrai retour. */
const SILENCE_MS = 2 * 60 * 1000;
/** Garde-fou absolu par session, au cas où les empreintes varieraient à l'infini. */
const MAX_PAR_SESSION = 25;
let envoyees = 0;

/** En cours d'envoi : empêche qu'une erreur née de l'envoi ne se signale elle-même. */
let enCours = false;

function tronque(v: string | null | undefined, max: number): string | null {
  if (!v) return null;
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}

function empreinte(message: string, stack: string | null): string {
  // La première ligne de pile suffit à distinguer deux erreurs ; le reste varie
  // trop d'un rendu à l'autre pour servir d'identité.
  return `${message}::${stack?.split("\n")[1]?.trim() ?? ""}`;
}

export interface ErrorContext {
  /** D'où vient le signalement : « frontière React », « promesse non gérée »… */
  origine?: string;
  [clef: string]: unknown;
}

/**
 * Signale une erreur. Ne lève jamais, ne bloque jamais l'appelant — l'appel peut
 * être laissé sans `await`.
 */
export async function reportError(error: unknown, context: ErrorContext = {}): Promise<void> {
  if (enCours || envoyees >= MAX_PAR_SESSION) return;

  try {
    enCours = true;

    const message = tronque(
      error instanceof Error ? error.message : String(error),
      MAX_MESSAGE,
    );
    if (!message) return;

    const stack = tronque(error instanceof Error ? error.stack ?? null : null, MAX_STACK);

    const clef = empreinte(message, stack);
    const vueA = dejaVues.get(clef);
    if (vueA && Date.now() - vueA < SILENCE_MS) return;
    dejaVues.set(clef, Date.now());

    const { data } = await supabase.auth.getSession();

    await supabase.from("error_events").insert({
      user_id: data.session?.user?.id ?? null,
      source: "client",
      message,
      stack,
      route: tronque(typeof location !== "undefined" ? location.pathname + location.search : null, 500),
      user_agent: tronque(typeof navigator !== "undefined" ? navigator.userAgent : null, 500),
      context: context as Record<string, unknown>,
    });

    envoyees += 1;
  } catch {
    // Volontairement muet. Un journal d'erreurs qui se plaint de ne pas pouvoir
    // journaliser ajoute du bruit sans rien résoudre.
  } finally {
    enCours = false;
  }
}

/**
 * Branche les deux filets globaux du navigateur : erreurs non rattrapées et
 * promesses rejetées sans `catch`. À appeler une fois au démarrage.
 */
export function installGlobalErrorReporting(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (e) => {
    void reportError(e.error ?? e.message, { origine: "erreur non rattrapée" });
  });

  window.addEventListener("unhandledrejection", (e) => {
    void reportError(e.reason, { origine: "promesse non gérée" });
  });
}
