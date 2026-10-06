import { supabase } from "@/integrations/supabase/client";

/**
 * Notifications sur le téléphone (web push), côté application.
 *
 * Activer = demander l'autorisation du navigateur, abonner le service worker
 * auprès du service de notification (Google pour Chrome, Apple pour Safari),
 * puis enregistrer l'abonnement dans `push_subscriptions`. Le serveur s'en sert
 * ensuite à chaque nouvelle notification (fonction send-push).
 *
 * Sur iPhone, il faut iOS 16.4 et Pick installée sur l'écran d'accueil : dans
 * Safari, `PushManager` n'existe tout simplement pas, et rien n'est proposé.
 */

/** Clé publique VAPID : elle identifie Pick auprès des services de notification. Publique par nature. */
export const VAPID_PUBLIC_KEY =
  "BMdioID6mmEIOXysENaDk7YgaHIjf4GMH3xqU_4qy0ok-Zyf6A-CHOxD8uO1OqvaRJFLLIXczLF4XgnTpUMYnZ8";

export const PUSH_SNOOZE_KEY = "pick_push_snooze";
/** Un « plus tard » range la proposition pour un mois. */
export const PUSH_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

export type EtatPush = "non-supporte" | "refuse" | "actif" | "inactif";

export function pushPrisEnCharge(): boolean {
  try {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  } catch {
    return false;
  }
}

/** Convertit la clé VAPID (base64 url) dans le format attendu par `pushManager.subscribe`. */
export function cleEnOctets(base64Url: string): Uint8Array {
  const rembourrage = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + rembourrage).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(base64);
  const octets = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
  return octets;
}

/**
 * Faut-il proposer d'activer ? Seulement si le navigateur sait faire, que la
 * question n'a pas encore été posée (permission « default »), que l'utilisateur
 * n'a pas répondu « plus tard » ce mois-ci, et qu'il a déjà reçu au moins une
 * notification dans l'application : c'est là qu'il en voit l'intérêt. Jamais à
 * la première ouverture.
 */
export function doitProposerPush(etat: {
  supporte: boolean;
  permission: NotificationPermission | null;
  dejaAbonne: boolean;
  aDesNotifications: boolean;
  remisLe: number | null;
  maintenant: number;
}): boolean {
  if (!etat.supporte || etat.permission !== "default" || etat.dejaAbonne) return false;
  if (!etat.aDesNotifications) return false;
  if (etat.remisLe === null) return true;
  const ecart = etat.maintenant - etat.remisLe;
  return ecart < 0 || ecart >= PUSH_SNOOZE_MS;
}

/** Le service worker n'existe qu'en production : en développement, ne pas attendre indéfiniment. */
async function serviceWorkerPret(): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ]);
}

export async function abonnementActuel(): Promise<PushSubscription | null> {
  if (!pushPrisEnCharge()) return null;
  const reg = await serviceWorkerPret();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function etatPush(): Promise<EtatPush> {
  if (!pushPrisEnCharge()) return "non-supporte";
  if (Notification.permission === "denied") return "refuse";
  return (await abonnementActuel()) ? "actif" : "inactif";
}

/** Demande l'autorisation, abonne ce téléphone et l'enregistre. Renvoie l'état obtenu. */
export async function activerPush(userId: string): Promise<EtatPush> {
  if (!pushPrisEnCharge()) return "non-supporte";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "refuse" : "inactif";

  const reg = await serviceWorkerPret();
  if (!reg) throw new Error("service worker indisponible");

  const abonnement =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: cleEnOctets(VAPID_PUBLIC_KEY),
    }));

  const json = abonnement.toJSON();
  const { error } = await supabase.from("push_subscriptions" as never).upsert(
    {
      user_id: userId,
      endpoint: abonnement.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      user_agent: navigator.userAgent.slice(0, 300),
    } as never,
    { onConflict: "endpoint" },
  );
  if (error) throw error;
  return "actif";
}

/** Désabonne ce téléphone et l'oublie côté serveur. */
export async function desactiverPush(): Promise<void> {
  const abonnement = await abonnementActuel();
  if (!abonnement) return;
  const endpoint = abonnement.endpoint;
  await abonnement.unsubscribe();
  await supabase.from("push_subscriptions" as never).delete().eq("endpoint", endpoint);
}

export function lirePushRemis(): number | null {
  try {
    const brut = localStorage.getItem(PUSH_SNOOZE_KEY);
    const date = brut ? Number(brut) : NaN;
    return Number.isFinite(date) && date > 0 ? date : null;
  } catch {
    return null;
  }
}

export function noterPushRemis(): void {
  try {
    localStorage.setItem(PUSH_SNOOZE_KEY, String(Date.now()));
  } catch {
    // Sans stockage, la proposition reviendra à la prochaine visite.
  }
}
