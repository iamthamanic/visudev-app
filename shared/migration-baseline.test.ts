/**
 * Unit tests for SDE-01 migration baseline extract + shadow parity.
 */

import { describe, expect, it } from "vitest";
import { compareShadowParity, extractSemanticBaseline } from "./migration-baseline.js";
import type { SoftwareGraph } from "./software-graph.types.js";

function makeGraph(overrides: Partial<SoftwareGraph> = {}): SoftwareGraph {
  return {
    version: 1,
    projectId: "baseline",
    analyzedAt: "2026-10-01T00:00:00.000Z",
    scopes: [],
    nodes: [
      { id: "svc:api", kind: "service", label: "API", metadata: {} },
      { id: "table:users", kind: "table", label: "users", metadata: {} },
      { id: "file:a", kind: "file", label: "a.ts", filePath: "src/a.ts", metadata: {} },
    ],
    edges: [
      { id: "e1", kind: "imports", sourceId: "file:a", targetId: "svc:api", metadata: {} },
      { id: "e2", kind: "data", sourceId: "svc:api", targetId: "table:users", metadata: {} },
    ],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 100, maxEdges: 100 },
    ...overrides,
  };
}

describe("extractSemanticBaseline", () => {
  it("captures blueprint, semantic, appflow, and data core ids", () => {
    const fingerprint = extractSemanticBaseline({
      projectId: "baseline",
      enrichment: "off",
      allowedUnknownKeys: ["partial-scan"],
      graph: makeGraph(),
      routes: [{ id: "GET /users" }, { id: "POST /orders" }],
      screens: [{ id: "screen:login" }],
      flows: [{ id: "flow:checkout" }],
      dataTables: [{ id: "erd:users", label: "users" }],
    });

    expect(fingerprint.version).toBe(1);
    expect(fingerprint.enrichment).toBe("off");
    expect(fingerprint.allowedUnknownKeys).toEqual(["partial-scan"]);
    expect(fingerprint.blueprint.routeIds).toEqual(["GET /users", "POST /orders"]);
    expect(fingerprint.blueprint.tableNodeIds).toEqual(["table:users"]);
    expect(fingerprint.blueprint.nodeKindCounts.service).toBe(1);
    expect(fingerprint.blueprint.edgeKindCounts.imports).toBe(1);
    expect(fingerprint.appflow.screenIds).toEqual(["screen:login"]);
    expect(fingerprint.appflow.flowIds).toEqual(["flow:checkout"]);
    expect(fingerprint.data.tableIds).toEqual(["erd:users"]);
    expect(fingerprint.data.tableLabels).toEqual(["users"]);
    expect(fingerprint.semantic.entityKindCounts.service).toBeGreaterThanOrEqual(1);
  });
});

describe("compareShadowParity", () => {
  it("passes when fingerprints match", () => {
    const left = extractSemanticBaseline({
      projectId: "baseline",
      enrichment: "off",
      graph: makeGraph(),
      routes: [{ id: "GET /users" }],
    });
    const right = extractSemanticBaseline({
      projectId: "baseline",
      enrichment: "off",
      graph: makeGraph(),
      routes: [{ id: "GET /users" }],
    });
    expect(compareShadowParity(left, right).status).toBe("pass");
  });

  it("fails when legacy routes disappear unnoticed", () => {
    const expected = extractSemanticBaseline({
      projectId: "baseline",
      enrichment: "off",
      graph: makeGraph(),
      routes: [{ id: "GET /users" }, { id: "POST /orders" }],
    });
    const actual = extractSemanticBaseline({
      projectId: "baseline",
      enrichment: "off",
      graph: makeGraph(),
      routes: [{ id: "GET /users" }],
    });
    const result = compareShadowParity(expected, actual);
    expect(result.status).toBe("fail");
    expect(result.missing.some((finding) => finding.expected === "POST /orders")).toBe(true);
  });
});
