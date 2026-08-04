import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Suite d'intégration — soirées de groupe.
 *
 * Séparée de `npm test` à dessein : ces tests parlent à la vraie base et aux
 * edge functions déployées. Ils sont lents (quelques secondes par appel) et
 * dépendent du réseau, alors que la suite unitaire doit rester instantanée et
 * exécutable hors ligne.
 *
 * Lancement : npm run test:integration
 * Ils s'auto-ignorent proprement si .env.test est absent.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    // Les appels aux edge functions prennent 1 à 3 s ; la fusion en cumule
    // plusieurs.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Séquentiel : les tests créent et suppriment des soirées, les faire
    // tourner en parallèle rendrait les comptages instables.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
