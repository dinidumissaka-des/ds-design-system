import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@ds/css/index.css";
// The five accent options, each scoped to [data-ds-theme="<slug>"].
// Loaded after the base tokens so their overrides win; which one applies
// is decided at runtime by the attribute, not by import order.
import "@ds/theme-pine/theme.css";
import "@ds/theme-lime/theme.css";
import "@ds/theme-rust/theme.css";
import "@ds/theme-ink/theme.css";
import "@ds/theme-cobalt/theme.css";
import "./playground.css";
import { App } from "./app.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
