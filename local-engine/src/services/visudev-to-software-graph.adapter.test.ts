/**
 * Adapter unit tests — VisuDevGraph passthrough must not collapse to containment-only.
 * Location: local-engine/src/services/visudev-to-software-graph.adapter.test.ts
 */

import { describe, expect, it } from "vitest";
import type { RawBlueprintScan, SoftwareGraph } from "../types/api.types.js";
import {
  adaptVisuDevGraphToSoftwareGraph,
  isUsableVisuDevGraph,
  resolveSoftwareGraphFromScan,
} from "./visudev-to-software-graph.adapter.js";

function baseScan(overrides: Partial<RawBlueprintScan> = {}): RawBlueprintScan {
  return {
    providerId: "legacy-blueprint-runner",
    projectId: "proj-nest",
    localPath: "/tmp/nest",
    analyzedAt: "2026-01-01T00:00:00.000Z",
    routes: [
      {
        id: "GET /users",
        method: "GET",
        path: "/users",
        filePath: "src/users.controller.ts",
        line: 10,
        pipeline: [{ kind: "auth" }, { kind: "handler" }],
      },
    ],
    facts: [],
    filesAnalyzed: 3,
    ...overrides,
  };
}

const visuDev = {
  version: 1 as const,
  nodes: [
    {
      id: "GET /users",
      kind: "route",
      label: "GET /users",
      state: "confirmed",
      filePath: "src/users.controller.ts",
      line: 10,
      evidenceIds: ["ev1"],
      metadata: { method: "GET", path: "/users" },
    },
    {
      id: "auth:jwt",
      kind: "auth",
      label: "JWT Auth",
      state: "confirmed",
      evidenceIds: ["ev2"],
    },
    {
      id: "table:User",
      kind: "table",
      label: "User",
      state: "confirmed",
      evidenceIds: [],
    },
  ],
  edges: [
    {
      id: "e-auth",
      fromNodeId: "GET /users",
      toNodeId: "auth:jwt",
      kind: "authenticates",
      state: "confirmed",
      evidenceIds: ["ev2"],
    },
    {
      id: "e-read",
      fromNodeId: "GET /users",
      toNodeId: "table:User",
      kind: "reads",
      state: "confirmed",
      evidenceIds: [],
    },
  ],
  evidence: [
    {
      id: "ev1",
      factId: "f1",
      subjectType: "node",
      subjectId: "GET /users",
      filePath: "src/users.controller.ts",
      line: 10,
      snippet: "@Get()",
      summary: "route",
    },
    {
      id: "ev2",
      factId: "f2",
      subjectType: "edge",
      subjectId: "e-auth",
      filePath: "src/users.controller.ts",
      line: 8,
      snippet: "@UseGuards(JwtAuthGuard)",
      summary: "auth",
    },
  ],
  scopes: [{ id: "GET /users", kind: "route", label: "GET /users", nodeIds: [], edgeIds: [] }],
  findings: [],
};

describe("visudev-to-software-graph adapter", () => {
  it("detects usable VisuDev graphs", () => {
    expect(isUsableVisuDevGraph(visuDev)).toBe(true);
    expect(isUsableVisuDevGraph({ version: 1, nodes: [], edges: [], evidence: [] })).toBe(false);
  });

  it("adapts VisuDevGraph with pipeline and evidenceKind tags", () => {
    const scan = baseScan();
    const graph = adaptVisuDevGraphToSoftwareGraph(visuDev, scan);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(visuDev.nodes.length);
    expect(graph.edges.length).toBeGreaterThanOrEqual(visuDev.edges.length);
    const route = graph.nodes.find((node) => node.id === "GET /users");
    expect(route?.metadata.pipeline).toEqual([{ kind: "auth" }, { kind: "handler" }]);
    const authEdge = graph.edges.find((edge) => edge.id === "e-auth");
    expect(authEdge?.metadata.evidenceKind).toBe("extracted");
    expect(authEdge?.kind).toBe("authenticates");
  });

  it("merges VisuDev into fact-built graph without dropping control edges", () => {
    const factBuilt: SoftwareGraph = {
      version: 1,
      projectId: "proj-nest",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      scopes: [],
      nodes: [
        {
          id: "file:src/users.controller.ts",
          kind: "file",
          label: "users.controller.ts",
          metadata: {},
        },
      ],
      edges: [
        {
          id: "contains-only",
          kind: "contains",
          sourceId: "mod",
          targetId: "file:src/users.controller.ts",
          metadata: {},
        },
      ],
      evidence: [],
      groups: [],
      metrics: [],
      condensed: false,
      limits: { maxNodes: 100, maxEdges: 200 },
    };
    const merged = resolveSoftwareGraphFromScan(baseScan({ visuDevGraph: visuDev }), factBuilt);
    expect(merged.edges.some((edge) => edge.id === "e-auth")).toBe(true);
    expect(merged.edges.some((edge) => edge.id === "e-read")).toBe(true);
    expect(merged.nodes.some((node) => node.kind === "table")).toBe(true);
    expect(merged.edges.length).toBeGreaterThan(factBuilt.edges.length);
  });
});
