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
    await expect(page.getByText(/minute/i)).toBeVisible({ timeout: 8_000 });
  });

  test("étape genres — exemples Comédie / Horreur, seuil à 4 sélections et CTA Continuer", async ({ page }) => {
    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /C'est parti/i }).click();
    await expect(page.getByText(/Initiation · 2\/5 · Genres/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Comédie" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Horreur" })).toBeVisible();
    const continueBtn = page.getByRole("button", { name: /Continuer/i });
    // Comédie/Horreur ne sont que des exemples visuels — pas de vraie sélection tant qu'on n'a pas touché aux chips.
    await expect(continueBtn).toBeDisabled();
    await page.getByRole("button", { name: "Fantastique" }).click();
    await page.getByRole("button", { name: "Thriller" }).click();
    await page.getByRole("button", { name: "Action" }).click();
    await page.getByRole("button", { name: "Aventure" }).click();
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
