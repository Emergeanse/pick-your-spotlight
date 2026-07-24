import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_ONBOARDING_PLATFORM_IDS, ensureOnboardingPlatforms } from "@/lib/onboarding-platforms";
import { ONBOARDING_FILM_LIKED_MAX } from "@/lib/onboarding-films";
import { ONBOARDING_PEOPLE_TARGET } from "@/lib/onboarding-people";
import type { PersonType } from "@/lib/people-preferences";

const AUTO_SURPRISE_SESSION_KEY = "pick_onboarding_auto_surprise_v1";

/**
 * File d'attente sessionStorage — même technique que event-reveal.ts (queueForReveal/consumeForReveal),
 * nécessaire pour survivre au double-montage React de HomeScreen ("Mount 1 démonté, Mount 2 vivant").
 * Un état React (useState/location.state) serait lu comme "vrai" par les deux montages ; sessionStorage
 * est lu ET supprimé de façon atomique, donc un seul montage déclenchera réellement la recherche.
 */
export function queueOnboardingAutoSurprise(): void {
  try { sessionStorage.setItem(AUTO_SURPRISE_SESSION_KEY, "1"); } catch {}
}

export function consumeOnboardingAutoSurprise(): boolean {
  try {
    if (!sessionStorage.getItem(AUTO_SURPRISE_SESSION_KEY)) return false;
    sessionStorage.removeItem(AUTO_SURPRISE_SESSION_KEY);
    return true;
  } catch {
    return false;
  }
}

export type OnboardingStep =
  | "welcome"
  | "genres"
  | "films"
  | "platforms"
  | "search";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "welcome",
  "genres",
  "films",
  "platforms",
  "search",
];

export const ONBOARDING_MIN_RATING = 7;
export const ONBOARDING_MATCH_THRESHOLD = 70;

export type OnboardingProgressData = {
  step: OnboardingStep;
  likedGenres: string[];
  excludedGenres: string[];
  platformIds: number[];
  paused: boolean;
  filmsProgress: number;
  filmsLikedIds: number[];
  filmsProposedIds: number[];
  actorsSelectedIds: number[];
  actorsProposedIds: number[];
  directorsSelectedIds: number[];
  directorsProposedIds: number[];
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
      "onboarding_step, onboarding_paused, onboarding_films_progress, onboarding_films_liked_ids, onboarding_films_proposed_ids, onboarding_actors_selected_ids, onboarding_actors_proposed_ids, onboarding_directors_selected_ids, onboarding_directors_proposed_ids, favorite_genres, excluded_genres, preferred_platforms, onboarding_completed",
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
    filmsProgress: Math.min(ONBOARDING_FILM_LIKED_MAX, Math.max(0, Number((data as any).onboarding_films_progress) || 0)),
    filmsLikedIds: normalizeOnboardingFilmsLikedIds((data as any).onboarding_films_liked_ids),
    filmsProposedIds: normalizeOnboardingFilmsProposedIds((data as any).onboarding_films_proposed_ids),
    actorsSelectedIds: normalizeOnboardingPeopleSelectedIds((data as any).onboarding_actors_selected_ids),
    actorsProposedIds: normalizeOnboardingPeopleProposedIds((data as any).onboarding_actors_proposed_ids),
    directorsSelectedIds: normalizeOnboardingPeopleSelectedIds((data as any).onboarding_directors_selected_ids),
    directorsProposedIds: normalizeOnboardingPeopleProposedIds((data as any).onboarding_directors_proposed_ids),
  };
}

function normalizeOnboardingPeopleSelectedIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))].slice(
    0,
    ONBOARDING_PEOPLE_TARGET,
  );
}

function normalizeOnboardingPeopleProposedIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
}

function normalizeOnboardingFilmsProposedIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
}

function normalizeOnboardingFilmsLikedIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))].slice(
    0,
    ONBOARDING_FILM_LIKED_MAX,
  );
}

export async function saveOnboardingFilmsProgress(
  likedIds: number[],
  proposedIds: number[] = [],
): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  const safeLiked = normalizeOnboardingFilmsLikedIds(likedIds);
  const safeProposed = normalizeOnboardingFilmsProposedIds([
    ...proposedIds,
    ...safeLiked,
  ]);
  await supabase
    .from("profiles")
    .update({
      onboarding_films_progress: safeLiked.length,
      onboarding_films_liked_ids: safeLiked,
      onboarding_films_proposed_ids: safeProposed,
    } as any)
    .eq("id", userId);
}

export async function saveOnboardingPeopleProgress(
  personType: PersonType,
  selectedIds: number[],
  proposedIds: number[] = [],
): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  const safeSelected = normalizeOnboardingPeopleSelectedIds(selectedIds);
  const safeProposed = normalizeOnboardingPeopleProposedIds([...proposedIds, ...safeSelected]);
  const isDirector = personType === "director";
  const payload = isDirector
    ? {
        onboarding_directors_selected_ids: safeSelected,
        onboarding_directors_proposed_ids: safeProposed,
      }
    : {
        onboarding_actors_selected_ids: safeSelected,
        onboarding_actors_proposed_ids: safeProposed,
      };

  await supabase.from("profiles").update(payload as any).eq("id", userId);
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
    onboarding_step: "search",
    favorite_genres: genres,
    excluded_genres: excluded,
    preferred_platforms: platforms,
    media_preference: "both",
    min_rating: ONBOARDING_MIN_RATING,
    match_threshold: ONBOARDING_MATCH_THRESHOLD,
    tour_completed: true,
    activation_completed: true,
    activation_step: "done",
    onboarding_films_progress: 0,
    onboarding_films_liked_ids: [],
    onboarding_films_proposed_ids: [],
    onboarding_actors_selected_ids: [],
    onboarding_actors_proposed_ids: [],
    onboarding_directors_selected_ids: [],
    onboarding_directors_proposed_ids: [],
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
    .update({
      onboarding_films_progress: 0,
      onboarding_films_liked_ids: [],
      onboarding_films_proposed_ids: [],
      onboarding_actors_selected_ids: [],
      onboarding_actors_proposed_ids: [],
      onboarding_directors_selected_ids: [],
      onboarding_directors_proposed_ids: [],
    } as any)
    .eq("id", userId);
  if (
    filmsProgressError &&
    !/onboarding_films_progress|onboarding_films_liked_ids|onboarding_films_proposed_ids|onboarding_actors_|onboarding_directors_/i.test(
      filmsProgressError.message,
    )
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
    if (/onboarding_films_progress|onboarding_films_liked_ids|onboarding_films_proposed_ids|onboarding_actors_|onboarding_directors_/i.test(msg)) {
      return "Migration initiatique manquante (onboarding_films_* / onboarding_*_people_*). Exécute supabase/migrations/20260622180000_onboarding_migrations_verify.sql puis réessaie.";
    }
    return msg;
  }
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Réessaie dans un instant.";
}