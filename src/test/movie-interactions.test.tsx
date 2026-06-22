import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ---- Mocks ---------------------------------------------------------------

let feedbackRows: Array<{ item_id: string; feedback_type: string; label?: string; created_at: string; score?: number }> = [];

vi.mock("@/integrations/supabase/client", () => {
  // Builder chainable différencié par table :
  // - "catalog_items" → retourne des lignes { id, tmdb_id, media_type }
  // - "user_item_feedback" → retourne feedbackRows
  const makeChain = (resolveData: () => unknown[]): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      eq:          () => chain,
      neq:         () => chain,
      in:          () => chain,
      not:         () => chain,
      or:          () => chain,
      filter:      () => chain,
      order:       () => chain,
      limit:       () => chain,
      range:       () => chain,
      select:      () => chain,
      single:      () => Promise.resolve({ data: resolveData()[0] ?? null, error: null }),
      maybeSingle: () => Promise.resolve({ data: resolveData()[0] ?? null, error: null }),
      // Thenable : supabase client builder s'await directement
      then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
        Promise.resolve().then(() => resolve({ data: resolveData(), error: null })),
    };
    return chain;
  };

  return {
    supabase: {
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } }),
      },
      from: (table: string) => {
        if (table === "catalog_items") {
          // getCatalogItemIdsByLookup attend [{ id, tmdb_id, media_type }]
          return makeChain(() =>
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100].map((n) => ({
              id: `item-${n}`,
              tmdb_id: n,
              media_type: "movie",
            }))
          );
        }
        // user_item_feedback → feedbackRows (variable let mise à jour par chaque test)
        return makeChain(() => feedbackRows);
      },
    },
  };
});

vi.mock("@/lib/catalog", () => ({
  // Fonctions pures — copiées depuis catalog.ts
  normalizeCatalogMediaType: (mt?: string | null) =>
    mt === "tv" || mt === "person" ? mt : "movie",
  catalogLookupKey: (tmdbId: number, mediaType = "movie") =>
    `${tmdbId}:${mediaType}`,
  inferCatalogMediaType: () => "movie",

  // getInteractionStateBatch appelle getCatalogItemIdsByLookup (clé = "mediaType:tmdbId")
  getCatalogItemIdsByLookup: async (lookups: Array<{ tmdbId: number; mediaType?: string }>) => {
    const out: Record<string, string> = {};
    for (const l of lookups) {
      const mt = l.mediaType ?? "movie";
      out[`${l.tmdbId}:${mt}`] = `item-${l.tmdbId}`;
    }
    return out;
  },
  getCatalogItemIds: async (tmdbIds: number[]) => {
    const out: Record<number, string> = {};
    for (const id of tmdbIds) out[id] = `item-${id}`;
    return out;
  },
  getOrCreateCatalogItem: async () => "item-x",
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

// ---- Imports under test (after mocks) ------------------------------------

import {
  getInteractionStateBatch,
  EMPTY_INTERACTION_STATE,
} from "@/lib/feedback";
import {
  useMovieInteraction,
  useMovieInteractions,
} from "@/hooks/use-movie-interactions";

const ts = (s: string) => new Date(s).toISOString();

beforeEach(() => {
  feedbackRows = [];
});

// ---- Aggregator unit tests ----------------------------------------------

describe("getInteractionStateBatch (SSOT aggregator)", () => {
  it("retourne un état vide quand aucun feedback", async () => {
    const out = await getInteractionStateBatch([10]);
    expect(out[10] ?? EMPTY_INTERACTION_STATE).toEqual(EMPTY_INTERACTION_STATE);
  });

  it("marque liked quand feedback_type=like", async () => {
    feedbackRows = [{ item_id: "item-1", feedback_type: "like", created_at: ts("2026-01-01") }];
    const out = await getInteractionStateBatch([1]);
    expect(out[1].liked).toBe(true);
    expect(out[1].primaryStatus).toBe("like");
    expect(out[1].hasInteraction).toBe(true);
  });

  it("marque seen / notForMe correctement", async () => {
    feedbackRows = [
      { item_id: "item-2", feedback_type: "seen", created_at: ts("2026-01-01") },
      { item_id: "item-3", feedback_type: "not_for_me", created_at: ts("2026-01-01") },
    ];
    const out = await getInteractionStateBatch([2, 3]);
    expect(out[2].seen).toBe(true);
    expect(out[3].notForMe).toBe(true);
  });

  it("watchlist est ADDITIF par rapport au statut primaire (liked + watchlist)", async () => {
    feedbackRows = [
      { item_id: "item-5", feedback_type: "like", created_at: ts("2026-01-02") },
      { item_id: "item-5", feedback_type: "watchlist", created_at: ts("2026-01-01") },
    ];
    const out = await getInteractionStateBatch([5]);
    expect(out[5].liked).toBe(true);
    expect(out[5].watchlist).toBe(true);
    expect(out[5].hasInteraction).toBe(true);
  });

  it("priorité love > like > seen > not_for_me", async () => {
    feedbackRows = [
      { item_id: "item-7", feedback_type: "like", created_at: ts("2026-01-03") },
      { item_id: "item-7", feedback_type: "love", created_at: ts("2026-01-02") },
      { item_id: "item-7", feedback_type: "seen", created_at: ts("2026-01-01") },
    ];
    const out = await getInteractionStateBatch([7]);
    expect(out[7].primaryStatus).toBe("love");
    expect(out[7].loved).toBe(true);
    expect(out[7].liked).toBe(true);
  });
});

// ---- Hook reactivity / persistence tests --------------------------------

describe("useMovieInteraction (réactivité + persistance UI)", () => {
  it("expose l'état aimé du film après chargement initial", async () => {
    feedbackRows = [{ item_id: "item-100", feedback_type: "like", created_at: ts("2026-05-01") }];
    const { result } = renderHook(() => useMovieInteraction(100));
    await waitFor(() => expect(result.current.liked).toBe(true));
    expect(result.current.primaryStatus).toBe("like");
  });

  it("se met à jour quand `pick-feedback-changed` est émis (retour sur la fiche)", async () => {
    feedbackRows = [];
    const { result } = renderHook(() => useMovieInteraction(200));
    await waitFor(() => expect(result.current.hasInteraction).toBe(false));

    feedbackRows = [{ item_id: "item-200", feedback_type: "seen", created_at: ts("2026-05-02") }];
    await act(async () => {
      window.dispatchEvent(new CustomEvent("pick-feedback-changed", { detail: { tmdbId: 200 } }));
    });
    await waitFor(() => expect(result.current.seen).toBe(true));
  });

  it("conserve l'état au remount via le cache (vignette → fiche → vignette)", async () => {
    feedbackRows = [{ item_id: "item-300", feedback_type: "watchlist", created_at: ts("2026-05-03") }];
    const first = renderHook(() => useMovieInteraction(300));
    await waitFor(() => expect(first.result.current.watchlist).toBe(true));
    first.unmount();

    // Simule la fiche détaillée qui ne renverrait rien de la DB cette fois
    feedbackRows = [];
    const second = renderHook(() => useMovieInteraction(300));
    // Doit immédiatement afficher l'état caché (pas de flash neutre)
    expect(second.result.current.watchlist).toBe(true);
  });

  it("propage les changements à TOUTES les vignettes (carrousels) écoutant le même film", async () => {
    feedbackRows = [];
    const a = renderHook(() => useMovieInteractions([400]));
    const b = renderHook(() => useMovieInteractions([400, 401]));
    await waitFor(() => {
      expect(a.result.current[400]?.hasInteraction ?? false).toBe(false);
      expect(b.result.current[400]?.hasInteraction ?? false).toBe(false);
    });

    feedbackRows = [{ item_id: "item-400", feedback_type: "not_for_me", created_at: ts("2026-05-04") }];
    await act(async () => {
      window.dispatchEvent(new CustomEvent("pick-feedback-changed", { detail: { tmdbId: 400 } }));
    });

    await waitFor(() => {
      expect(a.result.current[400].notForMe).toBe(true);
      expect(b.result.current[400].notForMe).toBe(true);
    });
  });
});
