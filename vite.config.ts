import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Air-gap rule: nothing here may reference a CDN. All assets are bundled from node_modules.
export default defineConfig({
  plugins: [react()],
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
  server: { host: "0.0.0.0" },
});
