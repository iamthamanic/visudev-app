/**
 * Unit tests for PR-21 evidence-backed DataLineage builder.
 * Location: shared/scan-detector/build-data-lineage.test.ts
 */

import { describe, expect, it } from "vitest";
import type { DataGraph } from "../data-graph.types.js";
import type { SoftwareGraph } from "../software-graph.types.js";
import type { UiInteractionGraph } from "../ui-interaction-graph.types.js";
import { buildDataLineage } from "./application/build-data-lineage.js";
import type { ScanFact } from "./types.js";

const analyzedAt = "2026-10-05T12:00:00.000Z";

function baseSoftware(): SoftwareGraph {
  return {
    version: 1,
    projectId: "demo",
    analyzedAt,
    scopes: [],
    nodes: [
      {
        id: "route:/api/users",
        kind: "route",
        label: "GET /api/users",
        metadata: { routeId: "route:/api/users" },
      },
      {
        id: "svc:users",
        kind: "service",
        label: "UsersService",
        metadata: {},
      },
      {
        id: "table:users",
        kind: "table",
        label: "users",
        metadata: {},
      },
      {
        id: "route:/api/orphan",
        kind: "route",
        label: "GET /api/orphan",
        metadata: {},
      },
    ],
    edges: [
      {
        id: "e:route-svc",
        kind: "calls",
        sourceId: "route:/api/users",
        targetId: "svc:users",
        metadata: { evidenceFactId: "fact:route-svc" },
      },
      {
        id: "e:svc-table",
        kind: "data",
        sourceId: "svc:users",
        targetId: "table:users",
        metadata: { evidenceFactId: "fact:svc-table" },
      },
    ],
    evidence: [
      {
        id: "sg-ev-1",
        factId: "fact:route-svc",
        kind: "calls",
        filePath: "src/api/users.ts",
        line: 10,
        excerpt: "usersHandler → UsersService",
        edgeId: "e:route-svc",
      },
      {
        id: "sg-ev-2",
        factId: "fact:svc-table",
        kind: "data",
        filePath: "src/services/users.ts",
        line: 40,
        excerpt: "UsersService reads users table",
        edgeId: "e:svc-table",
      },
    ],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 10_000, maxEdges: 20_000 },
  };
}

function baseUi(): UiInteractionGraph {
  return {
    version: 1,
    projectId: "demo",
    analyzedAt,
    surfaces: [
      {
        id: "surface:users",
        kind: "page",
        label: "Users",
        status: "detected",
        confidence: 0.9,
        evidenceIds: ["ui-ev-1"],
      },
    ],
    transitions: [
      {
        id: "tr:load-users",
        kind: "navigate",
        fromSurfaceId: "surface:users",
        toSurfaceId: "surface:users",
        status: "detected",
        confidence: 0.85,
        evidenceIds: ["ui-ev-2"],
      },
      {
        id: "tr:no-bind",
        kind: "menu-action",
        fromSurfaceId: "surface:users",
        toSurfaceId: "surface:users",
        status: "inferred",
        confidence: 0.4,
        evidenceIds: ["ui-ev-3"],
      },
    ],
    evidence: [],
    stats: {
      surfaceCount: 1,
      transitionCount: 2,
      routeSurfaceCount: 1,
      stateSurfaceCount: 0,
      conflictCount: 0,
      runtimeOnlyCount: 0,
    },
  };
}

function baseData(): DataGraph {
  return {
    version: 1,
    projectId: "demo",
    analyzedAt,
    databases: [],
    schemas: [],
    tables: [
      {
        id: "dg:users",
        schemaId: "schema:public",
        name: "users",
        label: "users",
        provenance: "migration",
        status: "detected",
        confidence: 0.9,
        evidenceIds: ["fact:svc-table"],
        columnIds: [],
      },
      {
        id: "dg:name-only",
        schemaId: "schema:public",
        name: "users",
        label: "users",
        provenance: "unknown",
        status: "inferred",
        confidence: 0.2,
        evidenceIds: ["fact:unrelated"],
        columnIds: [],
      },
    ],
    columns: [],
    relations: [],
    policies: [],
    evidence: [],
    stats: {
      databaseCount: 0,
      schemaCount: 0,
      tableCount: 2,
      columnCount: 0,
      relationCount: 0,
      policyCount: 0,
      conflictCount: 0,
    },
  };
}

function bindFact(): ScanFact {
  return {
    id: "fact:ui-endpoint",
    kind: "ui-binds-endpoint",
    status: "SUPPORTED",
    confidence: 0.8,
    provenance: {
      originKind: "static",
      detectorId: "test",
    },
    subjectId: "tr:load-users",
    objectId: "route:/api/users",
    evidenceIds: ["scan-ev-1"],
  };
}

describe("buildDataLineage PR-21", () => {
  it("builds evidenced Screen → Interaction → Endpoint → Service → Data path", () => {
    const lineage = buildDataLineage({
      projectId: "demo",
      analyzedAt,
      software: baseSoftware(),
      ui: baseUi(),
      data: baseData(),
      scan: { facts: [bindFact()] },
    });

    const complete = lineage.paths.find((path) => path.id === "lineage:tr:load-users");
    expect(complete?.status).toBe("complete");
    expect(complete?.hops.map((hop) => hop.to.layer)).toEqual([
      "ui-interaction",
      "endpoint",
      "service-module",
      "data-entity",
    ]);
    expect(complete?.hops.every((hop) => hop.evidence.length > 0)).toBe(true);
    expect(complete?.hops.every((hop) => hop.knowledgeStatus)).toBeTruthy();
    expect(complete?.hops.at(-1)?.to.entityId).toBe("dg:users");
    expect(lineage.stats.completeCount).toBeGreaterThanOrEqual(1);
  });

  it("truncates honestly when UI→endpoint has no evidence", () => {
    const lineage = buildDataLineage({
      projectId: "demo",
      analyzedAt,
      software: baseSoftware(),
      ui: baseUi(),
      data: baseData(),
      scan: { facts: [bindFact()] },
    });

    const partial = lineage.paths.find((path) => path.id === "lineage:tr:no-bind");
    expect(partial?.status).toBe("partial");
    expect(partial?.truncationReason).toBe("no-evidenced-endpoint-for-interaction");
    expect(partial?.hops.some((hop) => hop.to.layer === "endpoint")).toBe(false);
  });

  it("never joins DataGraph tables by label alone", () => {
    const software = baseSoftware();
    // Remove shared fact id from the name-collision table path — only label matches.
    software.edges = software.edges.map((edge) =>
      edge.id === "e:svc-table"
        ? { ...edge, metadata: { evidenceFactId: "fact:other-table-edge" } }
        : edge,
    );
    software.evidence = software.evidence.map((item) =>
      item.edgeId === "e:svc-table"
        ? { ...item, factId: "fact:other-table-edge", id: "sg-ev-alt" }
        : item,
    );

    const data = baseData();
    data.tables = [
      {
        id: "dg:name-only",
        schemaId: "schema:public",
        name: "users",
        label: "users",
        provenance: "unknown",
        status: "inferred",
        confidence: 0.2,
        evidenceIds: ["fact:unrelated"],
        columnIds: [],
      },
    ];

    const lineage = buildDataLineage({
      projectId: "demo",
      analyzedAt,
      software,
      ui: baseUi(),
      data,
      scan: { facts: [bindFact()] },
    });

    const path = lineage.paths.find((item) => item.id === "lineage:tr:load-users");
    const dataHop = path?.hops.find((hop) => hop.to.layer === "data-entity");
    expect(dataHop?.to.entityId).not.toBe("dg:name-only");
    // Falls back to software-graph table node when DataGraph lacks shared evidence.
    expect(dataHop?.to.entityId).toBe("table:users");
  });

  it("stays runtime-neutral (no profiler / UI imports in model)", () => {
    const lineage = buildDataLineage({
      projectId: "demo",
      analyzedAt,
      software: baseSoftware(),
    });
    expect(lineage.version).toBe(1);
    expect(lineage.paths.length).toBeGreaterThan(0);
    expect(JSON.stringify(lineage)).not.toMatch(/sql.?profiler|useEffect|React/i);
  });
});
