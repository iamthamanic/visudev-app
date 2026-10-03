/**
 * SDE-15 Blueprint analysis mode + projection cutover tests (engine authority).
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

describe("blueprint analysis mode (SDE-15)", () => {
  it("always parses to engine (legacy/shadow retired)", () => {
    expect(parseBlueprintAnalysisMode(undefined)).toBe("engine");
    expect(parseBlueprintAnalysisMode("")).toBe("engine");
    expect(parseBlueprintAnalysisMode("legacy")).toBe("engine");
    expect(parseBlueprintAnalysisMode("shadow")).toBe("engine");
    expect(parseBlueprintAnalysisMode("ENGINE")).toBe("engine");
    expect(parseBlueprintAnalysisMode("nope")).toBe("engine");
  });

  it("retired modes still resolve via engine projection", () => {
    const legacy = sampleGraph();
    const asLegacy = resolveBlueprintAnalysis({ mode: "engine", legacyGraph: legacy });
    const asShadow = resolveBlueprintAnalysis({ mode: "engine", legacyGraph: legacy });
    expect(asLegacy.source).toBe("engine-projection");
    expect(asShadow.source).toBe("engine-projection");
    expect(asLegacy.graph).toBe(asLegacy.engineGraph);
    expect(asLegacy.parity).toBeNull();
  });

  it("engine mode uses projection-materialized graph when complete", () => {
    const legacy = sampleGraph();
    const result = resolveBlueprintAnalysis({ mode: "engine", legacyGraph: legacy });
    expect(result.fallbackUsed).toBe(false);
    expect(result.source).toBe("engine-projection");
    expect(result.graph).toBe(result.engineGraph);
    expect(result.graph.nodes).toHaveLength(2);
    expect(result.graph.edges).toHaveLength(1);
    expect(result.engineGraph?.nodes.find((n) => n.id === "mod:a")?.metadata).toEqual({
      domain: "core",
    });
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
