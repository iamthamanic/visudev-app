/**
 * Tests for execution graph projection.
 */

import { describe, expect, it } from "vitest";
import type { SoftwareGraph } from "../../types";
import {
  listExecutionRoutes,
  projectExecutionGraph,
  computeStepTimings,
  computeExecutionMetrics,
  isExecutionLive,
  resolveStepDurationMs,
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

describe("projectExecutionGraph", () => {
  it("projects sequential pipeline edges left-to-right", () => {
    const graph = makeGraph({
      nodes: [
        {
          id: "route:users:get",
          kind: "route",
          label: "GET /users",
          scopeId: "file:handler",
          filePath: "src/routes/users.ts",
          line: 1,
          metadata: { routeId: "route:users:get" },
        },
        { id: "file:handler", kind: "file", label: "users.ts", metadata: {} },
        { id: "svc:db", kind: "service", label: "UserService", metadata: {} },
      ],
      groups: [
        {
          id: "execution:route:users:get:0",
          kind: "route",
          label: "GET /users · path 1",
          nodeIds: ["route:users:get", "file:handler", "svc:db"],
        },
      ],
    });

    const projected = projectExecutionGraph(graph, { routeId: "route:users:get" });
    expect(projected?.nodes).toHaveLength(3);
    expect(projected?.edges).toHaveLength(2);
    expect(projected?.edges[0].source).toBe("route:users:get");
    expect(projected?.edges[1].target).toBe("svc:db");
  });

  it("lists route selectors from graph nodes", () => {
    const graph = makeGraph({
      nodes: [
        {
          id: "route:a",
          kind: "route",
          label: "GET /a",
          metadata: { routeId: "route:a" },
        },
      ],
    });
    expect(listExecutionRoutes(graph)).toEqual([{ routeId: "route:a", label: "GET /a" }]);
  });

  it("prefers leave routes as default execution sample (P1-2)", () => {
    const graph = makeGraph({
      nodes: [
        {
          id: "route:audit",
          kind: "route",
          label: "GET /",
          filePath: "app/modules/audit-logs/audit-logs.routes.ts",
          metadata: { routeId: "GET /", path: "/" },
        },
        {
          id: "route:leave",
          kind: "route",
          label: "POST /api/leaves",
          filePath: "app/modules/leaves/leaves.routes.ts",
          metadata: { routeId: "POST /api/leaves", path: "/api/leaves" },
        },
      ],
    });
    expect(listExecutionRoutes(graph)[0]?.routeId).toBe("POST /api/leaves");
  });

  it("keeps non-leave route order unchanged when no leave routes (P1-2)", () => {
    const graph = makeGraph({
      nodes: [
        {
          id: "route:z",
          kind: "route",
          label: "GET /z",
          metadata: { routeId: "GET /z", path: "/z" },
        },
        {
          id: "route:a",
          kind: "route",
          label: "GET /a",
          metadata: { routeId: "GET /a", path: "/a" },
        },
      ],
    });
    expect(listExecutionRoutes(graph).map((r) => r.routeId)).toEqual(["GET /z", "GET /a"]);
  });

  it("computes step timings and metrics", () => {
    const graph = makeGraph({
      nodes: [
        {
          id: "route:users:get",
          kind: "route",
          label: "GET /users",
          metadata: { routeId: "route:users:get", durationMs: 20 },
        },
        { id: "file:handler", kind: "file", label: "users.ts", metadata: { durationMs: 30 } },
      ],
      groups: [
        {
          id: "execution:route:users:get:0",
          kind: "route",
          label: "GET /users · path 1",
          nodeIds: ["route:users:get", "file:handler"],
        },
      ],
    });

    const projected = projectExecutionGraph(graph, { routeId: "route:users:get" });
    const timings = computeStepTimings(graph, projected!.stepNodeIds);
    expect(timings).toEqual([
      { nodeId: "route:users:get", durationMs: 20, startMs: 0, endMs: 20 },
      { nodeId: "file:handler", durationMs: 30, startMs: 20, endMs: 50 },
    ]);

    const metrics = computeExecutionMetrics(projected, graph);
    expect(metrics).toEqual({
      totalDurationMs: 50,
      stepCount: 2,
      errorCount: 0,
      warningCount: 0,
      serviceCount: 0,
      dbCount: 0,
      eventCount: 0,
      payloadCount: 0,
    });
  });

  it("returns null duration when metadata has no durationMs (P0-4)", () => {
    const graph = makeGraph({
      nodes: [{ id: "file:a", kind: "file", label: "a.ts", metadata: {} }],
    });
    expect(resolveStepDurationMs(graph.nodes[0])).toBeNull();
  });

  it("detects live execution from route metadata", () => {
    const graph = makeGraph({
      nodes: [
        {
          id: "route:a",
          kind: "route",
          label: "GET /a",
          metadata: { routeId: "route:a", executionStatus: "running" },
        },
      ],
    });
    expect(isExecutionLive(graph, "route:a")).toBe(true);
  });

  it("does not treat a traceId without running status as live (P0-4)", () => {
    const graph = makeGraph({
      nodes: [
        {
          id: "route:b",
          kind: "route",
          label: "POST /b",
          metadata: { routeId: "route:b", traceId: "tr-demo" },
        },
      ],
    });
    expect(isExecutionLive(graph, "route:b")).toBe(false);
  });

  it("does not treat completed trace as live", () => {
    const graph = makeGraph({
      nodes: [
        {
          id: "route:c",
          kind: "route",
          label: "POST /c",
          metadata: { routeId: "route:c", traceId: "tr-done", executionStatus: "completed" },
        },
      ],
    });
    expect(isExecutionLive(graph, "route:c")).toBe(false);
  });

  it("does not treat terminal route status with trace as live", () => {
    const graph = makeGraph({
      nodes: [
        {
          id: "route:e",
          kind: "route",
          label: "POST /e",
          metadata: { routeId: "route:e", traceId: "tr-done", status: "completed" },
        },
      ],
    });
    expect(isExecutionLive(graph, "route:e")).toBe(false);
  });
});
