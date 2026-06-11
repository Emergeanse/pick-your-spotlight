import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function parseVector(v: any): number[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try { return JSON.parse(v.replace(/^\[/, "[").replace(/\]$/, "]")); } catch { return null; }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const mmT0 = Date.now();
    const { movie, userCriteria, tasteProfile, userTasteVector, likedMovieTitles, searchTags, cinematicProfile, peoplePreferences, userName, duoContext, minMatchScore: rawMinMatchScore } = await req.json();
    const minMatchScore = typeof rawMinMatchScore === "number" ? Math.max(0, Math.min(100, rawMinMatchScore)) : 60;
    const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!GOOGLE_AI_KEY) throw new Error("GOOGLE_AI_KEY is not configured");

    const isYouTube = !!(movie._youtube);
    const isTv = !isYouTube && !!(movie.first_air_date || movie.name && !movie.title);
    const mediaLabel = isYouTube ? "Vidéo YouTube" : isTv ? "Série" : "Film";
    const youtubeData = movie._youtubeData || {};
    const title = movie.title || movie.name || "Contenu inconnu";
    const genres = (movie.genres || []).map((g: any) => g.name).join(", ");
    const overview = movie.overview || "";
    const rating = movie.vote_average || 0;
    const runtime = movie.runtime || 0;
    const tmdbId = movie.id;

    // ── Embedding similarities (stable + recent + avoidance) ──
    let embeddingSimilarity: number | null = null;
    let recentSimilarity: number | null = null;
    let avoidanceSimilarity: number | null = null;
    let movieTasteTags: string[] = [];
    let movieSemanticAxes: any = {};
    let movieSafetyTags: string[] = [];
    let movieSuitabilityTags: string[] = [];
    let movieClusterLabels: string[] = [];

    if (!isYouTube && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: movieEmb } = await supabase
        .from("movie_embeddings")
        .select("embedding, taste_tags, semantic_axes, safety_tags, suitability_tags, cluster_labels")
        .eq("tmdb_id", tmdbId)
        .maybeSingle();

      let movieVector: number[] | null = null;

      if (movieEmb) {
        movieVector = typeof movieEmb.embedding === "string"
          ? JSON.parse(movieEmb.embedding.replace(/^\[/, "[").replace(/\]$/, "]"))
          : movieEmb.embedding;
        movieTasteTags = movieEmb.taste_tags || [];
        movieSemanticAxes = (movieEmb as any).semantic_axes || {};
        movieSafetyTags = (movieEmb as any).safety_tags || [];
        movieSuitabilityTags = (movieEmb as any).suitability_tags || [];
        movieClusterLabels = (movieEmb as any).cluster_labels || [];
      } else {
        try {
          const embResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-embedding`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({ tmdbId, title, overview, genres: (movie.genres || []).map((g: any) => g.name) }),
          });
          if (embResponse.ok) {
            const embData = await embResponse.json();
            movieVector = embData.embedding;
            movieTasteTags = embData.tasteTags || [];
          }
        } catch (e) { console.error("Embedding generation failed:", e); }
      }

      if (movieVector) {
        // Stable taste similarity
        if (userTasteVector) {
          embeddingSimilarity = cosineSimilarity(userTasteVector, movieVector);
        }
        // Recent taste similarity
        const recentVec = parseVector(tasteProfile?.recentTasteVector);
        if (recentVec) {
          recentSimilarity = cosineSimilarity(recentVec, movieVector);
        }
        // Avoidance similarity (high = BAD)
        const avoidVec = parseVector(tasteProfile?.avoidanceVector);
        if (avoidVec) {
          avoidanceSimilarity = cosineSimilarity(avoidVec, movieVector);
        }
      }
    }

    const mmT1 = Date.now();
    if (mmT1 - mmT0 > 20) console.log(`[MM⏱] Embedding fetch: ${mmT1 - mmT0}ms`);

    // ── Session context ──
    const searchTagsText = (searchTags && searchTags.length > 0) 
      ? `\nTAGS DE RECHERCHE (ce que l'utilisateur a dit/demandé) : ${searchTags.join(", ")}`
      : "";
    const criteriaText = userCriteria
      ? `SESSION ACTUELLE : humeur "${userCriteria.mood || "non précisée"}", contexte "${userCriteria.context || "non précisé"}", temps "${userCriteria.time || "non précisé"}".${searchTagsText}`
      : `L'utilisateur a demandé une surprise aléatoire.${searchTagsText}`;

    // ── Enriched taste context ──
    const tasteClusters = tasteProfile?.tasteClusters || [];
    const rejectedClusters = tasteProfile?.rejectedClusters || [];
    const confidence = tasteProfile?.confidence || { score: 50 };
    const skipPatterns = tasteProfile?.skipPatterns || {};
    const stats = tasteProfile?.stats || {};
    const topGenres = tasteProfile?.topGenres || [];
    const scoringWeights = tasteProfile?.scoringWeights || {};
    const fatigueState = tasteProfile?.fatigueState || {};

    const likedTitlesStr = (likedMovieTitles || []).slice(0, 30).join(", ");

    // Fatigue info
    const fatiguedGenres = Object.entries(fatigueState)
      .filter(([k, v]) => k.startsWith("genre_") && (v as number) >= 3)
      .map(([k, v]) => `${k.replace("genre_", "")} (${v}x cette semaine)`);

    const tasteSection = tasteProfile ? `
PROFIL DE GOÛTS ENRICHI (MULTI-VECTEUR) :
- Genres préférés (pondérés par récence) : ${topGenres.join(", ")}
- Micro-genres / clusters favoris : ${tasteClusters.join(", ") || "non déterminés"}
${rejectedClusters.length > 0 ? `- ⛔ CLUSTERS REJETÉS (fréquemment refusés) : ${rejectedClusters.join(", ")} — FORTE PÉNALITÉ` : ""}
- Films aimés : ${likedTitlesStr || "aucun encore"}
- ${stats.likeCount || 0} films aimés, ${stats.watchCount || 0} vus, ${stats.skipCount || 0} skippés
- Confiance profil : ${confidence.score}/100
- Taux d'acceptation : ${stats.acceptanceRate || 0}%
${embeddingSimilarity !== null ? `- 🧬 Similarité STABLE (goût profond) : ${Math.round(embeddingSimilarity * 100)}%` : ""}
${recentSimilarity !== null ? `- 🔄 Similarité RÉCENTE (30 derniers jours) : ${Math.round(recentSimilarity * 100)}%` : ""}
${avoidanceSimilarity !== null ? `- ⚠️ Similarité ÉVITEMENT : ${Math.round(avoidanceSimilarity * 100)}% ${avoidanceSimilarity > 0.6 ? "— RISQUE ÉLEVÉ DE REJET" : avoidanceSimilarity > 0.4 ? "— risque modéré" : "— risque faible"}` : ""}
${movieTasteTags.length > 0 ? `- 🏷️ Taste tags du film : ${movieTasteTags.join(", ")}` : ""}
${movieClusterLabels.length > 0 ? `- 📂 Clusters : ${movieClusterLabels.join(", ")}` : ""}
${movieSafetyTags.length > 0 ? `- ⚠️ Contenu sensible : ${movieSafetyTags.join(", ")}` : ""}
${movieSuitabilityTags.length > 0 ? `- 👥 Adapté pour : ${movieSuitabilityTags.join(", ")}` : ""}
${Object.keys(movieSemanticAxes).length > 0 ? `- 📊 Axes sémantiques : ${Object.entries(movieSemanticAxes).filter(([,v]) => (v as number) > 0.6).map(([k,v]) => `${k}=${v}`).join(", ")}` : ""}
${skipPatterns.avgSkipRate > 0.5 ? `- ⚠️ Skip rate élevé (${Math.round(skipPatterns.avgSkipRate * 100)}%) — l'utilisateur est exigeant` : ""}
${skipPatterns.recentSkipStreak > 2 ? `- ⚠️ ${skipPatterns.recentSkipStreak} skips consécutifs récents` : ""}
${fatiguedGenres.length > 0 ? `- 🔄 FATIGUE genre : ${fatiguedGenres.join(", ")} — pénalise ces genres dans le score` : ""}

PRÉFÉRENCES ACTEURS/RÉALISATEURS :
${peoplePreferences?.lovedActors?.length > 0 ? `- ❤️ Acteurs adorés : ${peoplePreferences.lovedActors.join(", ")}` : ""}
${peoplePreferences?.likedActors?.length > 0 ? `- 👍 Acteurs appréciés : ${peoplePreferences.likedActors.join(", ")}` : ""}
${peoplePreferences?.dislikedActors?.length > 0 ? `- 👎 Acteurs pas aimés : ${peoplePreferences.dislikedActors.join(", ")} — PÉNALISER` : ""}
${peoplePreferences?.lovedDirectors?.length > 0 ? `- ❤️ Réalisateurs adorés : ${peoplePreferences.lovedDirectors.join(", ")}` : ""}
${peoplePreferences?.likedDirectors?.length > 0 ? `- 👍 Réalisateurs appréciés : ${peoplePreferences.likedDirectors.join(", ")}` : ""}
${peoplePreferences?.dislikedDirectors?.length > 0 ? `- 👎 Réalisateurs pas aimés : ${peoplePreferences.dislikedDirectors.join(", ")} — PÉNALISER` : ""}

FACTEURS D'ÉVALUATION (à peser qualitativement, pas mathématiquement) :
- Goût profond : alignement avec les préférences stables${embeddingSimilarity !== null ? ` [similarité: ${Math.round(embeddingSimilarity * 100)}%]` : ""}
- Session actuelle : adéquation avec l'humeur/genre demandé aujourd'hui
- Tendances récentes : envies des 30 derniers jours${recentSimilarity !== null ? ` [similarité: ${Math.round(recentSimilarity * 100)}%]` : ""}
- Affinité personnes : acteurs/réalisateurs aimés = +boost notable, détestés = pénalité
- Risque rejet : si le film ressemble à ceux évités${avoidanceSimilarity !== null ? ` [${Math.round(avoidanceSimilarity * 100)}%]` : ""}
- Qualité : note critique
- Fatigue : genre vu trop souvent cette semaine
${cinematicProfile ? `\nPROFIL CINÉMATOGRAPHIQUE :\n- Personnalité : "${cinematicProfile.personality_title}"\n- Description : ${cinematicProfile.narrative}\n- Traits : ${(cinematicProfile.taste_traits || []).join(", ")}\nUtilise ce profil pour enrichir tes explications.` : ""}` : "";

    const contentType = isYouTube ? "vidéo YouTube" : "film";

    const systemPrompt = isYouTube
      ? `Tu es Pick, un ami passionné de culture audiovisuelle qui calcule un match score. On te donne une vidéo YouTube, le profil de goûts d'un utilisateur, et sa session actuelle.

TON : Tu parles comme un pote — chaleureux, direct, jamais robotique. TOUJOURS POSITIF.
- "headline" → une accroche naturelle et enthousiaste.
- "whyItMatches" → 1 phrase courte, style pote, qui met en avant CE QUI VA PLAIRE.
- "detailedExplanation" → 3-5 phrases POSITIVES. Mets en avant les points forts du contenu par rapport au profil. Ne mentionne JAMAIS les aspects négatifs, les faiblesses ou les réserves. Concentre-toi sur pourquoi ça va plaire, en faisant le lien entre les goûts de l'utilisateur et les qualités du contenu.

RÈGLE D'OR : Tu es un ami qui VEND le contenu. Pas de "malgré", "cependant", "par contre", "attention". Que du positif, de l'enthousiasme et de la conviction.

RÈGLES :
- Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans backticks
- Structure :
{
  "matchScore": <number 0-99>,
  "headline": "<accroche enthousiaste, 10 mots max>",
  "pickNote": "<1 phrase qui montre que Pick a compris la demande. Si aucun profil connu, null.>",
  "whyItMatches": "<1 phrase perso POSITIVE, ton conversationnel, tutoiement>",
  "detailedExplanation": "<3-5 phrases POSITIVES valorisant le contenu par rapport au profil>",
  "emotionalJourney": "<2-3 phrases sur l'expérience de visionnage>",
  "perfectFor": "<1 phrase, style 'Parfait pour apprendre un truc en 20 min'>",
  "funFact": "<1 info intéressante sur le sujet ou la chaîne>",
  "similarLikedMovies": [],
  "matchingReasons": ["<raison courte POSITIVE, 2-4 mots>", ...max 4]
}
- SCORE HONNÊTE : Donne un score SINCÈRE basé sur la compatibilité réelle. Un contenu parfait = 85-99. Un contenu correct = 65-84. Un contenu peu adapté = 40-64. Un contenu inadapté = <40.
- Ne gonfle PAS le score artificiellement. Le score doit REFLÉTER la réalité de la compatibilité.
- Score calibré : Match parfait → 85-99.`
      : `Tu es Pick, un ami cinéphile passionné qui calcule un match score MULTI-VECTEUR. On te donne un film, le profil de goûts multi-dimensionnel d'un utilisateur, et sa session actuelle.

TON : Tu parles comme un pote cinéphile — chaleureux, direct, jamais robotique. TOUJOURS POSITIF ET ENTHOUSIASTE.${duoContext?.user1Name && duoContext?.user2Name ? `\nTu t'adresses à un DUO : ${duoContext.user1Name} et ${duoContext.user2Name} regardent ensemble. Utilise "vous", "vous deux", ou leurs prénoms naturellement. Parle-leur comme à deux amis qui partagent un moment. Ex: "Vous allez adorer", "Pour ${duoContext.user1Name} et ${duoContext.user2Name}, ce film...", "Parfait pour votre soirée".` : userName ? `\nL'utilisateur s'appelle ${userName}. Utilise son prénom naturellement dans 1 ou 2 champs (headline ou whyItMatches ou detailedExplanation), comme un vrai ami qui lui parle directement.` : ""}
- "headline" → accroche naturelle et enthousiaste, comme un ami dirait
- "whyItMatches" → 1 phrase courte POSITIVE, style pote, qui met en avant ce qui va plaire
- "detailedExplanation" → 3-5 phrases EXCLUSIVEMENT POSITIVES. Valorise les qualités du film par rapport au profil de l'utilisateur (ses genres préférés, ses goûts, son humeur). Ne mentionne JAMAIS les points faibles, réserves ou aspects négatifs. Fais le lien entre ce que l'utilisateur aime et ce que le film offre.

RÈGLE D'OR : Tu es un ami qui RECOMMANDE avec conviction. Pas de "malgré", "cependant", "par contre", "attention", "même si". Que du positif, de l'enthousiasme et des raisons concrètes d'aimer ce contenu.

⚠️ MÉTHODE DE SCORING — ANCRAGE POSITIF :
Ce film a été pré-sélectionné mathématiquement parmi des milliers de candidats — il est déjà dans le top 3% de compatibilité vectorielle avec le profil de l'utilisateur. Ce n'est pas un hasard : les données le valident.
Point de départ OBLIGATOIRE : **75%**. Ajuste ensuite :
- HAUSSE (+5 à +20pts) si : genres adorés, acteur/réalisateur favoris, embedding stable >80%, session parfaitement alignée
- BAISSE (-5 à -10pts) UNIQUEMENT si : genre EXPLICITEMENT listé dans les rejets de l'utilisateur (pas dans ses préférences générales — dans sa liste de genres refusés). La fatigue de genre peut baisser de 5pts max.
- Plage normale : **70-88%** pour un candidat standard. 88-99% pour un match remarquable.

⛔ RÈGLE ABSOLUE — PLANCHER ${minMatchScore}% :
Tu NE PEUX PAS descendre sous ${minMatchScore}%. Cette règle est NON NÉGOCIABLE.
- "Animation", "Familial", "Comédie" ne sont PAS des rejets sauf s'ils figurent EXPLICITEMENT dans la liste des genres rejetés.
- Une description cinématographique sophistiquée du profil NE justifie PAS de pénaliser les films grand public.
- Si tu écris un texte positif sur le film, ton score DOIT refléter cette positivité. Score < 68% avec texte positif = incohérence interdite.
- Si tu n'as pas de raison EXPLICITE et VÉRIFIABLE de descendre sous ${minMatchScore}%, reste à ${minMatchScore}% ou au-dessus.

EXEMPLES DE CALIBRATION :
- Genre favori + note 8/10 → 82-90%
- Genre aimé + bonne note + peu de données profil → 72-80%
- Genre neutre + profil peu développé → 70-75%
- Genre EXPLICITEMENT rejeté par l'utilisateur → peut descendre sous ${minMatchScore}%

LECTURE DES SIGNAUX VECTORIELS (orientation, pas calcul) :
${embeddingSimilarity !== null ? `- 🎯 Goût stable : ${Math.round(embeddingSimilarity * 100)}% → >80% booste vers 82-90%, 60-80% = base solide 72-80%, <60% = reste à 70-72% (plancher)` : ""}
${recentSimilarity !== null ? `- 🔄 Goût récent : ${Math.round(recentSimilarity * 100)}% → si élevé, l'utilisateur est dans cet état d'esprit en ce moment` : ""}
${avoidanceSimilarity !== null ? `- ⚠️ Risque rejet : ${Math.round(avoidanceSimilarity * 100)}% → >90% = pénalise (-8pts max), <80% = ignore` : ""}

RÈGLES :
- Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans backticks
- Structure :
{
  "matchScore": <number 0-99>,
  "headline": "<accroche enthousiaste et chaleureuse, 10 mots max>",
  "pickNote": "<1 phrase courte POSITIVE citant un goût spécifique de l'utilisateur. Si profil vide, null.>",
  "whyItMatches": "<1 phrase perso POSITIVE, ton conversationnel, tutoiement>",
  "detailedExplanation": "<3-5 phrases POSITIVES valorisant le contenu par rapport au profil>",
  "emotionalJourney": "<2-3 phrases sur l'expérience émotionnelle positive>",
  "perfectFor": "<1 phrase, style 'Parfait pour une soirée solo sous la couette'>",
  "funFact": "<1 anecdote cool>",
  "similarLikedMovies": ["<titre exact d'un film aimé similaire>", ...max 3],
  "matchingReasons": ["<raison courte POSITIVE, 2-4 mots>", ...max 4],
  "scores": {
    "stable_taste": <0-100>,
    "recent_taste": <0-100>,
    "context": <0-100>,
    "people_affinity": <0-100>,
    "rejection_risk": <0-100>,
    "quality": <0-100>,
    "novelty": <0-100>,
    "fatigue": <0-100>
  }
}
- "scores.rejection_risk" : 0 = aucun risque, 100 = certain rejet.
- "scores.fatigue" : 0 = aucune fatigue, 100 = genre totalement sur-exposé.
- RAPPEL : matchScore part de 75, ajuste selon les signaux. Plage normale : 70-88%. Excellent : 88-99%.
- PLANCHER ABSOLU ET NON NÉGOCIABLE : ${minMatchScore}%. Aucune exception sauf genre EXPLICITEMENT rejeté.
- Profil peu développé (confiance < 40) → reste entre 70-75%, pas moins.
- COHÉRENCE OBLIGATOIRE : si ton texte est positif, ton score doit être ≥ 70%. Un score < 68% = film qui ne devrait pas être recommandé du tout.
- ⚠️ PIÈGE À ÉVITER : La "similarité d'embedding" (ex: 7%) est un signal technique brut, pas un score final. Elle mesure une distance mathématique sur des vecteurs, pas l'adéquation réelle. NE JAMAIS recopier cette valeur comme matchScore. Un film peut avoir 7% de similarité et 78% de match si le profil est peu développé ou si d'autres signaux sont forts. Le score part TOUJOURS de 75, la similarité est un facteur parmi d'autres.`;

    const youtubeExtra = isYouTube ? `\nChaîne YouTube : ${youtubeData.channelTitle || "inconnue"}\nVues : ${youtubeData.viewCount || 0}\nDurée : ${runtime} min` : "";

    const userPrompt = `${mediaLabel} : "${title}" (${genres}, ${isTv ? `série TV` : `${runtime}min`}${!isYouTube ? `, note ${rating}/10` : ""})
Synopsis : ${overview}${youtubeExtra}
${criteriaText}${tasteSection}

Génère la fiche de match multi-vecteur.`;

    const callGeminiModel = async (model: string) => {
      const generationConfig: any = { responseMimeType: "application/json", maxOutputTokens: 700 };
      // thinkingBudget uniquement supporté par les modèles 2.5
      if (model.startsWith("gemini-2.5")) generationConfig.thinkingConfig = { thinkingBudget: 0 };
      return fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_AI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig,
          }),
        },
      );
    };

    const mmT2 = Date.now();
    let response = await callGeminiModel("gemini-2.5-flash");
    let modelUsed = "gemini-2.5-flash";
    // Cascade sur rate-limit : 2.5-flash → 2.0-flash-lite → 2.0-flash
    if (response.status === 429 || response.status === 503) {
      console.warn(`[MM⏱] gemini-2.5-flash ${response.status} — trying gemini-2.0-flash-lite`);
      response = await callGeminiModel("gemini-2.0-flash-lite");
      modelUsed = "gemini-2.0-flash-lite";
    }
    // Continue vers 2.0-flash si flash-lite échoue pour n'importe quelle raison (incl. 404 si modèle invalide)
    if (!response.ok) {
      console.warn(`[MM⏱] gemini-2.0-flash-lite ${response.status} — trying gemini-2.0-flash`);
      if (response.status === 429) await new Promise((r) => setTimeout(r, 500));
      response = await callGeminiModel("gemini-2.0-flash");
      modelUsed = "gemini-2.0-flash";
    }
    const mmT3 = Date.now();
    console.log(`[MM⏱] Gemini API: ${mmT3 - mmT2}ms (model=${modelUsed}, status=${response.status}, title="${title}")`);

    if (!response.ok) {
      const t = await response.text();
      console.error(`[MM] Gemini HTTP error: status=${response.status} title="${title}" body=${t.slice(0, 300)}`);
      const fallback = {
        matchScore: 70,
        headline: "Celui-là pourrait bien te plaire",
        whyItMatches: "Vu ce que tu cherches, ça devrait coller.",
        detailedExplanation: "C'est le genre de film qui surprend — laisse-toi porter et tu verras.",
        emotionalJourney: "Une expérience qui vaut le détour.",
        perfectFor: "Parfait pour une soirée ciné sans prise de tête.",
        funFact: "Un film qui a marqué son genre.",
        scores: {
          stable_taste: embeddingSimilarity ? Math.round(embeddingSimilarity * 100) : 50,
          recent_taste: recentSimilarity ? Math.round(recentSimilarity * 100) : 50,
          context: 70,
          rejection_risk: avoidanceSimilarity ? Math.round(avoidanceSimilarity * 100) : 20,
          quality: 70,
          novelty: 50,
          fatigue: 0,
        },
        fallback: true,
        aiStatus: response.status,
        aiError: t.slice(0, 200),
      };
      if (embeddingSimilarity !== null) (fallback as any).embeddingSimilarity = Math.round(embeddingSimilarity * 100);
      if (recentSimilarity !== null) (fallback as any).recentSimilarity = Math.round(recentSimilarity * 100);
      if (avoidanceSimilarity !== null) (fallback as any).avoidanceSimilarity = Math.round(avoidanceSimilarity * 100);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let aiData: any;
    try {
      const rawText = await response.text();
      console.log(`[MM-RAW] "${title}": ${rawText.slice(0, 500)}`);
      aiData = JSON.parse(rawText);
    } catch (e) {
      console.error("Failed to parse movie-match response body:", e);
      throw new Error("AI response parse error");
    }
    // Native Gemini API response: candidates[0].content.parts[0].text
    const content = (aiData?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();

    let matchData;
    try {
      matchData = JSON.parse(content);
    } catch {
      console.error(`[MM] JSON parse failed for "${title}": content="${content.slice(0, 200)}"`);
      matchData = {
        matchScore: 70,
        headline: "Celui-là pourrait bien te plaire",
        whyItMatches: "Vu ce que tu cherches, ça devrait coller.",
        detailedExplanation: "C'est le genre de film qui surprend — laisse-toi porter et tu verras.",
        emotionalJourney: "Une expérience qui vaut le détour.",
        perfectFor: "Parfait pour une soirée ciné sans prise de tête.",
        funFact: "Un film qui a marqué son genre.",
        scores: {
          stable_taste: embeddingSimilarity ? Math.round(embeddingSimilarity * 100) : 50,
          recent_taste: recentSimilarity ? Math.round(recentSimilarity * 100) : 50,
          context: 70,
          rejection_risk: avoidanceSimilarity ? Math.round(avoidanceSimilarity * 100) : 20,
          quality: 70,
          novelty: 50,
          fatigue: 0,
        },
        fallback: true,
        aiError: "json_parse_failed",
      };
    }

    // Inject raw similarities for client-side use
    if (embeddingSimilarity !== null) matchData.embeddingSimilarity = Math.round(embeddingSimilarity * 100);
    if (recentSimilarity !== null) matchData.recentSimilarity = Math.round(recentSimilarity * 100);
    if (avoidanceSimilarity !== null) matchData.avoidanceSimilarity = Math.round(avoidanceSimilarity * 100);
    if (movieTasteTags.length > 0) matchData.movieTasteTags = movieTasteTags;
    if (movieClusterLabels.length > 0) matchData.clusterLabels = movieClusterLabels;
    if (movieSafetyTags.length > 0) matchData.safetyTags = movieSafetyTags;
    if (movieSuitabilityTags.length > 0) matchData.suitabilityTags = movieSuitabilityTags;
    if (Object.keys(movieSemanticAxes).length > 0) matchData.semanticAxes = movieSemanticAxes;

    const mmTFinal = Date.now();
    console.log(`[MM⏱] TOTAL: ${mmTFinal - mmT0}ms | embed: ${mmT1 - mmT0}ms | gemini: ${mmT3 - mmT2}ms | parse: ${mmTFinal - mmT3}ms`);
    matchData._timings = { total: mmTFinal - mmT0, embed: mmT1 - mmT0, gemini: mmT3 - mmT2 };

    return new Response(JSON.stringify(matchData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("movie-match error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
