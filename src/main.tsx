import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// En production, les logs du pipeline de recommandation sont coupés : ils ne
// doivent rien exposer aux utilisateurs. Pour les rallumer et suivre tout le
// raisonnement dans la console : ajouter ?debug=1 à l'URL. Le choix est
// mémorisé (il survit à la navigation et au rechargement) ; ?debug=0 l'annule.
const DEBUG_FLAG = "pick_debug";

function debugEnabled(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get("debug");
    if (param === "1") {
      localStorage.setItem(DEBUG_FLAG, "1");
      return true;
    }
    if (param === "0") {
      localStorage.removeItem(DEBUG_FLAG);
      return false;
    }
    return localStorage.getItem(DEBUG_FLAG) === "1";
  } catch {
    // Navigation privée ou stockage bloqué : on reste silencieux.
    return false;
  }
}

if (import.meta.env.PROD) {
  if (debugEnabled()) {
    // console.info n'est jamais neutralisée : le rappel reste visible.
    console.info("[Pick] Console de debug active — ajouter ?debug=0 à l'URL pour la couper.");
  } else {
    const noop = () => {};
    console.log = noop;
    console.group = noop;
    console.groupCollapsed = noop;
    console.groupEnd = noop;
    console.debug = noop;
    // console.table était restée active : elle laissait passer les tableaux de
    // candidats sans le contexte qui les explique.
    console.table = noop;
  }
}

createRoot(document.getElementById("root")!).render(<App />);
