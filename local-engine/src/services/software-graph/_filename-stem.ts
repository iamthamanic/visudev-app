/**
 * Filename stem extraction for layer-first domain naming (P0-14).
 * Location: local-engine/src/services/software-graph/_filename-stem.ts
 */

import { normalizePath } from "./_heuristics.js";

/** Layer-style suffixes (naming convention — not folder policy). Longer first. */
export const FILENAME_LAYER_SUFFIXES: readonly string[] = [
  "controller",
  "controllers",
  "presenter",
  "presenters",
  "serializer",
  "serializers",
  "repository",
  "repositories",
  "service",
  "services",
  "usecase",
  "use-case",
  "use_case",
  "handler",
  "handlers",
  "viewset",
  "viewsets",
  "policy",
  "policies",
  "job",
  "jobs",
  "worker",
  "workers",
  "mailer",
  "mailers",
  "helper",
  "helpers",
  "dto",
  "entity",
  "model",
  "models",
  "type",
  "types",
  "schema",
  "schemas",
  "component",
  "components",
  "page",
  "pages",
  "route",
  "routes",
];

export const GENERIC_FILENAME_STEMS = new Set([
  "index",
  "main",
  "mod",
  "app",
  "init",
  "server",
  "client",
  "config",
  "settings",
  "utils",
  "util",
  "helpers",
  "helper",
  "types",
  "type",
  "constants",
  "constant",
  "test",
  "tests",
  "spec",
  "mock",
  "mocks",
  "fixture",
  "fixtures",
]);

export function normalizeStem(raw: string): string {
  let s = raw.trim().toLowerCase();
  if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) {
    s = s.slice(0, -1);
  }
  return s;
}

function stripExtension(basename: string): string {
  return basename.replace(/\.[^.]+$/u, "");
}

function stripLayerSuffixes(name: string): string {
  let current = name;
  let changed = true;
  while (changed && current.length > 0) {
    changed = false;
    const lower = current.toLowerCase();
    for (const suffix of FILENAME_LAYER_SUFFIXES) {
      const camel = suffix.charAt(0).toUpperCase() + suffix.slice(1);
      if (current.endsWith(camel) && current.length > camel.length) {
        current = current.slice(0, -camel.length);
        changed = true;
        break;
      }
      for (const sep of ["_", "-", "."] as const) {
        const token = `${sep}${suffix}`;
        if (lower.endsWith(token) && lower.length > token.length) {
          current = current.slice(0, -token.length);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return current;
}

/**
 * Derive a normalized stem key + display label from a file path basename.
 * Returns null for empty / generic stems.
 * After suffix strip, keep the full remaining compound name (user-profile),
 * not only the last token — so compounds stay one domain.
 */
export function extractFilenameStem(filePath: string): { key: string; label: string } | null {
  const base = normalizePath(filePath).split("/").pop() ?? "";
  if (!base) return null;
  const withoutExt = stripExtension(base);
  if (!withoutExt) return null;

  const stripped = stripLayerSuffixes(withoutExt);
  const tokenSource = stripped.length > 0 ? stripped : withoutExt;
  const parts = tokenSource
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .split(/[-_./]+/)
    .filter(Boolean);
  if (parts.length === 0) return null;
  const rawLabel = parts.join("-").trim();
  if (!rawLabel) return null;
  const key = normalizeStem(rawLabel);
  if (!key || GENERIC_FILENAME_STEMS.has(key)) return null;
  return { key, label: rawLabel };
}
