/**
 * « avec Lou », « avec Lou et Sophie », « avec Lou, Sophie et 2 autres » :
 * qui partage la soirée, en une ligne courte.
 */
export function formatAvecQui(noms: string[], maxNoms = 2): string {
  const uniques = noms.filter(Boolean);
  if (uniques.length === 0) return "";
  if (uniques.length === 1) return uniques[0];
  if (uniques.length <= maxNoms) return `${uniques.slice(0, -1).join(", ")} et ${uniques[uniques.length - 1]}`;
  const reste = uniques.length - maxNoms;
  return `${uniques.slice(0, maxNoms).join(", ")} et ${reste} autre${reste > 1 ? "s" : ""}`;
}
