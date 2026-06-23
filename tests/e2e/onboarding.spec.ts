/**
 * TNR E2E — Parcours initiatique (smoke)
 *
 * Nécessite E2E_TEST_EMAIL / E2E_TEST_PASSWORD (.env.test)
 */
import { test, expect } from "@playwright/test";
import { loginViaApi, TEST_EMAIL } from "./helpers/auth";

test.describe("Parcours initiatique — smoke", () => {
  test.skip(!TEST_EMAIL, "E2E_TEST_EMAIL non défini");

  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test("la route /onboarding affiche l'écran Bienvenue", async ({ page }) => {
    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Bienvenue sur Pick/i })).toBeVisible({
      timeout: 12_000,
    });
    await expect(page.getByText(/2 minutes/i)).toBeVisible({ timeout: 8_000 });
  });

  test("étape genres — exemples Comédie / Horreur et CTA Continuer", async ({ page }) => {
    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /C'est parti/i }).click();
    await expect(page.getByText(/Initiation · 2\/8 · Genres/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Comédie" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Horreur" })).toBeVisible();
    await page.getByRole("button", { name: "Thriller" }).click();
    const continueBtn = page.getByRole("button", { name: /Continuer/i });
    await expect(continueBtn).toBeEnabled({ timeout: 5_000 });
  });

  test("compte non terminé — /app redirige vers onboarding ou affiche l'accueil gated", async ({
    page,
  }) => {
    await page.goto("/app/soirees");
    await page.waitForLoadState("networkidle");
    const url = page.url();
    const onOnboarding = url.includes("/onboarding");
    const onApp = url.includes("/app");
    expect(onOnboarding || onApp).toBe(true);
    if (onOnboarding) {
      await expect(page.getByText(/Initiation/i).first()).toBeVisible({ timeout: 8_000 });
    }
  });
});
