/**
 * Unit tests for RVP-12 real-visual-audit semantic helpers.
 */

import { describe, expect, it } from "vitest";
import {
  assertAnalysisSemantics,
  DEPENDENCIES_COMPLEXITY_MAX,
  isRouteLabel,
  isStructuralDomainLabel,
} from "../real-visual-audit-semantics.mjs";
import {
  buildSemanticHistoryFromSoftwareGraph,
  diffSemanticHistory,
} from "../../shared/semantic-history.js";
import type { SoftwareGraph } from "../../shared/software-graph.types.js";

describe("real-visual-audit-semantics", () => {
  it("flags structural domain-only labels and route primacy", () => {
    const result = assertAnalysisSemantics(
      {
        blueprint: {
          graph: {
            nodes: [
              { id: "f1", kind: "file", label: "a.ts", metadata: {} },
              { id: "r1", kind: "route", label: "GET /users", metadata: {} },
            ],
            edges: [],
            snapshots: [],
          },
          semanticSystemModel: {
            entities: [
              { id: "d1", kind: "business-domain", label: "hooks" },
              { id: "d2", kind: "business-domain", label: "utils" },
            ],
          },
          routes: [],
          facts: [],
        },
      },
      { enrichmentOff: false },
    );
    expect(result.passed).toBe(false);
    expect(result.failures.some((item) => /technical folders/i.test(item))).toBe(true);
    expect(result.failures.some((item) => /only route\/file/i.test(item))).toBe(true);
  });

  it("passes a minimal honest semantic graph", () => {
    const result = assertAnalysisSemantics(
      {
        summary: { graph: { nodes: 3 } },
        blueprint: {
          graph: {
            nodes: [
              { id: "app", kind: "application", label: "hr", metadata: {} },
              { id: "svc", kind: "service", label: "Auth", metadata: {} },
              { id: "tbl", kind: "table", label: "users", metadata: {} },
            ],
            edges: [],
            snapshots: [],
          },
          semanticSystemModel: {
            entities: [{ id: "d1", kind: "business-domain", label: "Personal" }],
          },
          routes: [
            {
              id: "GET /users",
              filePath: "src/users.ts",
              pipeline: [{ type: "auth" }],
            },
          ],
          facts: [{ id: "f1", filePath: "src/users.ts", kind: "api-route", metadata: {} }],
        },
      },
      { enrichmentOff: false },
    );
    expect(result.passed).toBe(true);
    expect(result.summary.dependencyCandidateCount).toBeLessThanOrEqual(
      DEPENDENCIES_COMPLEXITY_MAX,
    );
  });

  it("detects a real semantic change between two fixture graphs (Evolution)", () => {
    const baseGraph: SoftwareGraph = {
      version: 1,
      projectId: "p",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      scopes: [],
      nodes: [{ id: "svc-a", kind: "service", label: "Auth", metadata: {} }],
      edges: [],
      evidence: [],
      groups: [],
      metrics: [],
      condensed: false,
      limits: { maxNodes: 100, maxEdges: 100 },
    };
    const targetGraph: SoftwareGraph = {
      ...baseGraph,
      analyzedAt: "2026-01-02T00:00:00.000Z",
      nodes: [
        { id: "svc-a", kind: "service", label: "AuthService", metadata: {} },
        { id: "svc-b", kind: "service", label: "Billing", metadata: {} },
      ],
    };
    const base = buildSemanticHistoryFromSoftwareGraph(baseGraph, {
      key: "k1",
      commitSha: "c1",
      ref: "main",
      engineVersion: "1",
    });
    const target = buildSemanticHistoryFromSoftwareGraph(targetGraph, {
      key: "k2",
      commitSha: "c2",
      ref: "main",
      engineVersion: "1",
    });
    const diff = diffSemanticHistory(base, target);
    expect(diff.identical).toBe(false);
    expect(diff.addedEntityIds.length + diff.changedEntityIds.length).toBeGreaterThan(0);
  });

  it("classifies route vs structural labels", () => {
    expect(isRouteLabel("GET /api/users")).toBe(true);
    expect(isStructuralDomainLabel("hooks")).toBe(true);
    expect(isStructuralDomainLabel("Personal")).toBe(false);
  });

  it("accepts large semantic overview because UI density-caps Dependencies", () => {
    const manyComponents = Array.from({ length: 200 }, (_, index) => ({
      id: `c${index}`,
      kind: "component",
      label: `Comp${index}`,
    }));
    const result = assertAnalysisSemantics(
      {
        summary: { graph: { nodes: 2 } },
        blueprint: {
          graph: {
            nodes: [
              { id: "app", kind: "application", label: "hr", metadata: {} },
              { id: "svc", kind: "service", label: "Auth", metadata: {} },
            ],
            edges: [],
            snapshots: [],
          },
          semanticSystemModel: {
            entities: [{ id: "d1", kind: "business-domain", label: "Personal" }, ...manyComponents],
          },
          routes: [],
          facts: [],
        },
      },
      { enrichmentOff: false },
    );
    expect(result.passed).toBe(true);
    expect(result.summary.dependencyCandidateCount).toBe(DEPENDENCIES_COMPLEXITY_MAX);
  });

  it("fails when Dependencies has no semantic overview and primary graph explodes", () => {
    const manyServices = Array.from({ length: DEPENDENCIES_COMPLEXITY_MAX + 5 }, (_, index) => ({
      id: `svc-${index}`,
      kind: "service",
      label: `Svc${index}`,
      metadata: {},
    }));
    const result = assertAnalysisSemantics(
      {
        summary: { graph: { nodes: manyServices.length } },
        blueprint: {
          graph: { nodes: manyServices, edges: [], snapshots: [] },
          semanticSystemModel: { entities: [] },
          routes: [],
          facts: [],
        },
      },
      { enrichmentOff: false },
    );
    expect(result.passed).toBe(false);
    expect(result.failures.some((item) => /no semantic overview/i.test(item))).toBe(true);
  });
});
