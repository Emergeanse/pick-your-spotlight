const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'https://lrjhpflvkrebbngfnaif.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyamhwZmx2a3JlYmJuZ2ZuYWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODMwODMsImV4cCI6MjA4ODc1OTA4M30.uqrxehgcnJTHmhGcmSKpu8GNngUkSE5iuHUcw7z4tPk';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? '';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? '';

/** Auth directe API (indépendante de loginViaApi) — pour obtenir un token utilisable en REST. */
async function getTestSession(): Promise<{ accessToken: string; userId: string }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Login Supabase échoué (${res.status}): ${await res.text()}`);
  }
  const session = (await res.json()) as { access_token: string; user: { id: string } };
  return { accessToken: session.access_token, userId: session.user.id };
}

function authHeaders(accessToken: string) {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
  };
}

/**
 * Supprime les lignes user_preferences (catégorie "genre") de l'utilisateur de test —
 * même étape que setGenrePreferences() côté app. Sans ça, topGenres/excludedGenres
 * restent l'union de profiles.favorite_genres ET de ces lignes, qui s'accumulent
 * silencieusement d'un test à l'autre (persona précédente qui « fuit » dans la suivante).
 */
async function clearGenrePreferenceRows(accessToken: string, userId: string): Promise<void> {
  const tagsRes = await fetch(`${SUPABASE_URL}/rest/v1/preference_tags?category=eq.genre&select=id`, {
    headers: authHeaders(accessToken),
  });
  if (!tagsRes.ok) throw new Error(`Lecture preference_tags échouée (${tagsRes.status}): ${await tagsRes.text()}`);
  const tags = (await tagsRes.json()) as { id: string }[];
  if (!tags.length) return;
  const idsFilter = `(${tags.map((t) => t.id).join(',')})`;
  const delRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_preferences?user_id=eq.${userId}&tag_id=in.${idsFilter}`,
    { method: 'DELETE', headers: { ...authHeaders(accessToken), Prefer: 'return=minimal' } },
  );
  if (!delRes.ok) throw new Error(`Purge user_preferences échouée (${delRes.status}): ${await delRes.text()}`);
}

/**
 * Fixe directement les genres/seuils du profil de test via REST (PATCH profiles +
 * purge user_preferences), sans passer par l'UI — beaucoup plus rapide qu'un
 * aller-retour onboarding par persona, et sans pollution entre personas successives.
 */
export async function setProfileGenres(opts: {
  liked: string[];
  excluded: string[];
  minRating?: number;
  matchThreshold?: number;
}): Promise<void> {
  const { accessToken, userId } = await getTestSession();
  await clearGenrePreferenceRows(accessToken, userId);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...authHeaders(accessToken), Prefer: 'return=minimal' },
    body: JSON.stringify({
      favorite_genres: opts.liked,
      excluded_genres: opts.excluded,
      ...(opts.minRating !== undefined && { min_rating: opts.minRating }),
      ...(opts.matchThreshold !== undefined && { match_threshold: opts.matchThreshold }),
    }),
  });
  if (!res.ok) {
    throw new Error(`setProfileGenres PATCH échoué (${res.status}): ${await res.text()}`);
  }
}
