/**
 * Infrastructure coverage empty-state helpers (PR-15).
 */

import { describe, expect, it } from "vitest";
import { infrastructureCoverageEntry, infrastructureEmptyCopy } from "./infrastructure-coverage.js";
import type { BlueprintData } from "../../types";

const base: BlueprintData = {
  version: 1,
  routes: [],
  securityMatrix: [],
  findings: [],
  facts: [],
  filesAnalyzed: 10,
  totalFiles: 10,
};

describe("infrastructureCoverage", () => {
  it("reports ABSENT when scan complete with zero infra nodes", () => {
    const entry = infrastructureCoverageEntry(base, 0);
    expect(entry.capabilityId).toBe("infrastructure");
    expect(["ABSENT", "NOT_DETECTED", "UNKNOWN"]).toContain(entry.detection);
    const empty = infrastructureEmptyCopy(base, 0);
    expect(empty.titleDe.length).toBeGreaterThan(0);
    expect(empty.detection).toBe(entry.detection);
  });

  it("marks PARTIAL when file budget truncated", () => {
    const entry = infrastructureCoverageEntry({ ...base, filesAnalyzed: 2, totalFiles: 100 }, 0);
    expect(entry.coverage).toBe("PARTIAL");
  });
});
