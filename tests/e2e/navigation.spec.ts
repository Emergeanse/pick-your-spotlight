/**
 * TNR — Navigation (BottomTabBar)
 *
 * Vérifie que la navigation entre onglets fonctionne sans régression :
 * chaque onglet charge la bonne page et l'URL est correcte.
 *
 * Variables d'environnement requises :
 *   E2E_TEST_EMAIL / E2E_TEST_PASSWORD
 */
import { test, expect } from '@playwright/test';
import { loginViaApi, TEST_EMAIL } from './helpers/auth';

test.describe('BottomTabBar — navigation entre onglets', () => {
  test.skip(!TEST_EMAIL, 'E2E_TEST_EMAIL non défini — ignoré sans credentials');

  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
  });

  test('onglet Soirées navigue vers /app/soirees', async ({ page }) => {
    await page.getByRole('button', { name: /soirées/i }).click();
    await page.waitForURL('**/soirees', { timeout: 8_000 });
    expect(page.url()).toContain('/app/soirees');
  });

  test('onglet Biblio navigue vers /app/my-cinema', async ({ page }) => {
    await page.getByRole('button', { name: /biblio/i }).click();
    await page.waitForURL('**/my-cinema', { timeout: 8_000 });
    expect(page.url()).toContain('/app/my-cinema');
  });

  test('onglet Profil navigue vers /app/profile', async ({ page }) => {
    await page.getByRole('button', { name: /profil/i }).click();
    await page.waitForURL('**/profile', { timeout: 8_000 });
    expect(page.url()).toContain('/app/profile');
  });

  test('onglet Accueil ramène vers /app', async ({ page }) => {
    // Partir de Soirées puis revenir
    await page.getByRole('button', { name: /soirées/i }).click();
    await page.waitForURL('**/soirees');
    await page.getByRole('button', { name: /accueil/i }).click();
    await page.waitForURL(/\/app$/, { timeout: 8_000 });
    expect(page.url()).toMatch(/\/app$/);
  });

  test('navigation rapide entre tous les onglets ne provoque pas d\'erreur', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.getByRole('button', { name: /soirées/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /biblio/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /profil/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /accueil/i }).click();
    await page.waitForTimeout(500);

    // Aucune erreur JS fatale pendant la navigation
    const fatalErrors = errors.filter(e =>
      !e.includes('ResizeObserver') && // erreur inoffensive connue
      !e.includes('Non-Error promise rejection') // avertissement Supabase
    );
    expect(fatalErrors).toHaveLength(0);
  });
});
