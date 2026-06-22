/**
 * Crée le compte de test E2E dans Supabase via l'API Auth.
 * Usage : node scripts/create-test-user.mjs
 *
 * Nécessite Node 18+ (fetch natif).
 * Lit les variables depuis .env.test si présent, sinon utilise les valeurs par défaut.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Lire .env.test si disponible
const envPath = resolve(process.cwd(), '.env.test');
const env = {};
try {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.trim().split('=');
    if (key && rest.length) env[key] = rest.join('=');
  });
} catch {}

const SUPABASE_URL  = env.VITE_SUPABASE_URL  ?? 'https://lrjhpflvkrebbngfnaif.supabase.co';
const ANON_KEY      = env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyamhwZmx2a3JlYmJuZ2ZuYWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODMwODMsImV4cCI6MjA4ODc1OTA4M30.uqrxehgcnJTHmhGcmSKpu8GNngUkSE5iuHUcw7z4tPk';
const EMAIL         = env.E2E_TEST_EMAIL    ?? 'testpick@gmail.com';
const PASSWORD      = env.E2E_TEST_PASSWORD ?? 'picktest';

console.log(`Création du compte de test : ${EMAIL}`);

const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
  },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});

const data = await res.json();

// Supabase renvoie soit { id, email, ... } (succès), soit { code, msg, ... } (erreur)
const user = data.id ? data : data.user;

if (user?.id) {
  console.log(`✅ Compte créé — id : ${user.id}`);
  console.log(`   Email : ${user.email}`);
  if (user.confirmation_sent_at && !user.email_confirmed_at) {
    console.log('');
    console.log('   ⚠️  Email non confirmé — un lien a été envoyé à testpick@gmail.com.');
    console.log('   Pour les tests E2E, deux options :');
    console.log('');
    console.log('   Option A (recommandée) — désactiver la confirmation email dans Supabase :');
    console.log('     → Supabase dashboard → Authentication → Providers → Email');
    console.log('     → Désactiver "Confirm email"');
    console.log('');
    console.log('   Option B — confirmer manuellement dans le dashboard :');
    console.log('     → Supabase dashboard → Authentication → Users');
    console.log(`     → Chercher ${user.email} → "Send confirmation email" ou "Confirm"`);
  } else {
    console.log('   ✅ Compte actif immédiatement — prêt pour les tests E2E.');
  }
} else if (data.msg?.includes('already registered') || data.error_description?.includes('already registered') || data.code === 'user_already_exists') {
  console.log('ℹ️  Ce compte existe déjà — rien à faire.');
} else {
  console.error('❌ Erreur lors de la création :', JSON.stringify(data, null, 2));
  process.exit(1);
}
