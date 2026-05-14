import { supabase } from "@/integrations/supabase/client";

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

const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";

export async function fetchPopularPeople(page: number = 1): Promise<any[]> {
  const res = await fetch(
    `https://api.themoviedb.org/3/person/popular?api_key=${TMDB_API_KEY}&language=fr-FR&page=${page}`
  );
  const data = await res.json();
  return (data.results || []).filter(
    (p: any) => p.profile_path && p.known_for_department && ["Acting", "Directing"].includes(p.known_for_department)
  );
}

export async function fetchPersonDetail(personId: number): Promise<any> {
  const res = await fetch(
    `https://api.themoviedb.org/3/person/${personId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=movie_credits`
  );
  return res.json();
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
