import { supabase } from "@/integrations/supabase/client";
import { computeMultiVectorProfile } from "@/lib/taste-engine";

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
  user1_avatar_url?: string | null;
  user2_avatar_url?: string | null;
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

// Éclate les genres composites ("Science-Fiction & Fantastique" → ["Science-Fiction","Fantastique"])
// et normalise les variantes anglaises/françaises courantes
function expandGenres(genres: string[]): string[] {
  const result = new Set<string>();
  for (const g of genres) {
    // Séparateurs courants dans les genres TMDB composites
    for (const part of g.split(/\s*[&,/]\s*/)) {
      const clean = part.trim();
      if (clean.length > 1) result.add(clean);
    }
    result.add(g.trim()); // garder aussi l'original
  }
  return [...result];
}

// Calcule l'affinité : cosinus si vecteurs dispo, sinon Dice sur les genres (fallback)
function computeAffinityScore(
  tv1: number[] | null, tv2: number[] | null,
  genres1: string[], genres2: string[]
): number {
  if (tv1 && tv2) return Math.round(cosineSimilarity(tv1, tv2) * 100);
  // Fallback : coefficient Dice sur genres expandus
  const set1 = new Set(expandGenres(genres1));
  const set2 = new Set(expandGenres(genres2));
  const commonCount = [...set1].filter(g => set2.has(g)).length;
  const total = set1.size + set2.size;
  return total === 0 ? 0 : Math.round(2 * commonCount / total * 100);
}

// Calcule les genres réellement en commun (avec expansion des composites)
function computeCommonGenres(genres1: string[], genres2: string[]): string[] {
  const expanded1 = new Set(expandGenres(genres1));
  const expanded2 = new Set(expandGenres(genres2));
  // Retourne les termes atomiques communs présents dans les listes originales
  const allAtoms = new Set([...expanded1, ...expanded2]);
  return [...allAtoms].filter(g => expanded1.has(g) && expanded2.has(g))
    .filter(g => genres1.some(og => og === g || og.includes(g)) && genres2.some(og => og === g || og.includes(g)));
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
  const clusters1: string[] = vec1?.top_clusters ?? [];
  const clusters2: string[] = vec2?.top_clusters ?? [];
  const rejected1: string[] = vec1?.rejected_clusters ?? [];
  const rejected2: string[] = vec2?.rejected_clusters ?? [];
  const genres1: string[] = prof1?.favorite_genres ?? [];
  const genres2: string[] = prof2?.favorite_genres ?? [];
  const excluded1: string[] = prof1?.excluded_genres ?? [];
  const excluded2: string[] = prof2?.excluded_genres ?? [];
  const affinity = computeAffinityScore(tv1, tv2, genres1, genres2);

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
      common_genres: computeCommonGenres(genres1, genres2),
    })
    .select()
    .single();

  if (error || !data) { console.error("[Duo] createDuoWithFriend error:", error); return null; }

  // Ajouter mutuellement comme amis si pas déjà amis
  const { data: existingFriend } = await (supabase as any)
    .from("friendships")
    .select("id")
    .or(`and(requester_id.eq.${user1Id},addressee_id.eq.${user2Id}),and(requester_id.eq.${user2Id},addressee_id.eq.${user1Id})`)
    .maybeSingle();
  if (!existingFriend) {
    await (supabase as any)
      .from("friendships")
      .insert({ requester_id: user1Id, addressee_id: user2Id, status: "accepted" });
  }

  return data as DuoProfile;
}

/** Récupère un duo par son invite_code (pour la page d'acceptation) */
export async function getDuoByInviteCode(inviteCode: string): Promise<DuoProfile | null> {
  // Uses SECURITY DEFINER RPC so only the invite-code holder can read pending duo data
  const { data, error } = await db.rpc("get_pending_duo_by_invite_code", { _code: inviteCode });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row as DuoProfile;
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

  // 5. Clusters et genres
  const clusters1: string[] = vec1?.top_clusters ?? [];
  const clusters2: string[] = vec2?.top_clusters ?? [];
  const topClusters = clusters1.filter(c => clusters2.includes(c));

  const rejected1: string[] = vec1?.rejected_clusters ?? [];
  const rejected2: string[] = vec2?.rejected_clusters ?? [];
  const rejectedClusters = [...new Set([...rejected1, ...rejected2])];

  const genres1: string[] = prof1?.favorite_genres ?? [];
  const genres2: string[] = prof2?.favorite_genres ?? [];
  const excluded1: string[] = prof1?.excluded_genres ?? [];
  const excluded2: string[] = prof2?.excluded_genres ?? [];
  const excludedGenres = [...new Set([...excluded1, ...excluded2])];
  const affinity = computeAffinityScore(tv1, tv2, genres1, genres2);
  const commonGenres = computeCommonGenres(genres1, genres2);

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

  // Ajouter mutuellement comme amis si pas déjà amis
  const { data: existing } = await (supabase as any)
    .from("friendships")
    .select("id")
    .or(`and(requester_id.eq.${duo.user1_id},addressee_id.eq.${user2Id}),and(requester_id.eq.${user2Id},addressee_id.eq.${duo.user1_id})`)
    .maybeSingle();
  if (!existing) {
    await (supabase as any)
      .from("friendships")
      .insert({ requester_id: duo.user1_id, addressee_id: user2Id, status: "accepted" });
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
  const duos = (data ?? []) as DuoProfile[];

  // Enrich with avatar URLs from profiles table
  const userIds = [...new Set(duos.flatMap(d => [d.user1_id, d.user2_id].filter(Boolean) as string[]))];
  if (userIds.length === 0) return duos;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, avatar_url")
    .in("id", userIds);

  const avatarMap = new Map((profiles ?? []).map((p: any) => [p.id, p.avatar_url as string | null]));

  return duos.map(d => ({
    ...d,
    user1_avatar_url: avatarMap.get(d.user1_id) ?? null,
    user2_avatar_url: d.user2_id ? (avatarMap.get(d.user2_id) ?? null) : null,
  }));
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

export interface DuoFriendCandidate {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Charge les amis acceptés d'un utilisateur (pour le sélecteur de duo) */
export async function loadAcceptedFriends(userId: string): Promise<DuoFriendCandidate[]> {
  const { data: friendships } = await (supabase as any)
    .from("friendships")
    .select("requester_id, addressee_id")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq("status", "accepted");

  if (!friendships || (friendships as any[]).length === 0) return [];

  const otherIds = (friendships as any[]).map((f: any) =>
    f.requester_id === userId ? f.addressee_id : f.requester_id
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", otherIds);

  return (profiles ?? []).map((p: any) => ({
    id: p.id,
    displayName: (p as any).display_name ?? "Ami",
    avatarUrl: (p as any).avatar_url ?? null,
  }));
}

/** Recalcule les vecteurs et l'affinité d'un duo existant (utile quand les profils ont évolué) */
export async function recalculateDuo(duo: DuoProfile): Promise<DuoProfile | null> {
  if (!duo.user2_id) return null;

  // Mettre à jour les vecteurs de goût des deux utilisateurs avant le calcul
  // pour s'assurer que les interactions récentes sont bien prises en compte
  await Promise.all([
    computeMultiVectorProfile(duo.user1_id),
    computeMultiVectorProfile(duo.user2_id),
  ]);

  const fetchGenrePrefsFromPreferences = async (userId: string) => {
    const { data } = await supabase
      .from("user_preferences")
      .select("weight, tag:tag_id(category, label)")
      .eq("user_id", userId);
    const genres = (data ?? []).filter((r: any) => r.tag?.category === "genre");
    return {
      liked:    genres.filter((r: any) => r.weight > 0).map((r: any) => r.tag.label as string),
      excluded: genres.filter((r: any) => r.weight < 0).map((r: any) => r.tag.label as string),
    };
  };

  const [{ data: vec1 }, { data: vec2 }, prefs1, prefs2] = await Promise.all([
    supabase.from("user_taste_vectors").select("taste_vector, avoidance_vector, top_clusters, rejected_clusters").eq("user_id", duo.user1_id).maybeSingle(),
    supabase.from("user_taste_vectors").select("taste_vector, avoidance_vector, top_clusters, rejected_clusters").eq("user_id", duo.user2_id).maybeSingle(),
    fetchGenrePrefsFromPreferences(duo.user1_id),
    fetchGenrePrefsFromPreferences(duo.user2_id),
  ]);

  const tv1 = parseVector(vec1?.taste_vector ?? null);
  const tv2 = parseVector(vec2?.taste_vector ?? null);
  const av1 = parseVector(vec1?.avoidance_vector ?? null);
  const av2 = parseVector(vec2?.avoidance_vector ?? null);

  const mergedTaste = tv1 && tv2 ? averageVectors(tv1, tv2) : (tv1 ?? tv2);
  const mergedAvoidance = av1 && av2 ? averageVectors(av1, av2) : (av1 ?? av2);
  const clusters1: string[] = vec1?.top_clusters ?? [];
  const clusters2: string[] = vec2?.top_clusters ?? [];
  const rejected1: string[] = vec1?.rejected_clusters ?? [];
  const rejected2: string[] = vec2?.rejected_clusters ?? [];

  // Source de vérité : user_preferences (intersection pour liked et excluded)
  const commonGenres  = prefs1.liked.filter((g: string) => prefs2.liked.includes(g));
  const commonExcluded = prefs1.excluded.filter((g: string) => prefs2.excluded.includes(g));
  const affinity = computeAffinityScore(tv1, tv2, prefs1.liked, prefs2.liked);

  const { data, error } = await db
    .from("duo_taste_profiles")
    .update({
      taste_vector: mergedTaste ? JSON.stringify(mergedTaste) : null,
      avoidance_vector: mergedAvoidance ? JSON.stringify(mergedAvoidance) : null,
      affinity_score: affinity,
      top_clusters: clusters1.filter((c: string) => clusters2.includes(c)),
      rejected_clusters: [...new Set([...rejected1, ...rejected2])],
      excluded_genres: commonExcluded,
      user1_genres: prefs1.liked,
      user2_genres: prefs2.liked,
      common_genres: commonGenres,
      updated_at: new Date().toISOString(),
    })
    .eq("id", duo.id)
    .select()
    .single();

  if (error || !data) return null;
  return data as DuoProfile;
}

export interface SharedMovie {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  media_type: string;
  types: Array<"like" | "love" | "watchlist">;
}

/** Films que deux utilisateurs ont likés, adorés ou mis en watchlist en commun */
export async function fetchDuoSharedMovies(
  user1Id: string,
  user2Id: string
): Promise<{ liked: SharedMovie[]; watchlist: SharedMovie[] }> {
  const fetchFeedback = async (userId: string) => {
    const { data } = await supabase
      .from("user_item_feedback")
      .select("item_id, feedback_type")
      .eq("user_id", userId)
      .in("feedback_type", ["like", "love", "watchlist"]);
    return (data ?? []) as { item_id: string; feedback_type: string }[];
  };

  const [fb1, fb2] = await Promise.all([fetchFeedback(user1Id), fetchFeedback(user2Id)]);

  // Index par item_id → types pour chaque utilisateur
  const map1 = new Map<string, string[]>();
  for (const f of fb1) {
    if (!map1.has(f.item_id)) map1.set(f.item_id, []);
    map1.get(f.item_id)!.push(f.feedback_type);
  }
  const map2 = new Map<string, string[]>();
  for (const f of fb2) {
    if (!map2.has(f.item_id)) map2.set(f.item_id, []);
    map2.get(f.item_id)!.push(f.feedback_type);
  }

  // item_ids présents chez les deux
  const commonIds = [...map1.keys()].filter(id => map2.has(id));
  if (commonIds.length === 0) return { liked: [], watchlist: [] };

  // Récupérer les métadonnées
  const { data: catalogItems } = await supabase
    .from("catalog_items")
    .select("id, tmdb_id, title, poster_path, media_type")
    .in("id", commonIds);

  const movies: SharedMovie[] = (catalogItems ?? []).map((ci: any) => {
    const t1 = map1.get(ci.id) ?? [];
    const t2 = map2.get(ci.id) ?? [];
    const allTypes = [...new Set([...t1, ...t2])] as Array<"like" | "love" | "watchlist">;
    return { tmdb_id: ci.tmdb_id, title: ci.title, poster_path: ci.poster_path, media_type: ci.media_type, types: allTypes };
  });

  return {
    liked: movies.filter(m => m.types.some(t => t === "like" || t === "love")),
    watchlist: movies.filter(m => m.types.includes("watchlist")),
  };
}

/** Supprime un duo */
export async function deleteDuo(duoId: string): Promise<boolean> {
  const { error } = await db
    .from("duo_taste_profiles")
    .delete()
    .eq("id", duoId);
  return !error;
}
