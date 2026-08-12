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
});
