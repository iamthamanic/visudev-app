import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "local-engine/**/*.{test,spec}.ts",
      "shared/**/*.{test,spec}.ts",
      "preview-runner/lib/**/*.{test,spec}.js",
      "scripts/checks/**/*.test.ts",
    ],
    environmentMatchGlobs: [
      ["local-engine/**", "node"],
      ["preview-runner/**", "node"],
      ["scripts/checks/**", "node"],
    ],
    exclude: ["src/supabase/functions/**", "tests/fixtures/**"],
    passWithNoTests: true,
  },
});
