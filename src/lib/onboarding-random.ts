/** Mélange Fisher–Yates (copie, ne mute pas l’original). */
export function shuffleOnboarding<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickRandomOnboarding<T>(items: readonly T[], count: number): T[] {
  return shuffleOnboarding(items).slice(0, Math.max(0, count));
}
