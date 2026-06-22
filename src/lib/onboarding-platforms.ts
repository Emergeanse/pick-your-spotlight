/** Plateformes gratuites toujours incluses (non désactivables) */
export const LOCKED_FREE_PLATFORM_IDS = [234, 1754, 35, 147] as const; // Arte, TF1+, Rakuten TV, M6+

/** Autres plateformes gratuites pré-cochées à l'initiation */
export const SUGGESTED_FREE_PLATFORM_IDS = [300, 1967] as const; // Pluto TV, Molotov TV

export const DEFAULT_ONBOARDING_PLATFORM_IDS: number[] = [
  ...LOCKED_FREE_PLATFORM_IDS,
  ...SUGGESTED_FREE_PLATFORM_IDS,
];

export function ensureOnboardingPlatforms(selected: number[]): number[] {
  const set = new Set(selected);
  for (const id of LOCKED_FREE_PLATFORM_IDS) set.add(id);
  return [...set];
}

export function isLockedFreePlatform(id: number): boolean {
  return (LOCKED_FREE_PLATFORM_IDS as readonly number[]).includes(id);
}
