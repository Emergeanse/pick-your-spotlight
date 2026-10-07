import { useSyncExternalStore } from "react";

/**
 * Ouvrir un film depuis n'importe où : toujours la fiche principale d'abord
 * (affiche, adhésion, actions, « On regarde ? »), puis la fiche détaillée
 * quand on la touche. L'hôte (FicheFilmHost, dans AppLayout) affiche les deux.
 */
export interface FilmAOuvrir {
  tmdbId: number;
  media: "movie" | "tv";
}

let ouvert: FilmAOuvrir | null = null;
const abonnes = new Set<() => void>();
const publier = (f: FilmAOuvrir | null) => { ouvert = f; abonnes.forEach((a) => a()); };

export const ficheFilm = {
  lire: () => ouvert,
  abonner(f: () => void) { abonnes.add(f); return () => { abonnes.delete(f); }; },
  ouvrir: (film: FilmAOuvrir) => publier(film),
  fermer: () => publier(null),
};

export function useFilmOuvert(): FilmAOuvrir | null {
  return useSyncExternalStore(ficheFilm.abonner, ficheFilm.lire, ficheFilm.lire);
}
