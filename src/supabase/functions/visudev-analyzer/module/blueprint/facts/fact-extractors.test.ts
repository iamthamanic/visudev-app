import { assertEquals } from "std/assert";
import { extractFactsFromFile } from "./fact-extractors.ts";

Deno.test("extractFactsFromFile detects hono route and supabase write", () => {
  const content = `
app.post('/api/employees', async (c) => {
  const body = await c.req.json();
  const parsed = EmployeeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad' }, 400);
  await supabase.from('employees').insert(parsed.data);
});
`;
  const facts = extractFactsFromFile("routes/employees.ts", content);
  const kinds = facts.map((fact) => fact.kind);
  assertEquals(kinds.includes("api-route"), true);
  assertEquals(kinds.includes("request-body-read"), true);
  assertEquals(kinds.includes("schema-safe-parse"), true);
  assertEquals(kinds.includes("db-write"), true);
});

Deno.test("extractFactsFromFile classifies hono context routes in routes.ts files", () => {
  const content = `
app.post('/api/employees', async (c) => {
  await supabase.from('employees').insert({});
});
`;
  const facts = extractFactsFromFile("routes/employees.routes.ts", content);
  const route = facts.find((fact) => fact.kind === "api-route");
  assertEquals(route?.metadata?.framework, "hono");
});

Deno.test("extractFactsFromFile classifies plain express app routes in routes files", () => {
  const content = `app.get('/health', handler);`;
  const facts = extractFactsFromFile(
    "app/modules/leaves/leaves.routes.ts",
    content,
  );
  const route = facts.find((fact) => fact.kind === "api-route");
  assertEquals(route?.metadata?.framework, "express");
});

Deno.test("extractFactsFromFile keeps hono routes when routes file imports hono", () => {
  const content = `
import { Hono } from 'hono';
const app = new Hono();
app.post('/api/items', (c) => c.json({ ok: true }));
`;
  const facts = extractFactsFromFile("routes/items.routes.ts", content);
  const route = facts.find((fact) => fact.kind === "api-route");
  assertEquals(route?.metadata?.framework, "hono");
});

Deno.test("extractFactsFromFile detects express router routes", () => {
  const content = `
export function createLeavesRoutes() {
  const router = Router();
  router.get('/me', handler);
  router.post('/', authorize('hr.calendar.leave.request'), handler);
  app.get('/health', handler);
  return router;
}
`;
  const facts = extractFactsFromFile(
    "app/modules/leaves/leaves.routes.ts",
    content,
  );
  const routes = facts.filter((fact) => fact.kind === "api-route");
  assertEquals(routes.length, 3);
  assertEquals(
    routes.some((r) =>
      r.metadata?.framework === "express" && r.metadata?.path === "/me"
    ),
    true,
  );
  assertEquals(
    routes.some((r) =>
      r.metadata?.framework === "express" &&
      r.metadata?.method === "GET" &&
      r.metadata?.path === "/health"
    ),
    true,
  );
  assertEquals(routes.some((r) => r.metadata?.method === "POST"), true);
});

Deno.test("extractFactsFromFile detects Prisma models in schema.prisma", () => {
  const content = `
generator client {
  provider = "prisma-client-js"
}
model Survey {
  id String @id
}
model Webhook {
  id String @id
}
`;
  const facts = extractFactsFromFile(
    "packages/database/schema.prisma",
    content,
  );
  const tables = facts.filter((f) => f.kind === "db-write").map((f) =>
    f.metadata?.table
  );
  assertEquals(tables.includes("Survey"), true);
  assertEquals(tables.includes("Webhook"), true);
  assertEquals(facts.every((f) => f.metadata?.framework === "prisma"), true);
});

Deno.test("extractFactsFromFile detects prisma this.prisma client calls", () => {
  const content =
    `const leaveRequest = await this.prisma.leaveRequest.create({ data });`;
  const facts = extractFactsFromFile(
    "app/modules/leaves/leaves.service.ts",
    content,
  );
  const write = facts.find((f) => f.kind === "db-write");
  assertEquals(write?.metadata?.table, "leaveRequest");
  assertEquals(write?.metadata?.framework, "prisma");
});

Deno.test("extractFactsFromFile detects multiline express router paths", () => {
  const content = `
export function createLeavesRoutes() {
  const router = Router();
  router.get(
    '/escalation-approvers',
    authorize('hr.admin.approvals.read'),
    handler,
  );
  return router;
}
`;
  const facts = extractFactsFromFile(
    "app/modules/leaves/leaves.routes.ts",
    content,
  );
  const routes = facts.filter((fact) => fact.kind === "api-route");
  assertEquals(routes.length, 1);
  assertEquals(routes[0]?.metadata?.path, "/escalation-approvers");
  assertEquals(routes[0]?.metadata?.method, "GET");
});

Deno.test("extractFactsFromFile detects express app.use mount prefixes", () => {
  const content = `
import { Router } from 'express';
const router = createLeavesRoutes();
app.use('/api/leaves', router);
`;
  const facts = extractFactsFromFile(
    "app/modules/leaves/index.ts",
    content,
  );
  const mount = facts.find((f) => f.kind === "route-mount");
  assertEquals(mount?.metadata?.path, "/api/leaves");
});

Deno.test("extractFactsFromFile detects Django urlpatterns and permissions", () => {
  const content = `
from rest_framework.permissions import IsAuthenticated
from django.urls import path, re_path

urlpatterns = [
    path("api/workspaces/", WorkspaceView.as_view()),
    path("api/projects/", ProjectViewSet.as_view({"get": "list"})),
    re_path(r"^api/issues/(?P<pk>[^/.]+)/$", IssueView.as_view()),
]

class WorkspaceView(APIView):
    permission_classes = [IsAuthenticated]
`;
  const facts = extractFactsFromFile("apps/api/plane/urls.py", content);
  const routes = facts.filter((f) => f.kind === "api-route");
  assertEquals(routes.length >= 3, true);
  assertEquals(
    routes.some((r) => r.metadata?.framework === "django"),
    true,
  );
  assertEquals(
    routes.some((r) => String(r.metadata?.path).includes(":pk")),
    true,
  );
  assertEquals(facts.some((f) => f.kind === "auth-check"), true);
});

Deno.test("extractFactsFromFile detects Meteor.methods as METHOD api-routes", () => {
  const content = `
import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

Meteor.methods<ServerMethods>({
	async setRealName(name) {
		check(name, String);
		const userId = Meteor.userId();
		if (!userId) {
			throw new Meteor.Error('error-invalid-user');
		}
		return name;
	},
	deleteUser(userId) {
		return true;
	},
});
`;
  const facts = extractFactsFromFile(
    "apps/meteor/server/meteor-methods/users/setRealName.ts",
    content,
  );
  const routes = facts.filter((f) => f.kind === "api-route");
  assertEquals(routes.length, 2);
  assertEquals(
    routes.every((r) => r.metadata?.framework === "meteor"),
    true,
  );
  assertEquals(
    routes.some((r) =>
      r.metadata?.method === "METHOD" &&
      r.metadata?.path === "/meteor/setRealName"
    ),
    true,
  );
  assertEquals(
    routes.some((r) => r.metadata?.path === "/meteor/deleteUser"),
    true,
  );
  // Nested check() must not become a method unit
  assertEquals(
    routes.some((r) => String(r.metadata?.path).includes("check")),
    false,
  );
});

Deno.test("extractFactsFromFile detects Meteor.publish and Mongo registerModel", () => {
  const pubContent = `
Meteor.publish('spotlight', function () {
  return this.ready();
});
`;
  const pubFacts = extractFactsFromFile(
    "apps/meteor/server/publications/spotlight.ts",
    pubContent,
  );
  const pub = pubFacts.find((f) => f.kind === "api-route");
  assertEquals(pub?.metadata?.method, "PUBLISH");
  assertEquals(pub?.metadata?.path, "/meteor/publish/spotlight");
  assertEquals(pub?.metadata?.framework, "meteor");

  const modelContent = `
registerModel('IMessagesModel', new MessagesRaw(db));
registerModel('IRoomsModel', new RoomsRaw(db));
const legacy = new Mongo.Collection('rocketchat_roles');
`;
  const modelFacts = extractFactsFromFile(
    "apps/meteor/server/models.ts",
    modelContent,
  );
  const tables = modelFacts
    .filter((f) => f.kind === "db-write")
    .map((f) => f.metadata?.table);
  assertEquals(tables.includes("Messages"), true);
  assertEquals(tables.includes("Rooms"), true);
  assertEquals(tables.includes("rocketchat_roles"), true);
  assertEquals(
    modelFacts
      .filter((f) => f.kind === "db-write")
      .every((f) => f.metadata?.framework === "mongodb"),
    true,
  );
  // No invented RLS / PG policy facts
  assertEquals(modelFacts.some((f) => f.kind === "rls-policy"), false);
});

Deno.test("extractFactsFromFile emits prisma datasource PostgreSQL infra (P3-2)", () => {
  const content = `
generator client {
  provider = "prisma-client-js"
}
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
model User {
  id String @id
}
`;
  const facts = extractFactsFromFile("backend/prisma/schema.prisma", content);
  const infra = facts.filter((f) => f.kind === "infra-service");
  assertEquals(infra.length, 1);
  assertEquals(infra[0]?.metadata?.service, "PostgreSQL");
  assertEquals(infra[0]?.metadata?.source, "prisma-datasource");
  assertEquals(facts.some((f) => f.metadata?.table === "User"), true);
});

Deno.test("extractFactsFromFile emits compose Postgres+Redis infra (P3-2)", () => {
  const content = `
services:
  db:
    image: postgres:16-alpine
  redis:
    image: redis:7-alpine
  api:
    image: node:20-alpine
`;
  const facts = extractFactsFromFile("docker-compose.yml", content);
  const engines = facts
    .filter((f) => f.kind === "infra-service")
    .map((f) => f.metadata?.service)
    .sort();
  assertEquals(engines, ["PostgreSQL", "Redis"]);
  const deploy = facts
    .filter((f) => f.kind === "deploy-service")
    .map((f) => f.metadata?.service)
    .sort();
  assertEquals(deploy, ["api", "db", "redis"]);
  const api = facts.find((f) =>
    f.kind === "deploy-service" && f.metadata?.service === "api"
  );
  assertEquals(api?.metadata?.source, "docker-compose");
});

Deno.test("extractFactsFromFile maps plane valkey image to Redis (P3-2)", () => {
  const content = `
services:
  plane-redis:
    image: valkey/valkey:7.2.11-alpine
`;
  const facts = extractFactsFromFile("docker-compose.yml", content);
  assertEquals(facts[0]?.metadata?.service, "Redis");
});

Deno.test("extractFactsFromFile emits k8s deploy-service facts (AUF-3)", () => {
  const content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: prod
spec:
  template:
    spec:
      containers:
        - ports:
            - containerPort: 8080
`;
  const facts = extractFactsFromFile("k8s/web-deployment.yaml", content);
  assertEquals(facts.length, 1);
  assertEquals(facts[0]?.kind, "deploy-service");
  assertEquals(facts[0]?.metadata?.service, "web");
  assertEquals(facts[0]?.metadata?.env, "prod");
  assertEquals(facts[0]?.metadata?.ports, "8080");
  assertEquals(facts[0]?.metadata?.source, "kubernetes");
});

Deno.test("extractFactsFromFile invents no infra without compose/datasource evidence", () => {
  const facts = extractFactsFromFile("README.md", "hello postgres redis");
  assertEquals(facts.some((f) => f.kind === "infra-service"), false);
  assertEquals(facts.some((f) => f.kind === "deploy-service"), false);
});
