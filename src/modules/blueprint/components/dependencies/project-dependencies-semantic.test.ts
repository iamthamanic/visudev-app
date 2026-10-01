/**
 * Tests for RVP-7 semantic Dependencies projection (density, aggregation, drill-down).
 */

import { describe, expect, it } from "vitest";
import type { SoftwareGraph } from "../../types";
import { resolveCytoscapeColor } from "../../../../components/graph-canvas/_styles.js";
import {
  DEPENDENCIES_SEMANTIC_MAX_NODES,
  projectDependenciesSemanticGraph,
} from "./project-dependencies-semantic.js";

function makeGraph(overrides: Partial<SoftwareGraph> = {}): SoftwareGraph {
  return {
    version: 1,
    projectId: "p1",
    analyzedAt: "2026-01-01T00:00:00.000Z",
    scopes: [],
    nodes: [],
    edges: [],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 5000 },
    ...overrides,
  };
}

describe("projectDependenciesSemanticGraph", () => {
  it("aggregates file edges onto semantic entities with weight and evidence backlinks", () => {
    const graph = makeGraph({
      nodes: [
        { id: "svc:a", kind: "service", label: "Auth", metadata: {} },
        { id: "svc:b", kind: "service", label: "Billing", metadata: {} },
        { id: "file:a1", kind: "file", label: "a1.ts", metadata: {} },
        { id: "file:b1", kind: "file", label: "b1.ts", metadata: {} },
      ],
      edges: [
        {
          id: "e1",
          kind: "imports",
          sourceId: "svc:a",
          targetId: "svc:b",
          metadata: {},
        },
        {
          id: "e2",
          kind: "calls",
          sourceId: "svc:a",
          targetId: "svc:b",
          metadata: {},
        },
        {
          id: "e3",
          kind: "imports",
          sourceId: "svc:a",
          targetId: "svc:b",
          metadata: {},
        },
      ],
    });

    const projected = projectDependenciesSemanticGraph(graph, { level: "semantic" });
    expect(projected.nodes.length).toBeLessThanOrEqual(DEPENDENCIES_SEMANTIC_MAX_NODES);
    expect(projected.nodes.some((node) => node.id.startsWith("semantic:"))).toBe(true);

    const edge = projected.edges.find((item) => item.source.includes("svc:a"));
    expect(edge).toBeDefined();
    expect(edge?.label).toMatch(/×3/);
    expect(edge?.label).toMatch(/\+/);
    expect(projected.underlyingEdgeIdsByEdgeId?.get(edge!.id)).toEqual(
      expect.arrayContaining(["e1", "e2", "e3"]),
    );
  });

  it("caps default overview density well below thousand-node walls", () => {
    const nodes = Array.from({ length: 200 }, (_, index) => ({
      id: `svc:${index}`,
      kind: "service" as const,
      label: `Svc ${index}`,
      metadata: {},
    }));
    const edges = Array.from({ length: 150 }, (_, index) => ({
      id: `e:${index}`,
      kind: "imports" as const,
      sourceId: `svc:${index}`,
      targetId: `svc:${(index + 1) % 200}`,
      metadata: {},
    }));

    const projected = projectDependenciesSemanticGraph(makeGraph({ nodes, edges }));
    expect(projected.nodes.length).toBeLessThanOrEqual(DEPENDENCIES_SEMANTIC_MAX_NODES);
    expect(projected.nodes.length).toBeLessThan(200);
  });

  it("drills down to file-level members for a focused semantic entity", () => {
    const graph = makeGraph({
      nodes: [
        { id: "svc:a", kind: "service", label: "Auth", metadata: {} },
        { id: "file:a1", kind: "file", label: "a1.ts", metadata: {} },
        { id: "file:other", kind: "file", label: "other.ts", metadata: {} },
      ],
      edges: [
        {
          id: "e-dep",
          kind: "imports",
          sourceId: "svc:a",
          targetId: "file:a1",
          metadata: {},
        },
      ],
    });

    const overview = projectDependenciesSemanticGraph(graph, { level: "semantic" });
    const focusId = overview.nodes.find((node) => node.id.includes("svc:a"))?.id;
    expect(focusId).toBeTruthy();

    const drilled = projectDependenciesSemanticGraph(graph, {
      level: "files",
      focusSemanticEntityId: focusId!,
    });
    expect(drilled.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["svc:a", "file:a1"]),
    );
    expect(drilled.nodes.map((node) => node.id)).not.toContain("file:other");
    expect(drilled.edges.some((edge) => edge.id === "e-dep")).toBe(true);
  });

  it("tracks orphan semantic entities separately", () => {
    const graph = makeGraph({
      nodes: [
        { id: "svc:a", kind: "service", label: "Auth", metadata: {} },
        { id: "svc:lonely", kind: "service", label: "Lonely", metadata: {} },
        { id: "svc:b", kind: "service", label: "Billing", metadata: {} },
      ],
      edges: [
        {
          id: "e1",
          kind: "imports",
          sourceId: "svc:a",
          targetId: "svc:b",
          metadata: {},
        },
      ],
    });

    const projected = projectDependenciesSemanticGraph(graph);
    expect(projected.orphanNodeIds.some((id) => id.includes("lonely"))).toBe(true);
    const orphan = projected.nodes.find((node) => node.id.includes("lonely"));
    expect(orphan?.color).toBe("var(--color-muted-foreground)");
  });
});

describe("resolveCytoscapeColor", () => {
  it("does not pass unresolved var() tokens when CSS vars are missing", () => {
    expect(resolveCytoscapeColor("var(--missing-token)")).toBeUndefined();
    expect(resolveCytoscapeColor("transparent")).toBe("transparent");
  });
});
