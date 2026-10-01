import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SoftwareGraph } from "../../types";
import { projectAtlasGraph } from "./_projection.js";
import { useAtlasSelection } from "./useAtlasSelection.js";

function semanticGraph(): SoftwareGraph {
  return {
    version: 1,
    projectId: "selection-test",
    analyzedAt: "2026-08-16T00:00:00.000Z",
    scopes: [],
    nodes: [
      { id: "app", kind: "application", label: "Habit App", metadata: {} },
      {
        id: "route",
        kind: "route",
        label: "GET /api/habits",
        filePath: "src/habits/routes.ts",
        metadata: { path: "/api/habits" },
      },
      {
        id: "service",
        kind: "service",
        label: "HabitService",
        filePath: "src/habits/service.ts",
        metadata: {},
      },
    ],
    edges: [{ id: "call", kind: "calls", sourceId: "route", targetId: "service", metadata: {} }],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 5000 },
  };
}

describe("useAtlasSelection", () => {
  it("routes a semantic domain node to its cluster inspector instead of a raw evidence node", () => {
    const graph = semanticGraph();
    const projection = projectAtlasGraph(graph);
    const { result } = renderHook(() => useAtlasSelection(graph, projection, "snapshot-1"));

    act(() => result.current.handleSelectNode("semantic:business-domain:habit"));

    expect(result.current.selectedNodeId).toBeNull();
    expect(result.current.selectedGroupId).toBe("atlas-domain:semantic:business-domain:habit");
    expect(result.current.selectedCluster?.label).toBe("Habit");
    expect(result.current.selectedNode).toBeNull();
  });
});
