import { supabase } from "@/integrations/supabase/client";
import { TRAITS, type Adn, type TraitId } from "@/lib/adn";

/**
 * ADN cinéma partagé : enregistrement de son propre ADN, lecture de celui des
 * autres selon la relation (voir la migration 20261007120000_adn_public), et
 * comparaison « Vous et Chris ».
 */

export type NiveauAdn = "moi" | "ami" | "soiree" | "aucun";
export type VisibiliteAdn = "amis_et_soirees" | "amis" | "moi";

export interface AdnVisible {
  niveau: NiveauAdn;
  traits: Adn | null;
  univers: string[];
  archetype: string | null;
  narrative: string | null;
  bio: string | null;
  podium: number[] | null;
  visibilite: VisibiliteAdn | null;
  /** Trophées obtenus (« recos-3 »…) et, au plus trois, ceux épinglés. */
  distinctions: string[];
  epinglees: string[];
}

/** Enregistre son ADN, pour que ses amis puissent le voir. Silencieux en cas d'échec. */
export async function enregistrerAdn(userId: string, traits: Adn, univers?: string[]): Promise<void> {
  const ligne: Record<string, unknown> = { user_id: userId, traits, updated_at: new Date().toISOString() };
  if (univers) ligne.univers = univers;
  await supabase.from("adn_cinema" as never).upsert(ligne as never, { onConflict: "user_id" }).then(() => {}, () => {});
}

export async function lireAdnVisible(userId: string): Promise<AdnVisible | null> {
  const { data, error } = await supabase.rpc("get_adn_visible" as never, { p_user_id: userId } as never);
  if (error || !data) return null;
  const d = data as Partial<AdnVisible> & { niveau: NiveauAdn };
  return {
    niveau: d.niveau,
    traits: (d.traits as Adn) ?? null,
    univers: d.univers ?? [],
    archetype: d.archetype ?? null,
    narrative: d.narrative ?? null,
    bio: d.bio ?? null,
    podium: d.podium ?? null,
    visibilite: d.visibilite ?? null,
    distinctions: d.distinctions ?? [],
    epinglees: d.epinglees ?? [],
  };
}

export async function changerVisibiliteAdn(userId: string, visibilite: VisibiliteAdn): Promise<void> {
  const { error } = await supabase
    .from("adn_cinema" as never)
    .update({ visibilite } as never)
    .eq("user_id", userId);
  if (error) throw error;
}

// ── « Vous et Chris » ───────────────────────────────────────────────────────

export interface Comparaison {
  /** Affinité de 0 à 100 (montrée aux amis seulement). */
  affinite: number;
  /** Traits forts chez les deux (≥ 60). */
  communs: string[];
  /** Plus fort écart, s'il est net (≥ 15 points). */
  ecart: { libelle: string; plusFortChez: "lui" | "toi" } | null;
}

/**
 * Compare deux ADN. L'affinité suit l'écart moyen entre les six traits : deux
 * profils identiques font 100, un écart moyen de 40 points (déjà très
 * différent sur l'échelle 5–99) fait 0.
 */
export function comparerAdn(moi: Adn, lui: Adn): Comparaison {
  const ids = TRAITS.map((t) => t.id);
  const ecartMoyen = ids.reduce((s, id) => s + Math.abs(moi[id] - lui[id]), 0) / ids.length;
  const affinite = Math.round(Math.max(0, Math.min(100, 100 - ecartMoyen * 2.5)));
  const communs = TRAITS.filter((t) => moi[t.id] >= 60 && lui[t.id] >= 60).map((t) => t.libelle);
  // L'écart se cherche hors des traits communs : « vous partagez l'émotion »
  // puis « il recherche davantage d'émotion » se contredirait.
  const plusGrand = TRAITS
    .filter((t) => !communs.includes(t.libelle))
    .map((t) => ({ t, d: lui[t.id as TraitId] - moi[t.id as TraitId] }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  const ecart = plusGrand && Math.abs(plusGrand.d) >= 15
    ? { libelle: plusGrand.t.libelle, plusFortChez: plusGrand.d > 0 ? "lui" as const : "toi" as const }
    : null;
  return { affinite, communs, ecart };
}

/** La phrase de comparaison, en français, à partir de la comparaison et du prénom. */
export function phraseComparaison(c: Comparaison, prenom: string): string {
  const parties: string[] = [];
  if (c.communs.length > 0) {
    const liste = c.communs.map((x) => x.toLowerCase());
    const enumeration = liste.length > 1 ? `${liste.slice(0, -1).join(", ")} et ${liste[liste.length - 1]}` : liste[0];
    parties.push(`Vous partagez une forte sensibilité à ${articleTrait(enumeration)}.`);
  }
  if (c.ecart) {
    parties.push(c.ecart.plusFortChez === "lui"
      ? `${prenom} recherche davantage ${partitifTrait(c.ecart.libelle)}.`
      : `Tu recherches davantage ${partitifTrait(c.ecart.libelle)} que ${prenom}.`);
  }
  const phrase = parties.join(" ") || "Vos goûts se ressemblent sans dominante commune marquée.";
  // Chaque phrase commence par une majuscule, même si le prénom n'en a pas.
  return phrase.replace(/(^|\. )(\p{Ll})/gu, (_m, avant: string, lettre: string) => avant + lettre.toUpperCase());
}

/** « l'émotion et la tension » : article devant chaque trait. */
function articleTrait(enumeration: string): string {
  return enumeration
    .split(/(, | et )/)
    .map((m) => (m === ", " || m === " et " ? m : /^[aeiouéèêh]/i.test(m) ? `l'${m}` : `la ${m}`))
    .join("");
}

/** « de tension », « d'imaginaire », « de légèreté ». */
function partitifTrait(libelle: string): string {
  const mot = libelle.toLowerCase();
  return /^[aeiouéèêh]/i.test(mot) ? `d'${mot}` : `de ${mot}`;
}
