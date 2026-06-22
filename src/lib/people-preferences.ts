import { supabase } from "@/integrations/supabase/client";
import { fetchFromTMDB } from "@/lib/tmdb-proxy-client";

export type PersonType = "actor" | "director";
export type PreferenceValue = "loved" | "liked" | "disliked";

export interface PersonPreference {
  person_id: number;
  person_name: string;
  person_type: PersonType;
  photo_url: string | null;
  preference: PreferenceValue;
  known_for: string[];
}

export async function fetchPopularPeople(page: number = 1): Promise<any[]> {
  const data = await fetchFromTMDB("/person/popular", { page: String(page) });
  return (data.results || []).filter(
    (p: any) => p.profile_path && p.known_for_department && ["Acting", "Directing"].includes(p.known_for_department)
  );
}

/** Récupère acteurs et réalisateurs issus des films français populaires */
export async function fetchFrenchCinemaPeople(): Promise<any[]> {
  const moviesData = await fetchFromTMDB("/discover/movie", {
    with_original_language: "fr",
    sort_by: "popularity.desc",
    "vote_count.gte": "100",
    page: "1",
  });
  const movieIds: number[] = (moviesData.results || []).slice(0, 10).map((m: any) => m.id);

  const creditsResults = await Promise.all(
    movieIds.map((id) => fetchFromTMDB(`/movie/${id}/credits`)),
  );

  const peopleMap = new Map<number, any>();
  for (const credits of creditsResults) {
    const director = (credits.crew || []).find((c: any) => c.job === "Director");
    if (director?.profile_path) {
      peopleMap.set(director.id, { ...director, known_for_department: "Directing" });
    }
    for (const actor of (credits.cast || []).slice(0, 4).filter((c: any) => c.profile_path)) {
      peopleMap.set(actor.id, { ...actor, known_for_department: "Acting" });
    }
  }
  return [...peopleMap.values()];
}

export async function fetchPersonDetail(personId: number): Promise<any> {
  return fetchFromTMDB(`/person/${personId}`, { append_to_response: "movie_credits" });
}

export function getPersonPhotoUrl(path: string | null, size = "w185"): string {
  if (!path) return "/placeholder.svg";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export async function savePersonPreference(pref: PersonPreference): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  await (supabase.from("user_people_preferences" as any) as any).upsert({
    user_id: userId,
    person_id: pref.person_id,
    person_name: pref.person_name,
    person_type: pref.person_type,
    photo_url: pref.photo_url,
    preference: pref.preference,
    known_for: pref.known_for,
  }, { onConflict: "user_id,person_id" });
}

export async function getUserPeoplePreferences(): Promise<PersonPreference[]> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return [];

  const { data } = await (supabase.from("user_people_preferences" as any) as any)
    .select("*")
    .eq("user_id", userId);

  return (data || []) as PersonPreference[];
}

export async function deletePersonPreference(personId: number): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  await (supabase.from("user_people_preferences" as any) as any)
    .delete()
    .eq("user_id", userId)
    .eq("person_id", personId);
}

export async function getPersonPreference(personId: number): Promise<PreferenceValue | null> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return null;

  const { data } = await (supabase.from("user_people_preferences" as any) as any)
    .select("preference")
    .eq("user_id", userId)
    .eq("person_id", personId)
    .single();

  return (data?.preference as PreferenceValue) || null;
}
