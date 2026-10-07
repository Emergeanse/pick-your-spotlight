import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { clesDebloquees, distinctionsAffichees, tropheeParCle } from "@/lib/distinctions";

describe("distinctions", () => {
  it("ne garde que les trophées obtenus, du plus haut palier au plus bas", () => {
    const cles = clesDebloquees({ recos: 60, liked: 3, people: 0, seen: 0 });
    expect(cles).toEqual(["recos-3", "recos-2", "recos-1", "liked-1"]);
    expect(tropheeParCle("recos-3")?.label).toBe("Explorateur");
  });

  it("montre d'abord les épinglées encore obtenues, puis varie les catégories", () => {
    const debloquees = ["recos-3", "recos-2", "liked-2", "recos-1", "liked-1", "seen-1"];
    expect(distinctionsAffichees(debloquees, [])).toEqual(["recos-3", "liked-2", "seen-1"]);
    expect(distinctionsAffichees(debloquees, ["recos-1", "people-5"])).toEqual(["recos-1", "liked-2", "seen-1"]);
  });

  it("complète avec la même catégorie quand il n'y en a pas assez", () => {
    expect(distinctionsAffichees(["recos-2", "recos-1"], [])).toEqual(["recos-2", "recos-1"]);
  });
});
