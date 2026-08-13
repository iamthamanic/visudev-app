/**
 * Tests for buildArchitectureStackCards edge grouping.
 */

import { describe, it, expect } from "vitest";
import {
  buildArchitectureStackCards,
  groupArchitectureCardsByDomain,
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

  it("groups layer cards by metadata.domain and parent domain nodes", () => {
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
    expect(groups.map((group) => group.label)).toEqual(["billing", "hr", "Ohne Domäne"]);
    expect(groups.find((group) => group.id === "hr")?.cards.map((card) => card.label)).toEqual([
      "ui",
    ]);
    expect(hasRecognizedArchitectureDomains(groups)).toBe(true);
  });

  it("treats unassigned domain nodes as Ohne Domäne", () => {
    const unassigned: SoftwareGraph = {
      ...graph,
      nodes: [
        { id: "domain:unassigned", kind: "domain", label: "unassigned", metadata: {} },
        { id: "layer:x", kind: "layer", label: "ui", metadata: {} },
      ],
      edges: [
        {
          id: "e1",
          kind: "contains",
          sourceId: "domain:unassigned",
          targetId: "layer:x",
          metadata: {},
        },
      ],
    };
    const groups = groupArchitectureCardsByDomain(
      unassigned,
      buildArchitectureStackCards(unassigned, "layer"),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Ohne Domäne");
    expect(hasRecognizedArchitectureDomains(groups)).toBe(false);
  });
});
