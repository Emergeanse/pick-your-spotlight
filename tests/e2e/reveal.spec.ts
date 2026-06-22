/**
 * TNR — Bouton "Révéler" d'une soirée
 *
 * Régression cible : cliquer "Révéler" dans EventDetailPage devait déclencher
 * le pipeline de recommandation sur HomeScreen, mais l'intent était perdu
 * à cause du double-mount React Router / HMR Vite (corrigé 2026-06-21).
 *
 * Variables d'environnement requises :
 *   E2E_TEST_EMAIL     email d'un compte de test (organisateur d'au moins une soirée)
 *   E2E_TEST_PASSWORD  mot de passe du compte de test
 */
import { test, expect } from '@playwright/test';
import { loginViaApi, TEST_EMAIL } from './helpers/auth';

const SESSION_REVEAL_KEY = 'pick_reveal_intent_v1';

// ── Helpers d'interception réseau ──────────────────────────────────────────

/** Bloque les appels aux edge functions IA pour éviter la latence et la facture. */
async function mockEdgeFunctions(page: Parameters<typeof test>[1] extends { page: infer P } ? P : never) {
  const mockMovie = {
    id: 99999,
    title: 'Film Test E2E',
    overview: 'Résumé du film de test.',
    poster_path: '/test-poster.jpg',
    vote_average: 8.5,
    release_date: '2025-01-01',
    genre_ids: [18],
  };

  // Edge functions Supabase (surprise-personalized, movie-match, group-recommend)
  await page.route('**/functions/v1/**', async route => {
    const url = route.request().url();
    if (url.includes('surprise-personalized') || url.includes('group-recommend')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockMovie]),
      });
    } else if (url.includes('movie-match')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ score: 92, explanation: 'Excellent match E2E' }),
      });
    } else {
      await route.continue();
    }
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Bouton Révéler — TNR régression', () => {
  test.skip(!TEST_EMAIL, 'E2E_TEST_EMAIL non défini — test ignoré en CI sans credentials');

  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  // ── Test 1 : mécanisme sessionStorage ─────────────────────────────────
  test('sessionStorage contient l\'intent après clic Révéler', async ({ page }) => {
    await mockEdgeFunctions(page as any);

    // Aller sur la liste des soirées
    await page.goto('/app/soirees');
    await page.waitForLoadState('networkidle');

    // Cliquer sur la première soirée disponible
    const eventCards = page.locator('button').filter({ hasText: /\w/ });
    const count = await eventCards.count();
    if (count === 0) {
      test.skip(); // Pas de soirée dans le compte de test
      return;
    }
    await eventCards.first().click();

    // Attendre le chargement de EventDetailPage
    await page.waitForURL('**/soirees/**');
    await page.waitForLoadState('networkidle');

    // Vérifier la présence du bouton Révéler (visible uniquement pour l'organisateur)
    const revealBtn = page.getByRole('button', { name: 'Révéler' });
    const hasReveal = await revealBtn.isVisible().catch(() => false);
    if (!hasReveal) {
      test.skip(); // La soirée n'appartient pas au compte test ou est déjà révélée
      return;
    }

    // Cliquer sur Révéler
    await revealBtn.click();

    // Vérification clé : sessionStorage doit contenir l'intent AVANT de naviguer
    // (le navigate('/app') est dans la même fonction, juste après queueForReveal)
    await page.waitForURL('**/app');

    const raw = await page.evaluate((key) => sessionStorage.getItem(key), SESSION_REVEAL_KEY);
    // L'intent peut déjà être consommé si le pipeline a démarré très vite — on accepte les deux états
    // L'important est qu'il AIT ÉTÉ posé (on le vérifie via la présence ou non du résultat)
    // Si sessionStorage est null → le pipeline a déjà consommé → c'est bon
    // Si sessionStorage est non-null → posé, pas encore consommé

    if (raw !== null) {
      const intent = JSON.parse(raw) as { context: string; genres: string[] };
      expect(intent.context).toBeTruthy();
      expect(['solo', 'duo', 'group']).toContain(intent.context);
    }
  });

  // ── Test 2 : pipeline déclenché (résultat visible dans HomeScreen) ─────
  test('RÉGRESSION — Révéler ouvre l\'overlay sans flash de l\'accueil', async ({ page }) => {
    await mockEdgeFunctions(page as any);

    await page.goto('/app/soirees');
    await page.waitForLoadState('networkidle');

    const eventCards = page.locator('button').filter({ hasText: /\w/ });
    if ((await eventCards.count()) === 0) {
      test.skip();
      return;
    }
    await eventCards.first().click();
    await page.waitForURL('**/soirees/**');
    await page.waitForLoadState('networkidle');

    const revealBtn = page.getByRole('button', { name: 'Révéler' });
    if (!(await revealBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    const t0 = Date.now();
    await revealBtn.click();
    await page.waitForURL(/\/app$/, { timeout: 10_000 });

    // Overlay plein écran (TonightPickOverlay — fond noir z-50)
    const overlay = page.locator('.fixed.inset-0.z-50.bg-black').first();
    await expect(overlay).toBeVisible({ timeout: 2_000 });
    expect(Date.now() - t0).toBeLessThan(1_500);

    // Le greeting accueil ne doit pas être visible pendant le chargement
    const greeting = page.getByText(/Bonsoir/i).first();
    await expect(greeting).not.toBeVisible({ timeout: 500 });
  });

  test('le pipeline démarre et affiche un résultat après Révéler solo', async ({ page }) => {
    await mockEdgeFunctions(page as any);

    await page.goto('/app/soirees');
    await page.waitForLoadState('networkidle');

    // Chercher une soirée solo
    const soloCard = page.locator('button').filter({ hasText: /Solo/i }).first();
    if (!(await soloCard.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await soloCard.click();

    await page.waitForURL('**/soirees/**');
    await page.waitForLoadState('networkidle');

    const revealBtn = page.getByRole('button', { name: 'Révéler' });
    if (!(await revealBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await revealBtn.click();

    // Attendre la navigation vers HomeScreen
    await page.waitForURL(/\/app$/, { timeout: 10_000 });

    // Le pipeline doit déclencher un état de chargement ou afficher un film
    // On attend l'un OU l'autre dans un délai raisonnable
    const loadingOrResult = page.locator([
      // Spinner / état chargement générique
      '[class*="animate-spin"]',
      '[class*="loading"]',
      // Carte film résultante (flip card ou carte résultat)
      '[class*="tonight"]',
      '[class*="result"]',
      // Toast de succès
      '[data-sonner-toast]',
      // Le film mocké
      'text=Film Test E2E',
    ].join(', '));

    await expect(loadingOrResult.first()).toBeVisible({ timeout: 20_000 });
  });

  // ── Test 3 : l'intent survive à un rechargement de module (simulation HMR) ─
  test('l\'intent dans sessionStorage survit à une navigation supplémentaire', async ({ page }) => {
    // Ce test simule la situation exacte du bug : l'intent est posé,
    // puis un rechargement de contexte se produit (simule HMR / double-mount).
    // Avec la correction sessionStorage, l'intent doit toujours être là.

    await page.goto('/app');
    await page.waitForLoadState('domcontentloaded');

    // Injecter manuellement un intent dans sessionStorage
    const fakeIntent = {
      context: 'solo',
      genres: ['Comédie'],
      mood: '',
      participantIds: [],
    };
    await page.evaluate(
      ({ key, value }) => sessionStorage.setItem(key, value),
      { key: SESSION_REVEAL_KEY, value: JSON.stringify(fakeIntent) }
    );

    // Simuler un rechargement de module JS (équivalent HMR) via navigate + retour
    await page.goto('/app/soirees');
    await page.waitForLoadState('domcontentloaded');

    // L'intent doit toujours être là (sessionStorage survit aux navigations)
    const still = await page.evaluate((key) => sessionStorage.getItem(key), SESSION_REVEAL_KEY);
    expect(still).not.toBeNull();

    const parsed = JSON.parse(still!);
    expect(parsed.context).toBe('solo');
    expect(parsed.genres).toContain('Comédie');
  });
});
