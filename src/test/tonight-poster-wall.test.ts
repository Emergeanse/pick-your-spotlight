/**
 * TNR — Mur d'affiches cinéma (TonightPickOverlay)
 *
 * Régression cible : le carrousel de posters pendant le chargement reco
 * doit toujours remplir chaque cellule avec un chemin TMDB valide, compléter
 * via les fallbacks si le pool API est trop petit, et remplacer les affiches
 * en échec par un poster non déjà visible.
 */
import { describe, it, expect } from "vitest";
import {
  FALLBACK_POSTER_PATHS,
  buildWallColumns,
  extractPosterPaths,
  fallbackPathFor,
  mergePosterPools,
  pickUnusedPosterPath,
} from "@/lib/tonight-poster-wall";

const VALID_PATH = /^\/[A-Za-z0-9._-]+\.jpg$/;

describe("mur d'affiches — pool & fusion", () => {
  it("expose un pool de fallbacks suffisant pour 4 colonnes", () => {
    expect(FALLBACK_POSTER_PATHS.length).toBeGreaterThanOrEqual(20);
    for (const path of FALLBACK_POSTER_PATHS) {
      expect(path).toMatch(VALID_PATH);
    }
  });

  it("mergePosterPools déduplique et normalise les chemins", () => {
    const merged = mergePosterPools(
      ["/a.jpg", "b.jpg"],
      ["/a.jpg", "/c.jpg", "null", ""],
    );
    expect(merged).toEqual(["/a.jpg", "/b.jpg", "/c.jpg"]);
  });

  it("mergePosterPools préserve l'ordre des pools (fallbacks d'abord)", () => {
    const api = ["/api1.jpg", "/api2.jpg"];
    const merged = mergePosterPools([...FALLBACK_POSTER_PATHS], api);
    expect(merged[0]).toBe(FALLBACK_POSTER_PATHS[0]);
    expect(merged).toContain("/api1.jpg");
    expect(new Set(merged).size).toBe(merged.length);
  });

  it("extractPosterPaths ignore les entrées sans poster_path valide", () => {
    const results = [
      { poster_path: "/ok.jpg" },
      { poster_path: null },
      { poster_path: "null" },
      { title: "sans affiche" },
    ];
    expect(extractPosterPaths(results)).toEqual(["/ok.jpg"]);
    expect(extractPosterPaths(null)).toEqual([]);
  });
});

describe("mur d'affiches — buildWallColumns", () => {
  it("chaque cellule reçoit un chemin valide non vide", () => {
    const columns = buildWallColumns(["/x.jpg", "/y.jpg", "/z.jpg"]);
    expect(columns).toHaveLength(4);
    for (const col of columns) {
      expect(col.length).toBeGreaterThanOrEqual(16);
      for (const path of col) {
        expect(path).toMatch(VALID_PATH);
        expect(path.length).toBeGreaterThan(0);
      }
    }
  });

  it("complète avec FALLBACK_POSTER_PATHS quand le pool API est trop petit", () => {
    const shortPool = ["/only-one.jpg"];
    const columns = buildWallColumns(shortPool);
    const allPaths = columns.flat();
    expect(allPaths).toContain("/only-one.jpg");
    expect(allPaths.some((p) => FALLBACK_POSTER_PATHS.includes(p as (typeof FALLBACK_POSTER_PATHS)[number]))).toBe(true);
  });

  it("filtre les chemins invalides sans laisser de cases vides", () => {
    const columns = buildWallColumns(["", "null", "undefined", "/valid.jpg"]);
    const flat = columns.flat();
    expect(flat.every((p) => p && p !== "null")).toBe(true);
    expect(flat).toContain("/valid.jpg");
  });

  it("évite deux affiches consécutives identiques dans une colonne", () => {
    const tinyPool = ["/a.jpg", "/b.jpg"];
    const columns = buildWallColumns(tinyPool);
    for (const col of columns) {
      for (let i = 1; i < col.length; i++) {
        expect(col[i]).not.toBe(col[i - 1]);
      }
    }
  });

  it("utilise le pool fourni quand il contient au moins 8 affiches", () => {
    const pool = Array.from({ length: 10 }, (_, i) => `/film-${i}.jpg`);
    const columns = buildWallColumns(pool);
    const flat = new Set(columns.flat());
    for (const path of pool) {
      expect(flat.has(path)).toBe(true);
    }
  });
});

describe("mur d'affiches — remplacement affiche en échec", () => {
  it("pickUnusedPosterPath choisit un poster hors de l'écran", () => {
    const visible = new Set(["/bad.jpg", FALLBACK_POSTER_PATHS[0], FALLBACK_POSTER_PATHS[1]]);
    const replacement = pickUnusedPosterPath("/bad.jpg", 0, visible);
    expect(replacement).not.toBe("/bad.jpg");
    expect(visible.has(replacement)).toBe(false);
    expect(replacement).toMatch(VALID_PATH);
  });

  it("pickUnusedPosterPath varie selon attempt (backfill par cellule)", () => {
    const visible = ["/seed.jpg"];
    const first = pickUnusedPosterPath("/seed.jpg", 0, visible);
    const second = pickUnusedPosterPath("/seed.jpg", 1, visible);
    expect(first).toMatch(VALID_PATH);
    expect(second).toMatch(VALID_PATH);
    expect(first).not.toBe("/seed.jpg");
    expect(second).not.toBe("/seed.jpg");
  });

  it("fallbackPathFor retourne toujours un chemin du pool de secours", () => {
    const path = fallbackPathFor("/unknown.jpg", 3);
    expect(FALLBACK_POSTER_PATHS).toContain(path);
  });

  it("retombe sur fallbackPathFor si tout le pool est déjà visible", () => {
    const fullPool = [...FALLBACK_POSTER_PATHS];
    const visible = new Set(fullPool);
    const replacement = pickUnusedPosterPath("/seed.jpg", 0, visible, fullPool);
    expect(FALLBACK_POSTER_PATHS).toContain(replacement);
  });
});
