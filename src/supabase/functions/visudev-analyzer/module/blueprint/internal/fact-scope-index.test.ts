import { assertEquals } from "std/assert";
import type { CodeFact } from "../../dto/blueprint/blueprint-document.dto.ts";
import type { RouteScope } from "../../dto/blueprint/route-scope.dto.ts";
import { buildRouteFactsIndex } from "./route-facts-index.ts";
import { sanitizeFactMetadataForExport } from "./fact-metadata-sanitizer.ts";
import { sanitizeFactsForExport } from "./export-sanitizer.ts";
import { sanitizeExportIdentifier } from "./evidence-sanitizer.ts";
import { sanitizeSnippetForExport } from "./snippet-sanitizer.ts";
import { buildEvidenceIndex } from "../graph/fact-graph-evidence.ts";

Deno.test("sanitizeSnippetForExport redacts bearer tokens and caps length", () => {
  const long = "x".repeat(200);
  assertEquals(sanitizeSnippetForExport(long).length, 121);
  assertEquals(
    sanitizeSnippetForExport(
      'headers: { "x-api-key": "super-long-secret-value" }',
    ),
    'headers: { "x-api-key": "***" }',
  );
  assertEquals(
    sanitizeSnippetForExport('const apiKey = "my-private-api-key-value"'),
    "const apiKey:***",
  );
});

Deno.test("sanitizeSnippetForExport redacts email and phone numbers", () => {
  assertEquals(
    sanitizeSnippetForExport("contact user@example.com or +1 (555) 123-4567"),
    "contact ***@*** or ***",
  );
});

Deno.test("buildEvidenceIndex sanitizes snippets before export", () => {
  const facts: CodeFact[] = [{
    id: "fact-a",
    kind: "auth-check",
    filePath: "routes/a.ts",
    line: 1,
    snippet: 'hdr.Authorization = "Bearer abc.def.ghi"',
    metadata: {},
  }];
  const index = buildEvidenceIndex(facts);
  assertEquals(index.list[0].snippet.includes("abc.def"), false);
});

Deno.test("buildEvidenceIndex assigns unique ids for duplicate fact ids", () => {
  const facts: CodeFact[] = [{
    id: "fact-dup",
    kind: "api-route",
    filePath: "routes/a.ts",
    line: 1,
    snippet: "app.get('/a', handler)",
    metadata: {},
  }, {
    id: "fact-dup",
    kind: "api-route",
    filePath: "routes/b.ts",
    line: 1,
    snippet: "app.get('/b', handler)",
    metadata: {},
  }];
  const index = buildEvidenceIndex(facts);
  assertEquals(index.list.length, 2);
  assertEquals(index.idForFact(facts[0]) !== index.idForFact(facts[1]), true);
});

Deno.test("buildRouteFactsIndex does not assign pre-route facts to first route", () => {
  const routes: RouteScope[] = [{
    id: "GET /api/items",
    method: "GET",
    path: "/api/items",
    filePath: "routes/items.ts",
    line: 10,
    relatedFiles: ["routes/items.ts"],
  }];
  const facts: CodeFact[] = [{
    id: "fact-import",
    kind: "db-read",
    filePath: "routes/items.ts",
    line: 2,
    snippet: "import { db } from '../db'",
    metadata: { table: "items" },
  }, {
    id: "fact-route",
    kind: "api-route",
    filePath: "routes/items.ts",
    line: 10,
    snippet: "app.get('/api/items', handler)",
    metadata: { method: "GET", path: "/api/items" },
  }];
  const index = buildRouteFactsIndex(routes, facts);
  const scoped = index.get("GET /api/items") ?? [];
  assertEquals(scoped.some((fact) => fact.id === "fact-import"), false);
  assertEquals(scoped.some((fact) => fact.id === "fact-route"), true);
});

Deno.test("buildRouteFactsIndex skips ambiguous shared related-file facts", () => {
  const routes: RouteScope[] = [{
    id: "GET /api/a",
    method: "GET",
    path: "/api/a",
    filePath: "routes/a.ts",
    line: 2,
    relatedFiles: ["routes/a.ts", "services/shared.ts"],
  }, {
    id: "GET /api/b",
    method: "GET",
    path: "/api/b",
    filePath: "routes/b.ts",
    line: 2,
    relatedFiles: ["routes/b.ts", "services/shared.ts"],
  }];
  const facts: CodeFact[] = [{
    id: "fact-shared",
    kind: "db-read",
    filePath: "services/shared.ts",
    line: 5,
    snippet: "await db.from('shared').select()",
    metadata: { table: "shared" },
  }];
  const index = buildRouteFactsIndex(routes, facts);
  assertEquals(
    index.get("GET /api/a")?.some((fact) => fact.id === "fact-shared"),
    false,
  );
  assertEquals(
    index.get("GET /api/b")?.some((fact) => fact.id === "fact-shared"),
    false,
  );
});

Deno.test("buildRouteFactsIndex attaches shared *.service.ts db facts to related routes", () => {
  const routes: RouteScope[] = [{
    id: "POST /api/leaves",
    method: "POST",
    path: "/api/leaves",
    filePath: "app/modules/leaves/leaves.routes.ts",
    line: 10,
    relatedFiles: [
      "app/modules/leaves/leaves.routes.ts",
      "app/modules/leaves/leaves.service.ts",
    ],
  }, {
    id: "GET /api/leaves/me",
    method: "GET",
    path: "/api/leaves/me",
    filePath: "app/modules/leaves/leaves.routes.ts",
    line: 4,
    relatedFiles: [
      "app/modules/leaves/leaves.routes.ts",
      "app/modules/leaves/leaves.service.ts",
    ],
  }];
  const facts: CodeFact[] = [{
    id: "fact-leave-write",
    kind: "db-write",
    filePath: "app/modules/leaves/leaves.service.ts",
    line: 40,
    snippet: "await this.prisma.leaveRequest.create({})",
    metadata: { table: "leaveRequest", framework: "prisma" },
  }];
  const index = buildRouteFactsIndex(routes, facts);
  assertEquals(
    index.get("POST /api/leaves")?.some((fact) =>
      fact.id === "fact-leave-write"
    ),
    true,
  );
  assertEquals(
    index.get("GET /api/leaves/me")?.some((fact) =>
      fact.id === "fact-leave-write"
    ),
    true,
  );
});

Deno.test("sanitizeFactMetadataForExport drops unknown metadata keys", () => {
  const facts = sanitizeFactsForExport([{
    id: "fact-meta",
    kind: "external-api-call",
    filePath: "routes/a.ts",
    line: 1,
    snippet: "fetch(url)",
    metadata: {
      "x-api-key": "super-secret-key-value",
      email: "user@example.com",
      method: "GET",
      path: "/api/x",
    },
  }]);
  assertEquals(facts[0].metadata["x-api-key"], undefined);
  assertEquals(facts[0].metadata.email, undefined);
  assertEquals(facts[0].metadata.method, "GET");
  assertEquals(facts[0].metadata.path, "/api/x");
});

Deno.test("buildRouteFactsIndex assigns trailing facts for single-route files", () => {
  const routes: RouteScope[] = [{
    id: "GET /api/items",
    method: "GET",
    path: "/api/items",
    filePath: "routes/items.ts",
    line: 10,
    relatedFiles: ["routes/items.ts"],
  }];
  const facts: CodeFact[] = [{
    id: "fact-tail",
    kind: "db-read",
    filePath: "routes/items.ts",
    line: 400,
    snippet: "await db.from('items').select()",
    metadata: { table: "items" },
  }];
  const index = buildRouteFactsIndex(routes, facts);
  assertEquals(
    index.get("GET /api/items")?.some((fact) => fact.id === "fact-tail"),
    true,
  );
});

Deno.test("buildRouteFactsIndex does not assign distant trailing facts on multi-route files", () => {
  const routes: RouteScope[] = [
    {
      id: "GET /api/a",
      method: "GET",
      path: "/api/a",
      filePath: "routes/items.ts",
      line: 10,
      relatedFiles: ["routes/items.ts"],
    },
    {
      id: "POST /api/b",
      method: "POST",
      path: "/api/b",
      filePath: "routes/items.ts",
      line: 20,
      relatedFiles: ["routes/items.ts"],
    },
  ];
  const facts: CodeFact[] = [{
    id: "fact-tail",
    kind: "db-read",
    filePath: "routes/items.ts",
    line: 400,
    snippet: "await db.from('items').select()",
    metadata: { table: "items" },
  }];
  const index = buildRouteFactsIndex(routes, facts);
  assertEquals(
    index.get("POST /api/b")?.some((fact) => fact.id === "fact-tail"),
    false,
  );
  assertEquals(
    index.get("GET /api/a")?.some((fact) => fact.id === "fact-tail"),
    false,
  );
});

Deno.test("sanitizeExportIdentifier redacts route literals embedded in fact ids", () => {
  const sanitized = sanitizeExportIdentifier(
    "fact-routes-ts-2-api-route-express-GET-/users/secret-token-path",
    120,
  );
  assertEquals(sanitized.includes("secret-token"), false);
  assertEquals(sanitized.includes("api-route-express-"), true);
});

Deno.test("sanitizeFactMetadataForExport keeps only primitive allowed values", () => {
  const metadata = sanitizeFactMetadataForExport({
    method: "GET",
    path: "/api/x",
    framework: "hono",
    nested: { secret: "x" },
    count: 3,
    enabled: true,
    token: "should-drop",
  });
  assertEquals(metadata.method, "GET");
  assertEquals(metadata.path, "/api/x");
  assertEquals(metadata.framework, "hono");
  assertEquals("count" in metadata, false);
  assertEquals("enabled" in metadata, false);
  assertEquals("nested" in metadata, false);
  assertEquals("token" in metadata, false);
});

Deno.test("sanitizeFactMetadataForExport keeps infra-service promotion keys (P3-2b)", () => {
  const metadata = sanitizeFactMetadataForExport({
    service: "PostgreSQL",
    source: "prisma-datasource",
    provider: "postgresql",
    framework: "prisma",
    image: "postgres:16-alpine",
    password: "secret",
  });
  assertEquals(metadata.service, "PostgreSQL");
  assertEquals(metadata.source, "prisma-datasource");
  assertEquals(metadata.provider, "postgresql");
  assertEquals(metadata.framework, "prisma");
  assertEquals("image" in metadata, false);
  assertEquals("password" in metadata, false);
});

Deno.test("sanitizeFactMetadataForExport keeps deploy-service keys (AUF-3)", () => {
  const metadata = sanitizeFactMetadataForExport({
    service: "api",
    source: "docker-compose",
    env: "prod",
    region: "eu-central-1",
    ports: "3000:3000",
    networks: "frontend,backend",
    dependsOn: "db,redis",
    password: "secret",
  });
  assertEquals(metadata.service, "api");
  assertEquals(metadata.env, "prod");
  assertEquals(metadata.region, "eu-central-1");
  assertEquals(metadata.ports, "3000:3000");
  assertEquals(metadata.networks, "frontend,backend");
  assertEquals(metadata.dependsOn, "db,redis");
  assertEquals("password" in metadata, false);
});
