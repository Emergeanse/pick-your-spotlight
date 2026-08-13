import { describe, it, expect } from "vitest";
import { readQuotaRefusal, isTransientRateLimit } from "@/lib/quota-errors";

/**
 * Le code 429 recouvre deux situations opposées : un fournisseur saturé
 * (passager, on réessaie) et un quota journalier épuisé (définitif jusqu'à
 * demain, réessayer boucle pour rien). Confondre les deux fait tourner
 * l'application en rond en affichant « réessaie dans quelques secondes ».
 */

/** Imite l'erreur de `functions.invoke` : le corps vit dans `context`. */
function erreurAvecCorps(body: unknown, message = "Edge Function returned a non-2xx status code") {
  return {
    message,
    context: {
      json: async () => body,
      clone() {
        return this;
      },
    },
  };
}

describe("distinction des deux 429", () => {
  it("reconnaît un quota épuisé et en extrait le détail", async () => {
    const refus = await readQuotaRefusal(
      erreurAvecCorps({
        error: "Tu as atteint ta limite de recommandations pour aujourd'hui (40/40).",
        quotaExceeded: true,
        kind: "recommendation",
        used: 40,
        quota: 40,
      }),
    );

    expect(refus).not.toBeNull();
    expect(refus!.kind).toBe("recommendation");
    expect(refus!.used).toBe(40);
    expect(refus!.quota).toBe(40);
    expect(refus!.message).toContain("aujourd'hui");
  });

  it("ne confond pas une saturation du fournisseur avec un quota", async () => {
    const erreur = erreurAvecCorps({ error: "Rate limit exceeded" }, "429 Too Many Requests");
    const refus = await readQuotaRefusal(erreur);

    expect(refus).toBeNull();
    expect(isTransientRateLimit(erreur, refus)).toBe(true);
  });

  it("n'invite jamais à réessayer quand le quota est épuisé", async () => {
    const erreur = erreurAvecCorps({ quotaExceeded: true, error: "Limite atteinte", kind: "chat" });
    const refus = await readQuotaRefusal(erreur);

    expect(refus).not.toBeNull();
    expect(isTransientRateLimit(erreur, refus)).toBe(false);
  });

  it("reste muet sur une erreur sans corps exploitable", async () => {
    expect(await readQuotaRefusal(new Error("réseau injoignable"))).toBeNull();
    expect(await readQuotaRefusal(null)).toBeNull();
    expect(await readQuotaRefusal({ context: {} })).toBeNull();
  });

  it("ne prend pas un corps illisible pour un refus de quota", async () => {
    const erreur = {
      message: "429",
      context: {
        json: async () => {
          throw new Error("corps déjà consommé");
        },
        clone() {
          return this;
        },
      },
    };
    expect(await readQuotaRefusal(erreur)).toBeNull();
    // Faute de mieux, on retombe sur le comportement passager : réessayer une
    // fois est moins grave que de refuser à tort un utilisateur légitime.
    expect(isTransientRateLimit(erreur, null)).toBe(true);
  });

  it("ne traite pas une panne réseau comme un dépassement", async () => {
    const erreur = new Error("Failed to fetch");
    expect(isTransientRateLimit(erreur, null)).toBe(false);
  });
});
