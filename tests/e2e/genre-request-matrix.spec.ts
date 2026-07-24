/**
 * TNR — Matrice genres × type de requête (batteries par profil utilisateur)
 *
 * Vérifie que les genres/exclusions/seuils du profil — ou d'un thème choisi pour
 * une session précise — atteignent bien la requête envoyée à surprise-personalized.
 * Régression du bug corrigé le 2026-07-23 : pollution du profil par les genres
 * démo de l'onboarding, et recherche auto lancée avant que le profil soit chargé,
 * qui faisaient toutes deux disparaître les genres réels de la requête.
 *
 * Les fonctions edge sont simulées (page.route) : ces tests n'appellent jamais
 * le vrai LLM — rapides, gratuits, déterministes. Ils valident le CLIENT
 * (est-ce que Pick demande les bons genres ?), pas la pertinence du choix du LLM.
 *
 * Nécessite E2E_TEST_EMAIL / E2E_TEST_PASSWORD (.env.test)
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaApi, TEST_EMAIL } from "./helpers/auth";
import { setProfileGenres } from "./helpers/profile";

const MOCK_MOVIE = {
  id: 99002,
  title: "Film Test Matrice Genres",
  overview: "Film de test pour la matrice genres × requête.",
  poster_path: "/test-poster.jpg",
  vote_average: 8.0,
  release_date: "2025-06-01",
  genre_ids: [28, 18],
  genres: [{ id: 28, name: "Action" }, { id: 18, name: "Drame" }],
  original_language: "en",
};

const MOCK_SP_RESPONSE = {
  movies: [
    {
      movie: MOCK_MOVIE,
      reason: "Correspond à tes goûts TNR",
      confidence: 92,
      recommendationTexts: {
        matchScore: 92,
        score: 92,
        whyItMatches: "Correspond à tes goûts TNR",
        headline: "Un film parfait pour toi",
      },
    },
  ],
  movie: MOCK_MOVIE,
  reason: "Correspond à tes goûts TNR",
  confidence: 92,
  engineMeta: { mode: "retrieve-rerank", finalCount: 1 },
};

/** Intercepte surprise-personalized (capture le body) et movie-match (réponse neutre). */
async function mockEdgeFunctions(page: Page, captured: any[]) {
  await page.route("**/functions/v1/surprise-personalized**", async (route) => {
    let body: any = null;
    try { body = route.request().postDataJSON(); } catch { /* pas de JSON — laissé à null */ }
    captured.push(body);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_SP_RESPONSE) });
  });
  await page.route("**/functions/v1/movie-match**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ score: 90, explanation: "ok", headline: "ok", reason: "ok" }),
    });
  });
}

async function launchSurprise(page: Page) {
  await page.locator("button").filter({ hasText: /organiser une soir.e/i }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /laisse.moi te surprendre/i }).click();
}

const PERSONAS = [
  { name: "Fantastique / Science-Fiction", liked: ["Fantastique", "Science-Fiction"], excluded: ["Horreur", "Comédie"] },
  { name: "Comédie / Romance", liked: ["Comédie", "Romance"], excluded: ["Horreur", "Science-Fiction"] },
  { name: "Thriller / Crime", liked: ["Thriller", "Crime"], excluded: ["Comédie", "Animation"] },
];

test.describe("Matrice genres × requête — TNR", () => {
  test.skip(!TEST_EMAIL, "E2E_TEST_EMAIL non défini");

  for (const persona of PERSONAS) {
    test(`profil "${persona.name}" — la recherche Surprise reflète les genres du profil`, async ({ page }) => {
      await setProfileGenres({ liked: persona.liked, excluded: persona.excluded, minRating: 7, matchThreshold: 70 });
      await loginViaApi(page);
      const captured: any[] = [];
      await mockEdgeFunctions(page, captured);

      await page.goto("/app");
      await page.waitForLoadState("networkidle");
      await launchSurprise(page);

      await expect.poll(() => captured.length, { timeout: 15_000 }).toBeGreaterThan(0);
      const body = captured[0];
      const sentLiked: string[] = body?.tasteProfile?.topGenres ?? [];
      const sentExcluded: string[] = body?.excludedGenres ?? [];

      for (const g of persona.liked) expect(sentLiked).toContain(g);
      for (const g of persona.excluded) expect(sentExcluded).toContain(g);
      expect(body?.minRating).toBe(7);
      expect(body?.minMatchScore).toBe(70);
    });
  }

  test("thème de session (Thriller) — remplace les genres du profil pour cette recherche", async ({ page }) => {
    await setProfileGenres({ liked: ["Comédie", "Romance"], excluded: ["Horreur"], minRating: 7, matchThreshold: 70 });
    await loginViaApi(page);
    const captured: any[] = [];
    await mockEdgeFunctions(page, captured);

    await page.goto("/app");
    await page.waitForLoadState("networkidle");

    await page.locator("button").filter({ hasText: /organiser une soir.e/i }).first().click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Thème" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /Thriller/i }).click();
    await page.getByRole("button", { name: /Valider/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /laisse.moi te surprendre/i }).click();

    await expect.poll(() => captured.length, { timeout: 15_000 }).toBeGreaterThan(0);
    const sentLiked: string[] = captured[0]?.tasteProfile?.topGenres ?? [];
    expect(sentLiked).toEqual(["Thriller"]);
  });
});
