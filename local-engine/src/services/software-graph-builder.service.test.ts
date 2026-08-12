/**
 * Unit tests for software-graph-builder.service.ts
 * Location: local-engine/src/services/software-graph-builder.service.test.ts
 */

import { describe, expect, it } from "vitest";
import { buildSoftwareGraph } from "./software-graph-builder.service.js";
import type { RawBlueprintScan } from "../types/api.types.js";

function makeScan(overrides: Partial<RawBlueprintScan> = {}): RawBlueprintScan {
  return {
    providerId: "autoguide",
    projectId: "test-project",
    localPath: "/tmp/test-project",
    analyzedAt: new Date().toISOString(),
    routes: [],
    facts: [],
    filesAnalyzed: 0,
    ...overrides,
  };
}

describe("buildSoftwareGraph", () => {
  it("returns empty valid graph for empty scan", () => {
    const scan = makeScan();
    const graph = buildSoftwareGraph(scan);

    expect(graph.version).toBe(1);
    expect(graph.projectId).toBe("test-project");
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.condensed).toBe(false);
    expect(graph.nodes.some((n) => n.kind === "organization")).toBe(true);
    expect(graph.nodes.some((n) => n.kind === "application")).toBe(true);
    expect(graph.nodes.some((n) => n.kind === "runtime")).toBe(true);
  });

  it("creates domain/layer/module/file hierarchy from route paths", () => {
    const scan = makeScan({
      filesAnalyzed: 3,
      routes: [
        {
          id: "route:users:get",
          method: "get",
          path: "/api/users",
          filePath: "src/routes/users.ts",
          line: 10,
        },
      ],
      // Sibling dirs under src so `routes` becomes a domain candidate (P0-10).
      facts: [
        {
          id: "f-svc",
          kind: "db-read",
          filePath: "src/services/users.ts",
          line: 1,
          snippet: "find",
          metadata: {},
        },
        {
          id: "f-repo",
          kind: "db-read",
          filePath: "src/repositories/users.ts",
          line: 1,
          snippet: "find",
          metadata: {},
        },
      ],
    });

    const graph = buildSoftwareGraph(scan);

    expect(graph.nodes.some((n) => n.kind === "domain" && n.id === "domain:routes")).toBe(true);
    expect(
      graph.nodes.some((n) => n.kind === "layer" && n.id === "layer:routes:presentation"),
    ).toBe(true);
    expect(
      graph.nodes.some((n) => n.kind === "module" && n.id === "module:routes:presentation:routes"),
    ).toBe(true);
    expect(graph.nodes.some((n) => n.kind === "file" && n.id === "file:src/routes/users.ts")).toBe(
      true,
    );
    expect(graph.nodes.some((n) => n.kind === "route" && n.id === "route:route:users:get")).toBe(
      true,
    );
    expect(
      graph.nodes.some(
        (n) =>
          n.kind === "domain" && n.id === "domain:routes" && n.metadata?.domainSource === "path",
      ),
    ).toBe(true);
  });

  it("maps facts to evidence and inferred nodes", () => {
    const scan = makeScan({
      filesAnalyzed: 1,
      facts: [
        {
          id: "fact:1",
          kind: "autoguide:db-read",
          filePath: "src/routes/users.ts",
          line: 15,
          snippet: "supabase.from('users').select()",
        },
      ],
    });

    const graph = buildSoftwareGraph(scan);

    expect(graph.evidence.length).toBe(1);
    expect(graph.evidence[0].excerpt).toContain("supabase");
    expect(graph.nodes.some((n) => n.kind === "table")).toBe(true);
    expect(graph.edges.some((e) => e.kind === "data")).toBe(true);
  });

  it("sanitizes long snippets and secret-like metadata", () => {
    const scan = makeScan({
      filesAnalyzed: 1,
      facts: [
        {
          id: "fact:2",
          kind: "autoguide:auth",
          filePath: "src/routes/auth.ts",
          line: 1,
          snippet: "// " + "x ".repeat(200),
          metadata: {
            apiKey: "super-secret",
            safeField: "ok",
            headers: [
              "Authorization: Bearer sk-12345678901234567890123456789012345678901234567890",
            ],
          },
        },
      ],
    });

    const graph = buildSoftwareGraph(scan);
    const evidence = graph.evidence[0];
    const node = graph.nodes.find((n) => n.kind === "service");

    expect(evidence.excerpt.endsWith("…")).toBe(true);
    expect(evidence.excerpt.length).toBeLessThanOrEqual(201);
    expect(node?.metadata.apiKey).toBeUndefined();
    expect(node?.metadata.safeField).toBe("ok");
    expect((node?.metadata.headers as string[])[0]).not.toContain("sk-");
    expect((node?.metadata.headers as string[])[0]).toContain("***");
  });

  it("rejects invalid scan input", () => {
    const scan = makeScan({ projectId: "" });
    expect(() => buildSoftwareGraph(scan)).toThrow("Invalid RawBlueprintScan");
  });

  it("marks condensed and truncates when limits exceeded", { timeout: 15000 }, () => {
    const routes = Array.from({ length: 3000 }, (_, i) => ({
      id: `route:${i}`,
      method: "get",
      path: `/route/${i}`,
      filePath: `src/routes/route${i}.ts`,
      line: 1,
    }));
    const scan = makeScan({ filesAnalyzed: 3000, routes });
    const graph = buildSoftwareGraph(scan);

    expect(graph.condensed).toBe(true);
    expect(graph.nodes.length).toBeLessThanOrEqual(2500);
    expect(graph.edges.length).toBeLessThanOrEqual(5000);
    expect(graph.metrics.find((m) => m.name === "nodeCount")?.value).toBeGreaterThan(2500);
  });

  it("creates import and call edges from AST facts", () => {
    const scan = makeScan({
      filesAnalyzed: 2,
      facts: [
        {
          id: "fact:import",
          kind: "ast-import",
          filePath: "src/a.ts",
          line: 1,
          snippet: "import { x } from './b'",
          metadata: { resolvedPath: "src/b.ts" },
        },
        {
          id: "fact:call",
          kind: "ast-call",
          filePath: "src/a.ts",
          line: 5,
          snippet: "doWork()",
          metadata: { targetFile: "src/b.ts" },
        },
      ],
    });

    const graph = buildSoftwareGraph(scan);

    expect(graph.edges.some((e) => e.kind === "imports")).toBe(true);
    expect(graph.edges.some((e) => e.kind === "calls")).toBe(true);
    const importEdge = graph.edges.find((e) => e.kind === "imports");
    expect(importEdge?.metadata.evidenceFactId).toBe("fact:import");
  });

  it("uses pathCatalog for segment-spread when facts are thin (erpnext)", () => {
    const pathCatalog = [
      "erpnext/accounts/doctype/account/account.py",
      "erpnext/buying/doctype/supplier/supplier.py",
      "erpnext/crm/doctype/lead/lead.py",
      "erpnext/stock/doctype/item/item.py",
      "erpnext/selling/doctype/customer/customer.py",
      "erpnext/accounts/doctype/payment/payment.py",
      "erpnext/buying/doctype/purchase_order/purchase_order.py",
      "erpnext/crm/doctype/opportunity/opportunity.py",
      "erpnext/stock/doctype/warehouse/warehouse.py",
      "erpnext/selling/doctype/quotation/quotation.py",
    ];
    // Thin facts: one file per module — without pathCatalog, sibling stats
    // would be too weak; with catalog, accounts/buying resolve as domains.
    const scan = makeScan({
      filesAnalyzed: 2,
      pathCatalog,
      facts: [
        {
          id: "fact:accounts",
          kind: "db-read",
          filePath: "erpnext/accounts/doctype/account/account.py",
          line: 1,
          snippet: "pass",
          metadata: {},
        },
        {
          id: "fact:buying",
          kind: "db-read",
          filePath: "erpnext/buying/doctype/supplier/supplier.py",
          line: 1,
          snippet: "pass",
          metadata: {},
        },
      ],
    });

    const graph = buildSoftwareGraph(scan);
    const domains = graph.nodes.filter((n) => n.kind === "domain").map((n) => n.label);
    expect(domains).toEqual(expect.arrayContaining(["accounts", "buying"]));
    expect(domains).not.toContain("doctype");
  });

  it("classifies api and event edges from facts", () => {
    const scan = makeScan({
      filesAnalyzed: 1,
      facts: [
        {
          id: "fact:api",
          kind: "autoguide:external-api",
          filePath: "src/client.ts",
          line: 2,
          snippet: "fetch('/api')",
        },
        {
          id: "fact:event",
          kind: "autoguide:event-emit",
          filePath: "src/events.ts",
          line: 4,
          snippet: "emitter.emit('done')",
        },
      ],
    });

    const graph = buildSoftwareGraph(scan);

    expect(graph.edges.some((e) => e.kind === "api")).toBe(true);
    expect(graph.edges.some((e) => e.kind === "event")).toBe(true);
  });

  it("creates execution path groups for routes", () => {
    const scan = makeScan({
      filesAnalyzed: 1,
      routes: [
        {
          id: "route:users:get",
          method: "GET",
          path: "/users",
          filePath: "src/routes/users.ts",
          line: 10,
        },
      ],
      facts: [
        {
          id: "fact:db",
          kind: "autoguide:db-read",
          filePath: "src/routes/users.ts",
          line: 12,
          snippet: "from('users').select()",
        },
      ],
    });

    const graph = buildSoftwareGraph(scan);
    const executionGroup = graph.groups.find((group) => group.id.startsWith("execution:"));
    expect(executionGroup).toBeDefined();
    expect(executionGroup?.nodeIds.length).toBeGreaterThan(0);
  });

  it("includes same-module service data tables in execution path", () => {
    const scan = makeScan({
      filesAnalyzed: 2,
      routes: [
        {
          id: "POST /api/leaves",
          method: "POST",
          path: "/api/leaves",
          filePath: "app/modules/leaves/leaves.routes.ts",
          line: 62,
        },
      ],
      facts: [
        {
          id: "fact:auth",
          kind: "auth-check",
          filePath: "app/modules/leaves/leaves.routes.ts",
          line: 62,
          snippet: "authorize('hr.calendar.leave.request')",
        },
        {
          id: "fact:db",
          kind: "db-write",
          filePath: "app/modules/leaves/leaves.service.ts",
          line: 40,
          snippet: "this.prisma.leaveRequest.create({})",
          metadata: { table: "leaveRequest", framework: "prisma" },
        },
      ],
    });

    const graph = buildSoftwareGraph(scan);
    const executionGroup = graph.groups.find((group) => group.id.startsWith("execution:"));
    expect(executionGroup).toBeDefined();
    const tableNodes = graph.nodes.filter((node) => node.kind === "table");
    expect(tableNodes.length).toBeGreaterThan(0);
    expect(executionGroup?.nodeIds.some((id) => tableNodes.some((t) => t.id === id))).toBe(true);
    expect(executionGroup?.nodeIds.length).toBeGreaterThanOrEqual(3);
  });

  it("prefers leave routes and wires LeaveRequest tables into leave paths (P1-2)", () => {
    const scan = makeScan({
      filesAnalyzed: 3,
      routes: [
        {
          id: "GET /",
          method: "GET",
          path: "/",
          filePath: "app/modules/audit-logs/audit-logs.routes.ts",
          line: 1,
        },
        {
          id: "POST /api/leaves",
          method: "POST",
          path: "/api/leaves",
          filePath: "app/modules/leaves/leaves.routes.ts",
          line: 10,
        },
      ],
      facts: [
        {
          id: "fact:db",
          kind: "db-write",
          filePath: "app/modules/leaves/leaves.service.ts",
          line: 40,
          snippet: "this.prisma.leaveRequest.create({})",
          metadata: { table: "leaveRequest", framework: "prisma" },
        },
      ],
    });

    const graph = buildSoftwareGraph(scan);
    const executionGroups = graph.groups.filter((g) => g.id.startsWith("execution:"));
    const leaveGroup = executionGroups.find(
      (g) => g.id.includes("leaves") || g.label.toLowerCase().includes("leave"),
    );
    expect(leaveGroup).toBeDefined();
    expect(executionGroups[0]?.label.toLowerCase()).toMatch(/leave/);
    expect(leaveGroup?.nodeIds.length).toBeGreaterThanOrEqual(3);
    const tableNodes = graph.nodes.filter((n) => n.kind === "table");
    expect(leaveGroup?.nodeIds.some((id) => tableNodes.some((t) => t.id === id))).toBe(true);
    expect(
      graph.edges.some((e) => e.kind === "data" && leaveGroup?.nodeIds.includes(e.targetId)),
    ).toBe(true);
  });

  it("promotes all Prisma schema models to table nodes before route flood (P2-1)", () => {
    const modelNames = Array.from({ length: 40 }, (_, i) =>
      i === 35 ? "LeaveRequest" : `Model${i}`,
    );
    const prismaFacts = modelNames.map((table, i) => ({
      id: `fact:prisma:${table}`,
      kind: "db-write" as const,
      filePath: "prisma/schema.prisma",
      line: i + 1,
      snippet: `model ${table} { id String }`,
      metadata: { table, operation: "prisma-model", framework: "prisma" },
    }));
    const routes = Array.from({ length: 200 }, (_, i) => ({
      id: `GET /api/r${i}`,
      method: "GET",
      path: `/api/r${i}`,
      filePath: `app/modules/m${i % 50}/routes-${i}.ts`,
      line: 1,
    }));

    const graph = buildSoftwareGraph(
      makeScan({
        filesAnalyzed: 250,
        routes,
        facts: prismaFacts,
      }),
    );

    const tableLabels = graph.nodes.filter((n) => n.kind === "table").map((n) => n.label);
    expect(tableLabels.length).toBe(40);
    expect(tableLabels).toContain("LeaveRequest");
    expect(tableLabels).toContain("Model0");
    expect(tableLabels).toContain("Model39");
  });

  it("wires schema.prisma LeaveRequest into leave paths when table has no /leaves/ path (P2-2)", () => {
    const scan = makeScan({
      filesAnalyzed: 3,
      routes: [
        {
          id: "GET /api/leaves",
          method: "GET",
          path: "/api/leaves",
          filePath: "app/modules/leaves/leaves.routes.ts",
          line: 10,
        },
        {
          id: "GET /",
          method: "GET",
          path: "/",
          filePath: "app/modules/audit-logs/audit-logs.routes.ts",
          line: 1,
        },
      ],
      facts: [
        {
          id: "fact:prisma:LeaveRequest",
          kind: "db-write",
          filePath: "prisma/schema.prisma",
          line: 36,
          snippet: "model LeaveRequest { id String }",
          metadata: {
            table: "LeaveRequest",
            operation: "prisma-model",
            framework: "prisma",
          },
        },
        {
          id: "fact:auth",
          kind: "auth-check",
          filePath: "app/modules/leaves/leaves.routes.ts",
          line: 8,
          snippet: "authorize('hr.leave.request')",
        },
      ],
    });

    const graph = buildSoftwareGraph(scan);
    const leaveGroup = graph.groups.find(
      (g) => g.id.startsWith("execution:") && g.label.toLowerCase().includes("leave"),
    );
    expect(leaveGroup).toBeDefined();
    expect(leaveGroup?.nodeIds.length).toBeGreaterThanOrEqual(3);
    const leaveTable = graph.nodes.find(
      (n) => n.kind === "table" && /leaverequest/i.test(n.label.replace(/[^a-zA-Z0-9]/g, "")),
    );
    expect(leaveTable).toBeDefined();
    expect(leaveGroup?.nodeIds).toContain(leaveTable!.id);
    expect(graph.edges.some((e) => e.kind === "data" && e.targetId === leaveTable!.id)).toBe(true);
  });

  it("emits honest non-http execution group when no routes exist", () => {
    const scan = makeScan({
      filesAnalyzed: 1,
      routes: [],
      facts: [
        {
          id: "fact:file",
          kind: "external-api-call",
          filePath: "apps/meteor/server/methods/sendMessage.ts",
          line: 1,
          snippet: "Meteor.methods({ sendMessage() {} })",
        },
      ],
    });
    const graph = buildSoftwareGraph(scan);
    const nonHttp = graph.groups.find((group) => group.id === "execution:non-http:0");
    expect(nonHttp).toBeDefined();
    expect(nonHttp?.label).toMatch(/Non-HTTP/i);
  });

  it("promotes compose+prisma infra engines before route flood (P3-2)", () => {
    const scan = makeScan({
      filesAnalyzed: 3,
      routes: [
        {
          id: "r1",
          method: "GET",
          path: "/api/health",
          filePath: "backend/app/health.routes.ts",
          line: 1,
        },
      ],
      facts: [
        {
          id: "fact:compose-pg",
          kind: "infra-service",
          filePath: "docker-compose.yml",
          line: 10,
          snippet: "image: postgres:16-alpine",
          metadata: {
            service: "PostgreSQL",
            source: "docker-compose",
            image: "postgres:16-alpine",
          },
        },
        {
          id: "fact:compose-redis",
          kind: "infra-service",
          filePath: "docker-compose.yml",
          line: 20,
          snippet: "image: redis:7-alpine",
          metadata: {
            service: "Redis",
            source: "docker-compose",
            image: "redis:7-alpine",
          },
        },
        {
          id: "fact:prisma-ds",
          kind: "infra-service",
          filePath: "backend/prisma/schema.prisma",
          line: 7,
          snippet: 'provider = "postgresql"',
          metadata: {
            service: "PostgreSQL",
            source: "prisma-datasource",
            provider: "postgresql",
            framework: "prisma",
          },
        },
      ],
    });
    const graph = buildSoftwareGraph(scan);
    const pg = graph.nodes.find((n) => n.id === "infra:postgresql" || n.label === "PostgreSQL");
    const redis = graph.nodes.find((n) => n.id === "infra:redis" || n.label === "Redis");
    expect(pg).toBeDefined();
    expect(redis).toBeDefined();
    expect(pg?.kind).toBe("table");
    expect(redis?.kind).toBe("table");
    // No invented Stub LB from this path
    expect(graph.nodes.some((n) => /LOAD BALANCER/i.test(n.label))).toBe(false);
  });
});
