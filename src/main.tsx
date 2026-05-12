import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n";
import App from "./App.tsx";
import { ThemeProvider } from "./components/theme-provider";

// One-time wipe of pre-Supabase media IndexedDB.
try {
  indexedDB.deleteDatabase("flash-learn-media");
} catch {
  // ignore
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
