/**
 * Central discovery ignore / size / extension policy (SDE-04).
 * Shared by Local adapter and pure discovery — keep in sync with blueprint-local SKIP_DIRS.
 * Location: shared/scan-detector/domain/discovery-policy.ts
 */

export const DISCOVERY_SKIP_DIR_NAMES: readonly string[] = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".qa",
  ".turbo",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
];

/** Extensions treated as first-class analyzed source. */
export const DISCOVERY_SUPPORTED_EXTENSIONS: ReadonlySet<string> = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "vue",
  "py",
  "go",
  "rs",
  "java",
  "prisma",
  "yml",
  "yaml",
  "sql",
  "json",
  "toml",
]);

/** Extensions that stay as inventory only (no semantic detectors assumed). */
export const DISCOVERY_INVENTORY_ONLY_EXTENSIONS: ReadonlySet<string> = new Set([
  "rb",
  "php",
  "cs",
  "kt",
  "swift",
  "scala",
  "cpp",
  "c",
  "h",
  "hpp",
]);

export const DISCOVERY_MAX_FILE_BYTES = 512 * 1024;

export function isSkippedDiscoveryDirName(name: string): boolean {
  return DISCOVERY_SKIP_DIR_NAMES.includes(name);
}

export function extensionOf(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1).toLowerCase();
}
