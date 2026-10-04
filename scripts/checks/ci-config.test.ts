/**
 * Guards the CI job boundaries that keep demo enrichment out of real analyzer checks.
 * Location: scripts/checks/ci-config.test.ts
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  fileURLToPath(new URL("../../.github/workflows/ci.yml", import.meta.url)),
  "utf8",
);
const realAuditWorkflow = readFileSync(
  fileURLToPath(new URL("../../.github/workflows/real-visual-audit.yml", import.meta.url)),
  "utf8",
);
const workflowLines = workflow.split("\n");

function getJobBlock(jobName: string): string {
  const start = workflowLines.findIndex((line) => line === `  ${jobName}:`);
  if (start < 0) {
    throw new Error(`CI job not found: ${jobName}`);
  }

  const nextJobOffset = workflowLines
    .slice(start + 1)
    .findIndex((line) => /^  [a-z0-9-]+:$/.test(line));
  const end = nextJobOffset < 0 ? workflowLines.length : start + 1 + nextJobOffset;
  return workflowLines.slice(start, end).join("\n");
}

describe("CI workflow", () => {
  it("quality job does not enable demo enrichment", () => {
    expect(getJobBlock("quality")).not.toContain("DEMO_ENRICHMENT");
  });

  it("golden-set job does not enable demo enrichment", () => {
    expect(getJobBlock("golden-set")).not.toContain("DEMO_ENRICHMENT");
  });

  it("e2e-demo job is explicitly named as demo path", () => {
    expect(getJobBlock("e2e-demo")).toContain("name: E2E (Playwright, Demo-Enrichment)");
  });

  it("DEMO_ENRICHMENT only appears inside the e2e-demo job (not workflow-level)", () => {
    const e2eBlock = getJobBlock("e2e-demo");
    const outsideE2e = workflow.replace(e2eBlock, "");
    expect(outsideE2e).not.toMatch(/DEMO_ENRICHMENT/);
    expect(e2eBlock).toMatch(/DEMO_ENRICHMENT/);
  });
});

describe("Real Visual Audit workflow (RVP-12 / Product Readiness harness)", () => {
  it("runs on every PR to main (not label-gated)", () => {
    expect(realAuditWorkflow).toContain("pull_request:");
    expect(realAuditWorkflow).not.toMatch(/if:\s*contains\(github\.event\.pull_request\.labels/);
    expect(realAuditWorkflow).not.toContain("visudev-gapclose");
  });

  it("forces enrichment OFF and routes audits through the readiness harness", () => {
    expect(realAuditWorkflow).toContain('VISUDEV_DEMO_ENRICHMENT: "false"');
    expect(realAuditWorkflow).toContain('VITE_BLUEPRINT_DEMO_ENRICHMENT: "false"');
    expect(realAuditWorkflow).toContain("Readiness Gate");
    expect(realAuditWorkflow).toContain("scripts/readiness/resolve-matrix.mjs");
    expect(realAuditWorkflow).toContain("scripts/readiness/run-project-gate.mjs");
    expect(realAuditWorkflow).toContain("upload-artifact");
    expect(realAuditWorkflow).toContain("golden-projects.manifest.json");
  });
});
