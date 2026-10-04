/**
 * Tests for Architecture semantic authority resolution (PR-07).
 */

import { describe, expect, it } from "vitest";
import type { BlueprintData } from "../../types";
import { resolveArchitectureSemanticModel } from "./resolve-architecture-semantic-model.js";
import type { SoftwareGraph } from "../../types";

const graph: SoftwareGraph = {
  version: 1,
  projectId: "p1",
  analyzedAt: "2026-01-01T00:00:00.000Z",
  scopes: [],
  nodes: [
    { id: "svc:leave", kind: "service", label: "LeaveService", metadata: {} },
    { id: "tbl:leave", kind: "table", label: "leave", metadata: {} },
  ],
  edges: [],
  evidence: [],
  groups: [],
  metrics: [],
  condensed: false,
  limits: { maxNodes: 2500, maxEdges: 5000 },
};

describe("resolveArchitectureSemanticModel", () => {
  it("prefers blueprint.semanticSystemModel when present", () => {
    const blueprint = {
      graph,
      semanticSystemModel: {
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
            metadata: {},
          },
        ],
        memberships: [],
        relations: [],
      },
    } as BlueprintData;
    const model = resolveArchitectureSemanticModel(blueprint, graph);
    expect(model?.entities).toHaveLength(1);
    expect(model?.entities[0]?.label).toBe("Leave");
  });

  it("builds shared SemanticSystemModel when blueprint has none", () => {
    const blueprint = { graph } as BlueprintData;
    const model = resolveArchitectureSemanticModel(blueprint, graph);
    expect(model).not.toBeNull();
    expect(model?.version).toBe(2);
    expect(model?.entities.some((entity) => entity.kind === "business-domain")).toBe(true);
  });
});
