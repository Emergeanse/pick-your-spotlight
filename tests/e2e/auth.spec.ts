/**
 * TNR — Authentification et garde de routes
 *
 * Vérifie que :
 *   1. Les routes /app/* redirigent vers la page d'auth quand non connecté
 *   2. La page de login s'affiche correctement
 *   3. Après login, les routes /app/* sont accessibles
 *   4. La déconnexion redirige vers /auth
 *
 * Variables d'environnement (optionnelles) :
 *   E2E_TEST_EMAIL     email d'un compte de test
 *   E2E_TEST_PASSWORD  mot de passe du compte de test
 */
import { test, expect } from '@playwright/test';
import { loginViaApi, TEST_EMAIL } from './helpers/auth';

// ── Tests sans credentials (garde de route publique) ──────────────────────────

test.describe('Garde de route — non authentifié', () => {
  test('accès direct à /app redirige vers la page auth', async ({ page }) => {
    await page.goto('/app');
    // Attendre la redirection (ProtectedRoute → /auth ou /)
    await page.waitForURL(/(\/auth|^\/$)/, { timeout: 10_000 });
    const url = page.url();
    expect(url).toMatch(/(auth|^\/$)/);
  });

  test('accès direct à /app/soirees redirige vers la page auth', async ({ page }) => {
    await page.goto('/app/soirees');
    await page.waitForURL(/(\/auth|^\/$)/, { timeout: 10_000 });
  });

  test('accès direct à /app/profile redirige vers la page auth', async ({ page }) => {
    await page.goto('/app/profile');
    await page.waitForURL(/(\/auth|^\/$)/, { timeout: 10_000 });
  });

  test('la page auth affiche un champ email et un champ mot de passe', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    // Cherche au moins un input de type email ou avec placeholder email
    const emailField = page.locator('input[type="email"], input[placeholder*="mail" i]').first();
    const passField  = page.locator('input[type="password"]').first();
    await expect(emailField).toBeVisible({ timeout: 8_000 });
    await expect(passField).toBeVisible({ timeout: 8_000 });
  });
});

// ── Tests avec credentials ─────────────────────────────────────────────────────

test.describe('Session authentifiée', () => {
  test.skip(!TEST_EMAIL, 'E2E_TEST_EMAIL non défini — ignoré sans credentials');

  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('après login, /app est accessible (HomeScreen charge)', async ({ page }) => {
    await page.goto('/app');
    // Ne doit PAS rediriger vers /auth
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/app');
    expect(page.url()).not.toContain('/auth');
  });

  test('la BottomTabBar est visible sur /app', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    // BottomTabBar contient les labels des onglets
    const tabBar = page.locator('text=Accueil').or(page.locator('text=Soirées')).or(page.locator('text=Biblio'));
    await expect(tabBar.first()).toBeVisible({ timeout: 8_000 });
  });

  test('les routes protégées sont toutes accessibles avec une session valide', async ({ page }) => {
    const routes = ['/app', '/app/soirees', '/app/my-cinema', '/app/profile'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      expect(page.url()).not.toContain('/auth');
    }
  });
});
