import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchVisibleProfiles } from "@/lib/visible-profiles";

/**
 * Conseiller un film à un ami.
 *
 * Envoi : une ligne `shared_recommendations` par ami. Le serveur vérifie que
 * c'est bien un ami (politique RLS) et crée la notification « Léa te conseille
 * Parasite » avec le vrai prénom de l'expéditeur — qui part aussi sur son
 * téléphone s'il a activé les notifications.
 *
 * Réception : les conseils restent dans l'onglet « À voir » de la Biblio
 * jusqu'à ce qu'on les écarte (`dismissed`).
 */

export interface FilmAConseiller {
  tmdbId: number;
  titre: string;
  posterPath: string | null;
  mediaType: "movie" | "tv";
}

export const MESSAGE_CONSEIL_MAX = 140;

export interface ConseilRecu {
  id: string;
  tmdbId: number;
  titre: string;
  posterPath: string | null;
  mediaType: "movie" | "tv";
  message: string | null;
  conseillePar: string;
  creeLe: string;
}

/** Envoie le conseil à chaque ami choisi. Renvoie le nombre d'envois réussis. */
export async function envoyerConseil(
  expediteurId: string,
  film: FilmAConseiller,
  amis: string[],
  message?: string,
): Promise<number> {
  const mot = message?.trim().slice(0, MESSAGE_CONSEIL_MAX) || null;
  const lignes = amis.map((amiId) => ({
    sender_id: expediteurId,
    receiver_id: amiId,
    tmdb_id: film.tmdbId,
    title: film.titre,
    poster_path: film.posterPath,
    media_type: film.mediaType,
    message: mot,
  }));
  if (lignes.length === 0) return 0;
  const { data, error } = await supabase.from("shared_recommendations" as never).insert(lignes as never).select("id");
  if (error) throw error;
  return (data as unknown[] | null)?.length ?? 0;
}

/** Conseils reçus, non écartés, du plus récent au plus ancien. */
export async function listerConseilsRecus(userId: string): Promise<ConseilRecu[]> {
  const { data, error } = await supabase
    .from("shared_recommendations" as never)
    .select("id, tmdb_id, title, poster_path, media_type, message, sender_id, created_at")
    .eq("receiver_id", userId)
    .eq("dismissed", false)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const lignes = (data ?? []) as Array<{
    id: string; tmdb_id: number; title: string; poster_path: string | null;
    media_type: "movie" | "tv" | null; message: string | null; sender_id: string; created_at: string;
  }>;
  if (lignes.length === 0) return [];

  const profils = await fetchVisibleProfiles(lignes.map((l) => l.sender_id));
  const nomDe = new Map(profils.map((p) => [p.id, p.display_name ?? "Un ami"]));

  return lignes.map((l) => ({
    id: l.id,
    tmdbId: l.tmdb_id,
    titre: l.title,
    posterPath: l.poster_path,
    mediaType: l.media_type ?? "movie",
    message: l.message,
    conseillePar: nomDe.get(l.sender_id) ?? "Un ami",
    creeLe: l.created_at,
  }));
}

/** Retire un conseil reçu de « À voir ». */
export async function ecarterConseil(conseilId: string): Promise<void> {
  const { error } = await supabase
    .from("shared_recommendations" as never)
    .update({ dismissed: true } as never)
    .eq("id", conseilId);
  if (error) throw error;
}

// ── Proposition après un « j'aime » : une seule fois par film ──

const PROPOSE_KEY = "pick_conseil_propose";

export function conseilDejaPropose(tmdbId: number): boolean {
  try {
    return (JSON.parse(localStorage.getItem(PROPOSE_KEY) || "[]") as number[]).includes(tmdbId);
  } catch {
    return false;
  }
}

export function noterConseilPropose(tmdbId: number): void {
  try {
    const deja = JSON.parse(localStorage.getItem(PROPOSE_KEY) || "[]") as number[];
    // Garde les 500 derniers : la liste ne doit pas grossir sans fin.
    localStorage.setItem(PROPOSE_KEY, JSON.stringify([...deja.filter((id) => id !== tmdbId), tmdbId].slice(-500)));
  } catch {
    // Sans stockage, la proposition pourra revenir : sans gravité.
  }
}

// ── Ouverture du sélecteur d'amis depuis n'importe quel écran ──

let filmOuvert: FilmAConseiller | null = null;
const abonnes = new Set<() => void>();
const publier = (f: FilmAConseiller | null) => { filmOuvert = f; abonnes.forEach((a) => a()); };

export const conseilStore = {
  lire: () => filmOuvert,
  abonner(f: () => void) { abonnes.add(f); return () => { abonnes.delete(f); }; },
  ouvrir: (film: FilmAConseiller) => publier(film),
  fermer: () => publier(null),
};

export function useFilmAConseiller(): FilmAConseiller | null {
  return useSyncExternalStore(conseilStore.abonner, conseilStore.lire, conseilStore.lire);
}
