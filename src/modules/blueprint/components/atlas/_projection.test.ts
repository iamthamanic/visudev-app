/** Tests for semantic Atlas projection and progressive disclosure. */

import { describe, expect, it } from "vitest";
import { projectAtlasGraph } from "./_projection";
import type { SoftwareGraph } from "../../types";

function makeGraph(): SoftwareGraph {
  return {
    version: 1,
    projectId: "p1",
    analyzedAt: "2026-01-01T00:00:00.000Z",
    scopes: [],
    nodes: [
      { id: "app", kind: "application", label: "Habit Tracker", metadata: {} },
      {
        id: "route-habits",
        kind: "route",
        label: "GET /api/habits",
        filePath: "src/habits/routes.ts",
        metadata: { path: "/api/habits" },
      },
      {
        id: "habit-service",
        kind: "service",
        label: "HabitService",
        filePath: "src/habits/habit-service.ts",
        metadata: {},
      },
      {
        id: "habit-file",
        kind: "file",
        label: "habit.ts",
        filePath: "src/habits/habit.ts",
        metadata: {},
      },
    ],
    edges: [
      {
        id: "route-call",
        kind: "calls",
        sourceId: "route-habits",
        targetId: "habit-service",
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

describe("projectAtlasGraph", () => {
  it("shows application and business-domain districts instead of routes/files", () => {
    const projection = projectAtlasGraph(makeGraph());
    expect(projection.nodes.map((node) => node.label)).toEqual(
      expect.arrayContaining(["Habit Tracker", "Habit"]),
    );
    expect(projection.nodes.some((node) => node.label.startsWith("GET "))).toBe(false);
    expect(projection.nodes.some((node) => node.kind === "file")).toBe(false);
    expect(projection.groups.some((group) => group.label === "Habit")).toBe(true);
    expect(
      projection.groups.find((group) => group.label === "Habit")?.nodeIds,
    ).toContain("habit-file");
  });

  it("reveals semantic services through search without promoting raw files", () => {
    const projection = projectAtlasGraph(makeGraph(), { searchQuery: "HabitService" });
    expect(projection.nodes).toHaveLength(1);
    expect(projection.nodes[0]).toMatchObject({ id: "habit-service", kind: "service" });
  });

  it("caps large semantic overviews at forty objects", () => {
    const graph = makeGraph();
    graph.nodes.push(
      ...Array.from({ length: 60 }, (_, index) => ({
        id: `service-${index}`,
        kind: "service" as const,
        label: `Area${index}Service`,
        filePath: `src/area-${index}/service.ts`,
        metadata: {},
      })),
    );
    const projection = projectAtlasGraph(graph);
    expect(projection.condensed).toBe(true);
    expect(projection.visibleNodes).toBeLessThanOrEqual(40);
    expect(projection.nodes.every((node) => node.kind !== "route" && node.kind !== "file")).toBe(
      true,
    );
  });
});
