/**
 * Honest-Core: coveragePercent is null when the graph carries no real coverage
 * metric, and Atlas counters use the same canonical definitions as the footer.
 */

import { describe, it, expect } from "vitest";
import { computeAtlasStats } from "./atlas-stats";
import type { SoftwareGraph } from "../../types";

function baseGraph(metrics: SoftwareGraph["metrics"]): SoftwareGraph {
  return {
    version: 1,
    projectId: "p1",
    analyzedAt: "2026-01-01T00:00:00.000Z",
    scopes: [],
    nodes: [
      { id: "m1", kind: "module", label: "auth", metadata: {} },
      { id: "m2", kind: "module", label: "billing", metadata: {} },
      { id: "s1", kind: "service", label: "api", metadata: {} },
    ],
    edges: [],
    evidence: [],
    groups: [],
    metrics,
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 5000 },
  };
}

describe("computeAtlasStats", () => {
  it("returns coveragePercent null when no coverage metric exists", () => {
    const stats = computeAtlasStats(baseGraph([]), 0);
    expect(stats.coveragePercent).toBeNull();
  });

  it("returns real coveragePercent from metric, clamped to 100", () => {
    const stats = computeAtlasStats(baseGraph([{ id: "cov", name: "coverage", value: 87 }]), 0);
    expect(stats.coveragePercent).toBe(87);
  });

  it("clamps coverage metric above 100", () => {
    const stats = computeAtlasStats(baseGraph([{ id: "cov", name: "coverage", value: 140 }]), 0);
    expect(stats.coveragePercent).toBe(100);
  });

  it("never derives coverage from module/node ratio", () => {
    const stats = computeAtlasStats(baseGraph([]), 0);
    expect(stats.coveragePercent).not.toBe(67);
    expect(stats.coveragePercent).toBeNull();
  });

  it("does not let the legacy modules metric override exact module nodes", () => {
    const stats = computeAtlasStats(
      baseGraph([{ id: "legacy-modules", name: "modules", value: 561 }]),
      0,
    );
    expect(stats.modules).toBe(2);
  });
});
