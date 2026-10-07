import { supabase } from "@/integrations/supabase/client";
import { getEngagementData } from "@/lib/engagement";
import { getLikedMovies } from "@/lib/liked-movies";
import { flattenTrophyMilestones, TROPHY_CATEGORIES, type TrophyMilestoneMeta } from "@/lib/trophies";

/**
 * Distinctions : les trophées obtenus, tels que les autres les voient dans
 * l'ADN cinéma. Le profil privé garde la collection complète, verrouillés et
 * progression compris ; l'ADN n'en montre que trois, épinglés ou, à défaut,
 * les plus prestigieux.
 */

export const NB_DISTINCTIONS_AFFICHEES = 3;

/** « recos-3 » : catégorie et rang du palier (1 à 7). */
export function cleTrophee(m: TrophyMilestoneMeta): string {
  const cat = TROPHY_CATEGORIES.find((c) => c.key === m.categoryKey);
  const rang = (cat?.milestones.findIndex((x) => x.count === m.count) ?? -1) + 1;
  return `${m.categoryKey}-${rang}`;
}

const PAR_CLE = new Map(flattenTrophyMilestones().map((m) => [cleTrophee(m), m]));

export function tropheeParCle(cle: string): TrophyMilestoneMeta | undefined {
  return PAR_CLE.get(cle);
}

const rangDe = (cle: string) => Number(cle.split("-")[1]) || 0;

/** Clés des trophées obtenus, du plus prestigieux au moins prestigieux. */
export function clesDebloquees(values: Record<string, number>): string[] {
  return flattenTrophyMilestones()
    .filter((m) => (values[m.categoryKey] ?? 0) >= m.count)
    .map(cleTrophee)
    .sort((a, b) => rangDe(b) - rangDe(a));
}

/**
 * Les distinctions à montrer : les épinglées (encore obtenues), puis les plus
 * hauts paliers, une par catégorie d'abord pour varier, avant de compléter.
 */
export function distinctionsAffichees(
  debloquees: string[],
  epinglees: string[],
  n = NB_DISTINCTIONS_AFFICHEES,
): string[] {
  const obtenues = new Set(debloquees);
  const choix = epinglees.filter((c) => obtenues.has(c)).slice(0, n);
  const parPrestige = [...debloquees].sort((a, b) => rangDe(b) - rangDe(a));
  const categories = new Set(choix.map((c) => c.split("-")[0]));
  for (const c of parPrestige) {
    if (choix.length >= n) break;
    const cat = c.split("-")[0];
    if (!choix.includes(c) && !categories.has(cat)) { choix.push(c); categories.add(cat); }
  }
  for (const c of parPrestige) {
    if (choix.length >= n) break;
    if (!choix.includes(c)) choix.push(c);
  }
  return choix;
}

/** Les quatre compteurs des trophées, comme dans le profil. */
export async function lireValeursTrophees(userId: string): Promise<Record<string, number>> {
  const [eng, aimes, { count: personnes }, { count: vus }] = await Promise.all([
    getEngagementData(userId),
    getLikedMovies().catch(() => []),
    supabase.from("user_people_preferences" as never).select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("user_item_feedback").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("feedback_type", "seen"),
  ]);
  return {
    recos: eng?.totalRecommendations || 0,
    liked: aimes.length,
    people: personnes || 0,
    seen: vus || 0,
  };
}

/** Enregistre les trophées obtenus, pour l'ADN vu par les amis. Silencieux en cas d'échec. */
export async function enregistrerDistinctions(userId: string, cles: string[]): Promise<void> {
  await supabase
    .from("adn_cinema" as never)
    .update({ distinctions: cles } as never)
    .eq("user_id", userId)
    .then(() => {}, () => {});
}

export async function epinglerDistinctions(userId: string, cles: string[]): Promise<void> {
  const { error } = await supabase
    .from("adn_cinema" as never)
    .update({ distinctions_epinglees: cles.slice(0, NB_DISTINCTIONS_AFFICHEES) } as never)
    .eq("user_id", userId);
  if (error) throw error;
}
