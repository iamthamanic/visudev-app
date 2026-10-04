/**
 * SemanticSystemModel v2 taxonomy golden assertions (#379).
 * Location: shared/semantic-taxonomy-v2.test.ts
 */

import { describe, expect, it } from "vitest";
import { buildSemanticSystemModel } from "./semantic-system-model.js";
import { SEMANTIC_V2_REQUIRED_KINDS } from "./semantic-system-model.types.js";
import type { SoftwareGraph } from "./software-graph.types.js";
import {
  isResourceNotBusinessDomain,
  knowledgeStatusFromSignals,
  qualifiesAsBusinessDomain,
  RESOURCE_NOT_BUSINESS_DOMAIN,
} from "./semantic-taxonomy-v2.js";

function makeGraph(nodes: SoftwareGraph["nodes"]): SoftwareGraph {
  return {
    version: 1,
    projectId: "p",
    analyzedAt: "2026-10-04T00:00:00.000Z",
    scopes: [],
    nodes,
    edges: [],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 100, maxEdges: 100 },
  };
}

describe("semantic taxonomy v2", () => {
  it("lists all required v2 kinds", () => {
    expect(SEMANTIC_V2_REQUIRED_KINDS).toEqual(
      expect.arrayContaining([
        "application",
        "business-domain",
        "capability",
        "resource",
        "service",
        "technical-module",
        "endpoint",
        "data-store",
        "external-system",
        "security-control",
        "deployment-unit",
        "runtime",
        "execution-flow",
      ]),
    );
  });

  it("maps knowledge status: strong multi-signal VERIFIED, weak INTERPRETED", () => {
    expect(
      knowledgeStatusFromSignals({ sourceKindCount: 2, maxConfidence: 0.95, origin: "static" }),
    ).toBe("VERIFIED");
    expect(
      knowledgeStatusFromSignals({ sourceKindCount: 1, maxConfidence: 0.9, origin: "static" }),
    ).toBe("SUPPORTED");
    expect(
      knowledgeStatusFromSignals({ sourceKindCount: 1, maxConfidence: 0.6, origin: "heuristic" }),
    ).toBe("INTERPRETED");
    expect(
      knowledgeStatusFromSignals({ sourceKindCount: 1, maxConfidence: 0.9, origin: "llm" }),
    ).toBe("INTERPRETED");
  });

  it("blocks known resource→domain misclassifications", () => {
    for (const name of ["logo", "seed", "pending", "template", "role"]) {
      expect(isResourceNotBusinessDomain(name)).toBe(true);
      expect(RESOURCE_NOT_BUSINESS_DOMAIN.has(name)).toBe(true);
    }
    expect(qualifiesAsBusinessDomain(["route"])).toBe(false);
    expect(qualifiesAsBusinessDomain(["table"])).toBe(true);
    expect(qualifiesAsBusinessDomain(["service"])).toBe(true);
    expect(qualifiesAsBusinessDomain(["route", "table"])).toBe(true);
  });

  it("classifies auth-check as security-control and route as endpoint", () => {
    const model = buildSemanticSystemModel(
      makeGraph([
        { id: "app", kind: "application", label: "App", metadata: {} },
        { id: "auth", kind: "service", label: "auth-check", metadata: {} },
        {
          id: "route-1",
          kind: "route",
          label: "GET /api/employees",
          metadata: { path: "/api/employees" },
        },
        { id: "runtime-1", kind: "runtime", label: "node", metadata: {} },
      ]),
    );
    expect(model.version).toBe(2);
    expect(model.entities.some((entity) => entity.kind === "security-control")).toBe(true);
    expect(model.entities.some((entity) => entity.kind === "endpoint")).toBe(true);
    expect(model.entities.some((entity) => entity.kind === "runtime")).toBe(true);
    expect(
      model.entities.some(
        (entity) => entity.kind === "business-domain" && /employee/i.test(entity.label),
      ),
    ).toBe(false);
  });
});
