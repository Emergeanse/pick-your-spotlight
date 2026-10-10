import { supabase } from "@/integrations/supabase/client";
import { evaluerAdhesion } from "@/lib/adhesion";
import { getRecommendationScore, type RecommendationMatchData } from "@/lib/recommendation-batch";
import type { MovieDetail } from "@/lib/tmdb";

/**
 * Conseils de film gardés une fois pour toutes : la note d'adhésion et le
 * texte « Pourquoi c'est pour toi » du premier conseil reçu pour un film sont
 * réaffichés tels quels, sans rappeler l'IA. Un conseil reste le même.
 *
 * - une copie dans le téléphone, pour un affichage instantané ;
 * - la table `conseils_films`, pour ne rien perdre en vidant le cache ou en
 *   changeant de téléphone.
 *
 * Seule exception : un conseil arrivé sans ses textes (le score d'une
 * recommandation précède parfois son explication) se complète une fois.
 */
export type MediaConseil = "movie" | "tv";

const MAX_EN_MEMOIRE = 400;
const cleMemoire = (userId: string) => `pys_conseils_${userId}`;
const cleFilm = (tmdbId: number, media: MediaConseil) => `${media}:${tmdbId}`;

type Memoire = Record<string, RecommendationMatchData>;

function lireMemoire(userId: string): Memoire {
  try { return JSON.parse(localStorage.getItem(cleMemoire(userId)) || "{}") as Memoire; }
  catch { return {}; }
}

function garderEnMemoire(userId: string, tmdbId: number, media: MediaConseil, conseil: RecommendationMatchData) {
  try {
    const memoire = lireMemoire(userId);
    const cle = cleFilm(tmdbId, media);
    delete memoire[cle];
    memoire[cle] = conseil;
    // Les plus anciens partent d'abord : la base garde tout de toute façon.
    const cles = Object.keys(memoire);
    for (const vieux of cles.slice(0, Math.max(0, cles.length - MAX_EN_MEMOIRE))) delete memoire[vieux];
    localStorage.setItem(cleMemoire(userId), JSON.stringify(memoire));
  } catch { /* stockage indisponible : la base reste la référence */ }
}

const aUnScore = (c: RecommendationMatchData | null | undefined) => {
  const s = getRecommendationScore(c);
  return typeof s === "number" && s > 0;
};
const estComplet = (c: RecommendationMatchData | null | undefined) =>
  Boolean(c?.whyItMatches || c?.headline || c?.detailedExplanation);

/** Le conseil gardé dans le téléphone, sans attendre. */
export function conseilEnMemoire(userId: string, tmdbId: number, media: MediaConseil): RecommendationMatchData | null {
  return lireMemoire(userId)[cleFilm(tmdbId, media)] ?? null;
}

/** Le conseil gardé : téléphone d'abord, puis la base. */
export async function lireConseil(userId: string, tmdbId: number, media: MediaConseil): Promise<RecommendationMatchData | null> {
  const local = conseilEnMemoire(userId, tmdbId, media);
  if (local) return local;
  try {
    const { data } = await supabase
      .from("conseils_films" as never)
      .select("conseil")
      .eq("user_id", userId)
      .eq("tmdb_id", tmdbId)
      .eq("media", media)
      .maybeSingle();
    const conseil = (data as { conseil?: RecommendationMatchData } | null)?.conseil ?? null;
    if (conseil) garderEnMemoire(userId, tmdbId, media, conseil);
    return conseil;
  } catch {
    return null;
  }
}

/**
 * Garde un conseil. Ne remplace jamais un conseil complet ; complète une seule
 * fois un conseil qui n'avait que son score.
 */
export async function enregistrerConseil(userId: string, tmdbId: number, media: MediaConseil, conseil: RecommendationMatchData): Promise<void> {
  if (!aUnScore(conseil)) return;
  const existant = conseilEnMemoire(userId, tmdbId, media);
  if (existant && (estComplet(existant) || !estComplet(conseil))) return;
  // Compléter n'est pas changer d'avis : la note déjà affichée reste.
  if (existant) conseil = { ...conseil, matchScore: getRecommendationScore(existant) ?? conseil.matchScore };
  garderEnMemoire(userId, tmdbId, media, conseil);
  try {
    if (existant) {
      await supabase
        .from("conseils_films" as never)
        .update({ conseil } as never)
        .eq("user_id", userId)
        .eq("tmdb_id", tmdbId)
        .eq("media", media)
        .is("conseil->>whyItMatches" as never, null);
    } else {
      // Déjà présent dans la base (autre téléphone) : on n'y touche pas.
      await supabase
        .from("conseils_films" as never)
        .upsert({ user_id: userId, tmdb_id: tmdbId, media, conseil } as never, { onConflict: "user_id,tmdb_id,media", ignoreDuplicates: true });
    }
  } catch { /* la copie du téléphone suffit en attendant */ }
}

// Un même film demandé deux fois en même temps (accueil et fiche) : un seul appel à l'IA.
const enCours = new Map<string, Promise<RecommendationMatchData | null>>();

/**
 * Le conseil d'un film : celui qu'on a gardé, sinon un nouveau calculé par
 * movie-match puis gardé. Renvoie null en cas d'échec : jamais bloquant.
 */
export function obtenirConseil(userId: string, film: MovieDetail, media: MediaConseil): Promise<RecommendationMatchData | null> {
  const cle = `${userId}|${cleFilm(film.id, media)}`;
  const deja = enCours.get(cle);
  if (deja) return deja;
  const promesse = (async () => {
    const connu = await lireConseil(userId, film.id, media);
    if (connu && estComplet(connu)) return connu;
    const nouveau = await evaluerAdhesion(userId, film);
    if (nouveau && aUnScore(nouveau)) {
      await enregistrerConseil(userId, film.id, media, nouveau);
      return conseilEnMemoire(userId, film.id, media) ?? nouveau;
    }
    return connu;
  })().finally(() => enCours.delete(cle));
  enCours.set(cle, promesse);
  return promesse;
}
