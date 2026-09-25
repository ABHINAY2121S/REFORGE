import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// REFORGE Vite config — Tauri-optimised.
// Security note: NO CDN URLs, NO external resources — fully offline app.
// Any import that tries to load from a remote origin is a defect.

export default defineConfig(({ command }) => ({
  plugins: [react()],

  resolve: {
    alias: {
      "@audit": path.resolve(__dirname, "./src/audit-reports"),
    },
  },

  // Tauri expects the devserver on a specific port; it passes the port via
  // the TAURI_DEV_HOST env var in watch mode.
  server: {
    port: 1420,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST ?? "localhost",
    hmr: process.env.TAURI_DEV_HOST
      ? { protocol: "ws", host: process.env.TAURI_DEV_HOST, port: 1421 }
      : undefined,
    watch: {
      // Tell Vite to ignore the Rust + Python directories so their
      // changes don't trigger hot reloads (Cargo/Python have their
      // own watchers when needed).
      ignored: ["**/src-tauri/**", "**/python/**"],
    },
  },

  // Production build: output to src-tauri/target/frontend so Tauri
  // bundles it automatically.
  build: {
    outDir: "dist",
    // Tauri bundles the frontend; no chunking strategy needed here.
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
    // Minify in prod; readable in dev.
    minify: command === "build" ? "esbuild" : false,
    sourcemap: command !== "build",
  },

  // Prevents Vite from leaking process.env to the browser bundle —
  // the frontend should have zero secrets.
  envPrefix: ["VITE_"],
}));
