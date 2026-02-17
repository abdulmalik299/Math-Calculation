import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages:
// The workflow sets BASE_PATH to "/<repo-name>/"
const base =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [react()],
});
