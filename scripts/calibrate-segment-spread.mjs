/**
 * One-shot calibration: build SegmentSpreadIndex from analyzer-visible paths
 * (same prioritize + FILE_LIMIT as blueprint-local) for each visudev-test-repo.
 * Location: scripts/calibrate-segment-spread.mjs
 */

import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
/** Cloned fixtures live beside Visudevfigma in the workspace. */
const testReposRoot = path.resolve(repoRoot, "..", "visudev-test-repos");
/** Evidence is tracked inside Visudevfigma so the PR can ship the table. */
const evidencePath = path.join(
  repoRoot,
  "visudev-test-repos",
  "evidence",
  "segment-spread-calibration-2026-08-12.md",
);
const evidenceMirrorPath = path.join(
  testReposRoot,
  "evidence",
  "segment-spread-calibration-2026-08-12.md",
);

const SKIP = new Set(["evidence", "_references", "scripts", "README.md", "manifest.json"]);

async function listRepoDirs() {
  const entries = await readdir(testReposRoot, { withFileTypes: true });
  const names = [];
  for (const entry of entries) {
    if (SKIP.has(entry.name) || entry.name.startsWith(".")) continue;
    const full = path.join(testReposRoot, entry.name);
    try {
      const st = await stat(full);
      if (st.isDirectory()) names.push(entry.name);
    } catch {
      // skip unreadable entries
    }
  }
  return names.sort((a, b) => a.localeCompare(b));
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function main() {
  const blueprintUrl = pathToFileURL(
    path.join(repoRoot, "preview-runner/lib/blueprint-local.js"),
  ).href;
  const spreadUrl = pathToFileURL(
    path.join(repoRoot, "local-engine/src/services/software-graph/_segment-spread.ts"),
  ).href;
  const blueprint = await import(blueprintUrl);
  const { buildSegmentSpreadIndex, MAX_SPREAD_FOR_DOMAIN, MIN_SIBLING_DOMAINS, isDomainCandidate } =
    await import(spreadUrl);

  const {
    prioritizeBlueprintFiles,
    applyFileLimitWithSeeds,
    collectCriticalSeedRelPaths,
    walkCodeFiles,
    FILE_LIMIT,
  } = blueprint;

  const repos = await listRepoDirs();
  const lines = [];
  lines.push("# Segment-spread calibration — 2026-08-12");
  lines.push("");
  lines.push("Paths = analyzer-visible set after `prioritizeBlueprintFiles` + `FILE_LIMIT`");
  lines.push(`(FILE_LIMIT=${FILE_LIMIT}), Enrichment OFF — same catalog as blueprint-local.`);
  lines.push("");
  lines.push("## Thresholds chosen");
  lines.push("");
  lines.push(`- \`MAX_SPREAD_FOR_DOMAIN = ${MAX_SPREAD_FOR_DOMAIN}\``);
  lines.push(`- \`MIN_SIBLING_DOMAINS = ${MIN_SIBLING_DOMAINS}\``);
  lines.push("");
  lines.push(
    "Rationale: domain folders (e.g. browo `leaves`/`payroll`, erpnext `accounts`/`stock`) ",
  );
  lines.push(
    "usually have parentSpread ≤ 2 and sit beside ≥2 sibling dirs; repeated layer folders ",
  );
  lines.push(
    "(`models`/`controllers` in discourse) show parentSpread ≥ 2–many. Modules/app/backend ",
  );
  lines.push(
    "may still look domain-like by siblings alone — P0-10 must combine path position with these thresholds.",
  );
  lines.push("");

  function collectAnalyzerPaths(workspaceRoot) {
    const seedRelPaths = collectCriticalSeedRelPaths(workspaceRoot);
    const walkedAbs = walkCodeFiles(workspaceRoot);
    const walkedRel = walkedAbs.map((abs) => path.relative(workspaceRoot, abs).replace(/\\/g, "/"));
    const merged = [...new Set([...seedRelPaths, ...walkedRel])];
    const prioritized = prioritizeBlueprintFiles(merged);
    return applyFileLimitWithSeeds(prioritized, seedRelPaths, FILE_LIMIT);
  }

  for (const name of repos) {
    const localPath = path.join(testReposRoot, name);
    let paths;
    try {
      paths = collectAnalyzerPaths(localPath);
    } catch (error) {
      lines.push(`## ${name}`);
      lines.push("");
      lines.push(`_Skipped: ${error instanceof Error ? error.message : String(error)}_`);
      lines.push("");
      continue;
    }
    if (!paths.length) {
      lines.push(`## ${name}`);
      lines.push("");
      lines.push("_Skipped: no analyzable files_");
      lines.push("");
      continue;
    }
    const index = buildSegmentSpreadIndex(paths);
    const top = [...index.byKey.values()]
      .sort((a, b) => b.fileCount - a.fileCount || a.key.localeCompare(b.key))
      .slice(0, 10);
    const siblingMedians = top.map((e) => e.medianSiblings);
    lines.push(`## ${name}`);
    lines.push("");
    lines.push(`- files analyzed (capped): ${paths.length}`);
    lines.push(`- distinct segments: ${index.byKey.size}`);
    lines.push(`- top-10 median-of-medianSiblings: ${median(siblingMedians)}`);
    lines.push("");
    lines.push("| segment | files | spread | medianSiblings | domainCandidate? |");
    lines.push("|---|---:|---:|---:|:---:|");
    for (const entry of top) {
      const cand = isDomainCandidate(entry) ? "yes" : "no";
      lines.push(
        `| \`${entry.label}\` | ${entry.fileCount} | ${entry.parentSpread} | ${entry.medianSiblings} | ${cand} |`,
      );
    }
    lines.push("");
  }

  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, lines.join("\n"), "utf8");
  try {
    await mkdir(path.dirname(evidenceMirrorPath), { recursive: true });
    await writeFile(evidenceMirrorPath, lines.join("\n"), "utf8");
  } catch {
    // Mirror is optional when the sibling fixtures tree is absent.
  }
  console.log(`wrote ${evidencePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
