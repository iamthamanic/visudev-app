/**
 * RVP-8 execution use-case pipeline tests.
 */

import { describe, expect, it } from "vitest";
import type { SoftwareGraph } from "../../types";
import {
  buildExecutionUseCasePipeline,
  EXECUTION_STATION_ORDER,
} from "./execution-usecase-pipeline.js";
import { projectExecutionGraph } from "./_projection.js";

function graphFixture(): SoftwareGraph {
  return {
    version: 1,
    projectId: "demo",
    analyzedAt: "2026-10-02T00:00:00.000Z",
    scopes: [],
    nodes: [
      {
        id: "route:home",
        kind: "route",
        label: "GET /",
        filePath: "src/routes/home.ts",
        line: 1,
        metadata: { routeId: "home", path: "/" },
      },
      {
        id: "file:auth",
        kind: "file",
        label: "requireAuth",
        filePath: "src/middleware/auth.ts",
        line: 10,
        metadata: {},
      },
      {
        id: "file:auth-dup",
        kind: "file",
        label: "checkSession",
        filePath: "src/middleware/auth.ts",
        line: 40,
        metadata: {},
      },
      {
        id: "svc:home",
        kind: "service",
        label: "HomeUseCase",
        filePath: "src/services/home-use-case.ts",
        line: 1,
        metadata: { type: "Use Case" },
      },
      {
        id: "repo:users",
        kind: "repository",
        label: "UsersRepo",
        filePath: "src/repos/users.ts",
        line: 1,
        metadata: {},
      },
      {
        id: "file:noise",
        kind: "file",
        label: "random.ts",
        // no filePath evidence intentionally omitted via empty — wait need path for evidence rule
        filePath: "",
        metadata: {},
      },
    ],
    edges: [
      {
        id: "e1",
        kind: "calls",
        sourceId: "route:home",
        targetId: "file:auth",
        metadata: {},
      },
      {
        id: "e2",
        kind: "calls",
        sourceId: "route:home",
        targetId: "file:auth-dup",
        metadata: {},
      },
      {
        id: "e3",
        kind: "calls",
        sourceId: "file:auth",
        targetId: "svc:home",
        metadata: {},
      },
      {
        id: "e4",
        kind: "data",
        sourceId: "svc:home",
        targetId: "repo:users",
        metadata: {},
      },
      {
        id: "e-noise",
        kind: "contains",
        sourceId: "route:home",
        targetId: "file:noise",
        metadata: {},
      },
    ],
    evidence: [
      {
        id: "ev-route",
        factId: "f1",
        kind: "route",
        filePath: "src/routes/home.ts",
        line: 1,
        excerpt: "GET /",
        nodeId: "route:home",
      },
      {
        id: "ev-auth",
        factId: "f2",
        kind: "auth",
        filePath: "src/middleware/auth.ts",
        line: 10,
        excerpt: "requireAuth",
        nodeId: "file:auth",
      },
      {
        id: "ev-uc",
        factId: "f3",
        kind: "service",
        filePath: "src/services/home-use-case.ts",
        line: 1,
        excerpt: "HomeUseCase",
        nodeId: "svc:home",
      },
      {
        id: "ev-repo",
        factId: "f4",
        kind: "repository",
        filePath: "src/repos/users.ts",
        line: 1,
        excerpt: "UsersRepo",
        nodeId: "repo:users",
      },
    ],
    groups: [
      {
        id: "execution:home:0",
        kind: "route",
        label: "GET /",
        nodeIds: [
          "route:home",
          "file:auth",
          "file:auth-dup",
          "file:auth",
          "svc:home",
          "repo:users",
        ],
      },
    ],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 5000 },
  };
}

describe("execution use-case pipeline (RVP-8)", () => {
  it("builds evidenced stations in canonical order and dedupes auth", () => {
    const pipeline = buildExecutionUseCasePipeline(graphFixture(), "home");
    expect(pipeline).not.toBeNull();
    expect(pipeline!.steps.every((step) => step.evidenceIds.length > 0)).toBe(true);
    expect(pipeline!.steps.every((step) => step.durationMs === null)).toBe(true);

    const stations = pipeline!.steps.map((step) => step.station);
    expect(stations).toContain("trigger");
    expect(stations).toContain("auth");
    expect(stations).toContain("use-case");
    expect(stations).toContain("data");
    expect(stations.filter((station) => station === "auth")).toHaveLength(1);

    const ranks = stations.map((station) => EXECUTION_STATION_ORDER.indexOf(station));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("omits missing stations and ignores non-evidenced contains edges", () => {
    const pipeline = buildExecutionUseCasePipeline(graphFixture(), "home");
    expect(pipeline!.steps.some((step) => step.nodeId === "file:noise")).toBe(false);
    expect(pipeline!.steps.some((step) => step.station === "external")).toBe(false);
    expect(pipeline!.steps.some((step) => step.station === "validation")).toBe(false);
  });

  it("projectExecutionGraph prefers semantic pipeline when multi-station", () => {
    const projection = projectExecutionGraph(graphFixture(), { routeId: "home" });
    expect(projection).not.toBeNull();
    expect(projection!.stepNodeIds[0]).toBe("route:home");
    expect(projection!.stepNodeIds).toContain("svc:home");
    expect(projection!.stepNodeIds.filter((id) => id.startsWith("file:auth")).length).toBe(1);
  });
});
