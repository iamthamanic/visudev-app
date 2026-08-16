import { describe, expect, it } from "vitest";
import type { SoftwareGraph } from "../../../shared/software-graph.types.js";
import { buildSemanticSystemModel } from "./semantic-system-model.service.js";

function graphFixture(): SoftwareGraph {
  return {
    version: 1,
    projectId: "project-rollup",
    analyzedAt: "2026-08-15T00:00:00.000Z",
    scopes: [],
    nodes: [
      { id: "app", kind: "application", label: "App", metadata: {} },
      { id: "domain-payroll", kind: "domain", label: "payroll", scopeId: "app", metadata: {} },
      {
        id: "route-payroll",
        kind: "route",
        label: "GET /api/payroll",
        scopeId: "domain-payroll",
        metadata: { path: "/api/payroll" },
      },
      {
        id: "file-payroll",
        kind: "file",
        label: "payroll.service.ts",
        scopeId: "domain-payroll",
        filePath: "src/payroll/payroll.service.ts",
        metadata: {},
      },
      { id: "domain-docs", kind: "domain", label: "documents", scopeId: "app", metadata: {} },
      {
        id: "route-docs",
        kind: "route",
        label: "GET /api/documents",
        scopeId: "domain-docs",
        metadata: { path: "/api/documents" },
      },
      {
        id: "file-docs",
        kind: "file",
        label: "documents.repository.ts",
        scopeId: "domain-docs",
        filePath: "src/documents/documents.repository.ts",
        metadata: {},
      },
      {
        id: "route-orders",
        kind: "route",
        label: "GET /api/orders",
        metadata: { path: "/api/orders" },
      },
      {
        id: "file-orders",
        kind: "file",
        label: "orders.ts",
        filePath: "src/orders.ts",
        metadata: {},
      },
      { id: "service-payroll", kind: "service", label: "PayrollService", metadata: {} },
    ],
    edges: [
      {
        id: "import-1",
        kind: "imports",
        sourceId: "file-payroll",
        targetId: "file-docs",
        metadata: {},
      },
      {
        id: "import-2",
        kind: "imports",
        sourceId: "file-payroll",
        targetId: "file-docs",
        metadata: {},
      },
      {
        id: "call-1",
        kind: "calls",
        sourceId: "file-payroll",
        targetId: "file-docs",
        metadata: {},
      },
      {
        id: "internal",
        kind: "imports",
        sourceId: "file-payroll",
        targetId: "route-payroll",
        metadata: {},
      },
    ],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 8000 },
  };
}

describe("semantic roll-up", () => {
  it("maps low-level nodes to corroborated business domains", () => {
    const model = buildSemanticSystemModel(graphFixture());

    expect(model.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          graphNodeId: "file-payroll",
          semanticEntityId: "semantic:business-domain:payroll",
        }),
        expect.objectContaining({
          graphNodeId: "file-docs",
          semanticEntityId: "semantic:business-domain:document",
        }),
        expect.objectContaining({
          graphNodeId: "service-payroll",
          semanticEntityId: "semantic:service:service-payroll",
          confidence: 1,
        }),
      ]),
    );
  });

  it("uses a flat file stem as domain-path evidence", () => {
    const model = buildSemanticSystemModel(graphFixture());
    expect(model.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          graphNodeId: "file-orders",
          semanticEntityId: "semantic:business-domain:order",
        }),
      ]),
    );
  });

  it("aggregates many low-level edges into weighted domain relations", () => {
    const model = buildSemanticSystemModel(graphFixture());
    const dependsOn = model.relations.find(
      (relation) =>
        relation.id ===
        "semantic-rollup:depends-on:semantic:business-domain:payroll:semantic:business-domain:document",
    );
    const calls = model.relations.find(
      (relation) =>
        relation.id ===
        "semantic-rollup:calls:semantic:business-domain:payroll:semantic:business-domain:document",
    );

    expect(dependsOn).toMatchObject({
      kind: "depends-on",
      sourceId: "semantic:business-domain:payroll",
      targetId: "semantic:business-domain:document",
      metadata: {
        projectionLevel: "business-domain",
        weight: 2,
        sourceGraphEdgeIds: ["import-1", "import-2"],
      },
    });
    expect(dependsOn?.evidence.map((item) => item.refId)).toEqual(["import-1", "import-2"]);
    expect(calls?.metadata.weight).toBe(1);
  });

  it("does not create overview self-loops for internal domain edges", () => {
    const model = buildSemanticSystemModel(graphFixture());
    expect(
      model.relations.some(
        (relation) =>
          relation.id.startsWith("semantic-rollup:") && relation.sourceId === relation.targetId,
      ),
    ).toBe(false);
  });

  it("keeps ordering deterministic when graph arrays are reversed", () => {
    const graph = graphFixture();
    const reversed: SoftwareGraph = {
      ...graph,
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
    };
    expect(buildSemanticSystemModel(reversed)).toEqual(buildSemanticSystemModel(graph));
  });
});
