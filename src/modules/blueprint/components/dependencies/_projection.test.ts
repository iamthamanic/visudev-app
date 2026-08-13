/**
 * Tests for dependencies graph projection and evidence lookup.
 */

import { describe, expect, it } from "vitest";
import type { SoftwareGraph } from "../../types";
import {
  applyOrphanFilter,
  buildDependenciesGraphIndex,
  filterDependenciesProjection,
  findEdgeEvidence,
  getEdgeEvidenceFromIndex,
  getNodeDependencySummaryFromIndex,
  projectDependenciesGraph,
} from "./_projection.js";

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

describe("projectDependenciesGraph", () => {
  it("projects dependency edge kinds and endpoint nodes", () => {
    const graph = makeGraph({
      nodes: [
        { id: "file:a", kind: "file", label: "a.ts", metadata: {} },
        { id: "file:b", kind: "file", label: "b.ts", metadata: {} },
        { id: "svc:x", kind: "service", label: "svc", metadata: {} },
      ],
      edges: [
        { id: "e-import", kind: "imports", sourceId: "file:a", targetId: "file:b", metadata: {} },
        { id: "e-api", kind: "api", sourceId: "file:a", targetId: "svc:x", metadata: {} },
        { id: "e-contains", kind: "contains", sourceId: "file:a", targetId: "svc:x", metadata: {} },
      ],
    });

    const projected = projectDependenciesGraph(graph);

    expect(projected.edges.map((edge) => edge.id).sort()).toEqual(["e-api", "e-import"]);
    expect(projected.nodes.map((node) => node.id).sort()).toEqual(["file:a", "file:b", "svc:x"]);
    expect(projected.nodes[0].label).toContain("\n");
    expect(projected.edges[0].label).toBe("Imports");
  });

  it("filters edges by visible kinds independently", () => {
    const graph = makeGraph({
      nodes: [
        { id: "file:a", kind: "file", label: "a.ts", metadata: {} },
        { id: "file:b", kind: "file", label: "b.ts", metadata: {} },
      ],
      edges: [
        { id: "e-import", kind: "imports", sourceId: "file:a", targetId: "file:b", metadata: {} },
        { id: "e-call", kind: "calls", sourceId: "file:b", targetId: "file:a", metadata: {} },
      ],
    });

    const importsOnly = projectDependenciesGraph(graph, {
      visibleEdgeKinds: new Set(["imports"]),
    });
    expect(importsOnly.edges).toHaveLength(1);
    expect(importsOnly.edges[0].kind).toBe("imports");

    const none = projectDependenciesGraph(graph, { visibleEdgeKinds: new Set() });
    expect(none.edges).toHaveLength(0);
    expect(none.nodes).toHaveLength(2);
    expect(none.orphanNodeIds).toEqual(["file:a", "file:b"]);
  });

  it("includes isolated nodes as orphans", () => {
    const graph = makeGraph({
      nodes: [
        { id: "file:a", kind: "file", label: "a.ts", metadata: {} },
        { id: "file:b", kind: "file", label: "b.ts", metadata: {} },
        { id: "file:c", kind: "file", label: "c.ts", metadata: {} },
      ],
      edges: [
        { id: "e-import", kind: "imports", sourceId: "file:a", targetId: "file:b", metadata: {} },
      ],
    });

    const projected = projectDependenciesGraph(graph);
    expect(projected.nodes.map((node) => node.id).sort()).toEqual(["file:a", "file:b", "file:c"]);
    expect(projected.orphanNodeIds).toEqual(["file:c"]);
    expect(projected.nodes.find((node) => node.id === "file:c")?.color).toBe(
      "var(--color-muted-foreground)",
    );
    expect(projected.nodes.find((node) => node.id === "file:a")?.color).toBeUndefined();
  });
});

describe("filterDependenciesProjection", () => {
  it("filters nodes and connected edges by search query", () => {
    const projection = {
      nodes: [
        { id: "file:a", label: "a.ts\nDatei", kind: "file" },
        { id: "file:b", label: "b.ts\nDatei", kind: "file" },
      ],
      edges: [{ id: "e1", source: "file:a", target: "file:b", kind: "imports", label: "Imports" }],
      orphanNodeIds: [],
    };

    const filtered = filterDependenciesProjection(
      projection,
      "b.ts",
      makeGraph({
        nodes: [
          { id: "file:a", kind: "file", label: "a.ts", metadata: {} },
          { id: "file:b", kind: "file", label: "b.ts", metadata: {} },
        ],
      }),
    );
    expect(filtered.nodes).toHaveLength(2);
    expect(filtered.edges).toHaveLength(1);

    const empty = filterDependenciesProjection(
      projection,
      "missing-module",
      makeGraph({
        nodes: [
          { id: "file:a", kind: "file", label: "a.ts", metadata: {} },
          { id: "file:b", kind: "file", label: "b.ts", metadata: {} },
        ],
      }),
    );
    expect(empty.nodes).toHaveLength(0);

    const isolated = filterDependenciesProjection(
      {
        nodes: [{ id: "file:z", label: "z.ts\nDatei", kind: "file" }],
        edges: [],
        orphanNodeIds: ["file:z"],
      },
      "z.ts",
      makeGraph({ nodes: [{ id: "file:z", kind: "file", label: "z.ts", metadata: {} }] }),
    );
    expect(isolated.nodes).toHaveLength(1);
    expect(isolated.orphanNodeIds).toEqual(["file:z"]);
  });
});

describe("applyOrphanFilter", () => {
  it("hides orphan nodes when the toggle is off", () => {
    const projection = {
      nodes: [
        { id: "file:a", label: "a.ts\nDatei", kind: "file" },
        {
          id: "file:c",
          label: "c.ts\nDatei",
          kind: "file",
          color: "var(--color-muted-foreground)",
        },
      ],
      edges: [{ id: "e1", source: "file:a", target: "file:b", kind: "imports", label: "Imports" }],
      orphanNodeIds: ["file:c"],
    };

    const hidden = applyOrphanFilter(projection, false);
    expect(hidden.nodes.map((node) => node.id)).toEqual(["file:a"]);
    expect(hidden.orphanNodeIds).toEqual([]);
    expect(applyOrphanFilter(projection, true)).toBe(projection);
  });
});

describe("findEdgeEvidence", () => {
  it("returns evidence linked by fact id metadata", () => {
    const graph = makeGraph({
      edges: [
        {
          id: "e1",
          kind: "imports",
          sourceId: "file:a",
          targetId: "file:b",
          metadata: { evidenceFactId: "fact-1" },
        },
      ],
      evidence: [
        {
          id: "ev-1",
          factId: "fact-1",
          kind: "ast-import",
          filePath: "src/a.ts",
          line: 3,
          excerpt: "import x from './b'",
        },
      ],
    });

    const result = findEdgeEvidence(graph, "e1");
    expect(result?.edge.id).toBe("e1");
    expect(result?.evidence).toHaveLength(1);
    expect(result?.evidence[0].excerpt).toContain("import");
  });

  it("returns null when edge id is missing", () => {
    const graph = makeGraph();
    expect(findEdgeEvidence(graph, null)).toBeNull();
    expect(findEdgeEvidence(graph, "missing")).toBeNull();
  });
});

describe("buildDependenciesGraphIndex", () => {
  it("indexes node summaries and edge evidence in one pass", () => {
    const graph = makeGraph({
      nodes: [
        { id: "file:a", kind: "file", label: "a.ts", metadata: {} },
        { id: "file:b", kind: "file", label: "b.ts", metadata: {} },
      ],
      edges: [
        {
          id: "e1",
          kind: "imports",
          sourceId: "file:a",
          targetId: "file:b",
          metadata: { evidenceFactId: "fact-1" },
        },
        { id: "e2", kind: "calls", sourceId: "file:b", targetId: "file:a", metadata: {} },
      ],
      evidence: [
        {
          id: "ev-1",
          factId: "fact-1",
          kind: "ast-import",
          filePath: "src/a.ts",
          line: 1,
          excerpt: "import './b'",
        },
      ],
    });

    const index = buildDependenciesGraphIndex(graph);
    const summaryA = getNodeDependencySummaryFromIndex(index, "file:a");
    expect(summaryA.outgoing).toBe(1);
    expect(summaryA.incoming).toBe(1);

    const evidence = getEdgeEvidenceFromIndex(index, "e1");
    expect(evidence?.evidence).toHaveLength(1);
    expect(index.nodeById.get("file:b")?.label).toBe("b.ts");
  });
});
