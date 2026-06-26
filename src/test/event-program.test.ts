import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MovieDetail } from "@/lib/tmdb";

const mockMaybeSingle = vi.fn();
const mockEqMedia = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockEqTmdb = vi.fn(() => ({ eq: mockEqMedia }));
const mockSelect = vi.fn(() => ({ eq: mockEqTmdb }));
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

const mockResolvePickMediaType = vi.fn(() => "movie" as const);

vi.mock("@/lib/event-final-pick", () => ({
  resolvePickMediaType: (...args: unknown[]) => mockResolvePickMediaType(...args),
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
    mockResolvePickMediaType.mockReturnValue("movie");

    await programFilmForEvent("event-123", MOVIE);

    expect(mockSelect).toHaveBeenCalledWith("id");
    expect(mockEqTmdb).toHaveBeenCalledWith("tmdb_id", 38);
    expect(mockEqMedia).toHaveBeenCalledWith("media_type", "movie");
    expect(mockUpdate).toHaveBeenCalledWith({
      final_pick_id: "catalog-uuid",
      final_pick_title: "Eternal Sunshine",
      final_pick_poster: "/poster.jpg",
      final_pick_tmdb_id: 38,
      final_pick_media_type: "movie",
      status: "done",
    });
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "event-123");
  });

  it("enregistre final_pick_media_type tv pour une série révélée", async () => {
    mockResolvePickMediaType.mockReturnValue("tv");
    const tvShow = {
      id: 5262,
      name: "Farscape",
      poster_path: "/farscape.jpg",
      first_air_date: "1999-03-19",
    } as MovieDetail;

    await programFilmForEvent("event-farscape", tvShow);

    expect(mockEqTmdb).toHaveBeenCalledWith("tmdb_id", 5262);
    expect(mockEqMedia).toHaveBeenCalledWith("media_type", "tv");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        final_pick_title: "Farscape",
        final_pick_tmdb_id: 5262,
        final_pick_media_type: "tv",
        status: "done",
      }),
    );
  });

  it("propage l'erreur Supabase", async () => {
    mockUpdateEq.mockResolvedValue({ error: new Error("DB error") });

    await expect(programFilmForEvent("event-123", MOVIE)).rejects.toThrow("DB error");
  });
});
