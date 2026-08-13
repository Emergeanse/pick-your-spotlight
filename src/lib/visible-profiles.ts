/**
 * Lire le profil de quelqu'un d'autre.
 *
 * `profiles` n'est plus lisible que par son propriétaire. Toute lecture d'un
 * profil tiers passe par ici — c'est la seule voie, et elle ne rend que les
 * colonnes partageables.
 *
 * ⚠️ Ne pas rétablir un `supabase.from("profiles").select(...)` sur l'identifiant
 * d'un tiers : ça ne renverrait plus rien. Et si une politique de lecture était
 * ajoutée pour le faire fonctionner, elle exposerait les 49 colonnes — le RLS
 * PostgreSQL ne sait pas filtrer par colonne.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * `get_visible_profiles` n'est pas dans les types générés par Supabase. Plutôt
 * qu'un `any` qui ferait taire le compilateur partout, on décrit précisément la
 * seule signature dont on se sert.
 */
type ProfileRpc = {
  rpc: (
    fn: "get_visible_profiles",
    args: { p_ids: string[] },
  ) => Promise<{ data: VisibleProfile[] | null; error: { message: string } | null }>;
};

/** Nature du lien, telle que le serveur la calcule. */
export type ProfileRelation = "moi" | "proche" | "croise";

export interface VisibleProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  /** Renseignés pour « moi » et « proche » ; null pour un simple co-participant. */
  bio: string | null;
  podium_film_ids: number[] | null;
  friend_code: string | null;
  favorite_genres: string[] | null;
  excluded_genres: string[] | null;
  relation: ProfileRelation;
}

/**
 * Profils visibles parmi les identifiants demandés. Les inconnus sont
 * simplement absents du résultat — pas d'erreur, pas de ligne vide.
 */
export async function fetchVisibleProfiles(ids: string[]): Promise<VisibleProfile[]> {
  const uniques = [...new Set(ids.filter(Boolean))];
  if (uniques.length === 0) return [];

  const { data, error } = await (supabase as unknown as ProfileRpc).rpc("get_visible_profiles", {
    p_ids: uniques,
  });
  if (error) {
    console.error("[profils] lecture impossible:", error.message);
    return [];
  }
  return data ?? [];
}

/** Version à un seul identifiant. Renvoie null si la personne n'est pas visible. */
export async function fetchVisibleProfile(id: string): Promise<VisibleProfile | null> {
  const [premier] = await fetchVisibleProfiles([id]);
  return premier ?? null;
}

/** Indexé par identifiant, pour les écrans qui affichent une liste de gens. */
export async function fetchVisibleProfileMap(ids: string[]): Promise<Map<string, VisibleProfile>> {
  const rows = await fetchVisibleProfiles(ids);
  return new Map(rows.map((r) => [r.id, r]));
}
