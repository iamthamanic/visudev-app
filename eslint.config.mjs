import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  {
    ignores: [
      "build",
      "local-engine/dist/**",
      "node_modules",
      "preview-runner/**",
      "logs-runner/**",
      "scripts/**", // Node.js dev scripts (require, process, etc.)
      "tests/fixtures/**",
      "src/supabase/functions/**",
      "shared/**",
      "supabase/**", // Backup-Layout (Deno/Edge Functions)
      "docs/memory-live-doc/**", // static GitHub Pages viewer (browser globals)
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["local-engine/**/*.ts", "shared/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        process: "readonly",
        Buffer: "readonly",
      },
    },
    rules: {
      "no-console": ["error", { allow: ["warn", "error", "log"] }],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["local-engine/**"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
);
