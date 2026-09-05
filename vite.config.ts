import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// Air-gap rule: nothing here may reference a CDN. All assets are bundled from node_modules.
export default defineConfig({
  plugins: [
    react(),
    // Offline PWA (NFR-03). Workbox runtime is emitted locally into dist — nothing is fetched from the internet.
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,                       // we ship our own manifest.webmanifest with the official icons
      includeAssets: ["favicon.ico", "favicon.png", "emblem.png", "icons/*.png", "fonts/*.woff2", "geo/*.geojson"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webmanifest,geojson}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          { urlPattern: ({ url, request }) => url.pathname.startsWith("/api/") && request.method === "GET", handler: "NetworkFirst", options: { cacheName: "api-data", networkTimeoutSeconds: 4, expiration: { maxEntries: 300, maxAgeSeconds: 24 * 60 * 60 } } },
          { urlPattern: ({ url }) => url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/geo/"), handler: "CacheFirst", options: { cacheName: "static-assets", expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 } } },
        ],
      },
    }),
  ],
  root: path.resolve(import.meta.dirname, "client"),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: { host: "0.0.0.0", allowedHosts: true },
});
