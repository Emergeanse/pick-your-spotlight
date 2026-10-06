import { describe, it, expect } from "vitest";
import { formatAvecQui } from "@/lib/avec-qui";

describe("avec qui, sur la carte d'une soirée", () => {
  it("un, deux, puis « et N autres »", () => {
    expect(formatAvecQui([])).toBe("");
    expect(formatAvecQui(["Lou"])).toBe("Lou");
    expect(formatAvecQui(["Lou", "Sophie"])).toBe("Lou et Sophie");
    expect(formatAvecQui(["Lou", "Sophie", "Damien"])).toBe("Lou, Sophie et 1 autre");
    expect(formatAvecQui(["Lou", "Sophie", "Damien", "Max"])).toBe("Lou, Sophie et 2 autres");
  });
});
