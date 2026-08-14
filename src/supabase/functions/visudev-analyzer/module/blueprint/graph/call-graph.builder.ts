/** BFS call-path expansion across import graph (Blueprint v1). */

import { collectAstCallTargets } from "./ast-call-graph.ts";
import { extractImports } from "./import-resolver.ts";

export interface FileIndexEntry {
  path: string;
  content: string;
}

const MAX_DEPTH = 8;
const MAX_FILES = 40;

export function collectRelatedFiles(
  entryPath: string,
  fileIndex: Map<string, FileIndexEntry>,
): string[] {
  const visited = new Set<string>();
  const queue: Array<{ path: string; depth: number }> = [
    { path: entryPath, depth: 0 },
  ];
  const ordered: string[] = [];

  while (queue.length > 0 && ordered.length < MAX_FILES) {
    const current = queue.shift();
    if (!current || visited.has(current.path)) continue;
    visited.add(current.path);
    if (!fileIndex.has(current.path)) continue;
    ordered.push(current.path);
    if (current.depth >= MAX_DEPTH) continue;

    const entry = fileIndex.get(current.path)!;
    const knownPaths = new Set(fileIndex.keys());
    const astTargets = collectAstCallTargets(
      entry.content,
      current.path,
      knownPaths,
    );
    for (const targetPath of astTargets) {
      if (fileIndex.has(targetPath)) {
        queue.push({ path: targetPath, depth: current.depth + 1 });
      }
    }

    const imports = extractImports(entry.content, current.path, knownPaths);
    for (const imp of imports) {
      if (imp.resolvedPath && fileIndex.has(imp.resolvedPath)) {
        queue.push({ path: imp.resolvedPath, depth: current.depth + 1 });
      }
    }
  }

  return ordered;
}

/**
 * Soft-cap ranking: app/module surface before specs/mocks/basename noise.
 * Keep in sync with preview-runner/lib/blueprint-local.js prioritizeBlueprintFiles.
 */
export function prioritizeBlueprintFiles<T extends { path: string }>(
  files: T[],
): T[] {
  const score = (p: string): number => {
    const path = p.toLowerCase().replace(/\\/g, "/");
    // visudev-gapclose P0-1: specs/mocks must not dominate FILE_LIMIT.
    if (
      /\.(spec|test)\.[jt]sx?$/.test(path) ||
      /\.mock\.[jt]sx?$/.test(path) ||
      /(?:^|\/)(__tests__|__mocks__|fixtures|testdata)\//.test(path) ||
      /(?:^|\/)(test|tests|spec|specs|e2e)\//.test(path)
    ) {
      return -100;
    }

    let s = 0;
    if (/(?:^|\/)packages\/database\/schema\.prisma$/.test(path)) s = 100;
    else if (/(?:^|\/)prisma\/schema\.prisma$/.test(path)) s = 100;
    else if (/(?:^|\/)docker-compose\.ya?ml$/.test(path)) s = 99;
    else if (
      /(?:^|\/)docker-compose[^/]*\.(ya?ml)$/.test(path) ||
      /(?:^|\/)compose\.(ya?ml)$/.test(path)
    ) {
      s = 97;
    } else if (
      /(?:^|\/)(k8s|kubernetes|manifests)\//.test(path) ||
      /(?:^|\/)(deployment|deployments|service|services|statefulset|daemonset)s?\.(ya?ml)$/
        .test(path)
    ) {
      s = 96.5;
    } else if (/(?:^|\/)schema\.prisma$/.test(path)) s = 78;
    else if (path.endsWith(".prisma")) s = 70;
    else if (/(?:^|\/)manage\.py$/.test(path)) s = 99;
    else if (/(?:^|\/)urls\.py$/.test(path)) s = 98;
    else if (/(?:^|\/)(views|viewsets|serializers)\.py$/.test(path)) s = 96;
    else if (path.includes("supabase/functions")) s = 95;
    else if (/(?:^|\/)route\.(tsx?|jsx?)$/.test(path)) s = 94;
    else if (/(?:^|\/)pages\/api\//.test(path)) s = 90;
    else if (/(?:^|\/)(models|permissions|settings)\.py$/.test(path)) s = 88;
    else if (path.includes("/apps/meteor/server")) s = 87;
    else if (path.includes("/apps/meteor/") || path.includes("/apps/api/")) {
      s = 86;
    } else if (path.includes("/validators/")) s = 85;
    else if (
      path.includes("/repositories/") || path.includes("/packages/database/")
    ) {
      s = 80;
    } else if (path.includes("/modules/")) s = 79;
    else if (path.includes("/controllers/")) s = 78;
    else if (path.includes("/services/")) s = 75;
    else if (path.includes("/middleware")) s = 70;
    else if (path.includes("/routes/") || path.includes("/api/")) s = 65;
    else if (path.includes("server/")) s = 60;
    else if (path.endsWith(".py")) s = 55;
    else s = 10;

    const segments = path.split("/").filter(Boolean);
    s += Math.min(segments.length, 8);
    if (path.includes("/leaves/") || path.includes("/leave/")) s += 12;
    if (path.includes("/src/") || path.includes("/app/")) s += 4;
    if (path.includes("/frontend/") && s < 70) s -= 8;
    return s;
  };

  return [...files].sort((a, b) => {
    const diff = score(b.path) - score(a.path);
    if (diff !== 0) return diff;
    // Tie-break uses same path normalization as score() (Windows backslashes).
    const aNorm = a.path.replace(/\\/g, "/");
    const bNorm = b.path.replace(/\\/g, "/");
    const depthDiff = bNorm.split("/").length - aNorm.split("/").length;
    if (depthDiff !== 0) return depthDiff;
    return aNorm.localeCompare(bNorm);
  });
}

/** visudev-gapclose P1-1 — keep in sync with blueprint-local.js */
export function isCriticalWalkSeedPath(relPath: string): boolean {
  const path = String(relPath || "")
    .toLowerCase()
    .replace(/\\/g, "/");
  if (!path) return false;
  if (/(?:^|\/)schema\.prisma$/.test(path)) return true;
  if (
    /(?:^|\/)docker-compose[^/]*\.(ya?ml)$/.test(path) ||
    /(?:^|\/)compose\.(ya?ml)$/.test(path)
  ) {
    return true;
  }
  if (
    /(?:^|\/)(k8s|kubernetes|manifests)\//.test(path) ||
    /(?:^|\/)(deployment|deployments|service|services|statefulset|daemonset)s?\.(ya?ml)$/
      .test(
        path,
      )
  ) {
    return true;
  }
  if (
    path.includes("/packages/database/") ||
    path.startsWith("packages/database/")
  ) {
    return true;
  }
  if (
    path.includes("/apps/meteor/server/") ||
    path.startsWith("apps/meteor/server/")
  ) {
    return true;
  }
  return false;
}

function seedSortKey(relPath: string): number {
  const path = String(relPath || "")
    .toLowerCase()
    .replace(/\\/g, "/");
  if (/(?:^|\/)packages\/database\/schema\.prisma$/.test(path)) return 0;
  if (/(?:^|\/)prisma\/schema\.prisma$/.test(path)) return 1;
  if (/(?:^|\/)schema\.prisma$/.test(path)) return 2;
  if (/(?:^|\/)docker-compose\.ya?ml$/.test(path)) return 2.5;
  if (
    /(?:^|\/)docker-compose[^/]*\.(ya?ml)$/.test(path) ||
    /(?:^|\/)compose\.(ya?ml)$/.test(path)
  ) {
    return 2.6;
  }
  if (
    /(?:^|\/)(k8s|kubernetes|manifests)\//.test(path) ||
    /(?:^|\/)(deployment|deployments|service|services|statefulset|daemonset)s?\.(ya?ml)$/
      .test(
        path,
      )
  ) {
    return 2.7;
  }
  if (
    path.includes("/packages/database/") ||
    path.startsWith("packages/database/")
  ) {
    return 3;
  }
  if (
    path.includes("/apps/meteor/server/") ||
    path.startsWith("apps/meteor/server/")
  ) {
    return 4;
  }
  return 9;
}

/**
 * Guarantee seed paths occupy Cap slots before ranked fill.
 * Remaining slots round-robin by first two path segments so one package
 * (e.g. erpnext/accounts) cannot starve sibling modules under FILE_LIMIT.
 * Keep in sync with preview-runner/lib/blueprint-local.js applyFileLimitWithSeeds.
 */
export function applyFileLimitWithSeeds<T extends { path: string }>(
  ranked: T[],
  limit: number,
): T[] {
  const cap = Math.max(1, limit);
  const byPath = new Map<string, T>();
  for (const item of ranked) {
    if (!byPath.has(item.path)) byPath.set(item.path, item);
  }

  const seedPaths = [...byPath.keys()]
    .filter((p) => isCriticalWalkSeedPath(p))
    .sort((a, b) => {
      const diff = seedSortKey(a) - seedSortKey(b);
      return diff !== 0 ? diff : a.localeCompare(b);
    });

  const out: T[] = [];
  const seen = new Set<string>();
  for (const p of seedPaths) {
    if (out.length >= cap) break;
    const item = byPath.get(p);
    if (!item || seen.has(p)) continue;
    seen.add(p);
    out.push(item);
  }

  // Bucket remaining ranked paths for diversity fill.
  const buckets = new Map<string, T[]>();
  const order: string[] = [];
  for (const item of ranked) {
    if (seen.has(item.path)) continue;
    const norm = item.path.replace(/\\/g, "/");
    const parts = norm.split("/").filter(Boolean);
    const key = parts.slice(0, Math.min(2, parts.length)).join("/") || "_";
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(item);
  }
  const indexes = new Map<string, number>();
  for (const key of order) indexes.set(key, 0);

  let progress = true;
  while (out.length < cap && progress) {
    progress = false;
    for (const key of order) {
      if (out.length >= cap) break;
      const list = buckets.get(key)!;
      let idx = indexes.get(key) ?? 0;
      while (idx < list.length && seen.has(list[idx]!.path)) idx += 1;
      if (idx >= list.length) {
        indexes.set(key, idx);
        continue;
      }
      const pick = list[idx]!;
      seen.add(pick.path);
      out.push(pick);
      indexes.set(key, idx + 1);
      progress = true;
    }
  }

  return out;
}
