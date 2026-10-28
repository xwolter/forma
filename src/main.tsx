import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/plus-jakarta-sans/latin-ext-400.css";
import "@fontsource/plus-jakarta-sans/latin-ext-500.css";
import "@fontsource/plus-jakarta-sans/latin-ext-600.css";
import "@fontsource/plus-jakarta-sans/latin-ext-700.css";
import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-500.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/outfit/latin-ext-500.css";
import "@fontsource/outfit/latin-ext-600.css";
import "@fontsource/outfit/latin-ext-700.css";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/outfit/latin-700.css";
import App, { ErrorBoundary } from "./App";
import { StoreProvider } from "./core/store";
import { UIProvider } from "./ui/UI";
import { isNative } from "./core/native";
import "./forma.css";

if (!isNative && "serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) =>
    registerSW({ immediate: true }),
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <UIProvider>
          <App />
        </UIProvider>
      </StoreProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
