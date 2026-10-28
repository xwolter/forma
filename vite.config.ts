import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "forma-production-security",
      apply: "build",
      transformIndexHtml: (html) =>
        html.replace(
          '<meta charset="UTF-8" />',
          "<meta charset=\"UTF-8\" /><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://images.openfoodfacts.org; media-src 'self' blob:; connect-src 'self' https://world.openfoodfacts.org https://search.openfoodfacts.org https://forma-mobi-2026-4e7c1a.web.app https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src https://*.firebaseapp.com;\" />",
        ),
    },
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "icons/*.png"],
      manifest: {
        id: "/",
        name: "FORMA - trening i jedzenie",
        short_name: "FORMA",
        description: "Twój trening, jedzenie i postępy. W swoim tempie.",
        lang: "pl",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        theme_color: "#0f5a43",
        background_color: "#f4f5f8",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,webp,woff2,json}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/__/],
        maximumFileSizeToCacheInBytes: 10000000,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 700 },
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ["**/android/**"] },
    proxy: {"/off-search":{target:"https://search.openfoodfacts.org",changeOrigin:true,rewrite:path=>path.replace(/^\/off-search/,"")}},
  },
  preview: { port: 4173, strictPort: true },
});
