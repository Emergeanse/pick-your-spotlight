import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Gather all user data in parallel
    const [likedRes, interactionsRes, profileRes, groupMembersRes, existingProfileRes] = await Promise.all([
      supabase.from("liked_movies").select("title, genres, liked_at, rating").eq("user_id", userId).order("liked_at", { ascending: false }).limit(100),
      supabase.from("user_interactions").select("action_type, context, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("favorite_genres").eq("id", userId).single(),
      supabase.from("group_session_members").select("session_id").eq("user_id", userId),
      supabase.from("cinematic_profiles").select("personality_title, dna_archetype, taste_signatures, specializations, distinctions, global_level, social_reputation, narrative, taste_traits, updated_at").eq("user_id", userId).maybeSingle(),
    ]);

    const likedMovies = likedRes.data || [];
    const interactions = interactionsRes.data || [];
    const favoriteGenres = profileRes.data?.favorite_genres || [];
    const groupSessionCount = groupMembersRes.data?.length || 0;
    const existingProfile = existingProfileRes.data;

    const MIN_LIKED_FOR_DNA = 15;
    if (likedMovies.length < MIN_LIKED_FOR_DNA) {
      return new Response(JSON.stringify({
        error: "not_enough_data",
        liked_count: likedMovies.length,
        required: MIN_LIKED_FOR_DNA,
        personality_title: "Explorateur en devenir",
        dna_archetype: null,
        narrative: `Tu as aimé ${likedMovies.length} film${likedMovies.length > 1 ? "s" : ""} sur les ${MIN_LIKED_FOR_DNA} nécessaires. Continue à explorer et à entraîner Pick pour débloquer ton ADN Cinéma !`,
        taste_traits: [],
        taste_signatures: [],
        specializations: [],
        distinctions: [],
        global_level: "Regard naissant",
        social_reputation: [],
        representative_films: [],
        evolution_note: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build rich context
    const likedTitles = likedMovies.map(m => m.title).join(", ");
    const genreCounts: Record<string, number> = {};
    likedMovies.forEach(m => {
      (m.genres || []).forEach((g: string) => {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      });
    });
    const topGenres = Object.entries(genreCounts).sort(([, a], [, b]) => b - a).slice(0, 8).map(([g, c]) => `${g} (${c})`);

    const skipCount = interactions.filter(i => i.action_type === "skipped").length;
    const watchCount = interactions.filter(i => i.action_type === "watched").length;
    const openCount = interactions.filter(i => i.action_type === "opened").length;
    const totalDecisions = watchCount + skipCount;
    const acceptanceRate = totalDecisions > 0 ? Math.round((watchCount / totalDecisions) * 100) : 0;

    // Mood distribution from contexts
    const moodCounts: Record<string, number> = {};
    interactions.forEach(i => {
      const ctx = i.context as any;
      if (ctx?.mood) moodCounts[ctx.mood] = (moodCounts[ctx.mood] || 0) + 1;
    });
    const topMoods = Object.entries(moodCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([m, c]) => `${m} (${c})`);

    // Rating distribution
    const ratedMovies = likedMovies.filter(m => m.rating != null);
    const avgRating = ratedMovies.length > 0
      ? (ratedMovies.reduce((s, m) => s + (m.rating || 0), 0) / ratedMovies.length).toFixed(1)
      : "N/A";

    const evolutionContext = existingProfile
      ? `\nPROFIL PRÉCÉDENT (généré le ${new Date(existingProfile.updated_at).toLocaleDateString("fr-FR")}) :\n- ADN : "${existingProfile.dna_archetype || existingProfile.personality_title}"\n- Signatures : ${JSON.stringify(existingProfile.taste_signatures)}\n- Niveau : ${existingProfile.global_level}\nSi le profil a évolué, génère un "evolution_note" subtil.`
      : "";

    const systemPrompt = `Tu es Pick, un système d'analyse cinématographique profond. Tu génères un profil d'identité cinématographique complet en 6 couches.

Ce n'est PAS de la gamification. C'est un système de reconnaissance d'identité, de goût et de culture cinématographique. Le ton est éditorial, premium, intime — comme un curateur de festival qui décrit quelqu'un avec justesse.

══════ COUCHE 1 — ADN CINÉMA (1 seul) ══════
Choisis UN archétype parmi EXACTEMENT cette liste :
- Explorateur émotionnel contemplatif
- Architecte de tension
- Humaniste sensible
- Curateur de lumière
- Esthète visuel
- Narrateur instinctif
- Amateur de vertige narratif
- Flâneur cinématographique
- Chasseur d'émotions brutes
- Équilibriste du divertissement
- Observateur du réel
- Minimaliste narratif
- Passionné de contrastes
- Explorateur sensoriel

══════ COUCHE 2 — SIGNATURES DE GOÛT (3-5) ══════
Choisis 3-5 signatures parmi ces catégories :
Rythme: Slow burn, Rythme nerveux, Progression lente, Narration fragmentée, Montée progressive
Émotion: Émotion contenue, Intensité brute, Mélancolie douce, Tension psychologique, Catharsis émotionnelle
Visuel: Visuel contemplatif, Esthétique forte, Minimalisme visuel, Image sensorielle, Composition marquée
Narration: Dialogues ciselés, Silence narratif, Narration non-linéaire, Voix intérieure, Récit épuré
Structure: Twist endings, Ambiguïté narrative, Fin ouverte, Narration expérimentale, Structure classique maîtrisée
Univers: Réaliste, Onirique, Surréaliste, Ancré socialement, Univers immersif

Pour chaque signature, indique aussi la catégorie.

══════ COUCHE 3 — SPÉCIALISATIONS ══════
Attribue des spécialisations UNIQUEMENT si les données le justifient.
Sous-genres possibles : Thriller psychologique, Thriller politique, Thriller noir, Thriller paranoïaque, Romance moderne, Romance mélancolique, Romance réaliste, Romance dramatique, Drame intime, Drame social, Drame familial, Drame existentiel, Sci-fi contemplative, Sci-fi conceptuelle, Sci-fi dystopique, Sci-fi émotionnelle, Comédie feel-good, Comédie absurde, Comédie dramatique, Comédie ironique, Cinéma coréen, Cinéma japonais, Cinéma européen, Cinéma indépendant US

Niveaux (du plus bas au plus élevé) :
- "Sensible à" (quelques films dans le genre)
- "Habitué de" (consommation régulière)
- "Fin connaisseur de" (expertise notable)
- "Référence de" (maîtrise exceptionnelle, réservé aux profils très marqués)

══════ COUCHE 4 — DISTINCTIONS ══════
Attribue UNIQUEMENT les distinctions justifiées par le comportement. Sois sélectif.
Catégories et options :
Regard: Regard singulier, Œil nuancé, Lecture fine, Perception émotionnelle, Vision cohérente
Exploration: Explorateur cohérent, Curieux exigeant, Défricheur discret, Cartographe de niches, Voyageur narratif
Cohérence: Goût affirmé, Signature stable, Cohérence forte, Identité claire
Intelligence: Choix précis, Sélection réfléchie, Décisions fiables, Intuition juste
Social: Alchimiste de soirée, Matchmaker ciné, Bon compromis, Fédérateur de groupe, Équilibriste social
Découverte: Découvreur de pépites, Anti-mainstream, Chercheur de rareté, Curateur alternatif
Évolution: Goût en évolution, Transformation subtile, Ouverture progressive, Exploration maîtrisée
Maturité: Spectateur exigeant, Regard mature, Analyse implicite, Sens critique développé

══════ COUCHE 5 — STATUT GLOBAL ══════
Choisis UN niveau parmi :
- Regard naissant (< 20 films, début d'exploration)
- Regard sensible (20-40 films, goûts qui se dessinent)
- Œil affûté (40-70 films, préférences claires)
- Connaisseur nuancé (70-100 films, palette riche)
- Curateur cinématographique (100-150 films, expertise large)
- Signature de goût (150-200 films, identité très affirmée)
- Référence Pick (200+ films, profil d'exception)

══════ COUCHE 6 — RÉPUTATION SOCIALE ══════
Basée sur les sessions de groupe. Si pas de données groupe, renvoie un tableau vide.
Options : Très fiable en duo, Excellent en groupe, Recommandations sûres, Goût compatible, Profil rassurant, Profil audacieux

══════ NARRATIVE ══════
Écris une narrative poétique de 3-4 phrases. Personnelle, intime, éditoriale. Comme un ami cinéphile qui te décrit parfaitement.

══════ FORMAT DE RÉPONSE ══════
Réponds UNIQUEMENT en JSON valide, sans markdown ni backticks :
{
  "dna_archetype": "<archétype exact de la liste>",
  "personality_title": "<même valeur que dna_archetype>",
  "narrative": "<3-4 phrases poétiques>",
  "taste_signatures": [
    {"name": "<signature>", "category": "<catégorie>"}
  ],
  "specializations": [
    {"name": "<sous-genre>", "level": "<niveau>"}
  ],
  "distinctions": [
    {"name": "<distinction>", "category": "<catégorie>"}
  ],
  "global_level": "<niveau global>",
  "social_reputation": [<"label" strings>],
  "taste_traits": [<mots-clés essentiels pour rétrocompatibilité>],
  "representative_films": [<3-5 titres>],
  "evolution_note": "<phrase subtile ou null>"
}`;

    const userPrompt = `DONNÉES DE L'UTILISATEUR :

📊 STATISTIQUES :
- Films aimés : ${likedMovies.length}
- Interactions totales : ${interactions.length}
- Films vus (acceptés) : ${watchCount}
- Films skippés : ${skipCount}
- Taux d'acceptation : ${acceptanceRate}%
- Films ouverts (détails consultés) : ${openCount}
- Note moyenne donnée : ${avgRating}
- Sessions de groupe : ${groupSessionCount}

🎬 FILMS AIMÉS (${likedMovies.length}) :
${likedTitles}

🎭 GENRES DOMINANTS :
${topGenres.join(", ")}

🎯 GENRES FAVORIS DÉCLARÉS :
${favoriteGenres.join(", ") || "non définis"}

🌙 HUMEURS FRÉQUENTES :
${topMoods.join(", ") || "pas assez de données"}

📈 COMPORTEMENT :
- Sélectivité : ${acceptanceRate < 40 ? "très sélectif" : acceptanceRate < 60 ? "modéré" : "ouvert"}
- Volume d'exploration : ${interactions.length > 200 ? "explorateur actif" : interactions.length > 50 ? "régulier" : "débutant"}
${evolutionContext}

Génère le profil cinématographique complet en 6 couches.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI error");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let profileData;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      profileData = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse profile:", content);
      throw new Error("Failed to parse AI response");
    }

    // Upsert into DB
    const upsertData = {
      user_id: userId,
      personality_title: profileData.personality_title || profileData.dna_archetype,
      dna_archetype: profileData.dna_archetype,
      narrative: profileData.narrative,
      taste_traits: profileData.taste_traits || [],
      taste_signatures: profileData.taste_signatures || [],
      specializations: profileData.specializations || [],
      distinctions: profileData.distinctions || [],
      global_level: profileData.global_level || "Regard naissant",
      social_reputation: profileData.social_reputation || [],
      representative_films: profileData.representative_films || [],
      evolution_note: profileData.evolution_note || null,
      updated_at: new Date().toISOString(),
    };

    if (existingProfile) {
      await supabase.from("cinematic_profiles").update(upsertData).eq("user_id", userId);
    } else {
      await supabase.from("cinematic_profiles").insert(upsertData);
    }

    return new Response(JSON.stringify(profileData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cinematic-profile error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
