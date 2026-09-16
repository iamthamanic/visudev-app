/**
 * Runtime → SoftwareGraph merge tests.
 * Location: local-engine/src/services/runtime-into-software-graph.test.ts
 */

import { describe, expect, it } from "vitest";
import type { SoftwareGraph } from "../types/api.types.js";
import { mergeRuntimeIntoSoftwareGraph } from "./runtime-into-software-graph.js";

function graphFixture(): SoftwareGraph {
  return {
    version: 1,
    projectId: "p1",
    analyzedAt: "2026-01-01T00:00:00.000Z",
    scopes: [],
    nodes: [
      {
        id: "route:/home",
        kind: "route",
        label: "PAGE /home",
        metadata: { path: "/home", method: "PAGE" },
      },
      {
        id: "route:/settings",
        kind: "route",
        label: "PAGE /settings",
        metadata: { path: "/settings", method: "PAGE" },
      },
    ],
    edges: [],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 50, maxEdges: 50 },
  };
}

describe("mergeRuntimeIntoSoftwareGraph", () => {
  it("adds observed edges with provenance metadata", () => {
    const merged = mergeRuntimeIntoSoftwareGraph(graphFixture(), {
      crawledAt: "2026-01-02T00:00:00.000Z",
      verifiedEdges: [
        {
          fromScreenId: "home",
          toScreenId: "settings",
          type: "navigate",
          sourceRoute: "/home",
          targetRoute: "/settings",
          verification: "route-change",
        },
      ],
    });
    expect(merged.edges).toHaveLength(1);
    expect(merged.edges[0]?.metadata.provenance).toBe("observed");
    expect(merged.metrics.some((metric) => metric.id === "observed-edges")).toBe(true);
  });

  it("returns original graph when no matching routes", () => {
    const base = graphFixture();
    const merged = mergeRuntimeIntoSoftwareGraph(base, {
      verifiedEdges: [
        {
          fromScreenId: "x",
          toScreenId: "y",
          type: "navigate",
          sourceRoute: "/missing",
          targetRoute: "/also-missing",
        },
      ],
    });
    expect(merged).toBe(base);
  });
});
