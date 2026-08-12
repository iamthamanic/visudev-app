/** Tests for VisuDevGraph export sanitization and boundary coercion. */

import { assertEquals } from "std/assert";
import type { VisuDevGraph } from "../../dto/graph/visudev-graph.dto.ts";
import {
  capGraphForExport,
  FACT_EXPORT_PRIORITY,
  selectFactsPreservingPrismaModels,
} from "./graph-export-cap.ts";
import { repairGraphReferences } from "./graph-export-integrity.ts";
import { sanitizeGraphForExport } from "./graph-export-sanitize.ts";

const baseGraph = (): VisuDevGraph => ({
  version: 1,
  evidence: [{
    id: "ev-1",
    factId: "fact-1",
    subjectType: "node",
    subjectId: "node-1",
    filePath: "routes/a.ts",
    line: 1,
    snippet: "code",
    summary: "summary",
  }],
  nodes: [{
    id: "node-1",
    kind: "route",
    label: "GET /api/items",
    state: "confirmed",
    evidenceIds: ["ev-1"],
    scopeId: "GET /api/items",
  }],
  edges: [{
    id: "edge-1",
    fromNodeId: "node-1",
    toNodeId: "node-1",
    kind: "reads",
    state: "confirmed",
    evidenceIds: ["ev-1"],
    scopeId: "GET /api/items",
  }],
  scopes: [{
    id: "GET /api/items",
    kind: "route",
    label: "GET /api/items",
    nodeIds: ["node-1"],
    edgeIds: ["edge-1"],
  }],
  findings: [],
});

Deno.test("sanitizeGraphForExport remaps scope nodeIds and edgeIds with node ids", () => {
  const longNodeId =
    "node-with-very-long-id-that-will-be-truncated-or-redacted-for-export-boundary-check";
  const graph: VisuDevGraph = {
    ...baseGraph(),
    evidence: [{
      ...baseGraph().evidence[0],
      subjectId: longNodeId,
    }],
    nodes: [{
      ...baseGraph().nodes[0],
      id: longNodeId,
      evidenceIds: ["ev-1"],
    }],
    edges: [{
      ...baseGraph().edges[0],
      id: "edge-1",
      fromNodeId: longNodeId,
      toNodeId: longNodeId,
    }],
    scopes: [{
      ...baseGraph().scopes[0],
      nodeIds: [longNodeId],
      edgeIds: ["edge-1"],
    }],
  };

  const sanitized = sanitizeGraphForExport(graph);
  const remappedNodeId = sanitized.nodes[0].id;
  assertEquals(remappedNodeId.length <= 80, true);
  assertEquals(sanitized.scopes[0].nodeIds, [remappedNodeId]);
  assertEquals(sanitized.edges[0].fromNodeId, remappedNodeId);
  assertEquals(sanitized.evidence[0].subjectId.length <= 120, true);
});

Deno.test("capGraphForExport returns empty graph for malformed input", () => {
  const result = capGraphForExport(null);
  assertEquals(result, {
    version: 1,
    nodes: [],
    edges: [],
    evidence: [],
    scopes: [],
    findings: [],
  });
});

Deno.test("coerceVisuDevGraphInput keeps valid nodes when evidence is malformed", () => {
  const result = capGraphForExport({
    version: 1,
    nodes: baseGraph().nodes,
    edges: [],
    evidence: [{ id: "", factId: "x" }],
    scopes: [],
    findings: [],
  });
  assertEquals(result.nodes.length, 1);
  assertEquals(result.evidence.length, 1);
  assertEquals(result.evidence[0].factId, "fact-fallback-1");
});

Deno.test("sanitizeGraphForExport avoids id collisions after truncation", () => {
  const prefix = "node-";
  const graph: VisuDevGraph = {
    version: 1,
    evidence: [],
    nodes: [
      {
        id: `${prefix}${"a".repeat(90)}`,
        kind: "route",
        label: "GET /a",
        state: "confirmed",
        evidenceIds: [],
      },
      {
        id: `${prefix}${"b".repeat(90)}`,
        kind: "route",
        label: "GET /b",
        state: "confirmed",
        evidenceIds: [],
      },
    ],
    edges: [],
    scopes: [],
    findings: [],
  };
  const sanitized = sanitizeGraphForExport(graph);
  assertEquals(sanitized.nodes[0].id !== sanitized.nodes[1].id, true);
});

Deno.test("repairGraphReferences drops edges with missing nodes", () => {
  const graph = baseGraph();
  graph.edges[0].fromNodeId = "missing-node";
  const repaired = repairGraphReferences(graph);
  assertEquals(repaired.edges.length, 0);
  assertEquals(repaired.scopes[0].edgeIds.length, 0);
});

Deno.test("capGraphForExport accepts unknown and validates output", () => {
  const result = capGraphForExport(baseGraph());
  assertEquals(result.version, 1);
  assertEquals(result.nodes.length, 1);
  assertEquals(result.scopes[0].nodeIds, result.nodes.map((node) => node.id));
});

import type { CodeFact } from "../../dto/blueprint/blueprint-document.dto.ts";

function modelFact(table: string, line: number): CodeFact {
  return {
    id: `m-${table}`,
    kind: "db-write",
    filePath: "packages/database/schema.prisma",
    line,
    snippet: `model ${table} {`,
    metadata: { table, operation: "prisma-model", framework: "prisma" },
  };
}

function routeFact(i: number, filePath?: string): CodeFact {
  return {
    id: `r-${i}`,
    kind: "api-route",
    filePath: filePath ?? `apps/web/app/api/r${i}/route.ts`,
    line: 1,
    snippet: `export async function GET() {}`,
    metadata: { method: "GET", path: `/api/r${i}` },
  };
}

function kindFact(
  kind: string,
  filePath: string,
  index: number,
): CodeFact {
  return {
    id: `${kind}-${filePath}-${index}`,
    kind,
    filePath,
    line: index + 1,
    snippet: `${kind} snippet`,
    metadata: {},
  };
}

Deno.test("selectFactsPreservingPrismaModels keeps all schema models under cap flood", () => {
  const models = Array.from(
    { length: 80 },
    (_, i) => modelFact(`Model${i}`, i + 1),
  );
  const routes = Array.from({ length: 400 }, (_, i) => routeFact(i));
  const { facts: selected } = selectFactsPreservingPrismaModels(
    [...routes, ...models],
    100,
  );
  const keptModels = selected.filter((f) =>
    f.metadata?.operation === "prisma-model"
  );
  assertEquals(keptModels.length, 80);
  assertEquals(selected.some((f) => f.metadata?.table === "Model79"), true);
});

Deno.test("selectFactsPreservingPrismaModels keeps LeaveRequest among many models", () => {
  const models = [
    ...Array.from({ length: 40 }, (_, i) => modelFact(`Other${i}`, i + 1)),
    modelFact("LeaveRequest", 99),
  ];
  const noise = Array.from({ length: 200 }, (_, i) => routeFact(i));
  const { facts: selected } = selectFactsPreservingPrismaModels([
    ...noise,
    ...models,
  ], 50);
  assertEquals(
    selected.some((f) => f.metadata?.table === "LeaveRequest"),
    true,
  );
});

Deno.test("selectFactsPreservingPrismaModels keeps infra-service past route flood (P3-2b)", () => {
  const infra: CodeFact = {
    id: "fact-compose-redis",
    kind: "infra-service",
    filePath: "docker-compose.yml",
    line: 12,
    snippet: "image: redis:7-alpine",
    metadata: {
      service: "Redis",
      source: "docker-compose",
      framework: "docker-compose",
    },
  };
  const noise = Array.from({ length: 400 }, (_, i) => routeFact(i));
  const { facts: selected } = selectFactsPreservingPrismaModels([
    ...noise,
    infra,
  ], 50);
  assertEquals(
    selected.some((f) =>
      f.kind === "infra-service" && f.metadata?.service === "Redis"
    ),
    true,
  );
});

Deno.test("selectFactsPreservingPrismaModels bounds infra-service preservation (P3-2b)", () => {
  const flood = Array.from({ length: 40 }, (_, i) => ({
    id: `fact-infra-${i}`,
    kind: "infra-service" as const,
    filePath: "docker-compose.yml",
    line: i + 1,
    snippet: `image: custom-${i}`,
    metadata: {
      service: `Service${i}`,
      source: "docker-compose",
      framework: "docker-compose",
    },
  }));
  const { facts: selected } = selectFactsPreservingPrismaModels(flood, 10);
  const infra = selected.filter((f) => f.kind === "infra-service");
  assertEquals(infra.length <= 16, true);
  assertEquals(infra.length, 16);
});

Deno.test("selection spreads across files before deepening", () => {
  const facts: CodeFact[] = [];
  for (let file = 0; file < 100; file += 1) {
    for (let i = 0; i < 20; i += 1) {
      facts.push(
        kindFact("misc", `src/file-${String(file).padStart(3, "0")}.ts`, i),
      );
    }
  }
  const { facts: selected, report } = selectFactsPreservingPrismaModels(
    facts,
    200,
  );
  const coveredFiles = new Set(selected.map((fact) => fact.filePath));
  assertEquals(coveredFiles.size, 100);
  assertEquals(report.filesCovered, 100);
  assertEquals(selected.length, 200);
});

Deno.test("auth-check outranks generic facts", () => {
  const authFacts = Array.from(
    { length: 400 },
    (_, i) => kindFact("auth-check", `src/auth/file-${i}.ts`, 0),
  );
  const genericFacts = Array.from(
    { length: 4000 },
    (_, i) => kindFact("misc", `src/other/file-${i}.ts`, 0),
  );
  const { facts: selected } = selectFactsPreservingPrismaModels(
    [...genericFacts, ...authFacts],
    500,
  );
  const authSelected = selected.filter((fact) => fact.kind === "auth-check");
  assertEquals(authSelected.length, 400);
});

Deno.test("factSelection reports extracted and selected counts", () => {
  const facts = [
    ...Array.from({ length: 50 }, (_, i) => routeFact(i)),
    modelFact("User", 1),
  ];
  const { report } = selectFactsPreservingPrismaModels(facts, 10);
  assertEquals(report.extracted, 51);
  assertEquals(report.selected, 10);
  assertEquals(report.byKind["api-route"]?.extracted, 50);
  assertEquals(typeof report.byKind["db-write"]?.selected, "number");
});

Deno.test("no cap means selected equals extracted", () => {
  const facts = Array.from({ length: 12 }, (_, i) => routeFact(i));
  const { facts: selected, report } = selectFactsPreservingPrismaModels(
    facts,
    100,
  );
  assertEquals(selected.length, 12);
  assertEquals(report.extracted, report.selected);
});

Deno.test("single file cannot consume the whole budget", () => {
  const dominant = Array.from(
    { length: 5000 },
    (_, i) => kindFact("misc", "src/huge.ts", i),
  );
  const others = Array.from(
    { length: 99 },
    (_, i) => kindFact("misc", `src/small-${i}.ts`, 0),
  );
  const { facts: selected } = selectFactsPreservingPrismaModels(
    [...dominant, ...others],
    200,
  );
  const covered = new Set(selected.map((fact) => fact.filePath));
  for (let i = 0; i < 99; i += 1) {
    assertEquals(covered.has(`src/small-${i}.ts`), true);
  }
});

Deno.test("FACT_EXPORT_PRIORITY is exported and ordered", () => {
  assertEquals(FACT_EXPORT_PRIORITY[0], "auth-check");
  assertEquals(FACT_EXPORT_PRIORITY.includes("ast-import"), true);
});
