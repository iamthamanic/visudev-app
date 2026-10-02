/**
 * SDE-06 static detector bridge + shadow parity tests.
 */

import { describe, expect, it } from "vitest";
import {
  scanFactsToSoftwareGraph,
  softwareGraphToScanFacts,
} from "./application/software-graph-fact-bridge.js";
import { shadowCompareSoftwareGraphs } from "./application/shadow-compare-graphs.js";
import type { SoftwareGraph } from "../software-graph.types.js";

function sampleGraph(): SoftwareGraph {
  return {
    version: 1,
    projectId: "golden-set",
    analyzedAt: "2026-10-01T00:00:00.000Z",
    scopes: [],
    nodes: [
      { id: "app:golden-set", kind: "application", label: "golden-set", metadata: {} },
      {
        id: "route:GET:/users",
        kind: "route",
        label: "GET /users",
        filePath: "src/routes/users.route.ts",
        line: 1,
        metadata: {},
      },
      { id: "node-table-user", kind: "table", label: "User", metadata: {} },
    ],
    edges: [
      {
        id: "e1",
        kind: "contains",
        sourceId: "app:golden-set",
        targetId: "route:GET:/users",
        metadata: {},
      },
      {
        id: "e2",
        kind: "data",
        sourceId: "route:GET:/users",
        targetId: "node-table-user",
        metadata: {},
      },
    ],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 100, maxEdges: 100 },
  };
}

describe("software-graph fact bridge", () => {
  it("round-trips graph facts without losing semantic baseline parity", () => {
    const legacy = sampleGraph();
    const bundle = softwareGraphToScanFacts(legacy);
    const engine = scanFactsToSoftwareGraph(legacy.projectId, legacy.analyzedAt, bundle.facts);
    const parity = shadowCompareSoftwareGraphs({
      projectId: legacy.projectId,
      legacy,
      engine,
      enrichment: "off",
      routes: [{ id: "route:GET:/users" }],
    });
    expect(parity.status).toBe("pass");
    expect(engine.nodes.map((node) => node.id).sort()).toEqual(
      legacy.nodes.map((node) => node.id).sort(),
    );
    expect(engine.edges.map((edge) => edge.id).sort()).toEqual(
      legacy.edges.map((edge) => edge.id).sort(),
    );
  });

  it("reports semantic missing when engine drops a table node", () => {
    const legacy = sampleGraph();
    const bundle = softwareGraphToScanFacts(legacy);
    const trimmedFacts = bundle.facts.filter((fact) => fact.subjectId !== "node-table-user");
    const engine = scanFactsToSoftwareGraph(legacy.projectId, legacy.analyzedAt, trimmedFacts);
    const parity = shadowCompareSoftwareGraphs({
      projectId: legacy.projectId,
      legacy,
      engine,
      enrichment: "off",
    });
    expect(parity.status).toBe("fail");
    expect(
      parity.missing.some(
        (finding) => finding.path.includes("table") || finding.expected.includes("node-table-user"),
      ),
    ).toBe(true);
  });
});
