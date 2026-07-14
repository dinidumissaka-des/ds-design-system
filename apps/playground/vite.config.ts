import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  server: {
    // Allow importing registry manifests from outside the app root.
    fs: { allow: [path.resolve(__dirname, "../..")] },
  },
});
