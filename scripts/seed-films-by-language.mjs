/**
 * Enrichit movie_embeddings avec des films par langue d'origine.
 * Appelle enrich-french-films (maintenant générique) pour chaque langue.
 *
 * Usage :
 *   node scripts/seed-films-by-language.mjs                     # toutes les langues
 *   node scripts/seed-films-by-language.mjs --lang en           # anglais seulement
 *   node scripts/seed-films-by-language.mjs --lang fr,en        # français + anglais
 *   node scripts/seed-films-by-language.mjs --lang en --target 2000 --minvotes 80
 *
 * Langues disponibles : fr, en, de, it, es, pt, nl, sv, da, no, pl, ru
 */

const SUPABASE_URL  = "https://lrjhpflvkrebbngfnaif.supabase.co";
const ANON_KEY      = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyamhwZmx2a3JlYmJuZ2ZuYWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODMwODMsImV4cCI6MjA4ODc1OTA4M30.uqrxehgcnJTHmhGcmSKpu8GNngUkSE5iuHUcw7z4tPk";
const FUNCTION_URL  = `${SUPABASE_URL}/functions/v1/enrich-french-films`;

// --- Config par langue (minVotes plus élevé = moins de bruit, plus de qualité) ---
const LANG_CONFIG = {
  fr: { label: "Français",    minVotes: 20,  defaultTarget: 1500 },
  en: { label: "Américain/Anglophone", minVotes: 80, defaultTarget: 3000 },
  de: { label: "Allemand",    minVotes: 20,  defaultTarget: 600  },
  it: { label: "Italien",     minVotes: 20,  defaultTarget: 600  },
  es: { label: "Espagnol",    minVotes: 20,  defaultTarget: 600  },
  pt: { label: "Portugais",   minVotes: 15,  defaultTarget: 400  },
  nl: { label: "Néerlandais", minVotes: 15,  defaultTarget: 300  },
  sv: { label: "Suédois",     minVotes: 15,  defaultTarget: 300  },
  da: { label: "Danois",      minVotes: 15,  defaultTarget: 200  },
  no: { label: "Norvégien",   minVotes: 15,  defaultTarget: 200  },
  pl: { label: "Polonais",    minVotes: 15,  defaultTarget: 300  },
  ru: { label: "Russe",       minVotes: 20,  defaultTarget: 500  },
};

// --- Paramètres CLI ---
const args = process.argv.slice(2);
const getArg = (flag, def) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : def; };
const getNum = (flag, def) => { const v = getArg(flag, null); return v !== null ? Number(v) : def; };

const langArg   = getArg("--lang", null);
const TARGET    = getNum("--target", null);      // override cible
const MIN_VOTES = getNum("--minvotes", null);    // override minVotes
const BATCH     = getNum("--batch", 4);
const MEDIA     = args.includes("--tv") ? "tv" : "movie";

// Langues à traiter : --lang fr,en,de ou toutes dans l'ordre prioritaire
const PRIORITY_ORDER = ["fr", "en", "de", "it", "es", "pt", "nl", "sv", "da", "no", "pl", "ru"];
const langsToRun = langArg
  ? langArg.split(",").map(l => l.trim()).filter(l => LANG_CONFIG[l])
  : PRIORITY_ORDER;

// --- Helpers ---
function bar(n, total, w = 28) {
  const f = Math.min(w, Math.max(0, Math.round((n / total) * w)));
  return "█".repeat(f) + "░".repeat(w - f);
}
function fmt(n) { return String(n).padStart(4, " "); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callEnrich(page, lang, minVotes) {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ANON_KEY}` },
    body: JSON.stringify({
      startPage: page, scanUntilPage: 500,
      batchSize: BATCH, mediaType: MEDIA,
      minVoteCount: minVotes, originalLanguage: lang,
    }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`); }
  return res.json();
}

async function seedLanguage(lang) {
  const cfg    = LANG_CONFIG[lang];
  const target = TARGET ?? cfg.defaultTarget;
  const minV   = MIN_VOTES ?? cfg.minVotes;

  console.log(`\n${"═".repeat(55)}`);
  console.log(`🎬  ${cfg.label} (${lang})  — cible : ${target} films | minVotes : ${minV}`);
  console.log(`${"═".repeat(55)}\n`);

  let page = 1, totalAdded = 0, totalErrors = 0, call = 0;
  const t0 = Date.now();

  while (totalAdded < target) {
    call++;
    process.stdout.write(`[${lang.toUpperCase()} #${fmt(call)}] page ${fmt(page)} → `);

    let data;
    try {
      data = await callEnrich(page, lang, minV);
    } catch (e) {
      console.error(`\n  ❌ ${e.message}`);
      await sleep(6000);
      try { data = await callEnrich(page, lang, minV); }
      catch (e2) { console.error(`  ❌ Retry échoué: ${e2.message}`); break; }
    }

    let added = data.added || 0, errors = data.errors || 0;

    // Rate-limit Gemini : retry après pause
    if (errors > 0 && added === 0 && data.details?.length > 0) {
      process.stdout.write(`⏳ rate-limit, retry 10s... `);
      await sleep(10000);
      try {
        const r = await callEnrich(page, lang, minV);
        added = r.added || 0; errors = r.errors || 0; data = r;
      } catch { /* garde les valeurs précédentes */ }
    }

    totalAdded  += added;
    totalErrors += errors;
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`+${fmt(added)} films (${errors} err, ${data.scannedPages || 1} pages scannées, ${elapsed}s)`);

    const pct = Math.min(100, Math.round((totalAdded / target) * 100));
    console.log(`   ${bar(totalAdded, target)} ${totalAdded}/${target} (${pct}%)\n`);

    if (!data.nextPage) { console.log(`  ✅ Plus de pages TMDB pour [${lang}].\n`); break; }
    page = data.nextPage;
    await sleep(2000);
  }

  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n  [${lang}] Terminé : +${totalAdded} films, ${totalErrors} erreurs, ${mins} min`);
  return totalAdded;
}

// --- Main ---
async function main() {
  console.log(`\n${"═".repeat(55)}`);
  console.log(`🌍  Enrichissement movie_embeddings — ${langsToRun.join(", ")}`);
  console.log(`    Batch Gemini : ${BATCH}/appel | Média : ${MEDIA}`);
  console.log(`${"═".repeat(55)}`);

  let grand = 0;
  for (const lang of langsToRun) {
    if (!LANG_CONFIG[lang]) { console.warn(`  ⚠️  Langue inconnue ignorée : ${lang}`); continue; }
    grand += await seedLanguage(lang);
    if (langsToRun.indexOf(lang) < langsToRun.length - 1) {
      console.log(`\n  ⏸  Pause 5s avant la prochaine langue...\n`);
      await sleep(5000);
    }
  }

  console.log(`\n${"═".repeat(55)}`);
  console.log(`✅  Total global : +${grand} films ajoutés`);
  console.log(`${"═".repeat(55)}\n`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
