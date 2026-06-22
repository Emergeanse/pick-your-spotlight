import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_ONBOARDING_PLATFORM_IDS, ensureOnboardingPlatforms } from "@/lib/onboarding-platforms";
import { ONBOARDING_FILM_TARGET } from "@/lib/onboarding-films";

export type OnboardingStep =
  | "welcome"
  | "genres"
  | "platforms"
  | "films"
  | "actors"
  | "directors"
  | "modes"
  | "soirees";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "welcome",
  "genres",
  "platforms",
  "films",
  "actors",
  "directors",
  "modes",
  "soirees",
];

export const ONBOARDING_MIN_RATING = 6;
export const ONBOARDING_MATCH_THRESHOLD = 60;

export type OnboardingProgressData = {
  step: OnboardingStep;
  likedGenres: string[];
  excludedGenres: string[];
  platformIds: number[];
  paused: boolean;
  filmsProgress: number;
  filmsLikedIds: number[];
};

function normalizeStep(raw: string | null | undefined): OnboardingStep {
  if (raw && ONBOARDING_STEPS.includes(raw as OnboardingStep)) return raw as OnboardingStep;
  return "welcome";
}

export async function loadOnboardingProgress(): Promise<OnboardingProgressData | null> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select(
      "onboarding_step, onboarding_paused, onboarding_films_progress, onboarding_films_liked_ids, favorite_genres, excluded_genres, preferred_platforms, onboarding_completed",
    )
    .eq("id", userId)
    .single();

  if (!data || data.onboarding_completed) return null;

  const savedPlatforms = ((data as any).preferred_platforms as number[]) ?? [];
  const platformIds = savedPlatforms.length
    ? ensureOnboardingPlatforms(savedPlatforms)
    : [...DEFAULT_ONBOARDING_PLATFORM_IDS];

  return {
    step: normalizeStep((data as any).onboarding_step),
    likedGenres: ((data as any).favorite_genres as string[]) ?? [],
    excludedGenres: ((data as any).excluded_genres as string[]) ?? [],
    platformIds,
    paused: Boolean((data as any).onboarding_paused),
    filmsProgress: Math.min(ONBOARDING_FILM_TARGET, Math.max(0, Number((data as any).onboarding_films_progress) || 0)),
    filmsLikedIds: normalizeOnboardingFilmsLikedIds((data as any).onboarding_films_liked_ids),
  };
}

function normalizeOnboardingFilmsLikedIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))].slice(
    0,
    ONBOARDING_FILM_TARGET,
  );
}

export async function saveOnboardingFilmsProgress(likedIds: number[]): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  const safeIds = normalizeOnboardingFilmsLikedIds(likedIds);
  await supabase
    .from("profiles")
    .update({
      onboarding_films_progress: safeIds.length,
      onboarding_films_liked_ids: safeIds,
    } as any)
    .eq("id", userId);
}

export async function saveOnboardingProgress(
  step: OnboardingStep,
  options: {
    likedGenres?: string[];
    excludedGenres?: string[];
    platformIds?: number[];
    paused?: boolean;
  } = {},
): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  const payload: Record<string, unknown> = {
    onboarding_step: step,
    onboarding_paused: options.paused ?? false,
  };

  if (options.likedGenres !== undefined) {
    payload.favorite_genres = options.likedGenres.slice(0, 8);
  }
  if (options.excludedGenres !== undefined) {
    payload.excluded_genres = options.excludedGenres.slice(0, 8);
  }
  if (options.platformIds !== undefined) {
    payload.preferred_platforms = ensureOnboardingPlatforms(options.platformIds);
  }

  await supabase.from("profiles").update(payload as any).eq("id", userId);
}

export async function completeOnboarding(
  likedGenres: string[],
  excludedGenres: string[],
  platformIds: number[],
): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  const genres = likedGenres.slice(0, 8);
  const excluded = excludedGenres.slice(0, 8);
  const platforms = ensureOnboardingPlatforms(platformIds);

  await supabase.from("profiles").update({
    onboarding_completed: true,
    onboarding_paused: false,
    onboarding_step: "soirees",
    favorite_genres: genres,
    excluded_genres: excluded,
    preferred_platforms: platforms,
    birth_year: null,
    media_preference: "both",
    min_rating: ONBOARDING_MIN_RATING,
    match_threshold: ONBOARDING_MATCH_THRESHOLD,
    tour_completed: true,
    activation_completed: true,
    activation_step: "done",
  } as any).eq("id", userId);

  try {
    const { setGenrePreferences, setLikedPlatforms, setSinglePreference } = await import("@/lib/preferences");
    await Promise.all([
      setGenrePreferences(genres, excluded, "onboarding"),
      setLikedPlatforms(platforms, "onboarding"),
      setSinglePreference("media_type", "both", "onboarding"),
      setSinglePreference("rating_threshold", "good", "onboarding"),
    ]);
  } catch (e) {
    console.warn("preferences mirror failed", e);
  }
}

export async function fetchOnboardingPaused(): Promise<boolean> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return false;
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_completed, onboarding_paused")
    .eq("id", userId)
    .single();
  if (!data) return false;
  return !(data as any).onboarding_completed && Boolean((data as any).onboarding_paused);
}

/** Remet le profil à zéro pour refaire le parcours initiatique (genres, plateformes, personnes). */
export async function resetProfileForOnboarding(): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Utilisateur non connecté");

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      onboarding_completed: false,
      onboarding_paused: false,
      onboarding_step: "welcome",
      onboarding_skipped: false,
      activation_completed: false,
      tour_completed: false,
      activation_step: "train_20",
      favorite_genres: [],
      excluded_genres: [],
      preferred_platforms: [],
      min_rating: ONBOARDING_MIN_RATING,
      match_threshold: ONBOARDING_MATCH_THRESHOLD,
    } as any)
    .eq("id", userId);

  if (profileError) throw profileError;

  const { error: filmsProgressError } = await supabase
    .from("profiles")
    .update({ onboarding_films_progress: 0, onboarding_films_liked_ids: [] } as any)
    .eq("id", userId);
  if (
    filmsProgressError &&
    !/onboarding_films_progress|onboarding_films_liked_ids/i.test(filmsProgressError.message)
  ) {
    throw filmsProgressError;
  }

  const { error: peopleError } = await (supabase.from("user_people_preferences" as any) as any)
    .delete()
    .eq("user_id", userId);
  if (peopleError) throw peopleError;

  const { error: prefsError } = await supabase
    .from("user_preferences")
    .delete()
    .eq("user_id", userId)
    .eq("source", "onboarding");
  if (prefsError) throw prefsError;
}

export function onboardingErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const msg = String((error as { message: string }).message);
    if (/onboarding_step|onboarding_paused/i.test(msg)) {
      return "Migration initiatique manquante sur Supabase (onboarding_step). Exécute le SQL de migration puis réessaie.";
    }
    if (/onboarding_films_progress|onboarding_films_liked_ids/i.test(msg)) {
      return "Migration films manquante (onboarding_films_progress / onboarding_films_liked_ids). Exécute le SQL de migration puis réessaie.";
    }
    return msg;
  }
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Réessaie dans un instant.";
}