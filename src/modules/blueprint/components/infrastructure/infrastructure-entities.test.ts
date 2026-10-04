/**
 * RVP-9 infrastructure entity classification tests.
 */

import { describe, expect, it } from "vitest";
import type { SoftwareGraph } from "../../types";
import {
  isInfrastructureEntity,
  resolveInfrastructureRuntimeStatus,
  selectInfrastructureNodes,
} from "./infrastructure-entities.js";
import { projectInfrastructureGraph } from "./_projection.js";
import { classifyGraphNodeTopologyTier } from "./build-topology.js";

function baseGraph(nodes: SoftwareGraph["nodes"]): SoftwareGraph {
  return {
    version: 1,
    projectId: "demo",
    analyzedAt: "2026-10-02T00:00:00.000Z",
    scopes: [],
    nodes,
    edges: [],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 5000 },
  };
}

describe("infrastructure entities (RVP-9)", () => {
  it("rejects files and routes as infrastructure entities", () => {
    expect(
      isInfrastructureEntity({
        id: "file:a",
        kind: "file",
        label: "index.ts",
        filePath: "src/index.ts",
        metadata: { runtime: "browser" },
      }),
    ).toBe(false);
    expect(
      isInfrastructureEntity({
        id: "route:home",
        kind: "route",
        label: "GET /",
        filePath: "src/routes/home.ts",
        metadata: {},
      }),
    ).toBe(false);
  });

  it("accepts compose/k8s/dockerfile deployment services and evidenced datastores", () => {
    expect(
      isInfrastructureEntity({
        id: "svc:api",
        kind: "service",
        label: "api",
        metadata: { source: "docker-compose", ports: "3000" },
      }),
    ).toBe(true);
    expect(
      isInfrastructureEntity({
        id: "svc:docker-app",
        kind: "service",
        label: "app",
        metadata: { source: "dockerfile", ports: "3000" },
      }),
    ).toBe(true);
    expect(
      isInfrastructureEntity({
        id: "table:users",
        kind: "table",
        label: "users",
        filePath: "prisma/schema.prisma",
        metadata: {},
      }),
    ).toBe(true);
    expect(
      isInfrastructureEntity({
        id: "ext:stripe",
        kind: "external",
        label: "Stripe",
        metadata: {},
      }),
    ).toBe(true);
  });

  it("does not project routes/files/softort runtimes into infrastructure graph", () => {
    const graph = baseGraph([
      {
        id: "route:home",
        kind: "route",
        label: "GET /",
        filePath: "src/a.ts",
        metadata: {},
      },
      {
        id: "file:index",
        kind: "file",
        label: "index.ts",
        filePath: "src/index.ts",
        metadata: { runtime: "browser" },
      },
      {
        id: "rt:browser",
        kind: "runtime",
        label: "browser",
        metadata: {},
      },
      {
        id: "svc:web",
        kind: "service",
        label: "web",
        metadata: { source: "docker-compose" },
      },
      {
        id: "table:pg",
        kind: "table",
        label: "postgres",
        filePath: "docker-compose.yml",
        metadata: { source: "docker-compose" },
      },
    ]);
    const projected = projectInfrastructureGraph(graph);
    expect(projected.nodes.map((node) => node.id).sort()).toEqual(["svc:web", "table:pg"]);
    expect(projected.nodes.some((node) => node.kind === "route")).toBe(false);
    expect(projected.nodes.some((node) => node.kind === "file")).toBe(false);
  });

  it("uses RUNNING only with runtime evidence", () => {
    expect(
      resolveInfrastructureRuntimeStatus({
        id: "svc:web",
        kind: "service",
        label: "web",
        metadata: { source: "docker-compose" },
      }).label,
    ).toBe("DECLARED");
    expect(
      resolveInfrastructureRuntimeStatus({
        id: "svc:web",
        kind: "service",
        label: "web",
        metadata: { source: "docker-compose", runtimeObserved: true },
      }).label,
    ).toBe("RUNNING");
    expect(resolveInfrastructureRuntimeStatus(null).label).toBe("UNKNOWN");
  });

  it("selectInfrastructureNodes returns empty for code-only graphs", () => {
    const graph = baseGraph([
      {
        id: "file:a",
        kind: "file",
        label: "a.ts",
        filePath: "a.ts",
        metadata: { runtime: "edge" },
      },
      {
        id: "route:r",
        kind: "route",
        label: "GET /",
        metadata: {},
      },
    ]);
    expect(selectInfrastructureNodes(graph)).toEqual([]);
    expect(projectInfrastructureGraph(graph).nodes).toEqual([]);
  });

  it("topology classification no longer treats routes as services", () => {
    expect(
      classifyGraphNodeTopologyTier({ id: "r1", label: "GET /app/health", kind: "route" }),
    ).toBeNull();
    expect(
      classifyGraphNodeTopologyTier({ id: "rt1", label: "browser", kind: "runtime" }),
    ).toBeNull();
  });
});
