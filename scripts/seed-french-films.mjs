/**
 * Charge ~500 nouveaux films français dans movie_embeddings.
 *
 * Usage :  node scripts/seed-french-films.mjs
 * Options: node scripts/seed-french-films.mjs --target 300 --batch 10
 *
 * Chaque appel à enrich-french-films traite un batch de films via Gemini (~35s).
 * Le script boucle automatiquement en utilisant nextPage jusqu'à target atteint.
 */

const SUPABASE_URL  = "https://lrjhpflvkrebbngfnaif.supabase.co";
const ANON_KEY      = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyamhwZmx2a3JlYmJuZ2ZuYWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODMwODMsImV4cCI6MjA4ODc1OTA4M30.uqrxehgcnJTHmhGcmSKpu8GNngUkSE5iuHUcw7z4tPk";
const FUNCTION_URL  = `${SUPABASE_URL}/functions/v1/enrich-french-films`;

// --- Paramètres CLI ---
const args = process.argv.slice(2);
const getArg = (flag, def) => {
  const i = args.indexOf(flag);
  return i !== -1 ? Number(args[i + 1]) : def;
};
const TARGET      = getArg("--target", 500);   // films à ajouter au total
const BATCH_SIZE  = getArg("--batch", 3);      // 3 appels Gemini en parallèle max (évite le rate-limit)
const MIN_VOTES   = getArg("--minvotes", 20);  // vote_count.gte TMDB
const MEDIA_TYPE  = args.includes("--tv") ? "tv" : "movie";

// -------------------------------------------------------

async function callEnrich(startPage) {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      startPage,
      scanUntilPage: 500,
      batchSize: BATCH_SIZE,
      mediaType: MEDIA_TYPE,
      minVoteCount: MIN_VOTES,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function fmt(n) { return String(n).padStart(3, " "); }
function bar(n, total, width = 30) {
  const filled = Math.min(width, Math.max(0, Math.round((n / total) * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

// -------------------------------------------------------

async function main() {
  console.log(`\n🎬 Chargement de films français dans movie_embeddings`);
  console.log(`   Cible : ${TARGET} films | Batch : ${BATCH_SIZE}/appel | minVotes : ${MIN_VOTES}\n`);

  let page     = 1;
  let totalAdded  = 0;
  let totalErrors = 0;
  let call     = 0;
  const startTime  = Date.now();

  while (totalAdded < TARGET) {
    call++;
    const t0 = Date.now();
    process.stdout.write(`[#${fmt(call)}] Page ${fmt(page)} → appel edge function... `);

    let data;
    try {
      data = await callEnrich(page);
    } catch (e) {
      console.error(`\n   ❌ Erreur réseau: ${e.message}`);
      await new Promise(r => setTimeout(r, 5000));
      try { data = await callEnrich(page); }
      catch (e2) { console.error(`   ❌ Retry échoué: ${e2.message}`); break; }
    }

    let added   = data.added  || 0;
    let errors  = data.errors || 0;

    // Si 100% d'erreurs sur une page, retry après pause (rate-limit Gemini probable)
    if (errors > 0 && added === 0 && data.details?.length > 0) {
      process.stdout.write(`   ⏳ Rate-limit probable, retry dans 8s... `);
      await new Promise(r => setTimeout(r, 8000));
      try {
        const retry = await callEnrich(page);
        added  = retry.added  || 0;
        errors = retry.errors || 0;
        data   = retry;
        process.stdout.write(`retry: +${added} films\n`);
      } catch { process.stdout.write(`retry échoué\n`); }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    totalAdded  += added;
    totalErrors += errors;

    const skipped = data.skipped || 0;
    const scanned = data.scannedPages || 1;

    console.log(`✅ +${fmt(added)} films (${errors} err, ${scanned} pages scannées, ${elapsed}s)`);

    // Détail des erreurs
    if (errors > 0 && data.details) {
      data.details.filter(d => d.status === "error").forEach(d => {
        console.log(`      ⚠️  ${d.title} (${d.tmdbId}): ${d.error}`);
      });
    }

    // Progression
    const pct = Math.min(100, Math.round((totalAdded / TARGET) * 100));
    const elapsed_total = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`   ${bar(totalAdded, TARGET)} ${totalAdded}/${TARGET} (${pct}%) — ${elapsed_total}s écoulées\n`);

    // Prochain appel
    if (!data.nextPage) {
      console.log("✅ Plus de pages disponibles sur TMDB.");
      break;
    }
    page = data.nextPage;

    // Pause entre appels pour laisser Gemini respirer
    if (totalAdded < TARGET) {
      await new Promise(r => setTimeout(r, 2500));
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n═══════════════════════════════════════`);
  console.log(`✅ Terminé : ${totalAdded} films ajoutés, ${totalErrors} erreurs`);
  console.log(`   Durée totale : ${totalTime} min`);
  console.log(`═══════════════════════════════════════\n`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
