import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
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
