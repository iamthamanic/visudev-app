/**
 * Tests for buildArchitectureStackCards edge grouping.
 */

import { describe, it, expect } from "vitest";
import {
  buildArchitectureStackCards,
  groupArchitectureCardsByDomain,
  groupArchitectureCardsBySemanticDomains,
  hasRecognizedArchitectureDomains,
} from "./build-layer-stack.js";
import type { SoftwareGraph } from "../../types";

const graph: SoftwareGraph = {
  version: 1,
  projectId: "p1",
  analyzedAt: "2026-01-01T00:00:00.000Z",
  scopes: [],
  nodes: [
    { id: "domain:a", kind: "domain", label: "A", metadata: {} },
    { id: "layer:a:1", kind: "layer", label: "L1", metadata: {} },
    { id: "module:a:1", kind: "module", label: "M1", metadata: {} },
  ],
  edges: [
    { id: "e1", kind: "contains", sourceId: "domain:a", targetId: "layer:a:1", metadata: {} },
    { id: "e2", kind: "contains", sourceId: "layer:a:1", targetId: "module:a:1", metadata: {} },
  ],
  evidence: [],
  groups: [],
  metrics: [],
  condensed: false,
  limits: { maxNodes: 2500, maxEdges: 5000 },
};

describe("buildArchitectureStackCards", () => {
  it("groups contained children by parent id", () => {
    const layers = buildArchitectureStackCards(graph, "layer");
    expect(layers).toHaveLength(1);
    expect(layers[0].services).toEqual(["M1"]);
  });

  it("orders canonical wave-2 layer labels experience through platform", () => {
    const hrGraph: SoftwareGraph = {
      ...graph,
      nodes: [
        { id: "layer:platform", kind: "layer", label: "Platform Layer", metadata: {} },
        { id: "layer:experience", kind: "layer", label: "Experience Layer", metadata: {} },
        { id: "layer:domain", kind: "layer", label: "Domain Layer", metadata: {} },
      ],
      edges: [],
    };
    const layers = buildArchitectureStackCards(hrGraph, "layer");
    expect(layers.map((card) => card.label)).toEqual([
      "Experience Layer",
      "Domain Layer",
      "Platform Layer",
    ]);
  });

  it("does not invent domains from folder metadata without SemanticSystemModel", () => {
    const mixed: SoftwareGraph = {
      ...graph,
      nodes: [
        { id: "domain:hr", kind: "domain", label: "hr", metadata: {} },
        { id: "layer:hr:ui", kind: "layer", label: "ui", metadata: {} },
        {
          id: "layer:billing:data",
          kind: "layer",
          label: "data",
          metadata: { domain: "billing" },
        },
        { id: "layer:none:shared", kind: "layer", label: "shared", metadata: {} },
      ],
      edges: [
        {
          id: "e-hr",
          kind: "contains",
          sourceId: "domain:hr",
          targetId: "layer:hr:ui",
          metadata: {},
        },
      ],
    };

    const groups = groupArchitectureCardsByDomain(
      mixed,
      buildArchitectureStackCards(mixed, "layer"),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Ohne Domäne");
    expect(hasRecognizedArchitectureDomains(groups)).toBe(false);
  });

  it("keeps structural folder graphs under Ohne Domäne without semantic authority", () => {
    const structural: SoftwareGraph = {
      ...graph,
      nodes: [
        { id: "domain:components", kind: "domain", label: "components", metadata: {} },
        { id: "layer:c", kind: "layer", label: "ui", metadata: {} },
      ],
      edges: [
        {
          id: "e-c",
          kind: "contains",
          sourceId: "domain:components",
          targetId: "layer:c",
          metadata: {},
        },
      ],
    };
    const groups = groupArchitectureCardsBySemanticDomains(
      structural,
      buildArchitectureStackCards(structural, "layer"),
      null,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Ohne Domäne");
    expect(hasRecognizedArchitectureDomains(groups)).toBe(false);
  });

  it("groups layers by SemanticSystemModel business domains first", () => {
    const semanticGraph: SoftwareGraph = {
      ...graph,
      nodes: [
        { id: "domain:components", kind: "domain", label: "components", metadata: {} },
        { id: "layer:ui", kind: "layer", label: "ui", metadata: {} },
        { id: "svc:leave", kind: "service", label: "LeaveService", metadata: {} },
        { id: "layer:data", kind: "layer", label: "data", metadata: {} },
        { id: "svc:pay", kind: "service", label: "PayrollService", metadata: {} },
      ],
      edges: [
        {
          id: "e1",
          kind: "contains",
          sourceId: "domain:components",
          targetId: "layer:ui",
          metadata: {},
        },
        {
          id: "e2",
          kind: "contains",
          sourceId: "layer:ui",
          targetId: "svc:leave",
          metadata: {},
        },
        {
          id: "e3",
          kind: "contains",
          sourceId: "layer:data",
          targetId: "svc:pay",
          metadata: {},
        },
      ],
    };
    const semantic = {
      version: 2 as const,
      projectId: "p1",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      entities: [
        {
          id: "semantic:business-domain:leave",
          kind: "business-domain" as const,
          label: "Leave",
          confidence: 0.9,
          knowledgeStatus: "VERIFIED" as const,
          evidence: [{ source: "graph-node" as const, refId: "svc:leave" }],
          metadata: { candidateKey: "leave" },
        },
        {
          id: "semantic:business-domain:payroll",
          kind: "business-domain" as const,
          label: "Payroll",
          confidence: 0.9,
          knowledgeStatus: "VERIFIED" as const,
          evidence: [{ source: "graph-node" as const, refId: "svc:pay" }],
          metadata: { candidateKey: "payroll" },
        },
      ],
      memberships: [
        {
          graphNodeId: "svc:leave",
          semanticEntityId: "semantic:business-domain:leave",
          confidence: 0.9,
          evidence: [{ source: "graph-node" as const, refId: "svc:leave" }],
        },
        {
          graphNodeId: "svc:pay",
          semanticEntityId: "semantic:business-domain:payroll",
          confidence: 0.9,
          evidence: [{ source: "graph-node" as const, refId: "svc:pay" }],
        },
      ],
      relations: [],
    };

    const groups = groupArchitectureCardsBySemanticDomains(
      semanticGraph,
      buildArchitectureStackCards(semanticGraph, "layer"),
      semantic,
    );
    expect(groups.map((group) => group.label)).toEqual(["Leave", "Payroll"]);
    expect(groups.find((group) => group.label === "Leave")?.cards.map((c) => c.label)).toEqual([
      "ui",
    ]);
    expect(groups.find((group) => group.label === "Payroll")?.cards.map((c) => c.label)).toEqual([
      "data",
    ]);
    expect(hasRecognizedArchitectureDomains(groups)).toBe(true);
  });
});
