import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      // Le manifeste est écrit à la main dans `public/manifest.json` et déjà lié
      // depuis `index.html` : le plugin ne doit surtout pas en générer un second,
      // sinon Chrome en voit deux et n'en applique aucun de façon fiable.
      manifest: false,
      // L'enregistrement est fait à la main dans `src/lib/pwa-update.ts` : le
      // script injecté se contentait d'enregistrer, sans jamais recharger la
      // page ni revérifier au retour au premier plan.
      injectRegister: false,

      // La version déployée fait autorité. Lovable publie sans qu'on puisse
      // prévenir qui que ce soit : si le service worker attendait la fermeture
      // de tous les onglets pour s'activer, un correctif pourrait rester
      // invisible des jours durant. Ici la nouvelle version prend la main dès
      // qu'elle est téléchargée, et la page se recharge sur elle.
      registerType: "autoUpdate",

      // Le service worker est volontairement absent du serveur de dev : il
      // garderait en cache des modules que le HMR vient de remplacer.
      devOptions: { enabled: false },

      workbox: {
        // Pré-chargé : la coquille de l'application — code, styles, icônes.
        // Soit ~2,6 Mo bruts, environ 750 Ko sur le réseau une fois compressés,
        // téléchargés en arrière-plan après l'affichage de la page.
        // Volontairement exclus : les fonds d'écran `.webp` des pages, 1,9 Mo à
        // eux seuls, qui ne servent qu'à la page qu'on ouvre. Ils sont mis en
        // cache au fil des visites par la règle `fonds-pick` plus bas.
        globPatterns: ["**/*.{js,css,html,ico,svg}", "manifest.json", "icons/**/*.png", "logos/**/*.png"],

        // Le plus gros morceau de l'accueil dépasse la limite par défaut de 2 Mio
        // de peu aujourd'hui ; la marge évite qu'un découpage de HomeScreen le
        // fasse silencieusement sortir du pré-chargement demain.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,

        // Application à page unique : toute navigation inconnue est servie par
        // `index.html`, c'est le routeur qui tranche ensuite.
        navigateFallback: "index.html",
        // Sauf ces chemins, qui ne sont pas des écrans : le fichier de
        // vérification Google (chemin 2 vers le Play Store) doit rester un vrai
        // 404 tant qu'il n'existe pas, et non la page d'accueil déguisée.
        navigateFallbackDenylist: [/^\/\.well-known\//, /^\/robots\.txt$/],

        cleanupOutdatedCaches: true,

        // Écrits en toutes lettres : avec `injectRegister: false`, le plugin
        // n'ajoute plus `clientsClaim`, et le nouveau worker s'activait sans
        // jamais prendre la main sur la page ouverte — donc sans la recharger.
        skipWaiting: true,
        clientsClaim: true,

        runtimeCaching: [
          {
            // Les affiches de films. Elles ne changent jamais pour une URL
            // donnée : on sert le cache d'abord, sans même demander au réseau.
            urlPattern: /^https:\/\/image\.tmdb\.org\/t\/p\//,
            handler: "CacheFirst",
            options: {
              cacheName: "affiches-tmdb",
              expiration: { maxEntries: 250, maxAgeSeconds: 30 * 24 * 60 * 60 },
              // Les <img> partent sans CORS : la réponse est opaque, de statut 0.
              // Sans ce `0`, aucune affiche ne serait jamais gardée.
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Les fonds d'écran des pages, écartés du pré-chargement : gardés
            // dès la première visite de la page concernée.
            urlPattern: /\/assets\/.*\.webp$/,
            handler: "CacheFirst",
            options: {
              cacheName: "fonds-pick",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Les dépendances stables sont isolées du code applicatif : elles
        // changent rarement et restent donc en cache navigateur entre deux
        // déploiements, alors que les chunks de pages sont invalidés à chaque
        // build.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return "vendor-react";
          }
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("framer-motion")) return "vendor-motion";
          // Recharts n'est volontairement pas regroupé à la main : le forcer
          // dans un chunk nommé crée un import eager depuis l'entrée. Laissé
          // à Rollup, il reste confiné aux pages qui l'utilisent (Profil, ADN).
        },
      },
    },
  },
}));
