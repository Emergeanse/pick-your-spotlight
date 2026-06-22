import { fetchFromTMDB } from "@/lib/tmdb-proxy-client";
import { pickRandomOnboarding, shuffleOnboarding } from "@/lib/onboarding-random";

/** Acteurs très connus (FR + international) — TMDB person id */
export const CURATED_ONBOARDING_ACTOR_IDS = [
  // France
  52743, 1921, 78423, 8293, 6972, 113640, 37627, 78124, 114711, 17807, 37642,
  30162, 1978, 1427, 5445, 81134, 23478, 19806, 35029, 1190664, 72536, 5448,
  81838, 25067, 13240, 81827, 81835, 933099, 78435,
  // International
  6193, 31, 287, 1245, 976, 30614, 54693, 192, 1247, 1892, 6384, 500, 3223,
  17647, 74568, 16828, 9030, 4173, 18976, 10990, 72129, 1813, 17288, 4430,
  62, 27104, 1381396, 88047, 18999, 85, 12835, 3896, 6968, 84223, 17052,
  7399, 8688, 1333,
] as const;

/** Réalisateurs très connus — TMDB person id */
export const CURATED_ONBOARDING_DIRECTOR_IDS = [
  // France
  5740, 3768, 10783, 17898, 137427, 10770, 2039, 77918, 58425, 2405, 37341,
  2434, 2283, 1937, 45297, 2290, 129894, 20565, 10059, 23386,
  // International
  5281, 138, 1032, 5621, 7467, 108, 5655, 525, 103644, 3708, 97130, 52121,
  1776, 1223, 5953, 57130, 55890, 510, 12418, 6884, 18870, 15208, 10863,
  114552, 24045, 62554, 15344,
] as const;

export const ONBOARDING_PEOPLE_TARGET = 5;
export const ONBOARDING_ACTOR_DISPLAY = 10;
export const ONBOARDING_DIRECTOR_DISPLAY = 5;
/** @deprecated Utiliser ONBOARDING_ACTOR_DISPLAY */
export const ONBOARDING_PEOPLE_DISPLAY = ONBOARDING_ACTOR_DISPLAY;

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
  return ACTOR_ID_SET.has(p.id);
}

function isDirectorPerson(p: OnboardingPerson): boolean {
  return DIRECTOR_ID_SET.has(p.id);
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

export async function fetchOnboardingActors(excludeIds: number[] = []): Promise<OnboardingPerson[]> {
  return buildPeoplePool(
    CURATED_ONBOARDING_ACTOR_IDS,
    isActorPerson,
    "Acting",
    excludeIds,
    ONBOARDING_ACTOR_DISPLAY,
  );
}

export async function fetchOnboardingDirectors(excludeIds: number[] = []): Promise<OnboardingPerson[]> {
  return buildPeoplePool(
    CURATED_ONBOARDING_DIRECTOR_IDS,
    isDirectorPerson,
    "Directing",
    excludeIds,
    ONBOARDING_DIRECTOR_DISPLAY,
  );
}

export function getPersonPhotoUrl(path: string | null, size = "w185"): string {
  if (!path) return "/placeholder.svg";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
