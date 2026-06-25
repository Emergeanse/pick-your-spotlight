import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MovieDetail } from "@/lib/tmdb";

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockUpdateEq = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "catalog_items") {
        return { select: mockSelect };
      }
      if (table === "events") {
        return { update: mockUpdate };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  },
}));

vi.mock("@/lib/tmdb", () => ({
  getDisplayTitle: (movie: MovieDetail) => movie.title ?? movie.name ?? "Sans titre",
}));

import { programFilmForEvent } from "@/lib/event-program";

const MOVIE: MovieDetail = {
  id: 38,
  title: "Eternal Sunshine",
  poster_path: "/poster.jpg",
} as MovieDetail;

describe("programFilmForEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: { id: "catalog-uuid" }, error: null });
    mockUpdateEq.mockResolvedValue({ error: null });
  });

  it("met à jour la soirée avec le film choisi", async () => {
    await programFilmForEvent("event-123", MOVIE);

    expect(mockSelect).toHaveBeenCalledWith("id");
    expect(mockEq).toHaveBeenCalledWith("tmdb_id", 38);
    expect(mockUpdate).toHaveBeenCalledWith({
      final_pick_id: "catalog-uuid",
      final_pick_title: "Eternal Sunshine",
      final_pick_poster: "/poster.jpg",
      final_pick_tmdb_id: 38,
      status: "done",
    });
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "event-123");
  });

  it("propage l'erreur Supabase", async () => {
    mockUpdateEq.mockResolvedValue({ error: new Error("DB error") });

    await expect(programFilmForEvent("event-123", MOVIE)).rejects.toThrow("DB error");
  });
});
