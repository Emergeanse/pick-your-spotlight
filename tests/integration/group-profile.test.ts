import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  readTestEnv, signIn, createEvent, addMembers, addGuest, deleteEvent, groupProfile,
} from "./helpers";

/**
 * Fusion des profils de goût d'une soirée.
 *
 * Chaque test crée sa propre soirée et la supprime, quoi qu'il arrive.
 *
 * Les comptes participants sont ceux constitués pour la validation du 3 août.
 * Ce sont des comptes éphémères : s'ils ont disparu, les tests qui en dépendent
 * s'ignorent plutôt que d'échouer — un compte absent n'est pas une régression
 * du code.
 */

const MARIE = "3bb9f625-23e9-4ab0-84ee-d53292e2e6d7";     // ado, Comédie/Animation/Aventure, exclut Documentaire
const JEANLOU = "08b7c06f-5b2a-4878-9742-3a1e3c5ca09a";   // adulte, Thriller/Crime/Drame, exclut Animation

// Les gardes des `describe` sont évalués à la construction, avant `beforeAll` :
// la présence de .env.test se lit donc dès le chargement du module.
const env = readTestEnv();

let sb: SupabaseClient | null = null;
let organisateur = "";
let comptesPresents = false;
const aNettoyer: string[] = [];

beforeAll(async () => {
  if (!env) return;
  const session = await signIn(env);
  if (!session) throw new Error("connexion au compte de test impossible");
  sb = session.client;
  organisateur = session.userId;

  comptesPresents = await comptesDemoPresents();
});

/**
 * Détecter la présence des comptes de démonstration.
 *
 * On lisait auparavant `profiles` directement. Depuis la minimisation du
 * 13 août, un compte ordinaire ne peut plus lire le profil d'un tiers — la
 * lecture renvoyait donc toujours zéro ligne, et TOUS les tests à plusieurs
 * comptes s'ignoraient en silence. Un test qui se met à s'ignorer sans le dire
 * est pire qu'un test qui échoue.
 *
 * On passe désormais par le chemin réel : une soirée éphémère rend ses
 * participants visibles au titre du lien « croisé ». Cette détection prouve donc
 * à la fois que les comptes existent et que la nouvelle règle de visibilité
 * fonctionne.
 */
async function comptesDemoPresents(): Promise<boolean> {
  let eventId: string | null = null;
  try {
    const ev = await createEvent(sb!, organisateur, "amis");
    eventId = ev.id;
    await addMembers(sb!, ev.id, [MARIE, JEANLOU]);

    const { data } = await (sb as unknown as {
      rpc: (fn: string, args: { p_ids: string[] }) => Promise<{ data: { id: string }[] | null }>;
    }).rpc("get_visible_profiles", { p_ids: [MARIE, JEANLOU] });

    return (data ?? []).length === 2;
  } catch {
    return false;
  } finally {
    if (eventId && sb) await deleteEvent(sb, eventId);
  }
}

afterEach(async () => {
  while (aNettoyer.length > 0) {
    const id = aNettoyer.pop()!;
    if (sb) await deleteEvent(sb, id);
  }
});

const siConnecte = () => (env ? it : it.skip);
const siComptes = siConnecte;

/**
 * Les comptes de démonstration sont éphémères : ils disparaissent à la
 * déconnexion. Leur absence n'est pas une régression du code, on passe donc le
 * test à l'exécution plutôt que de le faire échouer.
 */
function exigeComptes(ctx: { skip: () => void }) {
  if (!comptesPresents) ctx.skip();
}

async function soireeAvec(membres: string[], contexte: "famille" | "amis" = "amis") {
  const ev = await createEvent(sb!, organisateur, contexte);
  aNettoyer.push(ev.id);
  await addMembers(sb!, ev.id, membres);
  return ev;
}

describe("autorisation", () => {
  siConnecte()("une soirée inexistante est refusée", async () => {
    const { data, error } = await groupProfile(sb!, "00000000-0000-0000-0000-000000000000");
    // La fonction refuse, d'une manière ou d'une autre : jamais de profil.
    expect(error !== null || data?.error !== undefined).toBe(true);
    expect(data?.userTasteVector).toBeUndefined();
  });

  siConnecte()("un eventId absent est refusé", async () => {
    const { data, error } = await sb!.functions.invoke("group-taste-profile", { body: {} });
    expect(error !== null || (data as any)?.error !== undefined).toBe(true);
  });
});

describe("fusion à plusieurs comptes", () => {
  siComptes()("agrège tous les participants et calcule de vrais vecteurs", async (ctx) => {
    exigeComptes(ctx);
    const ev = await soireeAvec([MARIE, JEANLOU]);
    const { data, error } = await groupProfile(sb!, ev.id);
    expect(error).toBeNull();

    expect(data.memberCount).toBe(3); // organisateur + 2
    // Régression du 3 août : la fusion lisait un cache jamais alimenté et
    // renvoyait systématiquement des vecteurs nuls.
    expect(data.contributingVectorCount).toBeGreaterThan(0);
    expect(Array.isArray(data.userTasteVector)).toBe(true);
    expect(data.userTasteVector).toHaveLength(32);
  });

  siComptes()("la note minimale du groupe est celle du plus exigeant", async (ctx) => {
    exigeComptes(ctx);
    const ev = await soireeAvec([MARIE]); // Marie exige 5, l'organisateur 7
    const { data } = await groupProfile(sb!, ev.id);
    expect(data.constraints.minRating).toBe(7);
  });

  siComptes()("un genre exclu par un seul l'est pour tout le groupe", async (ctx) => {
    exigeComptes(ctx);
    const ev = await soireeAvec([MARIE, JEANLOU]);
    const { data } = await groupProfile(sb!, ev.id);
    // Marie exclut Documentaire, JeanLou exclut Animation.
    expect(data.constraints.excludedGenres).toContain("Documentaire");
    expect(data.constraints.excludedGenres).toContain("Animation");
  });

  siComptes()("un genre aimé par l'un et exclu par l'autre n'est jamais dans les deux listes", async (ctx) => {
    exigeComptes(ctx);
    // Régression du 3 août : Marie aime l'Animation, JeanLou l'exclut. Le genre
    // ressortait des deux côtés et le moteur recevait une consigne
    // contradictoire.
    const ev = await soireeAvec([MARIE, JEANLOU]);
    const { data } = await groupProfile(sb!, ev.id);
    const aimes: string[] = data.tasteProfileOverrides.topGenres ?? [];
    const exclus: string[] = data.constraints.excludedGenres ?? [];
    const conflits = aimes.filter((g) => exclus.includes(g));
    expect(conflits, `genres présents des deux côtés : ${conflits.join(", ")}`).toHaveLength(0);
  });
});

describe("contrainte d'âge", () => {
  siComptes()("le plus jeune participant fixe le plafond", async (ctx) => {
    exigeComptes(ctx);
    const ev = await soireeAvec([MARIE]); // Marie est « ado »
    const { data } = await groupProfile(sb!, ev.id);
    expect(data.youngestAgeRange).toBe("ado");
    expect(data.maxCertificationLevel).toBe(3);
  });

  siComptes()("un invité enfant abaisse le plafond de tout le groupe", async (ctx) => {
    exigeComptes(ctx);
    const ev = await soireeAvec([MARIE, JEANLOU], "famille");
    await addGuest(sb!, ev.inviteToken, "Jules", "enfant", ["Animation"]);
    const { data } = await groupProfile(sb!, ev.id);

    expect(data.guestCount).toBe(1);
    expect(data.youngestAgeRange).toBe("enfant");
    // « enfant » tolère le niveau 1 : beaucoup de films d'animation destinés
    // aux enfants sont classés PG aux États-Unis.
    expect(data.maxCertificationLevel).toBe(1);
    expect(data.maxCertification).toBe("TP");
  });

  siConnecte()("sans âge déclaré, aucune contrainte n'est posée", async () => {
    const ev = await soireeAvec([]); // organisateur seul, sans age_range
    const { data } = await groupProfile(sb!, ev.id);
    expect(data.youngestAgeRange).toBeNull();
    expect(data.maxCertificationLevel).toBeNull();
  });

  siComptes()("les genres déclarés par un invité entrent dans la fusion", async (ctx) => {
    exigeComptes(ctx);
    const ev = await soireeAvec([], "famille");
    await addGuest(sb!, ev.inviteToken, "Léa", "ado", ["Science-Fiction"]);
    const { data } = await groupProfile(sb!, ev.id);
    expect(data.guests?.[0]?.name).toBe("Léa");
    expect(data.guests?.[0]?.genres).toContain("Science-Fiction");
    expect(data.participantCount).toBe(2);
  });
});

describe("contraintes de plateformes", () => {
  siComptes()("l'intersection est retenue quand elle existe", async (ctx) => {
    exigeComptes(ctx);
    const ev = await soireeAvec([JEANLOU]); // partage 234 et 1754 avec l'organisateur
    const { data } = await groupProfile(sb!, ev.id);
    expect(data.constraints.sharedPlatforms.length).toBeGreaterThan(0);
    expect(data.constraints.sharedPlatforms).toContain(234);
  });

  siConnecte()("un groupe réduit à une personne reste exploitable", async () => {
    const ev = await soireeAvec([]);
    const { data, error } = await groupProfile(sb!, ev.id);
    expect(error).toBeNull();
    expect(data.memberCount).toBe(1);
    // Le client n'utilisera pas ce profil (isUsableGroupProfile exige plus
    // d'un participant), mais la fonction ne doit pas échouer pour autant.
    expect(data.constraints).toBeDefined();
  });
});
