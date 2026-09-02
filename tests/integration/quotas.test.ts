import { describe, it, expect, beforeAll } from "vitest";
import { readTestEnv, type TestEnv } from "./helpers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Le plafonnement ne vaut que s'il est hors de portée du navigateur.
 *
 * Ces tests attaquent la base avec les droits d'un utilisateur ordinaire et
 * vérifient qu'il ne peut ni s'accorder du quota, ni remettre ses compteurs à
 * zéro. C'est exactement ce que permettait l'ancien système, où `daily_usage`
 * était écrite par le client.
 */

const env: TestEnv | null = readTestEnv();
const run = env ? describe : describe.skip;

run("quotas appliqués côté serveur", () => {
  let sb: SupabaseClient;
  let userId: string;
  let migrationAppliquee = true;

  beforeAll(async () => {
    sb = createClient(env!.url, env!.key);
    const { data, error } = await sb.auth.signInWithPassword({
      email: env!.email,
      password: env!.password,
    });
    if (error) throw error;
    userId = data.user!.id;

    const probe = await (sb as any).rpc("get_my_quotas");
    if (probe.error && /does not exist|schema cache|could not find/i.test(probe.error.message)) {
      migrationAppliquee = false;
      console.warn("[quotas] migration non appliquée — tests ignorés jusqu'au déploiement");
    }
  }, 30000);

  it("expose la consommation du jour à son propriétaire", async () => {
    if (!migrationAppliquee) return;
    const { data, error } = await (sb as any).rpc("get_my_quotas");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    const kinds = (data ?? []).map((r: any) => r.kind).sort();
    expect(kinds).toEqual(["chat", "recommendation", "search", "voice"]);

    for (const row of data ?? []) {
      expect(typeof row.used).toBe("number");
      expect(row.used).toBeGreaterThanOrEqual(0);
      // Même le palier payant a un plafond : c'est tout l'objet du chantier.
      expect(row.quota).not.toBeNull();
      expect(row.quota).toBeGreaterThan(0);
    }
  }, 20000);

  it("refuse au client de consommer du quota lui-même", async () => {
    if (!migrationAppliquee) return;
    const { error } = await (sb as any).rpc("consume_quota", {
      p_user_id: userId,
      p_kind: "recommendation",
      p_amount: 1,
    });
    // Sans ce refus, n'importe qui pourrait épuiser le quota d'autrui — ou
    // s'abstenir d'en consommer et appeler l'IA sans limite.
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/permission|denied|not exist|schema cache|could not find/i);
  }, 20000);

  it("laisse lire ses compteurs mais jamais les écrire", async () => {
    if (!migrationAppliquee) return;

    const lecture = await sb.from("usage_counters").select("kind, count").eq("user_id", userId);
    expect(lecture.error).toBeNull();

    const ecriture = await sb
      .from("usage_counters")
      .upsert({ user_id: userId, usage_date: new Date().toISOString().slice(0, 10), kind: "recommendation", count: 0 });
    expect(ecriture.error).not.toBeNull();
  }, 20000);

  it("ne laisse pas lire les compteurs d'un autre compte", async () => {
    if (!migrationAppliquee) return;
    const autre = "00000000-0000-0000-0000-000000000001";
    const { data, error } = await sb.from("usage_counters").select("count").eq("user_id", autre);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  }, 20000);

  it("publie les plafonds de chaque palier", async () => {
    if (!migrationAppliquee) return;
    const { data, error } = await sb.from("plan_quotas").select("plan, kind, daily_limit");
    expect(error).toBeNull();

    const plans = [...new Set((data ?? []).map((r: any) => r.plan))].sort();
    expect(plans).toEqual(["free", "pick_plus", "staff"]);

    // Le palier gratuit doit rester strictement plus serré que Pick+, sinon la
    // distinction ne veut rien dire.
    for (const kind of ["recommendation", "chat", "search", "voice"]) {
      const gratuit = (data ?? []).find((r: any) => r.plan === "free" && r.kind === kind);
      const plus = (data ?? []).find((r: any) => r.plan === "pick_plus" && r.kind === kind);
      expect(gratuit, `palier gratuit manquant pour ${kind}`).toBeTruthy();
      expect(plus, `palier Pick+ manquant pour ${kind}`).toBeTruthy();
      expect(gratuit!.daily_limit).toBeLessThan(plus!.daily_limit);
    }

    // Le palier « staff » est le seul sans plafond. Si un autre s'y mettait,
    // c'est qu'une limite aurait sauté par accident.
    for (const row of data ?? []) {
      if (row.plan === "staff") expect(row.daily_limit).toBeNull();
      else expect(row.daily_limit, `${row.plan}/${row.kind} sans plafond`).not.toBeNull();
    }
  }, 20000);

  it("laisse au palier gratuit de quoi se tromper", async () => {
    if (!migrationAppliquee) return;
    const { data } = await sb
      .from("plan_quotas")
      .select("daily_limit")
      .eq("plan", "free")
      .eq("kind", "recommendation")
      .maybeSingle();
    // Trois essais par jour ne laissaient pas la place à une erreur d'humeur.
    expect(data?.daily_limit).toBe(9);
  }, 20000);

  it("donne à la loupe son propre compteur, distinct des conversations", async () => {
    if (!migrationAppliquee) return;
    // Cinq recherches à la loupe verrouillaient le compagnon de film et le chat
    // Pick pour la journée : les quatre puisaient dans le même quota « chat ».
    const { data } = await sb
      .from("plan_quotas")
      .select("kind, daily_limit")
      .eq("plan", "free")
      .in("kind", ["chat", "search"]);
    const recherche = (data ?? []).find((r: any) => r.kind === "search");
    const conversation = (data ?? []).find((r: any) => r.kind === "chat");
    expect(recherche, "le quota de recherche n'existe pas").toBeTruthy();
    expect(recherche!.daily_limit).toBeGreaterThan(conversation!.daily_limit);
  }, 20000);
});
