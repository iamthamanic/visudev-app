/**
 * Tests for route method projection (visudev-gapclose P2-3 Meteor METHOD labels).
 * Location: shared/blueprint-graph-routes.test.ts
 */

import { describe, expect, it } from "vitest";
import { deriveRoutesFromGraph, normalizeRouteMethod } from "./blueprint-graph-routes.js";
import type { SoftwareGraph } from "./software-graph.types.js";

function emptyGraph(overrides: Partial<SoftwareGraph> = {}): SoftwareGraph {
  return {
    version: 1,
    projectId: "test",
    analyzedAt: "2026-07-17T00:00:00.000Z",
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

describe("normalizeRouteMethod", () => {
  it("preserves Meteor METHOD and PUBLISH", () => {
    expect(normalizeRouteMethod("METHOD")).toBe("METHOD");
    expect(normalizeRouteMethod("method")).toBe("METHOD");
    expect(normalizeRouteMethod("PUBLISH")).toBe("PUBLISH");
  });

  it("preserves HTTP verbs and maps unknown to PAGE", () => {
    expect(normalizeRouteMethod("GET")).toBe("GET");
    expect(normalizeRouteMethod("weird")).toBe("PAGE");
    expect(normalizeRouteMethod(null)).toBe("PAGE");
  });
});

describe("deriveRoutesFromGraph", () => {
  it("projects meteor method routes as METHOD not PAGE (P2-3)", () => {
    const graph = emptyGraph({
      nodes: [
        {
          id: "route:meteor:sendMessage",
          kind: "route",
          label: "METHOD /meteor/sendMessage",
          filePath: "apps/meteor/server/meteor-methods/messages/sendMessage.ts",
          line: 12,
          metadata: {
            routeId: "METHOD /meteor/sendMessage",
            method: "METHOD",
            path: "/meteor/sendMessage",
          },
        },
        {
          id: "route:page:home",
          kind: "route",
          label: "PAGE /",
          filePath: "apps/web/pages/index.tsx",
          line: 1,
          metadata: { method: "PAGE", path: "/" },
        },
      ],
    });

    const routes = deriveRoutesFromGraph(graph);
    const meteor = routes.find((r) => r.path === "/meteor/sendMessage");
    expect(meteor?.method).toBe("METHOD");
    expect(routes.find((r) => r.path === "/")?.method).toBe("PAGE");
  });

  it("normalizes Deno pipeline metadata into ProjectedPipelineNode shape", () => {
    const graph = emptyGraph({
      nodes: [
        {
          id: "GET /users",
          kind: "route",
          label: "GET /users",
          filePath: "src/users.ts",
          line: 4,
          metadata: {
            method: "GET",
            path: "/users",
            pipeline: [{ kind: "auth" }, { id: "h1", type: "handler", label: "handler", state: "confirmed" }],
          },
        },
      ],
    });
    const route = deriveRoutesFromGraph(graph)[0];
    expect(route?.pipeline).toEqual([
      { id: "pipeline-step-1", type: "auth", label: "auth", state: "unknown" },
      { id: "h1", type: "handler", label: "handler", state: "confirmed" },
    ]);
  });
});
