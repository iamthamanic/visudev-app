/**
 * SDE-08 Blueprint analysis mode + projection cutover tests.
 */

import { describe, expect, it } from "vitest";
import type { SoftwareGraph } from "../software-graph.types.js";
import {
  parseBlueprintAnalysisMode,
  resolveBlueprintAnalysis,
  softwareGraphFromBlueprintProjection,
  projectBlueprintReadModel,
  softwareGraphToScanFacts,
  type ScanSnapshot,
} from "./index.js";

function sampleGraph(): SoftwareGraph {
  return {
    version: 1,
    projectId: "demo",
    analyzedAt: "2026-10-02T00:00:00.000Z",
    scopes: [],
    nodes: [
      {
        id: "mod:a",
        kind: "module",
        label: "A",
        filePath: "src/a.ts",
        line: 1,
        metadata: { domain: "core" },
      },
      {
        id: "mod:b",
        kind: "module",
        label: "B",
        metadata: {},
      },
    ],
    edges: [
      {
        id: "e1",
        kind: "imports",
        sourceId: "mod:a",
        targetId: "mod:b",
        metadata: {},
      },
    ],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 5000 },
  };
}

describe("blueprint analysis mode (SDE-08)", () => {
  it("parses mode strings with shadow default", () => {
    expect(parseBlueprintAnalysisMode(undefined)).toBe("shadow");
    expect(parseBlueprintAnalysisMode("")).toBe("shadow");
    expect(parseBlueprintAnalysisMode("legacy")).toBe("legacy");
    expect(parseBlueprintAnalysisMode("ENGINE")).toBe("engine");
    expect(parseBlueprintAnalysisMode("nope")).toBe("shadow");
  });

  it("legacy mode returns legacy graph without engine work", () => {
    const legacy = sampleGraph();
    const result = resolveBlueprintAnalysis({ mode: "legacy", legacyGraph: legacy });
    expect(result.graph).toBe(legacy);
    expect(result.engineGraph).toBeNull();
    expect(result.parity).toBeNull();
    expect(result.source).toBe("legacy");
    expect(result.fallbackUsed).toBe(false);
  });

  it("shadow mode renders legacy and compares engine projection", () => {
    const legacy = sampleGraph();
    const result = resolveBlueprintAnalysis({
      mode: "shadow",
      legacyGraph: legacy,
      enrichment: "off",
    });
    expect(result.graph).toBe(legacy);
    expect(result.engineGraph).not.toBeNull();
    expect(result.parity?.status).toBe("pass");
    expect(result.source).toBe("legacy");
    expect(result.engineGraph?.nodes.map((n) => n.id).sort()).toEqual(["mod:a", "mod:b"]);
    expect(result.engineGraph?.nodes.find((n) => n.id === "mod:a")?.metadata).toEqual({
      domain: "core",
    });
  });

  it("engine mode uses projection-materialized graph when complete", () => {
    const legacy = sampleGraph();
    const result = resolveBlueprintAnalysis({ mode: "engine", legacyGraph: legacy });
    expect(result.fallbackUsed).toBe(false);
    expect(result.source).toBe("engine-projection");
    expect(result.graph).toBe(result.engineGraph);
    expect(result.parity?.status).toBe("pass");
    expect(result.graph.nodes).toHaveLength(2);
    expect(result.graph.edges).toHaveLength(1);
  });

  it("materializes SoftwareGraph only from projection read models", () => {
    const legacy = sampleGraph();
    const bundle = softwareGraphToScanFacts(legacy);
    const snapshot: ScanSnapshot = {
      version: 1,
      projectId: legacy.projectId,
      analyzedAt: legacy.analyzedAt,
      enrichment: "off",
      repo: {},
      versions: {
        engineVersion: "0.1.0",
        modelVersions: {},
        detectorVersions: {},
      },
      capabilities: [],
      facts: bundle.facts,
      evidence: bundle.evidence,
    };
    const projection = projectBlueprintReadModel({
      snapshot,
      scope: { projectId: "demo" },
      options: { limit: 2000 },
    });
    const graph = softwareGraphFromBlueprintProjection(projection);
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(["mod:a", "mod:b"]);
    expect(graph.edges[0]?.kind).toBe("imports");
  });
});
