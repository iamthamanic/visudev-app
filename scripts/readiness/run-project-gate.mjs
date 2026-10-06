/**
 * Run Product Readiness gate for one golden project via the shared harness (#375).
 * full mode → delegates to scripts/real-visual-audit.mjs
 * resolve mode / unavailable optional source → writes UNAVAILABLE report (not PASS)
 * Location: scripts/readiness/run-project-gate.mjs
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertEpistemicArtifacts } from "./assert-epistemic-artifacts.mjs";
import { aggregateProjectVerdict, buildCapabilityReport } from "./capability-status.mjs";
import { getProject, loadReadinessManifest } from "./load-manifest.mjs";
import { resolveProjectSource } from "./resolve-project.mjs";
import { loadCapabilityResultsFromArtifacts } from "./surface-capability-results.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function parseArgs(argv) {
  const projectIdx = argv.indexOf("--project");
  if (projectIdx < 0 || !argv[projectIdx + 1]) {
    throw new Error("Usage: node scripts/readiness/run-project-gate.mjs --project <id>");
  }
  return { projectId: argv[projectIdx + 1] };
}

function runNodeScript(scriptPath, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptPath} exited with code ${code}`));
    });
  });
}

async function writeReport(outDir, report) {
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, "readiness-project-report.json"),
    JSON.stringify(report, null, 2),
  );
}

async function main() {
  const { projectId } = parseArgs(process.argv.slice(2));
  const manifest = loadReadinessManifest();
  const project = getProject(manifest, projectId);
  const outDir = path.resolve(process.env.VISUDEV_AUDIT_OUT || "audit-output");
  const resolved = resolveProjectSource(project, process.env);
  const sourceRequired = Boolean(project.gate?.sourceRequiredInCi);

  const baseRows = buildCapabilityReport(project, {
    sourceAvailable: resolved.available,
    runtimeSecretsPresent: Boolean(process.env.VISUDEV_AUDIT_RUNTIME_SECRETS),
    runtimeExecuted: false,
  });

  if (!resolved.available) {
    const aggregate = aggregateProjectVerdict(baseRows, {
      sourceAvailable: false,
      sourceRequired,
    });
    const report = {
      projectId,
      mode: project.gate.mode,
      source: resolved,
      capabilities: baseRows,
      verdict: aggregate.verdict,
      verdictReason: aggregate.reason,
      note: "Missing optional/local source reported as UNAVAILABLE — never PASS",
    };
    await writeReport(outDir, report);
    if (aggregate.verdict === "FAIL") {
      console.error(`Readiness gate FAIL for ${projectId}: ${aggregate.reason}`);
      process.exit(1);
    }
    console.log(`Readiness gate UNAVAILABLE for ${projectId}: ${aggregate.reason}`);
    process.exit(0);
  }

  if (project.gate.mode === "resolve") {
    const aggregate = aggregateProjectVerdict(baseRows, {
      sourceAvailable: true,
      sourceRequired,
    });
    // Identity resolved; do not claim capability PASS in resolve mode
    const report = {
      projectId,
      mode: "resolve",
      source: resolved,
      capabilities: baseRows,
      verdict: "UNAVAILABLE",
      verdictReason:
        aggregate.verdict === "FAIL"
          ? aggregate.reason
          : "resolve mode: identity pinned; full certification deferred (not PASS)",
      assertionsProfile: project.assertions?.profile || null,
    };
    await writeReport(outDir, report);
    console.log(
      `Readiness resolve OK for ${projectId} at ${
        resolved.commitSha || resolved.localPath
      } — capabilities UNAVAILABLE/SKIPPED (not PASS)`,
    );
    process.exit(0);
  }

  // full mode — existing hrkoordinator audit path through the same harness
  const targetPath = process.env.VISUDEV_AUDIT_TARGET
    ? path.resolve(process.env.VISUDEV_AUDIT_TARGET)
    : resolved.localPath;
  if (!targetPath) {
    throw new Error(`full gate for ${projectId} requires VISUDEV_AUDIT_TARGET or local path`);
  }

  await runNodeScript(path.join(repoRoot, "scripts/real-visual-audit.mjs"), {
    VISUDEV_AUDIT_TARGET: targetPath,
    VISUDEV_AUDIT_PROJECT_NAME: String(project.displayName || project.id),
    VISUDEV_AUDIT_REPOSITORY_URL: resolved.repositoryUrl || "",
    VISUDEV_AUDIT_OUT: outDir,
  });

  const epistemic = await assertEpistemicArtifacts(outDir);
  const { capabilityResults, surfaces } = await loadCapabilityResultsFromArtifacts(outDir, {
    includeAppflowData: true,
  });

  const passedRows = buildCapabilityReport(project, {
    sourceAvailable: true,
    runtimeSecretsPresent: Boolean(process.env.VISUDEV_AUDIT_RUNTIME_SECRETS),
    runtimeExecuted: false,
    capabilityResults,
  });
  const aggregate = aggregateProjectVerdict(passedRows, {
    sourceAvailable: true,
    sourceRequired: true,
  });
  const verdict = !epistemic.passed || aggregate.verdict === "FAIL" ? "FAIL" : aggregate.verdict;
  const verdictReason = !epistemic.passed
    ? `hard epistemic gates failed: ${epistemic.failures.join("; ")}`
    : aggregate.reason;

  await writeReport(outDir, {
    projectId,
    mode: "full",
    source: resolved,
    capabilities: passedRows,
    surfaces,
    hardGates: {
      passed: epistemic.passed,
      ...epistemic.hardGates,
      failures: epistemic.failures,
    },
    assertionsProfile: project.assertions?.profile || null,
    verdict,
    verdictReason,
    delegatedTo: "scripts/real-visual-audit.mjs",
  });
  if (verdict === "FAIL") {
    console.error(`Readiness gate FAIL for ${projectId}: ${verdictReason}`);
    process.exit(1);
  }
  console.log(`Readiness gate PASS for ${projectId}`);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  try {
    const outDir = path.resolve(process.env.VISUDEV_AUDIT_OUT || "audit-output");
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(
      path.join(outDir, "readiness-error.txt"),
      error instanceof Error ? `${error.stack || error.message}\n` : `${String(error)}\n`,
    );
  } catch {
    // preserve original failure
  }
  process.exit(1);
});
