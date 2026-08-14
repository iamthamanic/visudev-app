import { assertEquals } from "std/assert";
import {
  analyzeFromFileEntries,
  isSupportedBlueprintFile,
} from "./blueprint-pipeline.service.ts";

Deno.test("analyzeFromFileEntries builds routes from hono handler", () => {
  const content = `
app.post('/api/employees', async (c) => {
  const body = await c.req.json();
  const parsed = EmployeeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad' }, 400);
  await supabase.from('employees').insert(parsed.data);
});
`;
  const doc = analyzeFromFileEntries({
    repo: "local:/tmp/test",
    branch: "local",
    commitSha: "local",
    fileEntries: [{ path: "routes/employees.ts", content }],
  });

  assertEquals(doc.routes.length >= 1, true);
  assertEquals(doc.filesAnalyzed, 1);
  assertEquals(doc.version, 1);
});

Deno.test("isSupportedBlueprintFile accepts compose yaml (P3-2c)", () => {
  assertEquals(isSupportedBlueprintFile("docker-compose.yml"), true);
  assertEquals(isSupportedBlueprintFile("compose.yaml"), true);
  assertEquals(isSupportedBlueprintFile("k8s/deployment.yaml"), true);
  assertEquals(isSupportedBlueprintFile(".github/workflows/ci.yml"), false);
  assertEquals(isSupportedBlueprintFile("README.md"), false);
});

Deno.test("analyzeFromFileEntries extracts Redis/Postgres from docker-compose.yml (P3-2c)", () => {
  const content = `
services:
  db:
    image: postgres:16-alpine
  redis:
    image: redis:7-alpine
`;
  const doc = analyzeFromFileEntries({
    repo: "local:/tmp/test",
    branch: "local",
    commitSha: "local",
    fileEntries: [{ path: "docker-compose.yml", content }],
  });
  const services = doc.facts
    .filter((f) => f.kind === "infra-service")
    .map((f) => f.metadata?.service)
    .sort();
  assertEquals(services, ["PostgreSQL", "Redis"]);
  assertEquals(doc.filesAnalyzed, 1);
});
