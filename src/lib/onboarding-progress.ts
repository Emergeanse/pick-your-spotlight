import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_ONBOARDING_PLATFORM_IDS, ensureOnboardingPlatforms } from "@/lib/onboarding-platforms";

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
      "onboarding_step, onboarding_paused, favorite_genres, excluded_genres, preferred_platforms, onboarding_completed",
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
  };
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
