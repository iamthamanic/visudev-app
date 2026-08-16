import { describe, expect, it } from "vitest";
import type { BlueprintData, SoftwareGraph } from "./types";
import {
  canonicalMetricsFromBlueprint,
  computeCanonicalBlueprintMetrics,
} from "./blueprint-metrics";

function graphFixture(): SoftwareGraph {
  return {
    version: 1,
    projectId: "metrics",
    analyzedAt: "2026-08-15T00:00:00.000Z",
    scopes: [],
    nodes: [
      { id: "module", kind: "module", label: "Module", metadata: {} },
      { id: "domain", kind: "domain", label: "Domain", metadata: {} },
      { id: "service", kind: "service", label: "Service", metadata: {} },
      { id: "route", kind: "route", label: "GET /", metadata: {} },
      { id: "file-a", kind: "file", label: "a.ts", metadata: {} },
      { id: "file-b", kind: "file", label: "b.ts", metadata: {} },
    ],
    edges: [
      { id: "contains", kind: "contains", sourceId: "module", targetId: "file-a", metadata: {} },
      { id: "import", kind: "imports", sourceId: "file-a", targetId: "file-b", metadata: {} },
      { id: "call", kind: "calls", sourceId: "file-a", targetId: "service", metadata: {} },
    ],
    evidence: [],
    groups: [],
    metrics: [
      { id: "fake-module-scale", name: "modules", value: 561 },
      { id: "legacy-files-scale", name: "files", value: 5732 },
      { id: "coverage", name: "coverage", value: 82 },
    ],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 8000 },
  };
}

describe("computeCanonicalBlueprintMetrics", () => {
  it("uses exact node kinds for structural counters", () => {
    expect(computeCanonicalBlueprintMetrics(graphFixture())).toMatchObject({
      modules: 1,
      services: 1,
      domains: 1,
      routes: 1,
      dependencies: 2,
    });
  });

  it("does not let a legacy modules metric redefine module semantics", () => {
    expect(computeCanonicalBlueprintMetrics(graphFixture()).modules).toBe(1);
  });

  it("prefers explicit filesAnalyzed over a legacy graph file metric", () => {
    expect(
      computeCanonicalBlueprintMetrics(graphFixture(), { filesAnalyzed: 1872 }),
    ).toMatchObject({
      files: 1872,
      coveragePercent: 82,
    });
  });

  it("falls back to a graph file metric when explicit scan metadata is absent", () => {
    expect(computeCanonicalBlueprintMetrics(graphFixture()).files).toBe(5732);
  });

  it("keeps coverage unknown when the analyzer did not provide it", () => {
    const graph = graphFixture();
    graph.metrics = graph.metrics.filter((metric) => metric.name !== "coverage");
    expect(computeCanonicalBlueprintMetrics(graph).coveragePercent).toBeNull();
  });

  it("counts high and critical findings from BlueprintData", () => {
    const blueprint: BlueprintData = {
      graph: graphFixture(),
      findings: [
        { id: "high", ruleId: "a", category: "security", severity: "high", scopeId: "s", message: "x", expectedState: "x", actualState: "y", evidenceFactIds: [], confidence: 1 },
        { id: "critical", ruleId: "b", category: "security", severity: "critical", scopeId: "s", message: "x", expectedState: "x", actualState: "y", evidenceFactIds: [], confidence: 1 },
        { id: "low", ruleId: "c", category: "quality", severity: "low", scopeId: "s", message: "x", expectedState: "x", actualState: "y", evidenceFactIds: [], confidence: 1 },
      ],
      filesAnalyzed: 1872,
    };
    expect(canonicalMetricsFromBlueprint(blueprint)).toMatchObject({
      files: 1872,
      criticalFindings: 2,
    });
  });
});
