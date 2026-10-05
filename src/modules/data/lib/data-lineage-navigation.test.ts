/**
 * Unit tests for Data lineage navigation queries (PR-22).
 * Location: src/modules/data/lib/data-lineage-navigation.test.ts
 */

import { describe, expect, it } from "vitest";
import type { DataLineageGraph } from "../../../../shared/data-lineage.types.js";
import { queryLineagePaths, slicePathHops } from "./data-lineage-navigation";

const graph: DataLineageGraph = {
  version: 1,
  projectId: "demo",
  analyzedAt: "2026-10-05T12:00:00.000Z",
  paths: [
    {
      id: "lineage:a",
      status: "complete",
      terminalHopIndex: 2,
      hops: [
        {
          from: { layer: "endpoint", entityId: "route:1", label: "GET /users" },
          to: { layer: "service-module", entityId: "svc:1", label: "UsersService" },
          joinRuleId: "graph-edge:calls",
          knowledgeStatus: "SUPPORTED",
          confidence: 0.8,
          evidence: [{ evidenceId: "e1", sourceIr: "software-graph", kind: "calls" }],
        },
        {
          from: { layer: "service-module", entityId: "svc:1", label: "UsersService" },
          to: { layer: "data-entity", entityId: "users", label: "users" },
          joinRuleId: "graph-edge:data",
          knowledgeStatus: "SUPPORTED",
          confidence: 0.8,
          evidence: [{ evidenceId: "e2", sourceIr: "software-graph", kind: "data" }],
        },
      ],
    },
    {
      id: "lineage:b",
      status: "partial",
      terminalHopIndex: 0,
      truncationReason: "no-evidenced-endpoint-for-interaction",
      hops: [
        {
          from: { layer: "ui-surface", entityId: "s1", label: "Users" },
          to: { layer: "ui-interaction", entityId: "tr1", label: "navigate" },
          joinRuleId: "ui-surface-transition",
          knowledgeStatus: "UNKNOWN",
          confidence: 0.4,
          evidence: [{ evidenceId: "e3", sourceIr: "ui", kind: "ui-transition" }],
        },
      ],
    },
    {
      id: "lineage:c",
      status: "partial",
      terminalHopIndex: 0,
      truncationReason: "no-evidenced-data-hop",
      hops: [
        {
          from: { layer: "endpoint", entityId: "route:2", label: "GET /posts" },
          to: { layer: "data-entity", entityId: "posts", label: "posts" },
          joinRuleId: "graph-edge:data",
          knowledgeStatus: "SUPPORTED",
          confidence: 0.7,
          evidence: [{ evidenceId: "e4", sourceIr: "software-graph", kind: "data" }],
        },
      ],
    },
  ],
  stats: {
    pathCount: 3,
    completeCount: 1,
    partialCount: 2,
    unresolvedCount: 0,
  },
};

describe("data-lineage-navigation", () => {
  it("returns forward paths that touch the selected data entity", () => {
    const result = queryLineagePaths({
      graph,
      anchor: { entityId: "users", labels: ["users"] },
      direction: "forward",
    });
    expect(result.total).toBe(1);
    expect(result.paths[0]?.id).toBe("lineage:a");
    const hops = slicePathHops(result.paths[0], { entityId: "users" }, "forward");
    expect(hops).toHaveLength(1);
    expect(hops[0]?.to.entityId).toBe("users");
  });

  it("returns reverse hops from path start through the anchor", () => {
    const result = queryLineagePaths({
      graph,
      anchor: { entityId: "users" },
      direction: "reverse",
    });
    const hops = slicePathHops(result.paths[0], { entityId: "users" }, "reverse");
    expect(hops.map((hop) => hop.to.layer)).toEqual(["service-module", "data-entity"]);
  });

  it("filters fan-out by search and respects limit", () => {
    const result = queryLineagePaths({
      graph,
      anchor: { entityId: "posts", labels: ["posts"] },
      direction: "forward",
      searchQuery: "posts",
      limit: 1,
    });
    expect(result.total).toBe(1);
    expect(result.paths[0]?.status).toBe("partial");
    expect(result.paths[0]?.truncationReason).toBe("no-evidenced-data-hop");
  });

  it("does not invent paths for unrelated tables", () => {
    const result = queryLineagePaths({
      graph,
      anchor: { entityId: "missing" },
      direction: "forward",
    });
    expect(result.total).toBe(0);
  });
});
