import { describe, expect, it } from "vitest";
import { projectInfrastructureGraph } from "./_projection";

describe("projectInfrastructureGraph", () => {
  it("projects compose services and datastore edges without files/routes", () => {
    const graph = projectInfrastructureGraph({
      version: 1,
      projectId: "p1",
      analyzedAt: "2026-01-01T00:00:00Z",
      scopes: [],
      evidence: [],
      groups: [],
      metrics: [],
      condensed: false,
      limits: { maxNodes: 2500, maxEdges: 5000 },
      nodes: [
        {
          id: "svc-api",
          kind: "service",
          label: "api",
          metadata: { source: "docker-compose" },
        },
        {
          id: "table-pg",
          kind: "table",
          label: "postgres",
          filePath: "docker-compose.yml",
          metadata: { source: "docker-compose" },
        },
        {
          id: "file-1",
          kind: "file",
          label: "app.ts",
          metadata: { runtime: "browser" },
        },
        {
          id: "route-1",
          kind: "route",
          label: "GET /",
          metadata: {},
        },
      ],
      edges: [
        {
          id: "e-data",
          kind: "data",
          sourceId: "svc-api",
          targetId: "table-pg",
          metadata: {},
        },
      ],
    });

    expect(graph.nodes.map((node) => node.id).sort()).toEqual(["svc-api", "table-pg"]);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]?.kind).toBe("data");
  });

  it("returns empty projection when only code nodes exist", () => {
    const graph = projectInfrastructureGraph({
      version: 1,
      projectId: "p1",
      analyzedAt: "2026-01-01T00:00:00Z",
      scopes: [],
      evidence: [],
      groups: [],
      metrics: [],
      condensed: false,
      limits: { maxNodes: 2500, maxEdges: 5000 },
      nodes: [
        {
          id: "file-a",
          kind: "file",
          label: "a.ts",
          metadata: { runtime: "edge" },
        },
      ],
      edges: [],
    });
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });
});
