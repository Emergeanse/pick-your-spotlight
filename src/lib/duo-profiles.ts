import { supabase } from "@/integrations/supabase/client";

// duo_taste_profiles n'est pas encore dans les types générés — alias non-typé
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface DuoProfile {
  id: string;
  duo_name: string;
  created_by: string;
  user1_id: string;
  user2_id: string | null;
  invite_code: string;
  status: "pending" | "active";
  affinity_score: number;
  top_clusters: string[];
  rejected_clusters: string[];
  excluded_genres: string[];
  user1_display_name: string | null;
  user2_display_name: string | null;
  user1_genres: string[];
  user2_genres: string[];
  common_genres: string[];
  taste_vector: string | null;
  avoidance_vector: string | null;
  created_at: string;
  updated_at: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function averageVectors(v1: number[], v2: number[]): number[] {
  return v1.map((val, i) => (val + v2[i]) / 2);
}

function parseVector(raw: string | null): number[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Crée un nouveau duo (statut pending) et retourne le code d'invitation */
export async function createDuo(
  userId: string,
  displayName: string,
  duoName: string
): Promise<{ duo: DuoProfile; inviteUrl: string } | null> {
  const { data, error } = await db
    .from("duo_taste_profiles")
    .insert({
      duo_name: duoName,
      created_by: userId,
      user1_id: userId,
      user1_display_name: displayName,
      status: "pending",
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[Duo] createDuo error:", error);
    return null;
  }

  const inviteUrl = `${window.location.origin}/join-duo/${data.invite_code}`;
  return { duo: data as DuoProfile, inviteUrl };
}

/** Crée un duo directement actif avec un ami déjà connu (pas de lien d'invitation nécessaire) */
export async function createDuoWithFriend(
  user1Id: string,
  user1DisplayName: string,
  user2Id: string,
  user2DisplayName: string,
  duoName: string
): Promise<DuoProfile | null> {
  // Vérifier qu'un duo entre ces deux utilisateurs n'existe pas déjà
  const { data: existing } = await db
    .from("duo_taste_profiles")
    .select("id")
    .or(`and(user1_id.eq.${user1Id},user2_id.eq.${user2Id}),and(user1_id.eq.${user2Id},user2_id.eq.${user1Id})`)
    .eq("status", "active")
    .maybeSingle();
  if (existing) throw new Error("Un duo existe déjà avec cet ami.");

  // Récupérer les vecteurs et profils des deux utilisateurs
  const [{ data: vec1 }, { data: vec2 }] = await Promise.all([
    supabase.from("user_taste_vectors").select("taste_vector, avoidance_vector, top_clusters, rejected_clusters").eq("user_id", user1Id).maybeSingle(),
    supabase.from("user_taste_vectors").select("taste_vector, avoidance_vector, top_clusters, rejected_clusters").eq("user_id", user2Id).maybeSingle(),
  ]);
  const [{ data: prof1 }, { data: prof2 }] = await Promise.all([
    supabase.from("profiles").select("favorite_genres, excluded_genres").eq("id", user1Id).maybeSingle(),
    supabase.from("profiles").select("favorite_genres, excluded_genres").eq("id", user2Id).maybeSingle(),
  ]);

  const tv1 = parseVector(vec1?.taste_vector ?? null);
  const tv2 = parseVector(vec2?.taste_vector ?? null);
  const av1 = parseVector(vec1?.avoidance_vector ?? null);
  const av2 = parseVector(vec2?.avoidance_vector ?? null);

  const mergedTaste = tv1 && tv2 ? averageVectors(tv1, tv2) : (tv1 ?? tv2);
  const mergedAvoidance = av1 && av2 ? averageVectors(av1, av2) : (av1 ?? av2);
  const affinity = tv1 && tv2 ? Math.round(cosineSimilarity(tv1, tv2) * 100) : 0;

  const clusters1: string[] = vec1?.top_clusters ?? [];
  const clusters2: string[] = vec2?.top_clusters ?? [];
  const rejected1: string[] = vec1?.rejected_clusters ?? [];
  const rejected2: string[] = vec2?.rejected_clusters ?? [];
  const genres1: string[] = prof1?.favorite_genres ?? [];
  const genres2: string[] = prof2?.favorite_genres ?? [];
  const excluded1: string[] = prof1?.excluded_genres ?? [];
  const excluded2: string[] = prof2?.excluded_genres ?? [];

  const { data, error } = await db
    .from("duo_taste_profiles")
    .insert({
      duo_name: duoName,
      created_by: user1Id,
      user1_id: user1Id,
      user2_id: user2Id,
      user1_display_name: user1DisplayName,
      user2_display_name: user2DisplayName,
      status: "active",
      taste_vector: mergedTaste ? JSON.stringify(mergedTaste) : null,
      avoidance_vector: mergedAvoidance ? JSON.stringify(mergedAvoidance) : null,
      affinity_score: affinity,
      top_clusters: clusters1.filter(c => clusters2.includes(c)),
      rejected_clusters: [...new Set([...rejected1, ...rejected2])],
      excluded_genres: [...new Set([...excluded1, ...excluded2])],
      user1_genres: genres1,
      user2_genres: genres2,
      common_genres: genres1.filter(g => genres2.includes(g)),
    })
    .select()
    .single();

  if (error || !data) { console.error("[Duo] createDuoWithFriend error:", error); return null; }
  return data as DuoProfile;
}

/** Récupère un duo par son invite_code (pour la page d'acceptation) */
export async function getDuoByInviteCode(inviteCode: string): Promise<DuoProfile | null> {
  const { data, error } = await db
    .from("duo_taste_profiles")
    .select("*")
    .eq("invite_code", inviteCode)
    .eq("status", "pending")
    .single();

  if (error || !data) return null;
  return data as DuoProfile;
}

/** Accepte un duo : fusionne les profils et active le duo */
export async function acceptDuo(
  inviteCode: string,
  user2Id: string,
  user2DisplayName: string
): Promise<DuoProfile | null> {
  // 1. Récupérer le duo pending
  const duo = await getDuoByInviteCode(inviteCode);
  if (!duo) return null;
  if (duo.user1_id === user2Id) {
    throw new Error("Tu ne peux pas rejoindre ton propre duo.");
  }

  // 2. Récupérer les vecteurs de goût des deux utilisateurs
  const [{ data: vec1 }, { data: vec2 }] = await Promise.all([
    supabase.from("user_taste_vectors").select("taste_vector, avoidance_vector, top_clusters, rejected_clusters").eq("user_id", duo.user1_id).maybeSingle(),
    supabase.from("user_taste_vectors").select("taste_vector, avoidance_vector, top_clusters, rejected_clusters").eq("user_id", user2Id).maybeSingle(),
  ]);

  // 3. Récupérer les profils (genres likés, genres exclus)
  const [{ data: prof1 }, { data: prof2 }] = await Promise.all([
    supabase.from("profiles").select("favorite_genres, excluded_genres").eq("id", duo.user1_id).maybeSingle(),
    supabase.from("profiles").select("favorite_genres, excluded_genres").eq("id", user2Id).maybeSingle(),
  ]);

  // 4. Calculer les vecteurs mergés
  const tv1 = parseVector(vec1?.taste_vector ?? null);
  const tv2 = parseVector(vec2?.taste_vector ?? null);
  const av1 = parseVector(vec1?.avoidance_vector ?? null);
  const av2 = parseVector(vec2?.avoidance_vector ?? null);

  const mergedTaste = tv1 && tv2 ? averageVectors(tv1, tv2) : (tv1 ?? tv2);
  const mergedAvoidance = av1 && av2 ? averageVectors(av1, av2) : (av1 ?? av2);
  const affinity = tv1 && tv2 ? Math.round(cosineSimilarity(tv1, tv2) * 100) : 0;

  // 5. Clusters et genres
  const clusters1: string[] = vec1?.top_clusters ?? [];
  const clusters2: string[] = vec2?.top_clusters ?? [];
  const topClusters = clusters1.filter(c => clusters2.includes(c));

  const rejected1: string[] = vec1?.rejected_clusters ?? [];
  const rejected2: string[] = vec2?.rejected_clusters ?? [];
  const rejectedClusters = [...new Set([...rejected1, ...rejected2])];

  const genres1: string[] = prof1?.favorite_genres ?? [];
  const genres2: string[] = prof2?.favorite_genres ?? [];
  const commonGenres = genres1.filter(g => genres2.includes(g));

  const excluded1: string[] = prof1?.excluded_genres ?? [];
  const excluded2: string[] = prof2?.excluded_genres ?? [];
  const excludedGenres = [...new Set([...excluded1, ...excluded2])];

  // 6. Mettre à jour le duo
  const { data, error } = await db
    .from("duo_taste_profiles")
    .update({
      user2_id: user2Id,
      user2_display_name: user2DisplayName,
      status: "active",
      taste_vector: mergedTaste ? JSON.stringify(mergedTaste) : null,
      avoidance_vector: mergedAvoidance ? JSON.stringify(mergedAvoidance) : null,
      affinity_score: affinity,
      top_clusters: topClusters,
      rejected_clusters: rejectedClusters,
      excluded_genres: excludedGenres,
      user1_genres: genres1,
      user2_genres: genres2,
      common_genres: commonGenres,
      updated_at: new Date().toISOString(),
    })
    .eq("invite_code", inviteCode)
    .select()
    .single();

  if (error || !data) {
    console.error("[Duo] acceptDuo error:", error);
    return null;
  }
  return data as DuoProfile;
}

/** Récupère tous les duos actifs d'un utilisateur */
export async function fetchMyDuos(userId: string): Promise<DuoProfile[]> {
  const { data, error } = await db
    .from("duo_taste_profiles")
    .select("*")
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as DuoProfile[];
}

/** Récupère les duos pending créés par l'utilisateur (en attente d'acceptation) */
export async function fetchPendingDuos(userId: string): Promise<DuoProfile[]> {
  const { data, error } = await db
    .from("duo_taste_profiles")
    .select("*")
    .eq("user1_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as DuoProfile[];
}

/** Met à jour le nom d'un duo */
export async function updateDuoName(duoId: string, newName: string): Promise<boolean> {
  const { error } = await db
    .from("duo_taste_profiles")
    .update({ duo_name: newName, updated_at: new Date().toISOString() })
    .eq("id", duoId);
  return !error;
}

/** Supprime un duo */
export async function deleteDuo(duoId: string): Promise<boolean> {
  const { error } = await db
    .from("duo_taste_profiles")
    .delete()
    .eq("id", duoId);
  return !error;
}
