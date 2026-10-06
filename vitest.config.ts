import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

/**
 * Vitest 4: environmentMatchGlobs removed — use projects for node vs jsdom.
 * Location: vitest.config.ts
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    passWithNoTests: true,
    exclude: ["src/supabase/functions/**", "tests/fixtures/**", "node_modules/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}", "shared/**/*.{test,spec}.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "local-engine/**/*.{test,spec}.ts",
            "preview-runner/lib/**/*.{test,spec}.js",
            "scripts/checks/**/*.test.ts",
          ],
        },
      },
    ],
  },
});
