import { fetchFromTMDB } from "@/lib/tmdb-proxy-client";
import { pickRandomOnboarding, shuffleOnboarding } from "@/lib/onboarding-random";

/** Acteurs très connus (FR + international) — TMDB person id */
export const CURATED_ONBOARDING_ACTOR_IDS = [
  52743,  // Jean Dujardin
  1921,   // Marion Cotillard
  78423,  // Omar Sy
  8293,   // Audrey Tautou
  6972,   // Vincent Cassel
  113640, // Léa Seydoux
  37627,  // Dany Boon
  78124,  // Gad Elmaleh
  114711, // François Cluzet
  17807,  // Isabelle Huppert
  37642,  // André Dussollier
  6193,   // Leonardo DiCaprio
  31,     // Tom Hanks
  287,    // Brad Pitt
  1245,   // Scarlett Johansson
  976,    // Jason Statham
  30614,  // Ryan Gosling
  54693,  // Emma Stone
  192,    // Morgan Freeman
  1247,   // Angelina Jolie
  1892,   // Robert De Niro
  6384,   // Keanu Reeves
] as const;

/** Réalisateurs très connus — IDs vérifiés (pas d’acteurs sans film réalisé notable). */
export const CURATED_ONBOARDING_DIRECTOR_IDS = [
  5281,   // Christopher Nolan
  138,    // Quentin Tarantino
  5740,   // Luc Besson
  3768,   // Jean-Pierre Jeunet
  1032,   // Steven Spielberg
  10783,  // François Ozon
  17898,  // Jacques Audiard
  137427, // Ladj Ly
  5621,   // Denis Villeneuve
  7467,   // Ridley Scott
  108,    // Peter Jackson
  10770,  // Céline Sciamma
  2039,   // Maïwenn
  77918,  // Michel Hazanavicius
  58425,  // Albert Dupontel
  2405,   // Claude Lelouch
  5655,   // James Cameron
  525,    // Martin Scorsese
  103644, // Jordan Peele
  3708,   // Thomas Vinterberg
  97130,  // Damien Chazelle
  37341,  // Alain Resnais
] as const;

export const ONBOARDING_PEOPLE_TARGET = 5;
/** Visages proposés à chaque passage (tirage aléatoire dans le pool curaté). */
export const ONBOARDING_PEOPLE_DISPLAY = 10;

export type OnboardingPerson = {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: "Acting" | "Directing";
  known_for?: { title?: string; name?: string }[];
};

const ACTOR_ID_SET = new Set<number>(CURATED_ONBOARDING_ACTOR_IDS);
const DIRECTOR_ID_SET = new Set<number>(CURATED_ONBOARDING_DIRECTOR_IDS);

function isActorPerson(p: OnboardingPerson): boolean {
  if (!ACTOR_ID_SET.has(p.id) || DIRECTOR_ID_SET.has(p.id)) return false;
  return p.known_for_department !== "Directing";
}

function isDirectorPerson(p: OnboardingPerson): boolean {
  if (!DIRECTOR_ID_SET.has(p.id)) return false;
  return p.known_for_department === "Directing";
}

async function fetchPeopleByIds(ids: readonly number[]): Promise<OnboardingPerson[]> {
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

async function buildPeoplePool(
  curatedIds: readonly number[],
  filter: (p: OnboardingPerson) => boolean,
  department: "Acting" | "Directing",
  pinnedIds: number[] = [],
): Promise<OnboardingPerson[]> {
  const pinnedSet = new Set(pinnedIds);
  const orderedIds = shuffleOnboarding(curatedIds.filter((id) => !pinnedSet.has(id)));
  const fetched = await fetchPeopleByIds([...pinnedIds, ...orderedIds]);
  const valid = fetched.filter(filter);
  const pinned = pinnedIds
    .map((id) => valid.find((p) => p.id === id))
    .filter((p): p is OnboardingPerson => !!p);
  const rest = valid.filter((p) => !pinnedSet.has(p.id));
  const slots = Math.max(0, ONBOARDING_PEOPLE_DISPLAY - pinned.length);
  const picked = pickRandomOnboarding(rest, slots);
  return [...pinned, ...picked].map((p) => ({
    ...p,
    known_for_department: department,
  }));
}

export async function fetchOnboardingActors(pinnedIds: number[] = []): Promise<OnboardingPerson[]> {
  return buildPeoplePool(CURATED_ONBOARDING_ACTOR_IDS, isActorPerson, "Acting", pinnedIds);
}

export async function fetchOnboardingDirectors(pinnedIds: number[] = []): Promise<OnboardingPerson[]> {
  return buildPeoplePool(CURATED_ONBOARDING_DIRECTOR_IDS, isDirectorPerson, "Directing", pinnedIds);
}

export function getPersonPhotoUrl(path: string | null, size = "w185"): string {
  if (!path) return "/placeholder.svg";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
