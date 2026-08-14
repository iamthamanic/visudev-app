/**
 * Local Blueprint analysis via filesystem walk + Deno CLI pipeline.
 * Location: preview-runner/lib/blueprint-local.js
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveValidatedLocalPath } from "./local-path-security.js";
import { readLocalAnalysisOrigin } from "./analysis-origin-git.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../..");
const ANALYZER_DIR = join(REPO_ROOT, "src/supabase/functions/visudev-analyzer");
const CLI_SCRIPT = join(ANALYZER_DIR, "module/blueprint/cli/analyze-local.ts");

const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const SKIP_DIRS = new Set([
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
]);

/** JS/TS plus Python (Django), Prisma, and compose YAML for Softort infra truth. */
const SUPPORTED_EXT = new Set(["ts", "tsx", "js", "jsx", "vue", "py", "prisma", "yml", "yaml"]);
const FILE_LIMIT = Math.max(250, Number(process.env.BLUEPRINT_FILE_LIMIT) || 400);
const MAX_WALK_CANDIDATES = Math.max(2000, Number(process.env.BLUEPRINT_MAX_WALK) || 4000);
/** Walk paths shipped for Softort/domain spread (may exceed FILE_LIMIT content set). */
const MAX_PATH_CATALOG = Math.max(
  FILE_LIMIT,
  Number(process.env.BLUEPRINT_MAX_PATH_CATALOG) || 4000,
);
/** visudev-gapclose P1-1: seed budgets so Cap cannot starve Prisma/Meteor. */
const SEED_DATABASE_BUDGET = Math.max(20, Number(process.env.BLUEPRINT_SEED_DATABASE_BUDGET) || 80);
const SEED_METEOR_SERVER_BUDGET = Math.max(
  40,
  Number(process.env.BLUEPRINT_SEED_METEOR_BUDGET) || 120,
);
const SEED_SCHEMA_FIND_BUDGET = Math.max(5, Number(process.env.BLUEPRINT_SEED_SCHEMA_BUDGET) || 24);
const SEED_K8S_BUDGET = Math.min(
  64,
  Math.max(8, Number(process.env.BLUEPRINT_SEED_K8S_BUDGET) || 24),
);
const MAX_FILE_BYTES = 512 * 1024;
const MAX_STDIN_BYTES = 8 * 1024 * 1024;
const DENO_TIMEOUT_MS = Math.max(30_000, Number(process.env.BLUEPRINT_DENO_TIMEOUT_MS) || 120_000);
const MAX_CONCURRENT_ANALYZE = Math.max(1, Number(process.env.BLUEPRINT_MAX_CONCURRENT) || 2);

let activeAnalyzeCount = 0;

/**
 * Soft-cap ranking: app/module surface before specs/mocks/basename noise.
 * Keep in sync with call-graph.builder.ts prioritizeBlueprintFiles.
 */
function prioritizeBlueprintFiles(files) {
  const score = (p) => {
    const path = p.toLowerCase().replace(/\\/g, "/");
    // visudev-gapclose P0-1: specs/mocks must not dominate FILE_LIMIT (Actual/Immich/Discourse).
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
      /(?:^|\/)(deployment|deployments|service|services|statefulset|daemonset)s?\.(ya?ml)$/.test(
        path,
      )
    ) {
      s = 96;
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
    else if (path.includes("/apps/meteor/") || path.includes("/apps/api/")) s = 86;
    else if (path.includes("/validators/")) s = 85;
    else if (path.includes("/repositories/") || path.includes("/packages/database/")) s = 80;
    else if (path.includes("/modules/")) s = 79;
    else if (path.includes("/controllers/")) s = 78;
    else if (path.includes("/services/")) s = 75;
    else if (path.includes("/middleware")) s = 70;
    else if (path.includes("/routes/") || path.includes("/api/")) s = 65;
    else if (path.includes("server/")) s = 60;
    else if (path.endsWith(".py")) s = 55;
    else s = 10;

    // Prefer module-segment paths over basename-lottery leaves (browo HrKo_* / flat roots).
    const segments = path.split("/").filter(Boolean);
    s += Math.min(segments.length, 8);
    if (path.includes("/leaves/") || path.includes("/leave/")) s += 12;
    if (path.includes("/src/") || path.includes("/app/")) s += 4;
    // Soft demote heavy frontend package trees when score is otherwise weak.
    if (path.includes("/frontend/") && s < 70) s -= 8;
    return s;
  };

  return [...files].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    // Tie-break uses same path normalization as score() (Windows backslashes).
    const aNorm = a.replace(/\\/g, "/");
    const bNorm = b.replace(/\\/g, "/");
    const depthDiff = bNorm.split("/").length - aNorm.split("/").length;
    if (depthDiff !== 0) return depthDiff;
    return aNorm.localeCompare(bNorm);
  });
}

function logBlueprintSkip(kind, detail) {
  console.warn(`[blueprint-local] ${kind}: ${detail}`);
}

/** Resolve realpath; null when missing / unreadable. */
function resolveRealPath(path) {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

/**
 * True when candidate resolves inside jailRoot (no symlink escape).
 * Exported for unit tests.
 */
export function isPathInsideRoot(candidateAbs, jailRootReal) {
  if (!jailRootReal) return false;
  const real = resolveRealPath(candidateAbs);
  if (!real) return false;
  const rel = relative(jailRootReal, real);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

/**
 * Walk code files under rootDir, never following symlinks and never leaving jailRoot.
 * @param {string} rootDir start directory
 * @param {number} [maxFiles]
 * @param {string} [jailRoot] containment root (defaults to rootDir)
 */
function walkCodeFiles(rootDir, maxFiles = MAX_WALK_CANDIDATES, jailRoot = rootDir) {
  const results = [];
  const rootReal = resolveRealPath(jailRoot) ?? resolveRealPath(rootDir);
  if (!rootReal) return results;
  if (!isPathInsideRoot(rootDir, rootReal)) return results;

  const stack = [rootDir];
  const limit = Math.max(1, maxFiles);

  while (stack.length > 0 && results.length < limit) {
    const dir = stack.pop();
    if (!isPathInsideRoot(dir, rootReal)) {
      logBlueprintSkip("skip directory outside workspace", dir);
      continue;
    }
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      logBlueprintSkip("skip directory", error instanceof Error ? error.message : "read failed");
      continue;
    }
    for (const entry of entries) {
      if (results.length >= limit) break;
      const full = join(dir, entry.name);
      // Skip before isDirectory/isFile — those follow symlink targets.
      if (entry.isSymbolicLink()) {
        logBlueprintSkip("skip symlink", relative(rootReal, full) || entry.name);
        continue;
      }
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (!isPathInsideRoot(full, rootReal)) {
          logBlueprintSkip("skip directory outside workspace", full);
          continue;
        }
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!isPathInsideRoot(full, rootReal)) {
        logBlueprintSkip("skip file outside workspace", full);
        continue;
      }
      const ext = entry.name.split(".").pop()?.toLowerCase();
      if (!ext || !SUPPORTED_EXT.has(ext)) continue;
      // Only compose + k8s YAML — generic .yml (CI) must not flood FILE_LIMIT.
      if (
        (ext === "yml" || ext === "yaml") &&
        !isAllowedYamlDescriptor(relative(rootReal, full), entry.name)
      ) {
        continue;
      }
      results.push(full);
    }
  }

  return results;
}

function isAllowedYamlDescriptor(relPath, name) {
  const path = String(relPath || "")
    .replace(/\\/g, "/")
    .toLowerCase();
  const base = String(name || path.split("/").pop() || "").toLowerCase();
  if (/^docker-compose/i.test(base) || /^compose\.(ya?ml)$/i.test(base)) return true;
  if (/(?:^|\/)(k8s|kubernetes|manifests)\//.test(path)) return true;
  return /(?:^|\/)(deployment|deployments|service|services|statefulset|daemonset)s?\.(ya?ml)$/.test(
    path,
  );
}

/**
 * visudev-gapclose P1-1: paths that must survive FILE_LIMIT (Formbricks Prisma, RC Meteor).
 */
function isCriticalWalkSeedPath(relPath) {
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
    /(?:^|\/)(deployment|deployments|service|services|statefulset|daemonset)s?\.(ya?ml)$/.test(path)
  ) {
    return true;
  }
  if (path.includes("/packages/database/") || path.startsWith("packages/database/")) {
    return true;
  }
  if (path.includes("/apps/meteor/server/") || path.startsWith("apps/meteor/server/")) {
    return true;
  }
  return false;
}

function seedSortKey(relPath) {
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
    /(?:^|\/)(deployment|deployments|service|services|statefulset|daemonset)s?\.(ya?ml)$/.test(path)
  ) {
    return 2.7;
  }
  if (path.includes("/packages/database/") || path.startsWith("packages/database/")) {
    return 3;
  }
  // visudev-gapclose P1-4: prefer Meteor methods/models over generic server fill.
  if (
    path.includes("/apps/meteor/server/meteor-methods/") ||
    path.includes("/apps/meteor/server/methods/") ||
    path.startsWith("apps/meteor/server/meteor-methods/") ||
    path.startsWith("apps/meteor/server/methods/")
  ) {
    return 4;
  }
  if (
    /(?:^|\/)apps\/meteor\/server\/models\.ts$/.test(path) ||
    path.includes("/apps/meteor/server/models/") ||
    path.includes("/apps/meteor/server/database/")
  ) {
    return 5;
  }
  if (path.includes("/apps/meteor/server/publications/")) return 6;
  if (path.includes("/apps/meteor/server/") || path.startsWith("apps/meteor/server/")) {
    return 7;
  }
  return 9;
}

/**
 * Targeted discovery so DFS MAX_WALK_CANDIDATES cannot miss Prisma/Meteor roots.
 */
function collectCriticalSeedRelPaths(workspaceRoot) {
  const absSeeds = [];
  const seen = new Set();

  const pushAbs = (abs) => {
    if (seen.has(abs)) return;
    seen.add(abs);
    absSeeds.push(abs);
  };

  const walkSub = (relDir, budget) => {
    const absDir = join(workspaceRoot, relDir);
    try {
      if (!statSync(absDir).isDirectory()) return;
    } catch {
      return;
    }
    for (const abs of walkCodeFiles(absDir, budget, workspaceRoot)) {
      pushAbs(abs);
    }
  };

  const pushFile = (relFile) => {
    const abs = join(workspaceRoot, relFile);
    try {
      if (statSync(abs).isFile()) pushAbs(abs);
    } catch {
      /* missing */
    }
  };

  walkSub("packages/database", SEED_DATABASE_BUDGET);
  walkSub("prisma", Math.min(40, SEED_DATABASE_BUDGET));

  // visudev-gapclose P3-2: compose files often sit outside soft-cap DFS — seed explicitly.
  pushFile("docker-compose.yml");
  pushFile("docker-compose.yaml");
  pushFile("compose.yml");
  pushFile("compose.yaml");
  pushFile("docker-compose-local.yml");
  pushFile("docker-compose-test.yml");
  pushFile("deployments/cli/community/docker-compose.yml");

  walkSub("k8s", SEED_K8S_BUDGET);
  walkSub("kubernetes", SEED_K8S_BUDGET);
  walkSub("manifests", SEED_K8S_BUDGET);
  pushFile("deployment.yaml");
  pushFile("deployment.yml");

  // Meteor: meteor-methods / publications / models first (Rocket.Chat layout).
  const methodsBudget = Math.max(40, Math.floor(SEED_METEOR_SERVER_BUDGET * 0.55));
  const publicationsBudget = Math.max(10, Math.floor(SEED_METEOR_SERVER_BUDGET * 0.15));
  walkSub("apps/meteor/server/meteor-methods", methodsBudget);
  walkSub("apps/meteor/server/methods", Math.min(20, methodsBudget));
  walkSub("apps/meteor/server/publications", publicationsBudget);
  walkSub("apps/meteor/server/database", Math.max(10, Math.floor(SEED_METEOR_SERVER_BUDGET * 0.1)));
  pushFile("apps/meteor/server/models.ts");
  const usedMeteor = absSeeds.filter((abs) =>
    abs.replace(/\\/g, "/").includes("/apps/meteor/server/"),
  ).length;
  const fillBudget = Math.max(0, SEED_METEOR_SERVER_BUDGET - usedMeteor);
  if (fillBudget > 0) walkSub("apps/meteor/server", fillBudget);

  // Named schema.prisma search (shallow-biased DFS) when package roots differ.
  const schemaHits = [];
  const workspaceReal = resolveRealPath(workspaceRoot);
  const stack = [workspaceRoot];
  while (stack.length > 0 && schemaHits.length < SEED_SCHEMA_FIND_BUDGET) {
    const dir = stack.pop();
    if (workspaceReal && !isPathInsideRoot(dir, workspaceReal)) continue;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (schemaHits.length >= SEED_SCHEMA_FIND_BUDGET) break;
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (workspaceReal && !isPathInsideRoot(full, workspaceReal)) continue;
        stack.push(full);
        continue;
      }
      if (entry.isFile() && entry.name === "schema.prisma") {
        if (!workspaceReal || isPathInsideRoot(full, workspaceReal)) {
          schemaHits.push(full);
        }
      }
    }
  }
  for (const abs of schemaHits) pushAbs(abs);

  return absSeeds.map((abs) => relative(workspaceRoot, abs).replace(/\\/g, "/"));
}

/**
 * Guarantee seed paths occupy Cap slots before ranked fill (route.ts must not starve meteor).
 * Remaining slots round-robin by first two path segments (erpnext module diversity).
 * Keep in sync with call-graph.builder.ts applyFileLimitWithSeeds.
 */
function applyFileLimitWithSeeds(rankedRelPaths, seedRelPaths, limit = FILE_LIMIT) {
  const cap = Math.max(1, limit);
  const seedSet = new Set((seedRelPaths || []).filter((p) => isCriticalWalkSeedPath(p)));
  const orderedSeeds = [...seedSet].sort((a, b) => {
    const diff = seedSortKey(a) - seedSortKey(b);
    return diff !== 0 ? diff : a.localeCompare(b);
  });

  const out = [];
  const seen = new Set();
  for (const p of orderedSeeds) {
    if (out.length >= cap) break;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }

  /** @type {Map<string, string[]>} */
  const buckets = new Map();
  /** @type {string[]} */
  const order = [];
  for (const p of rankedRelPaths || []) {
    if (seen.has(p)) continue;
    const norm = String(p || "").replace(/\\/g, "/");
    const parts = norm.split("/").filter(Boolean);
    const key = parts.slice(0, Math.min(2, parts.length)).join("/") || "_";
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key).push(p);
  }
  /** @type {Map<string, number>} */
  const indexes = new Map(order.map((k) => [k, 0]));

  let progress = true;
  while (out.length < cap && progress) {
    progress = false;
    for (const key of order) {
      if (out.length >= cap) break;
      const list = buckets.get(key);
      let idx = indexes.get(key) ?? 0;
      while (idx < list.length && seen.has(list[idx])) idx += 1;
      if (idx >= list.length) {
        indexes.set(key, idx);
        continue;
      }
      const pick = list[idx];
      seen.add(pick);
      out.push(pick);
      indexes.set(key, idx + 1);
      progress = true;
    }
  }
  return out;
}

/**
 * Blueprint analysis walks the clone root — not the preview "best web package".
 * Preview start still uses resolveAppWorkspaceDir; Softort needs FE+BE+packages.
 */
function resolveWorkspaceRoot(localPath) {
  return localPath;
}

/** Exported for unit tests (monorepo root must stay clone root). */
export {
  resolveWorkspaceRoot,
  prioritizeBlueprintFiles,
  applyFileLimitWithSeeds,
  isCriticalWalkSeedPath,
  collectCriticalSeedRelPaths,
  walkCodeFiles,
  selectDiversePathCatalog,
  SUPPORTED_EXT,
  FILE_LIMIT,
};

/**
 * Round-robin by first two path segments so erpnext/accounts + buying + crm
 * all appear in the Softort catalog even when ranked order clusters one module.
 * @param {string[]} rankedRelPaths
 * @param {number} limit
 */
function selectDiversePathCatalog(rankedRelPaths, limit = MAX_PATH_CATALOG) {
  const cap = Math.max(0, limit);
  if (cap === 0 || rankedRelPaths.length === 0) return [];
  if (rankedRelPaths.length <= cap) return [...rankedRelPaths];

  /** @type {Map<string, string[]>} */
  const buckets = new Map();
  /** @type {string[]} */
  const order = [];
  for (const raw of rankedRelPaths) {
    const path = String(raw || "")
      .replace(/\\/g, "/")
      .trim();
    if (!path) continue;
    const parts = path.split("/").filter(Boolean);
    const key = parts.slice(0, Math.min(2, parts.length)).join("/") || "_";
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key).push(path);
  }

  /** @type {string[]} */
  const selected = [];
  const seen = new Set();
  /** @type {Map<string, number>} */
  const indexes = new Map(order.map((k) => [k, 0]));

  let progress = true;
  while (selected.length < cap && progress) {
    progress = false;
    for (const key of order) {
      if (selected.length >= cap) break;
      const list = buckets.get(key);
      let idx = indexes.get(key) ?? 0;
      while (idx < list.length && seen.has(list[idx])) idx += 1;
      if (idx >= list.length) {
        indexes.set(key, idx);
        continue;
      }
      const pick = list[idx];
      seen.add(pick);
      selected.push(pick);
      indexes.set(key, idx + 1);
      progress = true;
    }
  }
  return selected;
}

function collectFileEntries(workspaceRoot) {
  const rootReal = resolveRealPath(workspaceRoot);
  if (!rootReal) {
    logBlueprintSkip("skip workspace", "unresolvable workspace root");
    return { files: [], pathCatalog: [] };
  }

  const seedRelPaths = collectCriticalSeedRelPaths(workspaceRoot);
  const walkedAbs = walkCodeFiles(workspaceRoot, MAX_WALK_CANDIDATES, workspaceRoot);
  const walkedRel = walkedAbs.map((abs) => relative(workspaceRoot, abs).replace(/\\/g, "/"));
  const merged = [...new Set([...seedRelPaths, ...walkedRel])];
  const prioritized = prioritizeBlueprintFiles(merged);
  // Full walk (diversified) for segment-spread — not limited to content FILE_LIMIT.
  const pathCatalog = selectDiversePathCatalog(prioritized, MAX_PATH_CATALOG);
  const capped = applyFileLimitWithSeeds(prioritized, seedRelPaths, FILE_LIMIT);

  const entries = [];
  for (const relPath of capped) {
    const abs = join(workspaceRoot, relPath);
    if (!isPathInsideRoot(abs, rootReal)) {
      logBlueprintSkip("skip path outside workspace", relPath);
      continue;
    }
    try {
      const realAbs = resolveRealPath(abs);
      if (!realAbs || !isPathInsideRoot(realAbs, rootReal)) {
        logBlueprintSkip("skip path outside workspace", relPath);
        continue;
      }
      const stat = statSync(realAbs);
      if (!stat.isFile()) continue;
      if (stat.size > MAX_FILE_BYTES) {
        logBlueprintSkip("skip large file", `${relPath} (${stat.size} bytes)`);
        continue;
      }
      const content = readFileSync(realAbs, "utf8");
      entries.push({ path: relPath, content });
    } catch (error) {
      logBlueprintSkip(
        "skip unreadable file",
        `${relPath}: ${error instanceof Error ? error.message : "read failed"}`,
      );
    }
  }

  return { files: entries, pathCatalog };
}

function runDenoAnalyze(payload) {
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, "utf8") > MAX_STDIN_BYTES) {
    return Promise.reject(new Error("Blueprint payload too large after file collection"));
  }

  return new Promise((resolve, reject) => {
    const child = spawn("deno", ["run", "--quiet", "--no-prompt", CLI_SCRIPT], {
      cwd: ANALYZER_DIR,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      const err = new Error(`Blueprint analysis timed out after ${DENO_TIMEOUT_MS}ms`);
      err.statusCode = 504;
      finish(reject, err);
    }, DENO_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (err) => {
      if (err.code === "ENOENT") {
        const missing = new Error("Deno nicht gefunden. Bitte deno installieren (Hybrid-Dev).");
        missing.statusCode = 503;
        finish(reject, missing);
        return;
      }
      finish(reject, err);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        finish(reject, new Error(stderr.trim() || `Deno CLI exit ${code ?? "?"}`));
        return;
      }
      try {
        finish(resolve, JSON.parse(stdout));
      } catch {
        finish(reject, new Error("Blueprint CLI returned invalid JSON"));
      }
    });

    child.stdin.write(serialized);
    child.stdin.end();
  });
}

/**
 * @param {{ localPath: unknown, projectId: unknown }} input
 */
export function validateBlueprintAnalyzeInput(input) {
  const localPath = typeof input.localPath === "string" ? input.localPath.trim() : "";
  const projectId = typeof input.projectId === "string" ? input.projectId.trim() : "";
  if (!localPath) {
    return { ok: false, statusCode: 400, error: "localPath is required" };
  }
  if (!projectId || !PROJECT_ID_PATTERN.test(projectId)) {
    return {
      ok: false,
      statusCode: 400,
      error: "projectId must match [A-Za-z0-9_-]{1,64}",
    };
  }
  return { ok: true, localPath, projectId };
}

/**
 * @param {{ localPath: string, projectId: string }} input
 */
export async function analyzeLocalBlueprint(input) {
  if (activeAnalyzeCount >= MAX_CONCURRENT_ANALYZE) {
    const err = new Error("Too many concurrent blueprint analyses. Retry shortly.");
    err.statusCode = 429;
    throw err;
  }

  activeAnalyzeCount += 1;
  try {
    const validated = resolveValidatedLocalPath(input.localPath);
    if (!validated.ok) {
      const err = new Error(validated.error);
      err.statusCode = 403;
      throw err;
    }

    const workspaceRoot = resolveWorkspaceRoot(validated.path);
    const { files, pathCatalog } = collectFileEntries(workspaceRoot);
    if (files.length === 0) {
      const err = new Error("No analyzable source files found in local project path");
      err.statusCode = 400;
      throw err;
    }

    const localPath = validated.path;
    const projectId = input.projectId;
    // Provenance git subprocesses inherit this handler's MAX_CONCURRENT_ANALYZE gate.
    const analysisOrigin = await readLocalAnalysisOrigin(localPath);

    const result = await runDenoAnalyze({
      projectId,
      localPath,
      repo: `local:${localPath}`,
      branch: analysisOrigin.branch,
      files,
      pathCatalog,
      fileLimit: FILE_LIMIT,
    });

    if (!result?.blueprint) {
      throw new Error("Blueprint CLI returned no blueprint");
    }

    if (analysisOrigin.commitSha) {
      result.blueprint.commitSha = analysisOrigin.commitSha;
    } else {
      delete result.blueprint.commitSha;
    }
    if (analysisOrigin.branch) {
      result.blueprint.branch = analysisOrigin.branch;
    } else {
      delete result.blueprint.branch;
    }
    result.blueprint.analysisOrigin = analysisOrigin;
    return {
      blueprint: result.blueprint,
      origin: analysisOrigin,
      analysisId: result.analysisId ?? randomUUID(),
      filesAnalyzed: files.length,
      workspaceRoot,
    };
  } finally {
    activeAnalyzeCount = Math.max(0, activeAnalyzeCount - 1);
  }
}
