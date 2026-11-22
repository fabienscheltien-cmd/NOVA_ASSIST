// Aperçu visuel des composants de Nova Assist avec les livrets d'essai (sans Supabase ni IA).
// Lancer : npx vite --config tests/apercu/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
  server: { port: 5199, fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] } },
});
