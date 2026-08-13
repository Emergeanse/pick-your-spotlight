/**
 * Distinguer les deux 429.
 *
 * Le code 429 recouvre désormais deux situations opposées :
 *
 *   1. Le fournisseur d'IA est saturé. C'est passager — réessayer dans quelques
 *      secondes a du sens.
 *   2. L'utilisateur a épuisé son quota du jour. Ce n'est pas passager du tout —
 *      réessayer ne servira à rien avant demain.
 *
 * Confondre les deux fait boucler l'application sur un refus définitif en
 * affichant « réessaie dans quelques secondes ». D'où ce module : les fonctions
 * serveur marquent le second cas d'un `quotaExceeded: true`, et c'est ce drapeau
 * qu'on lit ici — jamais le seul code de statut.
 */

export interface QuotaRefusal {
  message: string;
  kind: string;
  used: number;
  quota: number | null;
}

/**
 * Extrait le refus de quota d'une erreur `functions.invoke`, ou null si l'erreur
 * est autre chose. Asynchrone car le corps de la réponse n'est pas déjà lu.
 */
export async function readQuotaRefusal(error: unknown): Promise<QuotaRefusal | null> {
  const context = (error as { context?: unknown })?.context;
  if (!context || typeof (context as Response).json !== "function") return null;

  try {
    // `context` est la Response brute ; on la clone pour ne pas priver
    // d'éventuels autres lecteurs de son corps.
    const res = context as Response;
    const body = await (typeof res.clone === "function" ? res.clone() : res).json();
    if (!body?.quotaExceeded) return null;
    return {
      message: String(body.error ?? "Limite quotidienne atteinte."),
      kind: String(body.kind ?? "inconnu"),
      used: Number(body.used ?? 0),
      quota: body.quota == null ? null : Number(body.quota),
    };
  } catch {
    // Corps illisible ou déjà consommé : on ne peut rien affirmer.
    return null;
  }
}

/**
 * Vrai uniquement pour une saturation passagère du fournisseur — le seul cas
 * où réessayer a un sens.
 */
export function isTransientRateLimit(error: unknown, refusal: QuotaRefusal | null): boolean {
  if (refusal) return false;
  const msg = typeof error === "object" && (error as { message?: string })?.message
    ? (error as { message: string }).message
    : String(error);
  return msg.includes("429") || msg.includes("Trop de requêtes");
}
