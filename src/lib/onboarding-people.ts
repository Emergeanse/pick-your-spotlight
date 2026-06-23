import { fetchFromTMDB } from "@/lib/tmdb-proxy-client";
import { pickRandomOnboarding, shuffleOnboarding } from "@/lib/onboarding-random";

/** Acteurs très connus (FR + international) — TMDB person id */
export const CURATED_ONBOARDING_ACTOR_IDS = [
  // France — stars indiscutables
  1921,   // Jean-Paul Belmondo
  1978,   // Juliette Binoche
  6972,   // Audrey Tautou
  5445,   // Omar Sy
  1427,   // Vincent Cassel
  8293,   // Guillaume Canet
  78423,  // Jean Reno
  30162,  // Daniel Auteuil
  5448,   // Sophie Marceau
  37627,  // Gad Elmaleh
  19806,  // Gérard Depardieu
  1190664,// Tahar Rahim
  72536,  // François Cluzet
  17807,  // Mathieu Kassovitz
  23478,  // Jamel Debbouze
  // International — stars mondiales
  31,     // Tom Hanks
  287,    // Brad Pitt
  192,    // Morgan Freeman
  6384,   // Keanu Reeves
  500,    // Tom Cruise
  3223,   // Robert Downey Jr.
  62,     // Denzel Washington
  1245,   // Scarlett Johansson
  976,    // Cate Blanchett
  1892,   // Natalie Portman
  6193,   // Joaquin Phoenix
  74568,  // Leonardo DiCaprio
  85,     // Johnny Depp
  1247,   // Meryl Streep
  9030,   // Charlize Theron
  18976,  // Ryan Gosling
  1813,   // Anne Hathaway
  30614,  // Jake Gyllenhaal
  10990,  // Emma Stone
  4430,   // Chadwick Boseman
  54693,  // Chris Hemsworth
  7399,   // Christoph Waltz
  16828,  // Christian Bale
  4173,   // Daniel Craig
  8688,   // Viggo Mortensen
  1333,   // Idris Elba
] as const;

/** Réalisateurs très connus — TMDB person id */
export const CURATED_ONBOARDING_DIRECTOR_IDS = [
  // France — réalisateurs incontournables
  5740,   // Luc Besson
  3768,   // François Truffaut
  10783,  // Jean-Luc Godard
  2039,   // Claude Lelouch
  2405,   // Jacques Audiard
  37341,  // Olivier Nakache
  2434,   // Michel Gondry
  2283,   // Christophe Barratier
  2290,   // Jean-Pierre Jeunet
  1937,   // Louis Malle
  10059,  // Laurent Cantet
  // International — réalisateurs mondialement reconnus
  5281,   // Steven Spielberg
  138,    // Quentin Tarantino
  1032,   // Christopher Nolan
  7467,   // Martin Scorsese
  108,    // Tim Burton
  525,    // Alfred Hitchcock
  510,    // Ridley Scott
  5621,   // James Cameron
  5655,   // David Fincher
  3708,   // Pedro Almodóvar
  1776,   // Stanley Kubrick
  1223,   // Woody Allen
  57130,  // Denis Villeneuve
  55890,  // Wes Anderson
  12418,  // Clint Eastwood
  6884,   // Spike Lee
  18870,  // David Lynch
  10863,  // Francis Ford Coppola
  24045,  // Park Chan-wook
  15344,  // Wong Kar-wai
] as const;

export const ONBOARDING_PEOPLE_TARGET = 5;
export const ONBOARDING_PEOPLE_PAGE_SIZE = 6;
export const ONBOARDING_ACTOR_DISPLAY = ONBOARDING_PEOPLE_PAGE_SIZE;
export const ONBOARDING_DIRECTOR_DISPLAY = ONBOARDING_PEOPLE_PAGE_SIZE;
/** @deprecated Utiliser ONBOARDING_PEOPLE_PAGE_SIZE */
export const ONBOARDING_PEOPLE_DISPLAY = ONBOARDING_PEOPLE_PAGE_SIZE;

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
  return ACTOR_ID_SET.has(p.id) && p.known_for_department === "Acting";
}

function isDirectorPerson(p: OnboardingPerson): boolean {
  return DIRECTOR_ID_SET.has(p.id) && p.known_for_department === "Directing";
}

async function fetchPeopleByIds(ids: readonly number[]): Promise<OnboardingPerson[]> {
  const unique = [...new Set(ids)];
  const results = await Promise.allSettled(
    unique.map((id) => fetchFromTMDB(`/person/${id}`, { language: "fr-FR" })),
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

async function fetchPeoplePage(
  curatedIds: readonly number[],
  filter: (p: OnboardingPerson) => boolean,
  department: "Acting" | "Directing",
  excludeIds: number[] = [],
  limit: number,
): Promise<OnboardingPerson[]> {
  const excludeSet = new Set(excludeIds);
  const filteredIds = curatedIds.filter((id) => !excludeSet.has(id));
  const availableIds = shuffleOnboarding(filteredIds.length ? filteredIds : [...curatedIds]);
  const fetched = await fetchPeopleByIds(availableIds);
  let valid = fetched.filter(filter).filter((p) => !excludeSet.has(p.id));
  if (!valid.length) valid = fetched.filter(filter);
  const picked = pickRandomOnboarding(valid, limit);
  return picked.map((p) => ({
    ...p,
    known_for_department: department,
  }));
}

/** @deprecated Utiliser fetchOnboardingActorsPage */
async function buildPeoplePool(
  curatedIds: readonly number[],
  filter: (p: OnboardingPerson) => boolean,
  department: "Acting" | "Directing",
  excludeIds: number[] = [],
  displayCount: number,
): Promise<OnboardingPerson[]> {
  const excludeSet = new Set(excludeIds);
  const availableIds = shuffleOnboarding(curatedIds.filter((id) => !excludeSet.has(id)));
  const fetched = await fetchPeopleByIds(availableIds);
  const valid = fetched.filter(filter).filter((p) => !excludeSet.has(p.id));
  const picked = pickRandomOnboarding(valid, displayCount);
  return picked.map((p) => ({
    ...p,
    known_for_department: department,
  }));
}

export async function fetchOnboardingPeopleByIds(
  ids: number[],
  personType: "actor" | "director",
): Promise<OnboardingPerson[]> {
  const filter = personType === "director" ? isDirectorPerson : isActorPerson;
  const department = personType === "director" ? "Directing" : "Acting";
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (!unique.length) return [];
  const fetched = await fetchPeopleByIds(unique);
  return fetched.filter(filter).map((p) => ({
    ...p,
    known_for_department: department,
  }));
}

export async function fetchOnboardingActorsPage(
  excludeIds: number[] = [],
  limit: number = ONBOARDING_PEOPLE_PAGE_SIZE,
): Promise<OnboardingPerson[]> {
  return fetchPeoplePage(
    CURATED_ONBOARDING_ACTOR_IDS,
    isActorPerson,
    "Acting",
    excludeIds,
    limit,
  );
}

export async function fetchOnboardingDirectorsPage(
  excludeIds: number[] = [],
  limit: number = ONBOARDING_PEOPLE_PAGE_SIZE,
): Promise<OnboardingPerson[]> {
  return fetchPeoplePage(
    CURATED_ONBOARDING_DIRECTOR_IDS,
    isDirectorPerson,
    "Directing",
    excludeIds,
    limit,
  );
}

/** @deprecated Utiliser fetchOnboardingActorsPage */
export async function fetchOnboardingActors(excludeIds: number[] = []): Promise<OnboardingPerson[]> {
  return fetchOnboardingActorsPage(excludeIds, ONBOARDING_PEOPLE_PAGE_SIZE);
}

/** @deprecated Utiliser fetchOnboardingDirectorsPage */
export async function fetchOnboardingDirectors(excludeIds: number[] = []): Promise<OnboardingPerson[]> {
  return fetchOnboardingDirectorsPage(excludeIds, ONBOARDING_PEOPLE_PAGE_SIZE);
}

export function getPersonPhotoUrl(path: string | null, size = "w185"): string {
  if (!path) return "/placeholder.svg";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
