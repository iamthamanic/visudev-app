/**
 * Emit GitHub Actions matrix JSON + readiness identity report for all golden projects.
 * Usage: node scripts/readiness/resolve-matrix.mjs [--out dir]
 * Location: scripts/readiness/resolve-matrix.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import { aggregateProjectVerdict, buildCapabilityReport } from "./capability-status.mjs";
import { loadReadinessManifest } from "./load-manifest.mjs";
import { resolveProjectSource } from "./resolve-project.mjs";

function parseArgs(argv) {
  const outIdx = argv.indexOf("--out");
  return {
    outDir: outIdx >= 0 ? path.resolve(argv[outIdx + 1] || "readiness-out") : null,
  };
}

async function main() {
  const { outDir } = parseArgs(process.argv.slice(2));
  const manifest = loadReadinessManifest();
  const projects = [];

  for (const project of manifest.projects) {
    const resolved = resolveProjectSource(project, process.env);
    const sourceRequired = Boolean(project.gate?.sourceRequiredInCi);
    // Pre-audit matrix report: identity + capability requirements only (no false FAIL/PASS).
    const rows = buildCapabilityReport(
      { ...project, gate: { ...project.gate, mode: "resolve" } },
      {
        sourceAvailable: resolved.available,
        runtimeSecretsPresent: false,
        runtimeExecuted: false,
      },
    );
    const aggregate = aggregateProjectVerdict(rows, {
      sourceAvailable: resolved.available,
      sourceRequired,
    });
    const identityStatus = resolved.available ? "RESOLVED" : "UNAVAILABLE";

    projects.push({
      id: project.id,
      displayName: project.displayName,
      gateMode: project.gate.mode,
      captureViews: Boolean(project.gate.captureViews),
      sourceRequiredInCi: sourceRequired,
      source: resolved,
      identityStatus,
      capabilities: rows,
      verdict: aggregate.verdict,
      verdictReason: aggregate.reason,
      assertionsProfile: project.assertions?.profile || null,
      // Matrix fields for actions/checkout
      checkoutRepository: resolved.kind === "github" ? `${resolved.owner}/${resolved.repo}` : null,
      checkoutRef: resolved.kind === "github" ? resolved.commitSha : null,
      skipFullAudit: project.gate.mode !== "full" || !resolved.available,
    });
  }

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    epic: manifest.epic,
    harnessIssue: manifest.harnessIssue,
    projectCount: projects.length,
    projects,
  };

  const matrix = {
    include: projects.map((project) => ({
      id: project.id,
      displayName: project.displayName,
      gateMode: project.gateMode,
      captureViews: project.captureViews,
      sourceKind: project.source.kind,
      checkoutRepository: project.checkoutRepository,
      checkoutRef: project.checkoutRef,
      sourceRequiredInCi: project.sourceRequiredInCi,
      skipFullAudit: project.skipFullAudit,
      pathEnv:
        project.source.kind === "local"
          ? project.source.pathEnv || "VISUDEV_READINESS_HABA_PATH"
          : "",
    })),
  };

  if (outDir) {
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(
      path.join(outDir, "readiness-matrix-report.json"),
      JSON.stringify(report, null, 2),
    );
    await fs.writeFile(path.join(outDir, "github-matrix.json"), JSON.stringify(matrix, null, 2));
  }

  // stdout: matrix only (for GITHUB_OUTPUT consumers)
  process.stdout.write(JSON.stringify(matrix));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
