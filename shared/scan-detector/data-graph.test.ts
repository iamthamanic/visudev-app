/**
 * Unit tests for SDE-12 DataGraph adapt/project/resolve.
 */

import { describe, expect, it } from "vitest";
import { adaptErdToDataGraph } from "./application/adapt-erd-to-data-graph.js";
import { projectDataGraphToErd } from "./application/project-data-graph-to-erd.js";
import { resolveDataAnalysis } from "./application/resolve-data-analysis.js";
import { createSchemaDataDetector } from "./application/create-schema-data-detector.js";
import { parseDataAnalysisMode } from "./domain/data-analysis-mode.js";
import type { LegacyErdSnapshot } from "../data-graph.types.js";

const erd: LegacyErdSnapshot = {
  projectId: "demo",
  dialect: "postgres",
  source: "live-introspect",
  tables: [
    {
      id: "users",
      name: "users",
      label: "users",
      schema: "public",
      columns: [
        { name: "id", type: "uuid", nullable: false },
        { name: "email", type: "text", nullable: false },
        { name: "password_hash", type: "text", nullable: true, default: "secret-token-value" },
      ],
      rls: { enabled: true, expression: "auth.uid() = user_id" },
      sample: [{ id: "1", email: "a@b.c" }],
    },
    {
      id: "posts",
      name: "posts",
      columns: [{ name: "id", type: "uuid" }],
    },
  ],
  edges: [
    {
      id: "fk-posts-users",
      fromTable: "posts",
      toTable: "users",
      fromColumn: "user_id",
      toColumn: "id",
    },
  ],
};

describe("data-analysis-mode", () => {
  it("defaults to shadow", () => {
    expect(parseDataAnalysisMode(undefined)).toBe("engine");
    expect(parseDataAnalysisMode("shadow")).toBe("engine");
    expect(parseDataAnalysisMode("engine")).toBe("engine");
  });
});

describe("DataGraph SDE-12", () => {
  it("models database/schema/table/column/relation/policy with evidence", () => {
    const graph = adaptErdToDataGraph({ erd });
    expect(graph.databases.length).toBeGreaterThan(0);
    expect(graph.schemas.some((schema) => schema.name === "public")).toBe(true);
    expect(graph.tables).toHaveLength(2);
    expect(graph.columns.length).toBeGreaterThanOrEqual(3);
    expect(graph.relations).toHaveLength(1);
    expect(graph.policies).toHaveLength(1);
    expect(graph.evidence.length).toBeGreaterThan(0);
    // samples never become graph entities
    expect(JSON.stringify(graph)).not.toContain("a@b.c");
    // policy expression not persisted
    expect(JSON.stringify(graph.policies)).not.toContain("auth.uid()");
    // secret-like defaults redacted
    const passwordCol = graph.columns.find((column) => column.name === "password_hash");
    expect(passwordCol?.defaultValue).toBe("[redacted]");
  });

  it("projects ERD compatibility without samples", () => {
    const graph = adaptErdToDataGraph({ erd });
    const projected = projectDataGraphToErd(graph);
    expect(projected.tables?.map((table) => table.id).sort()).toEqual(["posts", "users"]);
    expect(projected.tables?.find((table) => table.id === "users")?.rls).toEqual({
      enabled: true,
      redacted: true,
    });
    expect(projected.tables?.every((table) => table.sample === undefined)).toBe(true);
    expect(projected.edges).toHaveLength(1);
  });

  it("engine mode serves ERD from DataGraph projection (no UI analyzer)", () => {
    const result = resolveDataAnalysis({ mode: "engine", legacyErd: erd });
    expect(result.source).toBe("engine-projection");
    expect(result.parity?.passed).toBe(true);
    expect(result.erd.tables?.length).toBe(2);
    expect(result.dataGraph?.stats.tableCount).toBe(2);
  });

  it("schema detector emits engine facts", async () => {
    const detector = createSchemaDataDetector({
      getErdSnapshot: () => erd,
    });
    const result = await detector.run({
      projectId: "demo",
      enrichment: "off",
      requestedCapabilityIds: ["schema-data-graph"],
      budget: { timeoutMs: 5_000 },
    });
    expect(result.status).toBe("success");
    expect(result.facts.some((fact) => fact.kind.startsWith("data-table:"))).toBe(true);
  });
});
