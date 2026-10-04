/**
 * PR-04 capability coverage contract tests (#378).
 * Location: shared/scan-detector/capability-coverage.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  buildCapabilityCoverageReport,
  emptyStateFromCoverage,
} from "./application/capability-coverage.js";

describe("capability coverage report", () => {
  it("uses only COMPLETE/PARTIAL/UNAVAILABLE", () => {
    const report = buildCapabilityCoverageReport({
      projectId: "p1",
      analyzedAt: "2026-10-04T00:00:00.000Z",
      hasFacts: true,
      filesAnalyzed: 10,
      filesDiscovered: 10,
    });
    for (const entry of report.capabilities) {
      expect(["COMPLETE", "PARTIAL", "UNAVAILABLE"]).toContain(entry.coverage);
      expect(["ABSENT", "NOT_DETECTED", "UNSUPPORTED", "UNKNOWN", "CONFLICTED"]).toContain(
        entry.detection,
      );
    }
  });

  it("never marks COMPLETE when budget/timeout limits apply", () => {
    const budget = buildCapabilityCoverageReport({
      hasFacts: true,
      filesAnalyzed: 5,
      filesDiscovered: 20,
      transportCapped: true,
    });
    expect(budget.capabilities.every((entry) => entry.coverage !== "COMPLETE")).toBe(true);
    expect(budget.capabilities.some((entry) => entry.reason === "budget")).toBe(true);

    const timeout = buildCapabilityCoverageReport({
      hasFacts: true,
      limitedBy: "timeout",
    });
    expect(timeout.capabilities.every((entry) => entry.coverage !== "COMPLETE")).toBe(true);
  });

  it("distinguishes NOT_DETECTED empty state from ABSENT", () => {
    const report = buildCapabilityCoverageReport({
      hasFacts: false,
      runtimeAvailable: false,
      runtimeRequired: true,
    });
    const runtime = report.capabilities.find((entry) => entry.capabilityId === "appflowRuntime");
    expect(runtime?.coverage).toBe("UNAVAILABLE");
    expect(runtime?.detection).toBe("NOT_DETECTED");
    const empty = emptyStateFromCoverage(runtime!);
    expect(empty.bodyDe).toMatch(/nicht, dass nichts existiert/i);
  });

  it("marks unsupported capabilities as UNAVAILABLE/UNSUPPORTED", () => {
    const report = buildCapabilityCoverageReport({
      hasFacts: true,
      capabilitySupported: { data: false },
    });
    const data = report.capabilities.find((entry) => entry.capabilityId === "data");
    expect(data?.coverage).toBe("UNAVAILABLE");
    expect(data?.detection).toBe("UNSUPPORTED");
  });
});
