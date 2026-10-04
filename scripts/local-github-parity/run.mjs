/**
 * Local/GitHub parity gate — validates manifest (≥2 GitHub projects) and runs unit suite.
 * Location: scripts/local-github-parity/run.mjs
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = join(root, ".qa/readiness/golden-projects.manifest.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const parityProjects = (manifest.projects ?? []).filter(
  (project) => project?.parity?.enabled === true && project?.source?.kind === "github",
);

if (parityProjects.length < 2) {
  console.error(
    `[parity:local-github] need ≥2 GitHub projects with parity.enabled, found ${parityProjects.length}`,
  );
  process.exit(1);
}

console.log(
  `[parity:local-github] projects: ${parityProjects.map((project) => project.id).join(", ")}`,
);

const result = spawnSync(
  "npx",
  [
    "vitest",
    "run",
    "shared/scan-detector/local-github-parity.test.ts",
    "shared/scan-detector/cloud-cutover.test.ts",
  ],
  { cwd: root, stdio: "inherit", env: process.env },
);

process.exit(result.status ?? 1);
