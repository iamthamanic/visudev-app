/**
 * Aggregate five-project V1 certification report (PR-18).
 * Location: scripts/readiness/aggregate-certification.mjs
 *
 * V1 PASS when:
 * - Every project with gate.mode === "full" that had source available reports PASS
 * - No full-mode FAIL reports
 * - At least `minFullPass` (default 3) full PASS projects
 * - All five golden project reports are present (identity matrix complete)
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadReadinessManifest } from "./load-manifest.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const dirIdx = argv.indexOf("--dir");
  const outIdx = argv.indexOf("--out");
  if (dirIdx < 0 || !argv[dirIdx + 1]) {
    throw new Error(
      "Usage: node scripts/readiness/aggregate-certification.mjs --dir <reports-root> [--out <file>]",
    );
  }
  return {
    dir: path.resolve(argv[dirIdx + 1]),
    out: outIdx >= 0 ? path.resolve(argv[outIdx + 1]) : null,
  };
}

/**
 * @param {object} manifest
 * @param {Array<object>} reports
 */
export function evaluateV1Certification(manifest, reports) {
  const projects = Array.isArray(manifest.projects) ? manifest.projects : [];
  const byId = new Map(reports.map((report) => [report.projectId, report]));
  const missing = [];
  const rows = [];

  for (const project of projects) {
    const report = byId.get(project.id);
    if (!report) {
      missing.push(project.id);
      rows.push({
        projectId: project.id,
        mode: project.gate?.mode || null,
        verdict: "MISSING",
        certificationRole: project.gate?.mode === "full" ? "required-full" : "identity",
      });
      continue;
    }
    rows.push({
      projectId: project.id,
      mode: report.mode,
      verdict: report.verdict,
      verdictReason: report.verdictReason || null,
      hardGates: report.hardGates || null,
      certificationRole: project.gate?.mode === "full" ? "required-full" : "identity",
    });
  }

  const fullRows = rows.filter((row) => row.certificationRole === "required-full");
  const fullPass = fullRows.filter((row) => row.verdict === "PASS");
  const fullFail = fullRows.filter((row) => row.verdict === "FAIL" || row.verdict === "MISSING");
  const configuredMin = Number(manifest.certification?.minFullPass);
  const minFullPass =
    Number.isFinite(configuredMin) && configuredMin > 0
      ? configuredMin
      : Math.max(1, fullRows.length);

  const identityComplete = missing.length === 0 && rows.length === projects.length;
  const hardGateFails = reports.filter(
    (report) => report.hardGates && report.hardGates.passed === false,
  );

  let verdict = "PASS";
  const reasons = [];
  if (!identityComplete) {
    verdict = "FAIL";
    reasons.push(`missing project reports: ${missing.join(", ")}`);
  }
  if (fullFail.length > 0) {
    verdict = "FAIL";
    reasons.push(
      `full certification failures: ${fullFail.map((row) => `${row.projectId}=${row.verdict}`).join(", ")}`,
    );
  }
  if (fullPass.length < minFullPass) {
    verdict = "FAIL";
    reasons.push(`need ≥${minFullPass} full PASS projects, got ${fullPass.length}`);
  }
  if (hardGateFails.length > 0) {
    verdict = "FAIL";
    reasons.push(
      `hard gate failures: ${hardGateFails.map((report) => report.projectId).join(", ")}`,
    );
  }

  return {
    version: 1,
    epic: manifest.epic ?? 374,
    feature: "v1-readiness-certification",
    verdict,
    reasons,
    minFullPass,
    identityComplete,
    fullPassCount: fullPass.length,
    projects: rows,
    hardGates: {
      evidenceKnowledgeStatus: "delegated-to-full-audit-semantics",
      consoleClean: "required-on-full-reports",
      noSilentTruthTruncation: "required-on-full-reports",
      noFabricatedFacts: "required-on-full-audit-semantics",
    },
  };
}

async function loadReports(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const reports = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidates = [path.join(dir, entry.name, "readiness-project-report.json")];
    // GitHub Actions download-artifact keeps the artifact name prefix.
    if (entry.name.startsWith("real-visual-audit-")) {
      candidates.push(path.join(dir, entry.name, "readiness-project-report.json"));
    }
    for (const reportPath of candidates) {
      try {
        const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
        if (report?.projectId) {
          reports.push(report);
          break;
        }
      } catch {
        // try next candidate
      }
    }
  }
  return reports;
}

async function main() {
  const { dir, out } = parseArgs(process.argv.slice(2));
  const manifest = loadReadinessManifest();
  const reports = await loadReports(dir);
  const aggregate = evaluateV1Certification(manifest, reports);
  const outPath = out || path.join(dir, "readiness-certification-report.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(aggregate, null, 2));
  console.log(
    `[v1-certification] verdict=${aggregate.verdict} fullPass=${aggregate.fullPassCount} → ${outPath}`,
  );
  if (aggregate.verdict !== "PASS") {
    console.error(aggregate.reasons.join("\n"));
    process.exit(1);
  }
}

const isMain =
  process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}
