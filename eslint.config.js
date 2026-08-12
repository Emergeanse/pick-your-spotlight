import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",

      // Dette de typage assumée : ~1030 `any`, dont un cinquième dans les deux
      // seuls fichiers HomeScreen.tsx et surprise-personalized/index.ts. C'est une
      // dette, pas une panne — elle ne doit pas bloquer un déploiement. Le cliquet
      // `--max-warnings` du script `lint` empêche le total d'augmenter : le nombre
      // ne peut que descendre, jamais monter.
      "@typescript-eslint/no-explicit-any": "warn",

      // `catch {}` est ici un garde-fou délibéré (localStorage, sessionStorage,
      // repli de parsing sur les réponses LLM), pas un oubli.
      "no-empty": ["error", { allowEmptyCatch: true }],

      // Le BOM placé dans la regex de nettoyage des réponses LLM
      // (surprise-personalized) est voulu : il retire le caractère que le modèle
      // ajoute parfois en tête de sa réponse.
      "no-irregular-whitespace": ["error", { skipRegExps: true }],
    },
  },
  {
    // Primitives shadcn/ui : générées, jamais modifiées à la main (cf. CLAUDE.md).
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: { "@typescript-eslint/no-empty-object-type": "off" },
  },
  {
    // Config Tailwind : `require()` est la forme attendue par l'écosystème des plugins.
    files: ["tailwind.config.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
