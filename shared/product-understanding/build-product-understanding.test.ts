/**
 * PU-02 builder tests — multi-signal corroboration across architectures.
 * Location: shared/product-understanding/build-product-understanding.test.ts
 */

import { describe, expect, it } from "vitest";
import type { DataLineageGraph } from "../data-lineage.types.js";
import type { SemanticSystemModel } from "../semantic-system-model.types.js";
import type { SoftwareGraph } from "../software-graph.types.js";
import type { UiInteractionGraph } from "../ui-interaction-graph.types.js";
import { buildProductUnderstanding } from "./build-product-understanding.js";

function modularSemantic(): SemanticSystemModel {
  return {
    version: 2,
    projectId: "modular",
    analyzedAt: "2026-10-06T00:00:00.000Z",
    entities: [
      {
        id: "semantic:business-domain:billing",
        kind: "business-domain",
        label: "Billing",
        confidence: 0.8,
        knowledgeStatus: "SUPPORTED",
        evidence: [{ source: "graph-node", refId: "node:domain:billing" }],
        metadata: { candidateKey: "billing" },
      },
      {
        id: "semantic:capability:invoices",
        kind: "capability",
        label: "Invoices",
        confidence: 0.7,
        knowledgeStatus: "SUPPORTED",
        evidence: [{ source: "graph-node", refId: "node:mod:invoices" }],
        metadata: { candidateKey: "invoices" },
      },
      {
        id: "semantic:application:app",
        kind: "application",
        label: "Modular App",
        confidence: 0.9,
        knowledgeStatus: "SUPPORTED",
        evidence: [{ source: "graph-node", refId: "node:app" }],
        metadata: {},
      },
    ],
    memberships: [],
    relations: [
      {
        id: "rel:contains",
        kind: "contains",
        sourceId: "semantic:business-domain:billing",
        targetId: "semantic:capability:invoices",
        confidence: 0.7,
        knowledgeStatus: "SUPPORTED",
        evidence: [{ source: "graph-edge", refId: "edge:1" }],
        metadata: {},
      },
    ],
  };
}

function modularUi(): UiInteractionGraph {
  return {
    version: 1,
    projectId: "modular",
    analyzedAt: "2026-10-06T00:00:00.000Z",
    surfaces: [
      {
        id: "ui:billing",
        kind: "page",
        label: "Billing",
        status: "detected",
        confidence: 0.85,
        evidenceIds: ["ev:1"],
      },
      {
        id: "ui:invoices",
        kind: "page",
        label: "Invoices",
        status: "detected",
        confidence: 0.8,
        evidenceIds: ["ev:3"],
      },
    ],
    transitions: [
      {
        id: "ui:tr:pay",
        kind: "menu-action",
        fromSurfaceId: "ui:billing",
        toSurfaceId: "ui:billing",
        trigger: { label: "Pay Invoice" },
        status: "detected",
        confidence: 0.8,
        evidenceIds: ["ev:2"],
      },
    ],
    evidence: [],
    stats: {
      surfaceCount: 1,
      transitionCount: 1,
      routeSurfaceCount: 1,
      stateSurfaceCount: 0,
      conflictCount: 0,
      runtimeOnlyCount: 0,
    },
  };
}

function layeredLineage(): DataLineageGraph {
  return {
    version: 1,
    projectId: "layered",
    analyzedAt: "2026-10-06T00:00:00.000Z",
    paths: [
      {
        id: "path:1",
        status: "complete",
        terminalHopIndex: 0,
        hops: [
          {
            from: { layer: "ui-surface", entityId: "ui:orders", label: "Orders" },
            to: { layer: "data-entity", entityId: "tbl:orders", label: "Orders" },
            joinRuleId: "ui-to-data",
            knowledgeStatus: "SUPPORTED",
            confidence: 0.75,
            evidence: [
              {
                evidenceId: "ev:lin:1",
                sourceIr: "scan",
                kind: "bind",
                summary: "orders query",
              },
            ],
          },
        ],
      },
    ],
    stats: {
      pathCount: 1,
      completeCount: 1,
      partialCount: 0,
      unresolvedCount: 0,
    },
  };
}

function emptySoftware(projectId: string, nodes: SoftwareGraph["nodes"]): SoftwareGraph {
  return {
    version: 1,
    projectId,
    analyzedAt: "2026-10-06T00:00:00.000Z",
    scopes: [],
    nodes,
    edges: [],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 5000, maxEdges: 20000 },
  };
}

function messySoftware(): SoftwareGraph {
  return emptySoftware("messy", [
    {
      id: "n:app",
      kind: "application",
      label: "MessyApp",
      metadata: {},
    },
    {
      id: "n:domain",
      kind: "domain",
      label: "Inventory",
      metadata: {},
    },
    {
      id: "n:file",
      kind: "file",
      label: "src",
      filePath: "src/index.ts",
      metadata: {},
    },
  ]);
}

describe("buildProductUnderstanding", () => {
  it("rejects single path-segment / folder-only signals", () => {
    const model = buildProductUnderstanding({
      projectId: "folder-first",
      analyzedAt: "2026-10-06T00:00:00.000Z",
      software: emptySoftware("folder-first", [
        {
          id: "n:src",
          kind: "module",
          label: "src",
          filePath: "src",
          metadata: {},
        },
      ]),
      semantic: {
        version: 2,
        projectId: "folder-first",
        analyzedAt: "2026-10-06T00:00:00.000Z",
        entities: [
          {
            id: "semantic:business-domain:src",
            kind: "business-domain",
            label: "src",
            confidence: 0.2,
            knowledgeStatus: "INTERPRETED",
            evidence: [{ source: "graph-node", refId: "n:src" }],
            metadata: { candidateKey: "src" },
          },
        ],
        memberships: [],
        relations: [],
      },
    });
    expect(model.concepts.every((concept) => concept.kind !== "product-area")).toBe(true);
    expect(model.concepts.some((concept) => /:src$/.test(concept.id))).toBe(false);
  });

  it("rejects structural folder tokens that previously leaked via loose-key fallback", () => {
    const structural = ["config", "imports", "layouts", "scripts", "services", "stores", "types"];
    const model = buildProductUnderstanding({
      projectId: "struct-leak",
      analyzedAt: "2026-10-06T00:00:00.000Z",
      software: emptySoftware(
        "struct-leak",
        structural.map((name) => ({
          id: `n:${name}`,
          kind: "module",
          label: name,
          filePath: `src/${name}`,
          metadata: {},
        })),
      ),
      semantic: {
        version: 2,
        projectId: "struct-leak",
        analyzedAt: "2026-10-06T00:00:00.000Z",
        entities: structural.map((name) => ({
          id: `semantic:business-domain:${name}`,
          kind: "business-domain" as const,
          label: name,
          confidence: 0.8,
          knowledgeStatus: "SUPPORTED" as const,
          evidence: [
            { source: "graph-node" as const, refId: `n:${name}` },
            { source: "graph-evidence" as const, refId: `ev:${name}` },
          ],
          metadata: { candidateKey: name },
        })),
        memberships: [],
        relations: [],
      },
      ui: {
        version: 1,
        projectId: "struct-leak",
        analyzedAt: "2026-10-06T00:00:00.000Z",
        surfaces: structural.map((name) => ({
          id: `ui:${name}`,
          kind: "page" as const,
          label: name,
          confidence: 0.8,
          status: "detected" as const,
          evidenceIds: [`ev:${name}`],
        })),
        transitions: [],
      },
    });
    for (const name of structural) {
      expect(model.concepts.some((concept) => concept.id === `pu:product-area:${name}`)).toBe(
        false,
      );
    }
  });

  it("corroborates modular billing from semantic + UI", () => {
    const model = buildProductUnderstanding({
      projectId: "modular",
      analyzedAt: "2026-10-06T00:00:00.000Z",
      semantic: modularSemantic(),
      ui: modularUi(),
    });
    const billing = model.concepts.find((concept) => concept.id === "pu:product-area:billing");
    expect(billing).toBeTruthy();
    expect(uniqueSources(billing!.evidence).size).toBeGreaterThanOrEqual(2);
    expect(model.concepts.some((concept) => concept.kind === "application")).toBe(true);
    expect(model.concepts.some((concept) => concept.kind === "user-action")).toBe(true);
    expect(model.relations.some((relation) => relation.evidence.length > 0)).toBe(true);
  });

  it("corroborates layered orders from UI lineage + semantic", () => {
    const model = buildProductUnderstanding({
      projectId: "layered",
      analyzedAt: "2026-10-06T00:00:00.000Z",
      lineage: layeredLineage(),
      semantic: {
        version: 2,
        projectId: "layered",
        analyzedAt: "2026-10-06T00:00:00.000Z",
        entities: [
          {
            id: "semantic:business-domain:orders",
            kind: "business-domain",
            label: "Orders",
            confidence: 0.7,
            knowledgeStatus: "SUPPORTED",
            evidence: [{ source: "graph-node", refId: "n:orders" }],
            metadata: { candidateKey: "orders" },
          },
        ],
        memberships: [],
        relations: [],
      },
      ui: {
        version: 1,
        projectId: "layered",
        analyzedAt: "2026-10-06T00:00:00.000Z",
        surfaces: [
          {
            id: "ui:orders",
            kind: "page",
            label: "Orders",
            status: "detected",
            confidence: 0.8,
            evidenceIds: ["e1"],
          },
        ],
        transitions: [],
        evidence: [],
        stats: {
          surfaceCount: 1,
          transitionCount: 0,
          routeSurfaceCount: 1,
          stateSurfaceCount: 0,
          conflictCount: 0,
          runtimeOnlyCount: 0,
        },
      },
    });
    const orders = model.concepts.find((concept) => concept.id.includes(":order"));
    expect(orders).toBeTruthy();
    expect(uniqueSources(orders!.evidence).size).toBeGreaterThanOrEqual(2);
    expect(model.concepts.some((concept) => concept.kind === "information")).toBe(true);
  });

  it("keeps technical topology separate while messy graph still yields application", () => {
    const model = buildProductUnderstanding({
      projectId: "messy",
      analyzedAt: "2026-10-06T00:00:00.000Z",
      software: messySoftware(),
      ui: {
        version: 1,
        projectId: "messy",
        analyzedAt: "2026-10-06T00:00:00.000Z",
        surfaces: [
          {
            id: "ui:inv",
            kind: "screen",
            label: "Inventory",
            status: "observed",
            confidence: 0.7,
            evidenceIds: ["e"],
          },
        ],
        transitions: [],
        evidence: [],
        stats: {
          surfaceCount: 1,
          transitionCount: 0,
          routeSurfaceCount: 1,
          stateSurfaceCount: 0,
          conflictCount: 0,
          runtimeOnlyCount: 0,
        },
      },
    });
    expect(model.concepts.some((concept) => concept.kind === "application")).toBe(true);
    const inventory = model.concepts.find((concept) => concept.id === "pu:product-area:inventory");
    expect(inventory).toBeTruthy();
    expect(uniqueSources(inventory!.evidence).size).toBeGreaterThanOrEqual(2);
  });

  it("does not invent concepts from a lone semantic entity without second source", () => {
    const model = buildProductUnderstanding({
      projectId: "single",
      analyzedAt: "2026-10-06T00:00:00.000Z",
      semantic: {
        version: 2,
        projectId: "single",
        analyzedAt: "2026-10-06T00:00:00.000Z",
        entities: [
          {
            id: "semantic:capability:lonely",
            kind: "capability",
            label: "Lonely",
            confidence: 0.9,
            knowledgeStatus: "SUPPORTED",
            evidence: [{ source: "graph-node", refId: "n:lonely" }],
            metadata: { candidateKey: "lonely" },
          },
        ],
        memberships: [],
        relations: [],
      },
    });
    expect(model.concepts.some((concept) => concept.id.includes("lonely"))).toBe(false);
  });
});

function uniqueSources(evidence: { source: string }[]): Set<string> {
  return new Set(evidence.map((item) => item.source));
}
