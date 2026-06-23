import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// En production : neutraliser les logs de debug (console.warn/error restent actifs)
if (import.meta.env.PROD) {
  const noop = () => {};
  console.log = noop;
  console.group = noop;
  console.groupCollapsed = noop;
  console.groupEnd = noop;
  console.debug = noop;
}

createRoot(document.getElementById("root")!).render(<App />);
