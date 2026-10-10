import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const chaine: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "update", "upsert"]) chaine[m] = () => chaine;
  chaine.maybeSingle = async () => ({ data: null });
  chaine.then = (ok: (v: unknown) => void) => ok({ data: null });
  return { supabase: { from: () => chaine } };
});
vi.mock("@/lib/adhesion", () => ({ evaluerAdhesion: vi.fn() }));

import { conseilEnMemoire, enregistrerConseil, obtenirConseil } from "@/lib/conseils-films";
import { evaluerAdhesion } from "@/lib/adhesion";
import type { MovieDetail } from "@/lib/tmdb";

// Node 26 masque le localStorage de jsdom : un stockage en mémoire suffit ici.
const memoire = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memoire.get(k) ?? null,
  setItem: (k: string, v: string) => { memoire.set(k, String(v)); },
  removeItem: (k: string) => { memoire.delete(k); },
  clear: () => memoire.clear(),
});

describe("un conseil reste le même", () => {
  beforeEach(() => { localStorage.clear(); vi.mocked(evaluerAdhesion).mockReset(); });

  it("ne remplace jamais un conseil complet", async () => {
    await enregistrerConseil("u", 1, "movie", { matchScore: 82, whyItMatches: "Premier avis" });
    await enregistrerConseil("u", 1, "movie", { matchScore: 64, whyItMatches: "Autre avis" });
    expect(conseilEnMemoire("u", 1, "movie")).toMatchObject({ matchScore: 82, whyItMatches: "Premier avis" });
  });

  it("complète une fois un conseil sans texte, en gardant sa note", async () => {
    await enregistrerConseil("u", 2, "movie", { matchScore: 90 });
    await enregistrerConseil("u", 2, "movie", { matchScore: 71, whyItMatches: "Le texte" });
    expect(conseilEnMemoire("u", 2, "movie")).toMatchObject({ matchScore: 90, whyItMatches: "Le texte" });
  });

  it("ne rappelle pas l'IA pour un film déjà conseillé", async () => {
    await enregistrerConseil("u", 3, "tv", { matchScore: 77, headline: "Accroche" });
    const c = await obtenirConseil("u", { id: 3 } as MovieDetail, "tv");
    expect(c?.matchScore).toBe(77);
    expect(evaluerAdhesion).not.toHaveBeenCalled();
  });

  it("garde le conseil calculé pour un nouveau film", async () => {
    vi.mocked(evaluerAdhesion).mockResolvedValue({ matchScore: 68, whyItMatches: "Nouveau" });
    await obtenirConseil("u", { id: 4 } as MovieDetail, "movie");
    await obtenirConseil("u", { id: 4 } as MovieDetail, "movie");
    expect(evaluerAdhesion).toHaveBeenCalledTimes(1);
    expect(conseilEnMemoire("u", 4, "movie")?.matchScore).toBe(68);
  });
});
