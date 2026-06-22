import { fetchFromTMDB } from "@/lib/tmdb-proxy-client";

/** Acteurs très connus (FR + international) — TMDB person id */
export const CURATED_ONBOARDING_ACTOR_IDS = [
  52743,  // Jean Dujardin
  1921,   // Marion Cotillard
  78423,  // Omar Sy
  8293,   // Audrey Tautou
  6972,   // Vincent Cassel
  113640, // Léa Seydoux
  37627,  // Dany Boon
  6193,   // Leonardo DiCaprio
  31,     // Tom Hanks
  287,    // Brad Pitt
  1245,   // Scarlett Johansson
  976,    // Jason Statham
];

/** Réalisateurs très connus */
export const CURATED_ONBOARDING_DIRECTOR_IDS = [
  5281,   // Christopher Nolan
  138,    // Quentin Tarantino
  5740,   // Luc Besson
  3768,   // Jean-Pierre Jeunet
  1032,   // Steven Spielberg
  10783,  // François Ozon
  17898,  // Jacques Audiard
  2405,   // Claude Lelouch
  137427, // Ladj Ly
  5621,   // Denis Villeneuve
  7467,   // Ridley Scott
  108,    // Peter Jackson
];

export const ONBOARDING_PEOPLE_TARGET = 5;

export type OnboardingPerson = {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: "Acting" | "Directing";
  known_for?: { title?: string; name?: string }[];
};

async function fetchPeopleByIds(ids: number[]): Promise<OnboardingPerson[]> {
  const results = await Promise.allSettled(
    ids.map((id) => fetchFromTMDB(`/person/${id}`, { language: "fr-FR" })),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((p) => p?.id && p.profile_path)
    .map((p) => ({
      id: p.id,
      name: p.name,
      profile_path: p.profile_path,
      known_for_department: p.known_for_department === "Directing" ? "Directing" : "Acting",
      known_for: p.known_for,
    }));
}

export async function fetchOnboardingActors(): Promise<OnboardingPerson[]> {
  const people = await fetchPeopleByIds(CURATED_ONBOARDING_ACTOR_IDS);
  return people.map((p) => ({ ...p, known_for_department: "Acting" as const }));
}

export async function fetchOnboardingDirectors(): Promise<OnboardingPerson[]> {
  const people = await fetchPeopleByIds(CURATED_ONBOARDING_DIRECTOR_IDS);
  return people.map((p) => ({ ...p, known_for_department: "Directing" as const }));
}

export function getPersonPhotoUrl(path: string | null, size = "w185"): string {
  if (!path) return "/placeholder.svg";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
