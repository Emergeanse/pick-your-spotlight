import { describe, it, expect } from "vitest";
import {
  ONBOARDING_STEPS,
  ONBOARDING_MIN_RATING,
  ONBOARDING_MATCH_THRESHOLD,
  onboardingErrorMessage,
} from "@/lib/onboarding-progress";
import { pickRandomOnboarding, shuffleOnboarding } from "@/lib/onboarding-random";
import {
  CURATED_EN_TMDB_IDS,
  CURATED_FR_TMDB_IDS,
  getOnboardingFilmOriginLabel,
  ONBOARDING_FILM_TARGET,
  ONBOARDING_FILM_PAGE_SIZE,
  pickOnboardingFilmReplacement,
} from "@/lib/onboarding-films";
import { hasMoviePoster, hasUsablePoster, normalizePosterPath, type Movie } from "@/lib/tmdb";
import {
  CURATED_ONBOARDING_ACTOR_IDS,
  CURATED_ONBOARDING_DIRECTOR_IDS,
  ONBOARDING_PEOPLE_TARGET,
  ONBOARDING_PEOPLE_PAGE_SIZE,
} from "@/lib/onboarding-people";

describe("parcours initiatique — constantes & étapes", () => {
  it("définit 8 étapes dans le bon ordre", () => {
    expect(ONBOARDING_STEPS).toEqual([
      "welcome",
      "genres",
      "platforms",
      "films",
      "actors",
      "directors",
      "modes",
      "soirees",
    ]);
  });

  it("conserve les préréglages reco onboarding", () => {
    expect(ONBOARDING_MIN_RATING).toBe(6);
    expect(ONBOARDING_MATCH_THRESHOLD).toBe(60);
    expect(ONBOARDING_FILM_TARGET).toBe(10);
    expect(ONBOARDING_PEOPLE_TARGET).toBe(5);
    expect(ONBOARDING_FILM_PAGE_SIZE).toBeGreaterThan(0);
    expect(ONBOARDING_PEOPLE_PAGE_SIZE).toBeGreaterThan(0);
  });
});

describe("parcours initiatique — pools curatés", () => {
  it("sépare acteurs et réalisateurs (Audrey Tautou = actrice uniquement)", () => {
    const audreyTautou = 8293;
    expect(CURATED_ONBOARDING_ACTOR_IDS).toContain(audreyTautou);
    expect(CURATED_ONBOARDING_DIRECTOR_IDS).not.toContain(audreyTautou);
  });

  it("n'a pas de doublons dans les pools personnes", () => {
    expect(new Set(CURATED_ONBOARDING_ACTOR_IDS).size).toBe(CURATED_ONBOARDING_ACTOR_IDS.length);
    expect(new Set(CURATED_ONBOARDING_DIRECTOR_IDS).size).toBe(
      CURATED_ONBOARDING_DIRECTOR_IDS.length,
    );
  });

  it("attribue les badges origine films depuis les listes curatées", () => {
    expect(getOnboardingFilmOriginLabel(CURATED_FR_TMDB_IDS[0])).toBe("Cinéma français");
    expect(getOnboardingFilmOriginLabel(CURATED_EN_TMDB_IDS[0])).toBe("Blockbuster US");
    expect(getOnboardingFilmOriginLabel(999999999)).toBeNull();
  });
});

describe("parcours initiatique — tirage aléatoire", () => {
  it("shuffleOnboarding ne mute pas l'original", () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffleOnboarding(src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
    expect(out.sort()).toEqual(src.sort());
  });

  it("pickRandomOnboarding respecte la taille demandée", () => {
    const pool = Array.from({ length: 20 }, (_, i) => i);
    expect(pickRandomOnboarding(pool, 8)).toHaveLength(8);
    expect(pickRandomOnboarding(pool, 0)).toHaveLength(0);
    expect(pickRandomOnboarding(pool, 100)).toHaveLength(20);
  });
});

describe("parcours initiatique — affiches films", () => {
  it("normalise les chemins TMDB", () => {
    expect(normalizePosterPath("/abc.jpg")).toBe("/abc.jpg");
    expect(normalizePosterPath("abc.jpg")).toBe("/abc.jpg");
    expect(normalizePosterPath("  /abc.jpg  ")).toBe("/abc.jpg");
    expect(normalizePosterPath(null)).toBeNull();
    expect(normalizePosterPath("")).toBeNull();
    expect(normalizePosterPath("null")).toBeNull();
    expect(normalizePosterPath("undefined")).toBeNull();
  });

  it("rejette les affiches invalides", () => {
    expect(hasUsablePoster(null)).toBe(false);
    expect(hasUsablePoster("")).toBe(false);
    expect(hasUsablePoster("null")).toBe(false);
    expect(hasUsablePoster("/valid.jpg")).toBe(true);
  });

  it("valide poster_path sur un film (movie ou tv)", () => {
    expect(hasMoviePoster({ poster_path: "/abc.jpg" })).toBe(true);
    expect(hasMoviePoster({ poster_path: null })).toBe(false);
    expect(hasMoviePoster({ poster_path: "" })).toBe(false);
  });
});

describe("parcours initiatique — remplacement affiche", () => {
  const stub = (id: number, poster_path: string | null): Movie => ({
    id,
    title: `Film ${id}`,
    overview: "",
    poster_path,
    backdrop_path: null,
    vote_average: 7,
    genre_ids: [],
  });

  it("choisit un film hors écran avec affiche valide", () => {
    const pool = [stub(1, "/a.jpg"), stub(2, "/b.jpg"), stub(3, "/c.jpg"), stub(4, null)];
    const replacement = pickOnboardingFilmReplacement(pool, [1, 2], 1);
    expect(replacement?.id).toBe(3);
  });

  it("ne réutilise pas un film déjà visible", () => {
    const pool = [stub(1, "/a.jpg"), stub(2, "/b.jpg")];
    expect(pickOnboardingFilmReplacement(pool, [1, 2], 1)).toBeNull();
  });

  it("ignore le film en échec même s'il n'est pas dans visibleIds", () => {
    const pool = [stub(5, "/e.jpg"), stub(6, "/f.jpg")];
    const replacement = pickOnboardingFilmReplacement(pool, [1], 5);
    expect(replacement?.id).toBe(6);
  });
});

describe("parcours initiatique — messages d'erreur migration", () => {
  it("signale une migration onboarding_step manquante", () => {
    const msg = onboardingErrorMessage({ message: "column onboarding_step does not exist" });
    expect(msg).toMatch(/onboarding_step/i);
    expect(msg).toMatch(/Migration/i);
  });

  it("signale une migration films/personnes manquante", () => {
    const msg = onboardingErrorMessage({ message: "column onboarding_films_liked_ids does not exist" });
    expect(msg).toMatch(/20260622180000/i);
  });
});
