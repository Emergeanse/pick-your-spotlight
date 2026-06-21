import type { Page } from '@playwright/test';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'https://lrjhpflvkrebbngfnaif.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyamhwZmx2a3JlYmJuZ2ZuYWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODMwODMsImV4cCI6MjA4ODc1OTA4M30.uqrxehgcnJTHmhGcmSKpu8GNngUkSE5iuHUcw7z4tPk';
const PROJECT_REF = 'lrjhpflvkrebbngfnaif';

export const TEST_EMAIL    = process.env.E2E_TEST_EMAIL    ?? '';
export const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? '';

/**
 * Injecte une session Supabase dans localStorage sans passer par l'UI de login.
 * Beaucoup plus rapide que de remplir le formulaire, et résistant aux changements UI.
 */
export async function loginViaApi(page: Page): Promise<void> {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error(
      'Variables E2E_TEST_EMAIL et E2E_TEST_PASSWORD manquantes.\n' +
      'Créez un fichier .env.test ou exportez-les avant de lancer les tests.'
    );
  }

  // 1. Obtenir le token via l'API Supabase Auth
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login Supabase échoué (${res.status}): ${body}`);
  }

  const session = await res.json() as {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
    user: { id: string; email: string };
  };

  // 2. Charger une page vide de l'app pour initialiser le contexte
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // 3. Injecter la session dans localStorage (Supabase persiste là avec persistSession: true)
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    {
      key: `sb-${PROJECT_REF}-auth-token`,
      value: JSON.stringify({
        access_token:  session.access_token,
        refresh_token: session.refresh_token,
        expires_at:    session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
        token_type:    'bearer',
        user:          session.user,
      }),
    }
  );
}
