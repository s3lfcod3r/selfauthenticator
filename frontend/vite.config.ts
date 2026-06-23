import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Der ESM-Build von libsodium-wrappers-sumo ist kaputt (importiert ein nicht
// existierendes ./libsodium-sumo.mjs). Wir zwingen Rollup auf den CJS-Build.
// Ein Paket-Subpfad-Alias scheitert am "exports"-Feld -> absoluter Pfad umgeht das.
const sodiumCjs = fileURLToPath(
  new URL("./node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js", import.meta.url),
);

// Dev-Proxy: /api -> FastAPI auf 8091. Im Container serviert FastAPI das dist/.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "SelfAuthenticator",
        short_name: "SelfAuth",
        description: "Self-hosted Zero-Knowledge 2FA / TOTP",
        theme_color: "#33a78c",
        background_color: "#080c11",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App-Shell offline cachen; /api NIE cachen (immer Netz / Fehler).
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^.*\/api\/.*$/,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  build: {
    // Keine Sourcemaps in Produktion -> Krypto-Quelltext nicht offenlegen.
    sourcemap: false,
  },
  resolve: {
    alias: {
      "libsodium-wrappers-sumo": sodiumCjs,
    },
  },
  optimizeDeps: {
    include: ["libsodium-wrappers-sumo"],
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8091" },
  },
});
